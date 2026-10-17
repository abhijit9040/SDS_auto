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

export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();

  public attach(server: http.Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      let clientRef: ClientConnection | null = null;

      ws.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as WebSocketClientMessage;
          if (msg.type === 'SUBSCRIBE') {
            if (clientRef) {
              clientRef.role = msg.role;
            } else {
              clientRef = { ws, role: msg.role };
              this.clients.add(clientRef);
            }
            ws.send(JSON.stringify({ type: 'SUBSCRIBED', role: msg.role }));
          } else if (msg.type === 'QUICK_REPLY') {
            const { payload } = msg;

            // Strict server-side whitelist validation (client input is untrusted)
            if (!payload || !ALLOWED_QUICK_REPLIES.includes(payload.reply)) {
              ws.send(
                JSON.stringify({
                  type: 'ERROR',
                  status: 'REJECTED',
                  message: 'Invalid quick reply: not on whitelist',
                })
              );
              return;
            }

            // 1. Log transaction in SQLite database tied to eventId
            try {
              dbService.insertReply(
                payload.eventId,
                payload.reply,
                payload.timestamp || new Date().toISOString()
              );
            } catch (dbErr) {
              console.error('[WebSocketHub] Failed to log reply in SQLite:', dbErr);
            }

            // 2. Broadcast reply to all visitor screens
            this.broadcastToVisitors({
              type: 'VISITOR_REPLY_DISPLAY',
              payload: {
                reply: payload.reply,
                timestamp: payload.timestamp || new Date().toISOString(),
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
        } catch {
          // Ignore malformed client message
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
  }
}
