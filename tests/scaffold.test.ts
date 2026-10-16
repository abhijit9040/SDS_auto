import { describe, it, expect } from 'vitest';
import { config } from '../src/server/config.js';
import { VisitorEvent, AlertPayload } from '../src/shared/types.js';
import { app } from '../src/server/index.js';

describe('SignalDoor Scaffold Verification', () => {
  it('loads default environment configuration correctly', () => {
    expect(config.port).toBeTypeOf('number');
    expect(['emulator', 'live']).toContain(config.ringMode);
    expect(config.ringWebhookSecret).toBeDefined();
    expect(config.internalDevSecret).toBeDefined();
  });

  it('validates shared types and event contracts', () => {
    const mockEvent: VisitorEvent = {
      id: 'test-event-001',
      timestamp: new Date().toISOString(),
      eventType: 'ring',
      metadata: {
        deviceId: 'ring-doorbell-front',
      },
    };

    const mockAlert: AlertPayload = {
      eventId: mockEvent.id,
      phase: 'PHASE_1_IMMEDIATE',
      timestamp: mockEvent.timestamp,
      title: 'Visitor Alert',
      body: 'Someone is at your door',
      timeoutFallback: false,
    };

    expect(mockEvent.id).toBe('test-event-001');
    expect(mockAlert.phase).toBe('PHASE_1_IMMEDIATE');
    expect(mockAlert.body).toBe('Someone is at your door');
  });

  it('verifies express app export exists and is functional', () => {
    expect(app).toBeDefined();
    expect(typeof app.get).toBe('function');
  });
});
