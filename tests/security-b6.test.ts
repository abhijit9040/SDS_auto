import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import express, { Request } from 'express';
import { server, wsHub } from '../src/server/index.js';
import { dbService } from '../src/server/db/index.js';
import { createRingWebhookRouter } from '../src/server/routes/ring-webhook.js';

describe('Task B6: Comprehensive Security Verification Suite', () => {
  let mainTestPort: number;
  let mainTestServer: http.Server;
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
    dbService.initialize(':memory:');
    await new Promise<void>((resolve) => {
      mainTestServer = server.listen(0, '127.0.0.1', () => {
        const addr = mainTestServer.address() as AddressInfo;
        mainTestPort = addr.port;
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
      mainTestServer.close(() => resolve());
    });
  });

  // 1. Forged webhook with the old default secret is rejected
  it('rejects a forged webhook signed with the old default hardcoded secret', async () => {
    const activeSecureSecret = crypto.randomBytes(32).toString('hex');
    const oldHardcodedSecret = 'test-ring-webhook-secret-replace-in-production';

    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as Request & { rawBody?: Buffer }).rawBody = buf;
        },
      })
    );
    app.use(
      '/webhooks/ring',
      createRingWebhookRouter({
        secret: activeSecureSecret,
        onValidEvent: () => {},
      })
    );

    const testWebhookServer = http.createServer(app);
    await new Promise<void>((res) => testWebhookServer.listen(0, '127.0.0.1', () => res()));
    const port = (testWebhookServer.address() as AddressInfo).port;

    const payload = {
      meta: { version: '1.0', time: Date.now(), request_id: 'forged-old-secret' },
      data: { id: 'evt-forged', type: 'button_press', attributes: { timestamp: Date.now() } },
    };
    const bodyStr = JSON.stringify(payload);
    // Attacker signs using the leaked/old default secret
    const forgedHmac = crypto
      .createHmac('sha256', oldHardcodedSecret)
      .update(bodyStr)
      .digest('hex');

    const res = await fetch(`http://127.0.0.1:${port}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${forgedHmac}`,
      },
      body: bodyStr,
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/HMAC mismatch/i);
    testWebhookServer.close();
  });

  // 2. Trigger without header is rejected even from localhost
  it('rejects trigger request without X-Internal-Secret header even from localhost (127.0.0.1)', async () => {
    const res = await fetch(`http://127.0.0.1:${mainTestPort}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenario: 'delivery' }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/protected|forbidden/i);
  });

  // 3. Reply from a visitor-role client rejected
  it('rejects QUICK_REPLY from a visitor-role client with ERROR response', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${mainTestPort}/ws`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    activeSockets.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', role: 'visitor' }));
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'SUBSCRIBED') resolve();
      });
    });

    const errorPromise = new Promise<{ type: string; status: string; message: string }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for ERROR')), 2000);
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ERROR') {
            clearTimeout(timer);
            resolve(msg);
          }
        });
      }
    );

    wsHub.registerEventId('evt-b6-visitor-role');
    ws.send(
      JSON.stringify({
        type: 'QUICK_REPLY',
        payload: {
          eventId: 'evt-b6-visitor-role',
          reply: 'Leave it at the door',
        },
      })
    );

    const errorMsg = await errorPromise;
    expect(errorMsg.type).toBe('ERROR');
    expect(errorMsg.status).toBe('REJECTED');
    expect(errorMsg.message).toMatch(/resident/i);
    ws.close();
  });

  // 4. Reply with an unknown eventId rejected
  it('rejects QUICK_REPLY with an unknown eventId not registered by server', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${mainTestPort}/ws`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    activeSockets.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', role: 'resident' }));
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'SUBSCRIBED') resolve();
      });
    });

    const errorPromise = new Promise<{ type: string; status: string; message: string }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for ERROR')), 2000);
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ERROR') {
            clearTimeout(timer);
            resolve(msg);
          }
        });
      }
    );

    ws.send(
      JSON.stringify({
        type: 'QUICK_REPLY',
        payload: {
          eventId: 'unregistered-b6-unknown-event',
          reply: 'Leave it at the door',
        },
      })
    );

    const errorMsg = await errorPromise;
    expect(errorMsg.type).toBe('ERROR');
    expect(errorMsg.status).toBe('REJECTED');
    expect(errorMsg.message).toMatch(/eventId|event/i);
    ws.close();
  });

  // 5. Oversized WS message rejected
  it('rejects oversized WebSocket message exceeding 4096 bytes (4 KB limit)', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${mainTestPort}/ws`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    activeSockets.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    const closeOrErrorPromise = new Promise<{ closed: boolean; code?: number }>((resolve) => {
      ws.on('close', (code) => resolve({ closed: true, code }));
      ws.on('error', () => resolve({ closed: true, code: 1009 }));
    });

    // Send payload > 4096 bytes
    const oversizedPayload = JSON.stringify({
      type: 'SUBSCRIBE',
      role: 'resident',
      extraData: 'X'.repeat(5000),
    });
    ws.send(oversizedPayload);

    const result = await closeOrErrorPromise;
    expect(result.closed).toBe(true);
    if (result.code) {
      expect([1009, 1006]).toContain(result.code);
    }
  });

  // 6. Disallowed Origin rejected
  it('rejects WebSocket handshake from unauthorized Origin with HTTP 403', async () => {
    const connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${mainTestPort}/ws`, {
        headers: { Origin: 'http://malicious-unauthorized-site.com' },
      });
      activeSockets.push(ws);
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
    });

    await expect(connectPromise).rejects.toThrow();
  });
});
