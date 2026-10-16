import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import {
  WebSocketClientMessage,
  WebSocketServerMessage,
  AlertPayload,
} from '../../shared/types.js';

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
    this.broadcastToResidents({
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
