import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { validateConfig, AppConfig } from '../src/server/config.js';

describe('Task B1: Security Configuration & Setup Script', () => {
  describe('validateConfig() startup guard', () => {
    const validConfig: AppConfig = {
      port: 3000,
      nodeEnv: 'development',
      ringMode: 'emulator',
      ringWebhookSecret: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      internalDevSecret: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      ringApiBaseUrl: 'https://api.amazonvision.com',
      ringRequestTimeoutMs: 5000,
      awsRegion: 'ap-southeast-2',
      bedrockModelId: 'amazon.nova-lite-v1:0',
      bedrockTimeoutMs: 5000,
      databasePath: './signaldoor.db',
    };

    it('passes validation when both secrets are provided and not CHANGE_ME', () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('refuses to start and mentions "npm run setup" when ringWebhookSecret is empty', () => {
      expect(() => validateConfig({ ...validConfig, ringWebhookSecret: '' })).toThrowError(
        /npm run setup/
      );
    });

    it('refuses to start and mentions "npm run setup" when ringWebhookSecret is CHANGE_ME', () => {
      expect(() => validateConfig({ ...validConfig, ringWebhookSecret: 'CHANGE_ME' })).toThrowError(
        /npm run setup/
      );
    });

    it('refuses to start and mentions "npm run setup" when internalDevSecret is empty', () => {
      expect(() => validateConfig({ ...validConfig, internalDevSecret: '' })).toThrowError(
        /npm run setup/
      );
    });

    it('refuses to start and mentions "npm run setup" when internalDevSecret is CHANGE_ME', () => {
      expect(() => validateConfig({ ...validConfig, internalDevSecret: 'CHANGE_ME' })).toThrowError(
        /npm run setup/
      );
    });
  });

  describe('scripts/setup-env.mjs script execution', () => {
    const tempDir = path.resolve(__dirname, '../.test-tmp-b1');
    const tempEnv = path.join(tempDir, '.env');
    const tempExample = path.join(tempDir, '.env.example');

    beforeEach(() => {
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        tempExample,
        'RING_WEBHOOK_SECRET=CHANGE_ME\nINTERNAL_DEV_SECRET=CHANGE_ME\nPORT=3000\n',
        'utf8'
      );
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('copies .env.example to .env and replaces CHANGE_ME with random 32-byte hex (64 chars)', () => {
      const scriptPath = path.resolve(__dirname, '../scripts/setup-env.mjs');
      execSync(`node "${scriptPath}" "${tempEnv}" "${tempExample}"`, {
        encoding: 'utf8',
      });

      expect(fs.existsSync(tempEnv)).toBe(true);
      const content = fs.readFileSync(tempEnv, 'utf8');
      expect(content).not.toContain('CHANGE_ME');

      const webhookMatch = content.match(/RING_WEBHOOK_SECRET=([0-9a-fA-F]{64})/);
      expect(webhookMatch).not.toBeNull();

      const internalMatch = content.match(/INTERNAL_DEV_SECRET=([0-9a-fA-F]{64})/);
      expect(internalMatch).not.toBeNull();
    });

    it('never overwrites an existing .env file', () => {
      const scriptPath = path.resolve(__dirname, '../scripts/setup-env.mjs');
      const existingContent = 'EXISTING_SECRET=do_not_touch_me\n';
      fs.writeFileSync(tempEnv, existingContent, 'utf8');

      execSync(`node "${scriptPath}" "${tempEnv}" "${tempExample}"`, {
        encoding: 'utf8',
      });

      const afterContent = fs.readFileSync(tempEnv, 'utf8');
      expect(afterContent).toBe(existingContent);
    });
  });
});
