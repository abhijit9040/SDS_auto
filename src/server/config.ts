import dotenv from 'dotenv';
import { RingMode } from '../shared/types.js';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  ringMode: RingMode;
  ringWebhookSecret: string;
  internalDevSecret: string;
  awsRegion: string;
  bedrockModelId: string;
  bedrockTimeoutMs: number;
  databasePath: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  ringMode: (process.env.RING_MODE as RingMode) || 'emulator',
  ringWebhookSecret: process.env.RING_WEBHOOK_SECRET || 'dev-ring-hmac-secret-key-32chars-min',
  internalDevSecret: process.env.INTERNAL_DEV_SECRET || 'dev-local-secret-change-me',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
  bedrockTimeoutMs: parseInt(process.env.BEDROCK_TIMEOUT_MS || '5000', 10),
  databasePath: process.env.DATABASE_PATH || './signaldoor.db',
};
