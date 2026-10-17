import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config.js';

// ─── Load the tunable prompt from file ──────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const VISITOR_PROMPT = readFileSync(join(__dirname, 'bedrock-prompt.txt'), 'utf-8').trim();

// Maximum allowed word count for the AI summary (SPEC: AC-4)
const MAX_WORDS = 25;
// Default timeout in milliseconds (matches SPEC FR-3: 5.0 s)
const DEFAULT_TIMEOUT_MS = 5_000;

export interface DescribeVisitorOptions {
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  metadata: { deviceId: string; eventType: string };
  timeoutMs?: number;
}

export interface BedrockResult {
  success: boolean;
  summary?: string;
  error?: string;
  latencyMs: number;
}

export class BedrockService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({ region: config.awsRegion });
  }

  public async describeVisitor(opts: DescribeVisitorOptions): Promise<BedrockResult> {
    const { imageBuffer, mimeType, metadata, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
    const start = Date.now();

    const input: ConverseCommandInput = {
      modelId: config.bedrockModelId,
      messages: [
        {
          role: 'user',
          content: [
            {
              image: {
                format: mimeType.split('/')[1] as 'jpeg' | 'png' | 'webp' | 'gif',
                source: {
                  bytes: imageBuffer, // in-memory only; never logged or written to disk
                },
              },
            },
            {
              text: VISITOR_PROMPT,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 60,
        temperature: 0.1,
      },
    };

    // AbortController for hard 5 s timeout (SPEC FR-3)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.send(new ConverseCommand(input), {
        abortSignal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      const textBlock = response.output?.message?.content?.find(
        (c) => 'text' in c && typeof (c as { text?: string }).text === 'string'
      ) as { text: string } | undefined;
      const text = textBlock?.text?.trim() ?? '';

      if (!text) {
        return { success: false, error: 'Empty response from Bedrock', latencyMs };
      }

      const words = wordCount(text);
      if (words > MAX_WORDS) {
        console.warn(
          `[Bedrock] Summary exceeded ${MAX_WORDS} words (${words} words). Rejecting in favor of fallback text.`
        );
        return {
          success: false,
          error: `Summary exceeded ${MAX_WORDS}-word limit (${words} words); falling back to generic alert`,
          latencyMs,
        };
      }

      // Log latency only — no image data
      console.log(
        `[Bedrock] deviceId=${metadata.deviceId} eventType=${metadata.eventType} latencyMs=${latencyMs} words=${words}`
      );

      return { success: true, summary: text, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));

      const safeError = isAbort
        ? `Bedrock timeout after ${timeoutMs}ms (AbortController)`
        : `Bedrock error: ${err instanceof Error ? err.message : String(err)}`;

      // Log error, but never include image bytes
      console.error(
        `[Bedrock] FAILED deviceId=${metadata.deviceId} latencyMs=${latencyMs} error=${safeError}`
      );

      return { success: false, error: safeError, latencyMs };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Word-count utilities ────────────────────────────────────────────────────
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
