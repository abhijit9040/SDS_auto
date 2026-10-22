import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { server } from '../src/server/index.js';
import { dbService } from '../src/server/db/index.js';

// ─── B7: Tunnel-exposure guards ──────────────────────────────────────────────
// 1. WebSocket upgrade is rejected when any X-Forwarded-* header is present.
// 2. WebSocket upgrade requires an Origin header unless ALLOW_NO_ORIGIN=1.
// 3. All /api/* routes reject requests carrying any X-Forwarded-* header.
// 4. /webhooks/ring, /oauth/*, /ring/* are NOT affected by the /api/* guard.
// ─────────────────────────────────────────────────────────────────────────────

describe('Task B7: Tunnel-exposure header guards', () => {
  let testPort: number;
  let baseUrl: string;
  let testServer: http.Server;
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
    dbService.initialize(':memory:');
    await new Promise<void>((resolve) => {
      testServer = server.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as AddressInfo;
        testPort = addr.port;
        baseUrl = `http://127.0.0.1:${testPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  });

  // ── Helper: open a raw WebSocket with arbitrary headers ──────────────────
  function openWs(headers: Record<string, string>): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}/ws`, { headers });
      activeSockets.push(ws);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  // ── 1. WebSocket: X-Forwarded-* must reject the upgrade ──────────────────

  it('WS: rejects upgrade when X-Forwarded-For is present', async () => {
    await expect(
      openWs({ Origin: 'http://localhost:5173', 'X-Forwarded-For': '1.2.3.4' })
    ).rejects.toThrow();
  });

  it('WS: rejects upgrade when X-Forwarded-Proto is present', async () => {
    await expect(
      openWs({ Origin: 'http://localhost:5173', 'X-Forwarded-Proto': 'https' })
    ).rejects.toThrow();
  });

  it('WS: rejects upgrade when X-Forwarded-Host is present', async () => {
    await expect(
      openWs({ Origin: 'http://localhost:5173', 'X-Forwarded-Host': 'evil.example.com' })
    ).rejects.toThrow();
  });

  it('WS: allows upgrade with no forwarded headers and an allowed Origin', async () => {
    const ws = await openWs({ Origin: 'http://localhost:5173' });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // ── 2. WebSocket: Origin header required unless ALLOW_NO_ORIGIN=1 ─────────

  it('WS: rejects upgrade when no Origin header is sent and ALLOW_NO_ORIGIN is not set', async () => {
    // Temporarily clear the flag set by vitest.setup.ts so the guard triggers
    const saved = process.env.ALLOW_NO_ORIGIN;
    delete process.env.ALLOW_NO_ORIGIN;
    try {
      await expect(openWs({})).rejects.toThrow();
    } finally {
      if (saved !== undefined) process.env.ALLOW_NO_ORIGIN = saved;
    }
  });

  // ── 3. /api/* HTTP routes: X-Forwarded-* must return 403 ─────────────────

  it('GET /api/health returns 403 when X-Forwarded-For is present', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Forwarded-For': '1.2.3.4' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/forwarded|forbidden/i);
  });

  it('GET /api/health returns 403 when X-Forwarded-Proto is present', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Forwarded-Proto': 'https' },
    });
    expect(res.status).toBe(403);
  });

  it('GET /api/health returns 200 when no forwarded headers are present', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
  });

  it('POST /api/simulator/trigger returns 403 for X-Forwarded-For (caught by shared middleware)', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_DEV_SECRET ?? '',
        'X-Forwarded-For': '1.2.3.4',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/forwarded|forbidden/i);
  });

  // ── 4. Public endpoints: NOT blocked by the /api/* middleware ────────────

  it('POST /webhooks/ring with X-Forwarded-For reaches signature check (not 403)', async () => {
    // No valid HMAC → 400/401, but NOT 403 (the forwarded-header guard must not fire here)
    const res = await fetch(`${baseUrl}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '1.2.3.4',
      },
      body: JSON.stringify({ data: { id: 'x', type: 'button_press', attributes: {} } }),
    });
    expect(res.status).not.toBe(403);
  });
});
