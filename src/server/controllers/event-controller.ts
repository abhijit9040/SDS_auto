import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RingWebhookPayload, AlertPayload } from '../../shared/types.js';
import { WebSocketHub } from '../services/ws-hub.js';
import { BedrockService } from '../services/bedrock.js';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_VISITORS_DIR = join(__dirname, '../assets/sample-visitors');

const defaultBedrock = new BedrockService();

export async function handleRingEvent(
  payload: RingWebhookPayload,
  wsHub: WebSocketHub,
  bedrockService: BedrockService = defaultBedrock
): Promise<{ phase2Sent: boolean; summary?: string }> {
  const eventId = payload.data.id;
  const timestamp = new Date(payload.data.attributes.timestamp || Date.now()).toISOString();
  const deviceId = payload.data.attributes.source;

  // In emulator mode, load a sample visitor snapshot into an in-memory buffer.
  // CRITICAL REQUIREMENT: Image bytes remain strictly in memory, never written to disk or logged.
  let imageBuffer = Buffer.alloc(0);
  let mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg';

  const samplePath = join(SAMPLE_VISITORS_DIR, 'delivery.jpg');
  if (existsSync(samplePath)) {
    try {
      imageBuffer = readFileSync(samplePath);
      mimeType = 'image/jpeg';
    } catch {
      imageBuffer = Buffer.alloc(0);
    }
  }

  // Phase 2: Async Bedrock enrichment with strict 5.0 s timeout (FR-3)
  const bedrockResult = await bedrockService.describeVisitor({
    imageBuffer,
    mimeType,
    metadata: { deviceId, eventType: payload.data.type },
    timeoutMs: config.bedrockTimeoutMs,
  });

  if (bedrockResult.success && bedrockResult.summary) {
    const phase2Payload: AlertPayload = {
      eventId,
      phase: 'PHASE_2_ENRICHED',
      timestamp,
      title: 'Visitor Alert',
      body: bedrockResult.summary,
      timeoutFallback: false,
    };
    wsHub.broadcastToResidents({ type: 'ALERT_PHASE_2', payload: phase2Payload });
    return { phase2Sent: true, summary: bedrockResult.summary };
  }

  // On failure or timeout: Phase 1 fallback text remains visible on the resident UI.
  // No Phase 2 alert is broadcast.
  return { phase2Sent: false };
}
