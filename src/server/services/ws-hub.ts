import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import {
  WebSocketClientMessage,
  WebSocketServerMessage,
  AlertPayload,
  ALLOWED_QUICK_REPLIES,
} from '../../shared/types.js';
import { dbService } from '../db/index.js';

interface ClientConnection {
  ws: WebSocket;
  role: 'resident' | 'visitor';
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    for (const origin of envOrigins.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    }
  }
  return origins;
}

export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  private recentEventIds: Set<string> = new Set();
  private static readonly MAX_RECENT_EVENTS = 100;

  public registerEventId(eventId: string): void {
    if (!eventId) return;
    if (this.recentEventIds.size >= WebSocketHub.MAX_RECENT_EVENTS) {
      const oldest = this.recentEventIds.values().next().value;
      if (oldest) {
        this.recentEventIds.delete(oldest);
      }
    }
    this.recentEventIds.add(eventId);
  }

  public isRegisteredEventId(eventId: string): boolean {
    return this.recentEventIds.has(eventId);
  }

  public attach(server: http.Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 4096,
      verifyClient: (info, cb) => {
        const origin = info.origin;
        if (origin) {
          const allowed = getAllowedOrigins();
          if (!allowed.has(origin)) {
            cb(false, 403, 'Forbidden Origin');
            return;
          }
        }
        cb(true);
      },
    });

    this.wss.on('connection', (ws: WebSocket) => {
      let clientRef: ClientConnection | null = null;

      ws.on('message', (data: Buffer | string) => {
        let msg: WebSocketClientMessage;
        try {
          msg = JSON.parse(data.toString()) as WebSocketClientMessage;
        } catch {
          ws.close(1008, 'Invalid JSON payload');
          return;
        }

        if (msg.type === 'SUBSCRIBE') {
          if (clientRef) {
            clientRef.role = msg.role;
          } else {
            clientRef = { ws, role: msg.role };
            this.clients.add(clientRef);
          }
          ws.send(JSON.stringify({ type: 'SUBSCRIBED', role: msg.role }));
        } else if (msg.type === 'QUICK_REPLY') {
          // Require role check: only clients subscribed as "resident" can send QUICK_REPLY
          if (!clientRef || clientRef.role !== 'resident') {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                status: 'REJECTED',
                message: 'Only resident clients may send quick replies',
              })
            );
            return;
          }

          const { payload } = msg;

          // eventId verification: must match an event the server really received
          if (!payload || !payload.eventId || !this.isRegisteredEventId(payload.eventId)) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                status: 'REJECTED',
                message: 'Unknown or unverified eventId',
              })
            );
            return;
          }

          // Strict server-side whitelist validation (client input is untrusted)
          if (!ALLOWED_QUICK_REPLIES.includes(payload.reply)) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                status: 'REJECTED',
                message: 'Invalid quick reply: not on whitelist',
              })
            );
            return;
          }

          // Overwrite client-supplied timestamp: always use server-generated timestamp
          const serverTimestamp = new Date().toISOString();

          // 1. Log transaction in SQLite database tied to eventId
          try {
            dbService.insertReply(payload.eventId, payload.reply, serverTimestamp);
          } catch (dbErr) {
            console.error('[WebSocketHub] Failed to log reply in SQLite:', dbErr);
          }

          // 2. Broadcast reply to all visitor screens
          this.broadcastToVisitors({
            type: 'VISITOR_REPLY_DISPLAY',
            payload: {
              reply: payload.reply,
              timestamp: serverTimestamp,
            },
          });

          // 3. Send REPLY_ACK back to resident client
          ws.send(
            JSON.stringify({
              type: 'REPLY_ACK',
              payload: {
                eventId: payload.eventId,
                status: 'DELIVERED',
              },
            })
          );
        }
      });

      ws.on('close', () => {
        if (clientRef) {
          this.clients.delete(clientRef);
        }
      });

      ws.on('error', () => {
        if (clientRef) {
          this.clients.delete(clientRef);
        }
      });
    });
  }

  public broadcastToResidents(msg: WebSocketServerMessage): void {
    const raw = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.role === 'resident' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  public broadcastToVisitors(msg: WebSocketServerMessage): void {
    const raw = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.role === 'visitor' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  public broadcastPhase1Alert(payload: AlertPayload): void {
    // Record event ID as received by server
    this.registerEventId(payload.eventId);

    // Broadcast to residents for immediate alert
    this.broadcastToResidents({
      type: 'ALERT_PHASE_1',
      payload,
    });
    // Also notify visitor clients to reset any prior displayed reply
    this.broadcastToVisitors({
      type: 'ALERT_PHASE_1',
      payload,
    });
  }

  public close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    this.recentEventIds.clear();
  }
}
