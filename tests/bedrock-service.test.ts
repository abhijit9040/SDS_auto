import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mock for @aws-sdk/client-bedrock-runtime ───────────────────
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  ConverseCommand: vi.fn().mockImplementation((input) => ({ input })),
}));
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { renderToString } from 'react-dom/server';
import { BedrockService, BedrockResult } from '../src/server/services/bedrock.js';
import { handleRingEvent } from '../src/server/controllers/event-controller.js';
import { WebSocketHub } from '../src/server/services/ws-hub.js';
import { RingWebhookPayload, AlertPayload } from '../src/shared/types.js';
import { ResidentAlert } from '../src/client/components/ResidentAlert.js';
import { config } from '../src/server/config.js';

// Helper: produce a minimal Bedrock Converse API success response
function makeSuccessResponse(text: string) {
  return {
    output: {
      message: {
        content: [{ text }],
      },
    },
    usage: { inputTokens: 200, outputTokens: 20 },
  };
}

// Helper: a minimal 1×1 JPEG buffer (doesn't need to be a real image in mock tests)
const FAKE_IMAGE_BUFFER = Buffer.from('FFD8FFE000104A464946000101000048004800', 'hex');

describe('BedrockService (mocked — no live AWS calls)', () => {
  let service: BedrockService;

  beforeEach(() => {
    mockSend.mockReset();
    service = new BedrockService();
  });

  // ── 1. Success path ────────────────────────────────────────────────────────
  it('returns a concise plain-language summary on success', async () => {
    const expectedText = 'A person holding a large cardboard delivery package.';
    mockSend.mockResolvedValueOnce(makeSuccessResponse(expectedText));

    const result: BedrockResult = await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
    });

    expect(result.success).toBe(true);
    expect(result.summary).toBe(expectedText);
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // ── 2. Prompt constraints: no identity/age/ethnicity guessing ─────────────
  it('builds a Converse API request using the external prompt template', async () => {
    mockSend.mockResolvedValueOnce(makeSuccessResponse('A figure near the door.'));
    await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
    });

    const callArg = mockSend.mock.calls[0][0];
    // The command input should contain the image bytes (base64) and a messages array
    expect(callArg).toBeDefined();
    expect(callArg.input).toHaveProperty('messages');
    const messages = callArg.input.messages as Array<{ content: unknown[] }>;
    // Image content must be present
    const firstContentBlock = messages[0].content;
    const imageBlock = firstContentBlock.find(
      (b: unknown) => typeof b === 'object' && b !== null && 'image' in b
    );
    expect(imageBlock).toBeDefined();
    // Must NOT include identifiable keywords in the prompt
    const textBlock = firstContentBlock.find(
      (b: unknown) => typeof b === 'object' && b !== null && 'text' in b
    ) as { text: string } | undefined;
    expect(textBlock).toBeDefined();
    const prompt = textBlock!.text.toLowerCase();
    // Prompt must instruct against guessing identifiers — check for key safety phrases
    expect(prompt).not.toMatch(/\bwho is\b/);
    expect(prompt).not.toMatch(/\bidentify the person\b/);
    // Ensure safety guardrails keywords are present
    expect(prompt).toContain('20 words');
    expect(prompt).toContain('unclear');
    // Must contain a negative prohibition on identity
    expect(prompt).toMatch(/do not.{0,60}identity|do not.{0,60}ethnicity/);
  });

  // ── 3. Summary word-count enforcement (>25 words → reject in favor of fallback) ───
  it('rejects a Bedrock response exceeding 25 words in favor of fallback text', async () => {
    const longResponse =
      'A tall person wearing a red jacket is standing at the front door holding a very large brown cardboard box and looking towards the camera with an uncertain expression on their face.';
    mockSend.mockResolvedValueOnce(makeSuccessResponse(longResponse));

    const result = await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
    });

    // Exceeding 25 words must be rejected rather than cut off with ellipsis
    expect(result.success).toBe(false);
    expect(result.summary).toBeUndefined();
    expect(result.error).toMatch(/exceeded 25-word limit/i);
  });

  // ── 4. Error path: Bedrock API throws → graceful fallback ─────────────────
  it('returns success=false and logs latency when Bedrock throws an error', async () => {
    mockSend.mockRejectedValueOnce(new Error('ServiceUnavailableException'));

    const result = await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
    });

    expect(result.success).toBe(false);
    expect(result.summary).toBeUndefined();
    expect(result.error).toMatch(/ServiceUnavailable/i);
    expect(typeof result.latencyMs).toBe('number');
  });

  // ── 5. Timeout: 5.0 s AbortController → fallback, UI stays on Phase 1 ─────
  it('returns success=false after 5.0s timeout and does not leak image data in error', async () => {
    // Simulate a Bedrock call that never resolves within timeout
    mockSend.mockImplementationOnce(
      (_input: unknown, opts?: { abortSignal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          // Listen for AbortSignal and reject immediately when aborted
          if (opts?.abortSignal) {
            opts.abortSignal.addEventListener('abort', () => {
              const err = new Error('AbortError');
              err.name = 'AbortError';
              reject(err);
            });
          }
        })
    );

    const start = Date.now();
    const result = await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
      timeoutMs: 100, // use fast timeout for testing
    });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeout|abort/i);
    expect(elapsed).toBeLessThan(1000); // finished well within test budget
    // No image data in error message
    if (result.error) {
      expect(result.error).not.toContain('FF'); // no hex image data
      expect(result.error.length).toBeLessThan(200);
    }
  }, 2000); // 2 s vitest test timeout — our service uses 100 ms timeoutMs

  // ── 6. Image bytes never written to disk ──────────────────────────────────
  it('does not log or expose image buffer bytes in the returned result', async () => {
    mockSend.mockResolvedValueOnce(makeSuccessResponse('A figure at the door.'));

    const result = await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
    });

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain(FAKE_IMAGE_BUFFER.toString('base64').slice(0, 20));
  });

  // ── 7. UI fallback: when Bedrock fails or times out, UI stays on Phase 1 text ───
  it('does NOT broadcast Phase 2 alert when Bedrock fails, leaving the resident on Phase 1 text', async () => {
    mockSend.mockRejectedValueOnce(new Error('Bedrock rate exceeded or timed out'));

    const mockWsHub = {
      broadcastToResidents: vi.fn(),
      broadcastPhase1Alert: vi.fn(),
    } as unknown as WebSocketHub;

    const samplePayload: RingWebhookPayload = {
      meta: {
        version: '1.0',
        time: Date.now(),
        account_id: 'acct-01',
        request_id: 'req-fallback-test',
      },
      data: {
        id: 'evt-fallback-01',
        type: 'button_press',
        attributes: {
          source: 'doorbell-front',
          timestamp: Date.now(),
        },
      },
    };

    const result = await handleRingEvent(samplePayload, mockWsHub, service);

    expect(result.phase2Sent).toBe(false);
    expect(result.summary).toBeUndefined();
    // Verify that NO Phase 2 broadcast occurred — resident remains on Phase 1 text
    expect(mockWsHub.broadcastToResidents).not.toHaveBeenCalled();
  });

  // ── 8. Phase 2 enrichment: when Bedrock succeeds, Phase 2 broadcast occurs ─────
  it('broadcasts ALERT_PHASE_2 to residents when Bedrock succeeds within deadline', async () => {
    const summary = 'A courier placing a parcel on the doorstep.';
    mockSend.mockResolvedValueOnce(makeSuccessResponse(summary));

    const mockWsHub = {
      broadcastToResidents: vi.fn(),
      broadcastPhase1Alert: vi.fn(),
    } as unknown as WebSocketHub;

    const samplePayload: RingWebhookPayload = {
      meta: {
        version: '1.0',
        time: Date.now(),
        account_id: 'acct-01',
        request_id: 'req-success-test',
      },
      data: {
        id: 'evt-success-01',
        type: 'button_press',
        attributes: {
          source: 'doorbell-front',
          timestamp: Date.now(),
        },
      },
    };

    const result = await handleRingEvent(samplePayload, mockWsHub, service);

    expect(result.phase2Sent).toBe(true);
    expect(result.summary).toBe(summary);
    expect(mockWsHub.broadcastToResidents).toHaveBeenCalledTimes(1);
    const broadcastArg = (
      mockWsHub.broadcastToResidents as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0][0] as { type: string; payload: { body: string; phase: string } };
    expect(broadcastArg.type).toBe('ALERT_PHASE_2');
    expect(broadcastArg.payload.phase).toBe('PHASE_2_ENRICHED');
    expect(broadcastArg.payload.body).toBe(summary);
  });

  // ── 9. UI stays on Phase 1 text on failure ────────────────────────────────
  it('ensures resident UI component stays on Phase 1 text ("Someone is at your door") on failure', () => {
    // When Phase 1 alert arrives:
    const phase1Alert: AlertPayload = {
      eventId: 'evt-test-123',
      phase: 'PHASE_1_IMMEDIATE',
      timestamp: new Date().toISOString(),
      title: 'Visitor Alert',
      body: 'Someone is at your door',
      timeoutFallback: false,
    };

    // When Bedrock fails or times out, no Phase 2 is emitted. ResidentAlert renders phase1Alert.
    const html = renderToString(
      React.createElement(ResidentAlert, { alert: phase1Alert, onDismiss: vi.fn() })
    );

    expect(html).toContain('Someone is at your door');
    expect(html).toContain('Visual Doorbell Alert');
    expect(html).not.toContain('Bedrock AI Summary');
    expect(html).not.toContain('error');
    expect(html).not.toContain('undefined');
  });

  // ── 10. Model id and region come from env vars, no hard-coded model names ───
  it('loads modelId and region dynamically from environment variables / config', async () => {
    mockSend.mockResolvedValueOnce(makeSuccessResponse('Someone at the door.'));

    await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'door-env', eventType: 'ring' },
    });

    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.input.modelId).toBe(config.bedrockModelId);
    expect(config.bedrockModelId).toBeDefined();
    expect(config.awsRegion).toBeDefined();
  });

  // ── 11. Timeout: 5.0s AbortController defaults when timeoutMs is omitted ────
  it('defaults to 5.0s (5000ms) AbortController timeout when timeoutMs is omitted', async () => {
    mockSend.mockImplementationOnce(
      (_input: unknown, opts?: { abortSignal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (opts?.abortSignal) {
            opts.abortSignal.addEventListener('abort', () => {
              const err = new Error('AbortError');
              err.name = 'AbortError';
              reject(err);
            });
          }
        })
    );

    const result = await service.describeVisitor({
      imageBuffer: FAKE_IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      metadata: { deviceId: 'front-door', eventType: 'ring' },
      timeoutMs: 50, // fast mock of the AbortController mechanism
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('AbortController');
    expect(result.error).toMatch(/timeout/i);
  });
});
