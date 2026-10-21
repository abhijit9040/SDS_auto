// MOCKED TESTS ONLY: All Ring API responses are synthetic mocks and not live-tested against Ring servers.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import express, { Request } from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import {
  RingRestClient,
  RingAuthError,
  RingForbiddenError,
  RingNotFoundError,
  RingRateLimitError,
  RingTimeoutError,
  RingApiError,
} from '../src/server/services/ring-rest-client.js';
import { RingApiAdapter } from '../src/server/adapters/ring-api-adapter.js';
import { createRingWebhookRouter } from '../src/server/routes/ring-webhook.js';
import { RingWebhookPayload } from '../src/shared/types.js';

describe('Task 5-lite: Ring Partner REST Client & Ring Sandbox Compatibility', () => {
  const MOCK_TOKEN = 'mock-ava-bearer-token-secret-xyz';
  const MOCK_BASE_URL = 'https://api.amazonvision.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Device Discovery & Listing (JSON:API)
  // ==========================================================================
  describe('1. Device Discovery & JSON:API Compliance', () => {
    it('fetches device list with Bearer token and JSON:API headers [mocked, not live-tested against Ring servers]', async () => {
      const mockDevicesResponse = {
        data: [
          {
            type: 'devices',
            id: 'doorbell-front-01',
            attributes: {
              name: 'Front Door Camera',
              image_url: 'https://media.ring.com/device-01.jpg',
            },
            relationships: {
              account: { data: { id: 'account-123', type: 'accounts' } },
            },
          },
          {
            type: 'devices',
            id: 'doorbell-back-02',
            attributes: {
              name: 'Backyard Doorbell',
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        expect(url).toBe(`${MOCK_BASE_URL}/v1/devices`);
        expect(init?.method).toBe('GET');
        const headers = init?.headers as Record<string, string>;
        expect(headers['Authorization']).toBe(`Bearer ${MOCK_TOKEN}`);
        expect(headers['Accept']).toContain('application/vnd.api+json');

        return new Response(JSON.stringify(mockDevicesResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        });
      });

      const client = new RingRestClient({ token: MOCK_TOKEN, baseUrl: MOCK_BASE_URL });
      const devices = await client.listDevices();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(devices).toHaveLength(2);
      expect(devices[0].id).toBe('doorbell-front-01');
      expect(devices[0].attributes.name).toBe('Front Door Camera');
      expect(devices[1].id).toBe('doorbell-back-02');
    });

    it('fetches single device details by id [mocked, not live-tested against Ring servers]', async () => {
      const mockSingleDevice = {
        data: {
          type: 'devices',
          id: 'doorbell-front-01',
          attributes: {
            name: 'Front Door Camera',
          },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        expect(url).toBe(`${MOCK_BASE_URL}/v1/devices/doorbell-front-01`);
        expect(init?.method).toBe('GET');
        return new Response(JSON.stringify(mockSingleDevice), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        });
      });

      const client = new RingRestClient({ token: MOCK_TOKEN, baseUrl: MOCK_BASE_URL });
      const device = await client.getDevice('doorbell-front-01');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(device.id).toBe('doorbell-front-01');
      expect(device.attributes.name).toBe('Front Door Camera');
    });
  });

  // ==========================================================================
  // 2. Image Snapshots Retrieval
  // ==========================================================================
  describe('2. Image Snapshots Retrieval', () => {
    it('downloads binary JPEG snapshot with X-Media-Timestamp header [mocked, not live-tested against Ring servers]', async () => {
      const fakeImageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const mockMediaTimestamp = 1729000012345;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        expect(url).toBe(`${MOCK_BASE_URL}/v1/devices/doorbell-front-01/media/image/download`);
        expect(init?.method).toBe('POST');
        const headers = init?.headers as Record<string, string>;
        expect(headers['Authorization']).toBe(`Bearer ${MOCK_TOKEN}`);
        expect(headers['Content-Type']).toBe('application/json');

        const parsedBody = JSON.parse(init?.body as string);
        expect(parsedBody.type).toBe('latest_in_range');
        expect(parsedBody.image_options?.format).toBe('jpeg');

        return new Response(fakeImageBytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'X-Media-Timestamp': String(mockMediaTimestamp),
          },
        });
      });

      const client = new RingRestClient({ token: MOCK_TOKEN, baseUrl: MOCK_BASE_URL });
      const result = await client.downloadSnapshot('doorbell-front-01', {
        type: 'latest_in_range',
        format: 'jpeg',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.imageBuffer).toEqual(fakeImageBytes);
      expect(result.contentType).toBe('image/jpeg');
      expect(result.timestamp).toBe(mockMediaTimestamp);
    });

    it('downloads snapshot at specific timestamp with resolution options [mocked, not live-tested against Ring servers]', async () => {
      const fakePngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const targetTs = 1729000099999;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.type).toBe('at_timestamp');
        expect(body.timestamp).toBe(targetTs);
        expect(body.image_options.format).toBe('png');
        expect(body.image_options.resolution).toEqual({ width: 1920, height: 1080 });

        return new Response(fakePngBytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'X-Media-Timestamp': String(targetTs),
          },
        });
      });

      const client = new RingRestClient({ token: MOCK_TOKEN, baseUrl: MOCK_BASE_URL });
      const result = await client.downloadSnapshot('doorbell-front-01', {
        type: 'at_timestamp',
        timestamp: targetTs,
        format: 'png',
        width: 1920,
        height: 1080,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.contentType).toBe('image/png');
      expect(result.timestamp).toBe(targetTs);
    });
  });

  // ==========================================================================
  // 3. Error Handling: 401, 403, 404, 429 & Timeouts
  // ==========================================================================
  describe('3. Error Handling & Resilience', () => {
    it('throws RingAuthError on HTTP 401 Unauthorized [mocked, not live-tested against Ring servers]', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 })
      );

      const client = new RingRestClient({ token: 'bad-token', baseUrl: MOCK_BASE_URL });
      await expect(client.listDevices()).rejects.toThrow(RingAuthError);
    });

    it('throws RingForbiddenError on HTTP 403 Forbidden [mocked, not live-tested against Ring servers]', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'insufficient_scopes' }), { status: 403 })
      );

      const client = new RingRestClient({ token: MOCK_TOKEN, baseUrl: MOCK_BASE_URL });
      await expect(client.listDevices()).rejects.toThrow(RingForbiddenError);
    });

    it('throws RingNotFoundError on HTTP 404 Not Found [mocked, not live-tested against Ring servers]', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'device_not_found' }), { status: 404 })
      );

      const client = new RingRestClient({ token: MOCK_TOKEN, baseUrl: MOCK_BASE_URL });
      await expect(client.getDevice('non-existent-device')).rejects.toThrow(RingNotFoundError);
    });

    it('handles 429 Too Many Requests with Retry-After and succeeds on retry [mocked, not live-tested against Ring servers]', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { 'Retry-After': '0.05' }, // 50ms in test
          });
        }
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        });
      });

      const client = new RingRestClient({
        token: MOCK_TOKEN,
        baseUrl: MOCK_BASE_URL,
        initialBackoffMs: 20,
      });

      const devices = await client.listDevices();
      expect(devices).toEqual([]);
      expect(callCount).toBe(2);
    });

    it('throws RingRateLimitError when 429 retries are exhausted [mocked, not live-tested against Ring servers]', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
          status: 429,
          headers: { 'Retry-After': '1' },
        })
      );

      const client = new RingRestClient({
        token: MOCK_TOKEN,
        baseUrl: MOCK_BASE_URL,
        maxRetries: 2,
        initialBackoffMs: 10,
      });

      await expect(client.listDevices()).rejects.toThrow(RingRateLimitError);
    });

    it('throws RingTimeoutError when request exceeds timeoutMs [mocked, not live-tested against Ring servers]', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const client = new RingRestClient({
        token: MOCK_TOKEN,
        baseUrl: MOCK_BASE_URL,
        timeoutMs: 50,
      });

      await expect(client.listDevices()).rejects.toThrow(RingTimeoutError);
    });

    it('never leaks Bearer token in error messages or logs [mocked, not live-tested against Ring servers]', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
      );

      const client = new RingRestClient({
        token: 'SUPER_SECRET_TOKEN_DO_NOT_LEAK',
        baseUrl: MOCK_BASE_URL,
      });
      try {
        await client.listDevices();
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RingApiError);
        expect((err as Error).message).not.toContain('SUPER_SECRET_TOKEN_DO_NOT_LEAK');
        expect(JSON.stringify(err)).not.toContain('SUPER_SECRET_TOKEN_DO_NOT_LEAK');
      }
    });
  });

  // ==========================================================================
  // 4. RingApiAdapter Startup Validation
  // ==========================================================================
  describe('4. RingApiAdapter Startup Validation', () => {
    it('fails fast on initialize() if token is missing or empty [mocked, not live-tested against Ring servers]', async () => {
      const adapterWithNoToken = new RingApiAdapter({ token: '' });
      await expect(adapterWithNoToken.initialize()).rejects.toThrow(
        /Startup Error \[RingApiAdapter\]: RING_MODE is set to 'live' but RING_API_TOKEN is missing or empty/
      );

      const adapterWithWhitespaceToken = new RingApiAdapter({ token: '   ' });
      await expect(adapterWithWhitespaceToken.initialize()).rejects.toThrow(
        /Startup Error \[RingApiAdapter\]/
      );
    });

    it('initializes cleanly when valid token is supplied [mocked, not live-tested against Ring servers]', async () => {
      const adapter = new RingApiAdapter({ token: MOCK_TOKEN });
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. ring-sandbox Webhook Payload Compatibility
  // ==========================================================================
  describe('5. ring-sandbox Webhook Payload Compatibility', () => {
    let server: http.Server;
    let serverUrl: string;
    const testSecret = 'dev-ring-hmac-secret-key-32chars-min';
    let receivedPayloads: RingWebhookPayload[] = [];

    beforeEach(async () => {
      receivedPayloads = [];
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
          secret: testSecret,
          onValidEvent: (payload) => {
            receivedPayloads.push(payload);
          },
        })
      );

      server = http.createServer(app);
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const port = (server.address() as AddressInfo).port;
          serverUrl = `http://127.0.0.1:${port}`;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('successfully accepts and parses ring-sandbox v1.1 event with ISO timestamp and relationships [mocked, not live-tested against Ring servers]', async () => {
      // Exact payload structure constructed by ring_sandbox.webhooks.build_event()
      const sandboxTime = new Date().toISOString();
      const sandboxPayload: RingWebhookPayload = {
        meta: {
          version: '1.1',
          time: sandboxTime, // ISO string emitted by ring-sandbox
          request_id: 'd4fedfd3-b389-406d-a850-936dbce5202a',
          account_id: 'ava1.ring.account.SANDBOX',
        },
        data: {
          id: 'doorbell-front-123_button_press_1792235452469',
          type: 'button_press',
          attributes: {
            source: 'doorbell-front-123',
            source_type: 'devices',
            timestamp: 1792235452469,
          },
          relationships: {
            devices: {
              links: {
                self: '/v1/devices/doorbell-front-123',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(sandboxPayload);
      const hmac = crypto
        .createHmac('sha256', testSecret)
        .update(Buffer.from(rawBody))
        .digest('hex');
      const signature = `sha256=${hmac}`;

      const res = await fetch(`${serverUrl}/webhooks/ring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        body: rawBody,
      });

      expect(res.status).toBe(200);
      const resJson = (await res.json()) as { status: string; requestId: string };
      expect(resJson.status).toBe('received');
      expect(resJson.requestId).toBe('d4fedfd3-b389-406d-a850-936dbce5202a');

      await new Promise((r) => setTimeout(r, 30));
      expect(receivedPayloads).toHaveLength(1);
      const received = receivedPayloads[0];
      expect(received.meta.version).toBe('1.1');
      expect(received.meta.time).toBe(sandboxTime);
      expect(received.data.type).toBe('button_press');
      expect(received.data.attributes.source).toBe('doorbell-front-123');
      expect(received.data.attributes.timestamp).toBe(1792235452469);
      expect(received.data.relationships).toBeDefined();
    });
  });
});
