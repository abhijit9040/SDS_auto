import crypto from 'crypto';
import { RingAdapter } from './ring-adapter.interface.js';
import { RingWebhookPayload, VisitorEvent } from '../../shared/types.js';

export class SimulatorAdapter implements RingAdapter {
  private listeners: ((event: VisitorEvent) => void | Promise<void>)[] = [];

  constructor(
    private serverBaseUrl: string,
    private webhookSecret: string
  ) {}

  public async initialize(): Promise<void> {
    // Simulator initialized
  }

  public onVisitorEvent(handler: (event: VisitorEvent) => void | Promise<void>): void {
    this.listeners.push(handler);
  }

  public async emitVisitorEvent(payload: RingWebhookPayload): Promise<void> {
    const event: VisitorEvent = {
      id: payload.data.id,
      timestamp: new Date(payload.data.attributes.timestamp || Date.now()).toISOString(),
      eventType: payload.data.type === 'button_press' ? 'ring' : 'test',
      metadata: {
        deviceId: payload.data.attributes.source,
      },
    };

    for (const listener of this.listeners) {
      await listener(event);
    }
  }

  public async triggerDoorbellPress(options?: {
    deviceId?: string;
    requestId?: string;
  }): Promise<{ status: string; requestId?: string }> {
    const payload: RingWebhookPayload = {
      meta: {
        version: '1.0',
        time: Date.now(),
        account_id: 'simulator-account-01',
        request_id:
          options?.requestId || `sim-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
      data: {
        id: `sim-evt-${Date.now()}`,
        type: 'button_press',
        attributes: {
          source: options?.deviceId || 'doorbell-front-simulator',
          timestamp: Date.now(),
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const signature = `sha256=${hmac}`;

    const res = await fetch(`${this.serverBaseUrl}/webhooks/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: rawBody,
    });

    return (await res.json()) as { status: string; requestId?: string };
  }
}
