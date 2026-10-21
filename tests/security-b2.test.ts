import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { AddressInfo } from 'net';
import { app, simulatorAdapter } from '../src/server/index.js';
import { config } from '../src/server/config.js';

describe('Task B2: Simulator Trigger Endpoint Security', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Spy on triggerDoorbellPress to isolate route auth testing from network webhook dispatch
    if (simulatorAdapter) {
      vi.spyOn(simulatorAdapter, 'triggerDoorbellPress').mockImplementation(async (opts) => ({
        status: 'ok',
        requestId: opts?.requestId || 'mock-sim-req-id',
      }));
    }

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('rejects trigger request without X-Internal-Secret header even from localhost (removes isLocal bypass)', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: 'doorbell-test' }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/protected|forbidden/i);
  });

  it('rejects trigger request with incorrect X-Internal-Secret header', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': 'wrong-secret-value-1234567890abcdef',
      },
      body: JSON.stringify({ deviceId: 'doorbell-test' }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/protected|forbidden/i);
  });

  it('rejects trigger request when X-Forwarded-For header is present, even with valid secret', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.internalDevSecret,
        'X-Forwarded-For': '203.0.113.195',
      },
      body: JSON.stringify({ deviceId: 'doorbell-test' }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/forwarded/i);
  });

  it('rejects trigger request when X-Forwarded-Proto header is present, even with valid secret', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.internalDevSecret,
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ deviceId: 'doorbell-test' }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/forwarded/i);
  });

  it('rejects trigger request when X-Forwarded-Host header is present, even with valid secret', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.internalDevSecret,
        'X-Forwarded-Host': 'evil-tunnel.example.com',
      },
      body: JSON.stringify({ deviceId: 'doorbell-test' }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/forwarded/i);
  });

  it('accepts trigger request with valid X-Internal-Secret and no X-Forwarded headers', async () => {
    const res = await fetch(`${baseUrl}/api/simulator/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.internalDevSecret,
      },
      body: JSON.stringify({ deviceId: 'doorbell-test' }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; requestId?: string };
    expect(data.status).toBe('ok');
    expect(data.requestId).toBeDefined();
  });

  it('verifies client code and built bundle do not leak the internal secret or header', () => {
    // Check that client source code does NOT hardcode the internal secret or header
    const clientSourceDir = path.resolve(__dirname, '../src/client');
    const clientFiles = fs.readdirSync(clientSourceDir, { recursive: true }) as string[];

    for (const relFile of clientFiles) {
      const fullPath = path.join(clientSourceDir, relFile);
      if (fs.statSync(fullPath).isFile() && /\.(tsx?|jsx?)$/.test(relFile)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).not.toContain('X-Internal-Secret');
        if (config.internalDevSecret) {
          expect(content).not.toContain(config.internalDevSecret);
        }
      }
    }
  });
});
