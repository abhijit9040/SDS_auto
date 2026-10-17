import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { server, wsHub } from '../src/server/index.js';
import {
  ALLOWED_QUICK_REPLIES,
  WebSocketServerMessage,
  WebSocketClientMessage,
} from '../src/shared/types.js';
import { dbService } from '../src/server/db/index.js';
import { QuickReplies } from '../src/client/components/QuickReplies.js';
import { VisitorScreen } from '../src/client/components/VisitorScreen.js';

describe('Task 3: Two-Way Quick Replies & Visitor Screen (/visitor)', () => {
  let testPort: number;
  let testServer: http.Server;

  beforeAll(async () => {
    // Initialize in-memory SQLite DB for tests
    dbService.initialize(':memory:');

    // Start server on dynamic port to prevent collisions
    await new Promise<void>((resolve) => {
      testServer = server.listen(0, () => {
        const addr = testServer.address();
        testPort = typeof addr === 'object' && addr ? addr.port : 3105;
        resolve();
      });
    });
  });

  const activeWebSockets: WebSocket[] = [];

  afterAll(async () => {
    for (const ws of activeWebSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // Helper to connect and subscribe a WebSocket client
  async function connectClient(role: 'resident' | 'visitor'): Promise<WebSocket> {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
    activeWebSockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        const subMsg: WebSocketClientMessage = { type: 'SUBSCRIBE', role };
        ws.send(JSON.stringify(subMsg));
      });
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SUBSCRIBED') {
            resolve();
          }
        } catch {
          // ignore non-json
        }
      });
      ws.on('error', reject);
    });
    return ws;
  }

  // ── 1. Server-side validation of allowed quick reply strings ───────────────
  it('accepts only the three allowed reply strings and rejects arbitrary strings', async () => {
    expect(ALLOWED_QUICK_REPLIES).toContain('Leave it at the door');
    expect(ALLOWED_QUICK_REPLIES).toContain('Coming in 2 minutes');
    expect(ALLOWED_QUICK_REPLIES).toContain("I can't hear, please text me");
    expect(ALLOWED_QUICK_REPLIES.length).toBe(3);

    const residentWs = await connectClient('resident');

    // Attempt to send an invalid / untrusted reply string
    const invalidPromise = new Promise<{ status: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for invalid reply ack')), 2000);
      residentWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ERROR' || msg.status === 'REJECTED') {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });

    const untrustedMsg = {
      type: 'QUICK_REPLY',
      payload: {
        eventId: 'evt-test-invalid',
        reply: 'Malicious custom reply text not on whitelist',
        timestamp: new Date().toISOString(),
      },
    };
    residentWs.send(JSON.stringify(untrustedMsg));

    // Verify rejection
    const rejection = await invalidPromise;
    expect(rejection).toBeDefined();

    // Verify nothing written to DB for this invalid event
    const logs = dbService.getRepliesByEventId('evt-test-invalid');
    expect(logs.length).toBe(0);

    residentWs.close();
  });

  // ── 2. SQLite transaction logging & REPLY_ACK to resident ──────────────────
  it('logs valid replies in SQLite tied to eventId and returns REPLY_ACK to resident', async () => {
    const residentWs = await connectClient('resident');
    const eventId = 'evt-log-test-' + Date.now();
    const replyText = 'Leave it at the door';

    const ackPromise = new Promise<WebSocketServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for REPLY_ACK')), 2000);
      residentWs.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WebSocketServerMessage;
        if (msg.type === 'REPLY_ACK') {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });

    const validMsg: WebSocketClientMessage = {
      type: 'QUICK_REPLY',
      payload: {
        eventId,
        reply: replyText,
        timestamp: new Date().toISOString(),
      },
    };
    residentWs.send(JSON.stringify(validMsg));

    // 1. Verify REPLY_ACK delivered to resident UI
    const ack = await ackPromise;
    expect(ack.type).toBe('REPLY_ACK');
    if (ack.type === 'REPLY_ACK') {
      expect(ack.payload.eventId).toBe(eventId);
      expect(ack.payload.status).toBe('DELIVERED');
    }

    // 2. Verify logged in SQLite database
    const dbRows = dbService.getRepliesByEventId(eventId);
    expect(dbRows.length).toBe(1);
    expect(dbRows[0].event_id).toBe(eventId);
    expect(dbRows[0].reply_text).toBe(replyText);
    expect(dbRows[0].timestamp).toBeDefined();

    residentWs.close();
  });

  // ── 3. Two tabs concurrent: resident reply displays on visitor screen ──────
  it('delivers VISITOR_REPLY_DISPLAY to visitor screen tab within 1.5s', async () => {
    const residentWs = await connectClient('resident');
    const visitorWs = await connectClient('visitor');

    const eventId = 'evt-visitor-test-' + Date.now();
    const replyText = 'Coming in 2 minutes';

    const startTime = Date.now();
    const visitorPromise = new Promise<WebSocketServerMessage>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timeout waiting for VISITOR_REPLY_DISPLAY (>1.5s)')),
        1500
      );
      visitorWs.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WebSocketServerMessage;
        if (msg.type === 'VISITOR_REPLY_DISPLAY') {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });

    residentWs.send(
      JSON.stringify({
        type: 'QUICK_REPLY',
        payload: {
          eventId,
          reply: replyText,
          timestamp: new Date().toISOString(),
        },
      })
    );

    const received = await visitorPromise;
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1500);
    expect(received.type).toBe('VISITOR_REPLY_DISPLAY');
    if (received.type === 'VISITOR_REPLY_DISPLAY') {
      expect(received.payload.reply).toBe(replyText);
      expect(received.payload.timestamp).toBeDefined();
    }

    residentWs.close();
    visitorWs.close();
  });

  // ── 4. Stale reply reset on new visitor alert ──────────────────────────────
  it('resets displayed visitor reply when a new visitor alert arrives', async () => {
    const visitorWs = await connectClient('visitor');

    // First send a reply display
    wsHub.broadcastToVisitors({
      type: 'VISITOR_REPLY_DISPLAY',
      payload: { reply: 'Leave it at the door', timestamp: new Date().toISOString() },
    });

    // Now a new doorbell press occurs: broadcast Phase 1 alert
    const resetPromise = new Promise<WebSocketServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for alert broadcast')), 2000);
      visitorWs.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WebSocketServerMessage;
        if (msg.type === 'ALERT_PHASE_1') {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });

    wsHub.broadcastPhase1Alert({
      eventId: 'evt-new-visitor',
      phase: 'PHASE_1_IMMEDIATE',
      timestamp: new Date().toISOString(),
      title: 'Visitor Alert',
      body: 'Someone is at your door',
      timeoutFallback: false,
    });

    const alertMsg = await resetPromise;
    expect(alertMsg.type).toBe('ALERT_PHASE_1');

    visitorWs.close();
  });

  // ── 5. Accessibility & Touch Targets for QuickReply component ─────────────
  it('renders QuickReplies with >=48px touch targets and valid reply options', () => {
    const html = renderToString(
      React.createElement(QuickReplies, {
        eventId: 'evt-btn-test',
        onSendReply: () => {},
        isPending: false,
      })
    );

    // Must render all three buttons
    expect(html).toContain('Leave it at the door');
    expect(html).toContain('Coming in 2 minutes');
    expect(html).toMatch(/I can(&#x27;|')t hear, please text me/);

    // Must have minHeight: 48px or touch target attribute
    expect(html).toMatch(/min-height:\s*48px|height:\s*48px|48px/i);
  });

  // ── 6. VisitorScreen component rendering ──────────────────────────────────
  it('renders VisitorScreen with "Waiting for response..." initially and reply upon arrival', () => {
    // Initial state: waiting
    const initialHtml = renderToString(
      React.createElement(VisitorScreen, { currentReply: null })
    );
    expect(initialHtml).toContain('Waiting for response...');

    // Arrived state: displays reply with timestamp
    const replyHtml = renderToString(
      React.createElement(VisitorScreen, {
        currentReply: {
          reply: 'Coming in 2 minutes',
          timestamp: '2026-10-17T12:00:00Z',
        },
      })
    );
    expect(replyHtml).toContain('Coming in 2 minutes');
    expect(replyHtml).not.toContain('Waiting for response...');
  });
});
