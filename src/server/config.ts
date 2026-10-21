import dotenv from 'dotenv';
import { RingMode } from '../shared/types.js';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  ringMode: RingMode;
  ringWebhookSecret: string;
  internalDevSecret: string;
  ringApiToken?: string;
  ringApiBaseUrl: string;
  ringRequestTimeoutMs: number;
  awsRegion: string;
  bedrockModelId: string;
  bedrockTimeoutMs: number;
  databasePath: string;
}

export function validateConfig(cfg: Partial<AppConfig>): void {
  const isMissingOrPlaceholder = (val?: string) => !val || val.trim() === '' || val === 'CHANGE_ME';

  if (
    isMissingOrPlaceholder(cfg.ringWebhookSecret) ||
    isMissingOrPlaceholder(cfg.internalDevSecret)
  ) {
    throw new Error(
      'Startup Error: RING_WEBHOOK_SECRET or INTERNAL_DEV_SECRET is missing or set to CHANGE_ME. ' +
        'Please run "npm run setup" to generate secure local secrets before starting the server.'
    );
  }
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  ringMode: (process.env.RING_MODE as RingMode) || 'emulator',
  ringWebhookSecret: process.env.RING_WEBHOOK_SECRET || '',
  internalDevSecret: process.env.INTERNAL_DEV_SECRET || '',
  ringApiToken: process.env.RING_API_TOKEN,
  ringApiBaseUrl: process.env.RING_API_BASE_URL || 'https://api.amazonvision.com',
  ringRequestTimeoutMs: parseInt(process.env.RING_REQUEST_TIMEOUT_MS || '5000', 10),
  awsRegion: process.env.AWS_REGION || 'ap-southeast-2',
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0',
  bedrockTimeoutMs: parseInt(process.env.BEDROCK_TIMEOUT_MS || '5000', 10),
  databasePath: process.env.DATABASE_PATH || './signaldoor.db',
};
