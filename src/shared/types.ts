export type RingMode = 'live' | 'emulator';
export type EventType = 'ring' | 'motion' | 'test';

export interface RingWebhookMeta {
  version?: string;
  time?: number;
  account_id: string;
  request_id: string;
}

export interface RingWebhookDataAttributes {
  source: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface RingWebhookData {
  id: string;
  type: string; // e.g. 'button_press'
  attributes: RingWebhookDataAttributes;
}

export interface RingWebhookPayload {
  meta: RingWebhookMeta;
  data: RingWebhookData;
}

export interface VisitorEvent {
  id: string;
  timestamp: string;
  eventType: EventType;
  imageBuffer?: Buffer;
  metadata: {
    deviceId: string;
    locationName?: string;
    mediaUrl?: string;
  };
}

export type AlertPhase = 'PHASE_1_IMMEDIATE' | 'PHASE_2_ENRICHED';

export interface AlertPayload {
  eventId: string;
  phase: AlertPhase;
  timestamp: string;
  title: string;
  body: string;
  timeoutFallback: boolean;
}

export type QuickReplyText =
  'Leave it at the door' | 'Coming in 2 minutes' | "I can't hear, please text me";

export interface QuickReplyMessage {
  eventId: string;
  reply: QuickReplyText;
  timestamp: string;
}

export type WebSocketClientMessage =
  | { type: 'SUBSCRIBE'; role: 'resident' | 'visitor'; secret?: string }
  | { type: 'QUICK_REPLY'; payload: QuickReplyMessage };

export type WebSocketServerMessage =
  | { type: 'ALERT_PHASE_1'; payload: AlertPayload }
  | { type: 'ALERT_PHASE_2'; payload: AlertPayload }
  | { type: 'VISITOR_REPLY_DISPLAY'; payload: { reply: string; timestamp: string } }
  | { type: 'REPLY_ACK'; payload: { eventId: string; status: 'DELIVERED' } };
