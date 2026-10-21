import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import { server, wsHub } from '../src/server/index.js';
import { dbService } from '../src/server/db/index.js';

describe('Task B3: WebSocket Security & Verification', () => {
  let testPort: number;
  let testServer: http.Server;
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
    dbService.initialize(':memory:');
    await new Promise<void>((resolve) => {
      testServer = server.listen(0, '127.0.0.1', () => {
        const addr = testServer.address();
        testPort = typeof addr === 'object' && addr ? addr.port : 3106;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    await new Promise<void>((resolve) => {
      testServer.close(() => resolve());
    });
  });

  function createSocket(origin?: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (origin) {
        headers['Origin'] = origin;
      }
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/ws`, { headers });
      activeSockets.push(ws);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  async function connectAndSubscribe(role: 'resident' | 'visitor'): Promise<WebSocket> {
    const ws = await createSocket('http://localhost:5173');
    await new Promise<void>((resolve) => {
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', role }));
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SUBSCRIBED') {
            resolve();
          }
        } catch {
          // ignore
        }
      });
    });
    return ws;
  }

  it('rejects WebSocket connection from a disallowed Origin', async () => {
    await expect(createSocket('http://evil-attacker.com')).rejects.toThrow();
  });

  it('accepts WebSocket connection from an allowed Origin', async () => {
    const ws = await createSocket('http://localhost:5173');
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('closes WebSocket connection when non-JSON payload is received', async () => {
    const ws = await createSocket('http://localhost:5173');
    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
    });

    ws.send('THIS_IS_NOT_VALID_JSON{malformed');
    const closeInfo = await closePromise;
    expect([1008, 1003, 1002]).toContain(closeInfo.code);
  });

  it('rejects QUICK_REPLY from a client subscribed as "visitor" with an ERROR response', async () => {
    const visitorWs = await connectAndSubscribe('visitor');
    const errorPromise = new Promise<{ type: string; message: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for ERROR')), 2000);
      visitorWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ERROR') {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });

    wsHub.registerEventId('evt-valid-registered-1');
    visitorWs.send(
      JSON.stringify({
        type: 'QUICK_REPLY',
        payload: {
          eventId: 'evt-valid-registered-1',
          reply: 'Leave it at the door',
        },
      })
    );

    const res = await errorPromise;
    expect(res.type).toBe('ERROR');
    expect(res.message).toMatch(/resident/i);
    visitorWs.close();
  });

  it('rejects QUICK_REPLY with an unknown eventId not received by server', async () => {
    const residentWs = await connectAndSubscribe('resident');
    const errorPromise = new Promise<{ type: string; message: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for ERROR')), 2000);
      residentWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ERROR') {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });

    residentWs.send(
      JSON.stringify({
        type: 'QUICK_REPLY',
        payload: {
          eventId: 'unregistered-fake-event-id-999',
          reply: 'Leave it at the door',
        },
      })
    );

    const res = await errorPromise;
    expect(res.type).toBe('ERROR');
    expect(res.message).toMatch(/eventId|event/i);
    residentWs.close();
  });

  it('accepts QUICK_REPLY for registered eventId and overrides timestamp with server-side timestamp', async () => {
    const residentWs = await connectAndSubscribe('resident');
    const testEventId = 'evt-registered-success-' + Date.now();
    wsHub.registerEventId(testEventId);

    const ackPromise = new Promise<{ type: string; payload: { eventId: string; status: string } }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for REPLY_ACK')), 2000);
        residentWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'REPLY_ACK') {
            clearTimeout(timer);
            resolve(msg);
          }
        });
      }
    );

    const spoofedOldTimestamp = '2020-01-01T00:00:00.000Z';
    residentWs.send(
      JSON.stringify({
        type: 'QUICK_REPLY',
        payload: {
          eventId: testEventId,
          reply: 'Coming in 2 minutes',
          timestamp: spoofedOldTimestamp,
        },
      })
    );

    const ack = await ackPromise;
    expect(ack.type).toBe('REPLY_ACK');
    expect(ack.payload.eventId).toBe(testEventId);

    // Verify database record has current server timestamp, NOT spoofed timestamp
    const dbRows = dbService.getRepliesByEventId(testEventId);
    expect(dbRows.length).toBe(1);
    expect(dbRows[0].timestamp).not.toBe(spoofedOldTimestamp);
    expect(new Date(dbRows[0].timestamp).getFullYear()).toBeGreaterThanOrEqual(2026);

    residentWs.close();
  });
});
