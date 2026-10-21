import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { RingWebhookPayload } from '../../shared/types.js';

export interface RingWebhookOptions {
  secret: string;
  maxAgeSeconds?: number;
  onValidEvent: (payload: RingWebhookPayload) => void | Promise<void>;
}

function parseMetaTime(time: unknown): number | null {
  if (typeof time === 'number') {
    if (time < 1e11) {
      // Unix timestamp in seconds
      return time * 1000;
    }
    // Unix timestamp in milliseconds
    return time;
  }
  if (typeof time === 'string') {
    const parsed = Date.parse(time);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function createRingWebhookRouter(options: RingWebhookOptions): Router {
  const router = Router();
  const processedRequestIds = new Set<string>();

  const defaultMaxAgeSeconds =
    options.maxAgeSeconds !== undefined
      ? options.maxAgeSeconds
      : process.env.WEBHOOK_MAX_AGE_SECONDS
        ? parseInt(process.env.WEBHOOK_MAX_AGE_SECONDS, 10)
        : 300;

  router.post('/', (req: Request, res: Response) => {
    const signatureHeader = req.headers['x-signature'] as string | undefined;

    if (!signatureHeader) {
      res.status(401).json({ error: 'Missing signature header (X-Signature required)' });
      return;
    }

    const [algo, providedHash] = signatureHeader.split('=');
    if (algo !== 'sha256' || !providedHash) {
      res.status(401).json({ error: 'Invalid signature format (expected sha256=<hex>)' });
      return;
    }

    // Require raw request body buffer for HMAC verification (no fallback to JSON.stringify)
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: 'Missing raw request body buffer for signature verification' });
      return;
    }

    const computedHash = crypto.createHmac('sha256', options.secret).update(rawBody).digest('hex');

    const providedBuffer = Buffer.from(providedHash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (
      providedBuffer.length !== computedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, computedBuffer)
    ) {
      res.status(401).json({ error: 'Invalid signature (HMAC mismatch)' });
      return;
    }

    const payload = req.body as RingWebhookPayload;

    // Check event age if meta.time is present and parses
    if (defaultMaxAgeSeconds > 0 && payload.meta?.time !== undefined) {
      const eventTimeMs = parseMetaTime(payload.meta.time);
      if (eventTimeMs !== null) {
        const ageMs = Date.now() - eventTimeMs;
        const maxAgeMs = defaultMaxAgeSeconds * 1000;
        if (ageMs > maxAgeMs || ageMs < -maxAgeMs) {
          res.status(400).json({ error: 'Webhook event is stale or expired' });
          return;
        }
      }
    }

    const requestId = payload.meta?.request_id;

    // Deduplication check on meta.request_id
    if (requestId && processedRequestIds.has(requestId)) {
      res.status(200).json({ status: 'ignored_duplicate', requestId });
      return;
    }

    if (requestId) {
      processedRequestIds.add(requestId);
      // Evict old entries if set grows too large
      if (processedRequestIds.size > 1000) {
        const first = processedRequestIds.values().next().value;
        if (first) processedRequestIds.delete(first);
      }
    }

    // Return HTTP 200 immediately
    res.status(200).json({ status: 'received', requestId });

    // Asynchronously dispatch event and alert
    setImmediate(async () => {
      try {
        await options.onValidEvent(payload);
      } catch (err) {
        console.error('Error handling async webhook event:', err);
      }
    });
  });

  return router;
}
