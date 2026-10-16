# SignalDoor — Developer Friction Log & Product Feedback

> **Purpose:** Document real-time developer friction, SDK/API ergonomics, and integration learnings while building SignalDoor for the Amazon Developer Hackathon (Ring Track + AWS Builder).

---

## 1. Ring Developer Experience & Webhooks

### Task 1: Walking Skeleton Ingestion & HMAC Verification
- **Express Raw Body Ingestion for HMAC:**
  - *Friction:* Express's default `express.json()` parser consumes and decodes the stream directly into an object, discarding raw bytes. If you re-serialize with `JSON.stringify(req.body)`, key ordering or whitespace discrepancies break the HMAC-SHA256 digest comparison.
  - *Solution:* Implemented `express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } })` to preserve the original payload buffer.
- **Timing Safe Equal Guard:**
  - *Friction:* Node's `crypto.timingSafeEqual(bufA, bufB)` crashes with `RangeError` if the two buffers have different byte lengths (e.g. if an attacker supplies an invalid hex length).
  - *Solution:* Added an explicit buffer length equality check prior to executing `crypto.timingSafeEqual`.
- **Request Deduplication & Webhook SLA:**
  - *Learning:* Returning an immediate HTTP 200 upon verifying signature and checking `meta.request_id` prevents webhook retries, while downstream WebSocket dispatch runs asynchronously via `setImmediate`.
- **Ring Webhook Schema Nuances:**
  - *Learning:* Ring's envelope schema uses `meta.time` (epoch millis) and `meta.version` rather than generic `timestamp` properties, while event data attributes can vary by device model. Designed payload interfaces with open index signatures to avoid fragile hard-coded assumptions.

---

## 2. Amazon Bedrock Converse API Experience

### Task 2: Multimodal Visitor Summaries & 5-Second SLA Fallback
- **AbortController Integration with AWS SDK v3:**
  - *Friction:* Bedrock inference latency can fluctuate based on region load and image payload size. To guarantee accessibility responsiveness for deaf users, the UI cannot wait indefinitely for AI enrichment.
  - *Solution:* Wired an `AbortController` with a 5.0s timer (`config.bedrockTimeoutMs`) into `@aws-sdk/client-bedrock-runtime`'s `send(command, { abortSignal })`. When aborted, the error is caught cleanly and latency is logged, leaving the resident on the Phase 1 fallback alert text (`"Someone is at your door"`).
- **In-Memory Zero-Disk Retention for Visitor Privacy:**
  - *Requirement:* Security and privacy demand that visitor camera frames are never written to temporary files or logged in plaintext.
  - *Solution:* Image bytes are ingested directly as Node.js `Buffer` in memory and passed into `ConverseCommandInput.messages[0].content[0].image.source.bytes`. Logging outputs device ID, event type, and latency in milliseconds, strictly omitting byte buffers and base64 strings.
- **Converse API Output ContentBlock Schema:**
  - *Friction:* AWS Bedrock's TypeScript types for `ContentBlock` represent a discriminated union without a uniform `.type` discriminator property (e.g. `{ text?: string } | { image?: ... }`). Checking `c.type === 'text'` resulted in TS2339.
  - *Solution:* Refactored extraction to use `'text' in c && typeof c.text === 'string'`, ensuring robust type-safe parsing across all Bedrock runtime versions.
- **Prompt Isolation for Accessibility Tuning:**
  - *Learning:* Housing the system prompt in a standalone text file (`bedrock-prompt.txt`) enabled rapid iteration of safety boundaries (e.g., hard 25-word limit, zero identity/ethnicity guessing, graceful "unclear" fallbacks) without touching core service code.

---

## 3. Real-Time & Accessibility Implementation
*(Entries to be added during Tasks 3 & 4 implementation)*

---

## 4. Overall Hackathon Summary & Recommendations
*(Entries to be finalized during Task 6)*
