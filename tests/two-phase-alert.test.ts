import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import { server } from '../src/server/index.js';
import { config } from '../src/server/config.js';
import { RingWebhookPayload, WebSocketServerMessage } from '../src/shared/types.js';
import { SimulatorAdapter } from '../src/server/adapters/ring-simulator-adapter.js';

describe('Task 1: Walking Skeleton (HMAC Webhook to Phase 1 Alert End-to-End)', () => {
  let testPort: number;
  let testServer: http.Server;

  beforeAll(async () => {
    testPort = 3101;
    await new Promise<void>((resolve) => {
      testServer = server.listen(testPort, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function generateSignature(secret: string, bodyString: string): string {
    const hmac = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    return `sha256=${hmac}`;
  }

  it('rejects webhooks with missing signature header with 401', async () => {
    const payload: RingWebhookPayload = {
      meta: {
        version: '1.0',
        time: Date.now(),
        account_id: 'test-account-123',
        request_id: 'req-missing-sig-01',
      },
      data: {
        id: 'evt-001',
        type: 'button_press',
        attributes: {
          source: 'doorbell-front',
          timestamp: Date.now(),
        },
      },
    };

    const res = await fetch(`http://localhost:${testPort}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Missing signature/i);
  });

  it('rejects webhooks with invalid HMAC signature with 401', async () => {
    const payload: RingWebhookPayload = {
      meta: {
        version: '1.0',
        time: Date.now(),
        account_id: 'test-account-123',
        request_id: 'req-invalid-sig-02',
      },
      data: {
        id: 'evt-002',
        type: 'button_press',
        attributes: {
          source: 'doorbell-front',
          timestamp: Date.now(),
        },
      },
    };

    const res = await fetch(`http://localhost:${testPort}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': 'sha256=invalid0000000000000000000000000000000000000000000000000000000000',
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid signature/i);
  });

  it('accepts valid HMAC signature, returns 200 immediately, and dedupes repeated request_id', async () => {
    const payload: RingWebhookPayload = {
      meta: {
        version: '1.0',
        time: Date.now(),
        account_id: 'test-account-123',
        request_id: 'req-dedupe-test-03',
      },
      data: {
        id: 'evt-003',
        type: 'button_press',
        attributes: {
          source: 'doorbell-front',
          timestamp: Date.now(),
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = generateSignature(config.ringWebhookSecret, rawBody);

    // First delivery -> 200 OK received
    const res1 = await fetch(`http://localhost:${testPort}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: rawBody,
    });

    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.status).toBe('received');
    expect(body1.requestId).toBe('req-dedupe-test-03');

    // Duplicate delivery with same request_id -> 200 OK ignored_duplicate
    const res2 = await fetch(`http://localhost:${testPort}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: rawBody,
    });

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.status).toBe('ignored_duplicate');
  });

  it('delivers Phase 1 visual alert to WebSocket client within 2.0s when SimulatorAdapter fires', async () => {
    // Connect a test WebSocket client subscribed as resident
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', role: 'resident' }));
        resolve();
      });
      ws.on('error', reject);
    });

    const startTime = Date.now();
    const alertPromise = new Promise<WebSocketServerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Phase 1 alert timed out (>2s)')), 2000);
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WebSocketServerMessage;
          if (msg.type === 'ALERT_PHASE_1') {
            clearTimeout(timeout);
            resolve(msg);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    // Fire event via SimulatorAdapter
    const simulator = new SimulatorAdapter(
      `http://localhost:${testPort}`,
      config.ringWebhookSecret
    );
    const triggerRes = await simulator.triggerDoorbellPress({
      deviceId: 'front-doorbell-01',
      requestId: 'sim-req-' + Date.now(),
    });

    expect(triggerRes.status).toBe('received');

    // Verify WebSocket receives Phase 1 alert
    const receivedAlert = await alertPromise;
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(2000);
    expect(receivedAlert.type).toBe('ALERT_PHASE_1');
    if (receivedAlert.type === 'ALERT_PHASE_1') {
      expect(receivedAlert.payload.body).toBe('Someone is at your door');
      expect(receivedAlert.payload.phase).toBe('PHASE_1_IMMEDIATE');
      expect(receivedAlert.payload.timeoutFallback).toBe(false);
    }

    ws.close();
  });
});
