import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { RingWebhookPayload } from '../../shared/types.js';

export interface RingWebhookOptions {
  secret: string;
  onValidEvent: (payload: RingWebhookPayload) => void | Promise<void>;
}

export function createRingWebhookRouter(options: RingWebhookOptions): Router {
  const router = Router();
  const processedRequestIds = new Set<string>();

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

    // Verify HMAC using raw request body
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const bodyBuffer = rawBody || Buffer.from(JSON.stringify(req.body));
    const computedHash = crypto
      .createHmac('sha256', options.secret)
      .update(bodyBuffer)
      .digest('hex');

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
