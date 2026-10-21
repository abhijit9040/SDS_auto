import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const targetEnvPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), '.env');

const sourceExamplePath = process.argv[3]
  ? path.resolve(process.cwd(), process.argv[3])
  : path.resolve(process.cwd(), '.env.example');

if (fs.existsSync(targetEnvPath)) {
  console.log(
    `[setup-env] Target environment file already exists at ${path.basename(targetEnvPath)}. Preserving existing configuration without modification.`
  );
  process.exit(0);
}

if (!fs.existsSync(sourceExamplePath)) {
  console.error(`[setup-env] Error: Template file not found at ${sourceExamplePath}`);
  process.exit(1);
}

const exampleContent = fs.readFileSync(sourceExamplePath, 'utf8');

// Generate 32-byte (64 hex characters) cryptographically secure random secrets
const ringWebhookSecret = crypto.randomBytes(32).toString('hex');
const internalDevSecret = crypto.randomBytes(32).toString('hex');

let newEnvContent = exampleContent
  .replace(/^RING_WEBHOOK_SECRET=.*$/m, `RING_WEBHOOK_SECRET=${ringWebhookSecret}`)
  .replace(/^INTERNAL_DEV_SECRET=.*$/m, `INTERNAL_DEV_SECRET=${internalDevSecret}`);

fs.writeFileSync(targetEnvPath, newEnvContent, { encoding: 'utf8', mode: 0o600 });
console.log(
  `[setup-env] Successfully initialized ${path.basename(targetEnvPath)} from template with random 32-byte secrets.`
);
