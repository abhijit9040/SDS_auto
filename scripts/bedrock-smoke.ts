// Real (unmocked) Bedrock check. Run: npx tsx scripts/bedrock-smoke.ts [path/to/image.jpg]
import 'dotenv/config';
import { readFileSync } from 'fs';
import { BedrockService } from '../src/server/services/bedrock.js';
import { config } from '../src/server/config.js';

const file = process.argv[2] ?? 'src/server/assets/sample-visitors/delivery.jpg';
const mimeType = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

console.log(`region=${config.awsRegion} model=${config.bedrockModelId} image=${file}`);
const result = await new BedrockService().describeVisitor({
  imageBuffer: readFileSync(file),
  mimeType,
  metadata: { deviceId: 'smoke-test', eventType: 'button_press' },
  timeoutMs: 15000,
});
console.log(result);
