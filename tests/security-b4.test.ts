import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import express, { Request } from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { createRingWebhookRouter } from '../src/server/routes/ring-webhook.js';
import { RingWebhookPayload } from '../src/shared/types.js';

describe('Task B4: Webhook Raw Body & Event Age Verification', () => {
  const secret = 'test-webhook-secret-32-chars-long!';

  function createTestApp(options?: { maxAgeSeconds?: number; omitRawBody?: boolean }) {
    const app = express();
    if (!options?.omitRawBody) {
      app.use(
        express.json({
          verify: (req, _res, buf) => {
            (req as Request & { rawBody?: Buffer }).rawBody = buf;
          },
        })
      );
    } else {
      // Standard json parser without rawBody capture
      app.use(express.json());
    }

    const received: RingWebhookPayload[] = [];
    app.use(
      '/webhooks/ring',
      createRingWebhookRouter({
        secret,
        maxAgeSeconds: options?.maxAgeSeconds,
        onValidEvent: (payload) => {
          received.push(payload);
        },
      })
    );
    return { app, received };
  }

  it('rejects webhook with 400 when rawBody buffer is missing', async () => {
    const { app } = createTestApp({ omitRawBody: true });
    const server = http.createServer(app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as AddressInfo).port;

    const payload = {
      meta: { version: '1.0', time: Date.now(), request_id: 'req-raw-test' },
      data: { id: 'evt-raw', type: 'button_press', attributes: { timestamp: Date.now() } },
    };
    const bodyStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const res = await fetch(`http://127.0.0.1:${port}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${hmac}`,
      },
      body: bodyStr,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/raw.*body/i);
    server.close();
  });

  it('accepts fresh event with simulator-style epoch time', async () => {
    const { app } = createTestApp();
    const server = http.createServer(app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as AddressInfo).port;

    const payload = {
      meta: { version: '1.0', time: Date.now(), request_id: 'req-fresh-epoch' },
      data: { id: 'evt-fresh-epoch', type: 'button_press', attributes: { timestamp: Date.now() } },
    };
    const bodyStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const res = await fetch(`http://127.0.0.1:${port}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${hmac}`,
      },
      body: bodyStr,
    });

    expect(res.status).toBe(200);
    server.close();
  });

  it('accepts fresh event with ring-sandbox-style ISO timestamp', async () => {
    const { app } = createTestApp();
    const server = http.createServer(app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as AddressInfo).port;

    const payload = {
      meta: { version: '1.1', time: new Date().toISOString(), request_id: 'req-fresh-iso' },
      data: { id: 'evt-fresh-iso', type: 'button_press', attributes: { timestamp: Date.now() } },
    };
    const bodyStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const res = await fetch(`http://127.0.0.1:${port}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${hmac}`,
      },
      body: bodyStr,
    });

    expect(res.status).toBe(200);
    server.close();
  });

  it('rejects stale webhook event exceeding default max age (300 seconds)', async () => {
    const { app } = createTestApp();
    const server = http.createServer(app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as AddressInfo).port;

    // 400 seconds ago
    const staleTime = new Date(Date.now() - 400 * 1000).toISOString();
    const payload = {
      meta: { version: '1.1', time: staleTime, request_id: 'req-stale' },
      data: { id: 'evt-stale', type: 'button_press', attributes: { timestamp: Date.now() } },
    };
    const bodyStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const res = await fetch(`http://127.0.0.1:${port}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${hmac}`,
      },
      body: bodyStr,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/stale|expired|age/i);
    server.close();
  });

  it('respects WEBHOOK_MAX_AGE_SECONDS environment variable or options override', async () => {
    const { app } = createTestApp({ maxAgeSeconds: 10 });
    const server = http.createServer(app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as AddressInfo).port;

    // 15 seconds ago (stale for 10s max age)
    const staleTime = Date.now() - 15 * 1000;
    const payload = {
      meta: { version: '1.0', time: staleTime, request_id: 'req-custom-stale' },
      data: { id: 'evt-custom-stale', type: 'button_press', attributes: { timestamp: Date.now() } },
    };
    const bodyStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const res = await fetch(`http://127.0.0.1:${port}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${hmac}`,
      },
      body: bodyStr,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/stale|expired|age/i);
    server.close();
  });
});
