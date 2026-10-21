# SignalDoor — Product Feedback & Developer Requests

> **Target Teams:** Ring Developer Platform Team (`api.amazonvision.com`) & Amazon Bedrock Runtime Team (`aws-sdk`).  
> **Authors:** SignalDoor Team (Amazon Developer Hackathon: Ring Track + AWS Builder + Open Source).  
> **Perspective:** Independent developers building assistive smart-home technology for deaf and hard-of-hearing residents.

---

## 1. Ring Developer Platform Feedback & Requests

### 1.1 Webhook Envelope Schema Consistency (`meta.time`)
- **Context:** In the official Ring Developer Documentation, `meta.time` in webhook payloads is illustrated as an epoch timestamp in milliseconds (e.g., `1729000000000`). However, offline emulators and JSON:API implementations (such as `ring-sandbox`) emit UTC ISO-8601 strings (e.g., `"2026-10-17T11:10:52.469284Z"`).
- **Developer Request:** Could the Ring Developer Platform team clarify in the official OpenAPI/JSON:API specification whether `meta.time` is officially an ISO-8601 string or epoch milliseconds, or formally document union type support (`string | number`)? Explicit documentation on this in the schema reference would streamline type generation for TypeScript and Go SDK authors.

### 1.2 Direct Snapshot Previews in Webhooks (Latency Reduction for Accessibility)
- **Context:** Currently, when a visitor rings the doorbell, the partner application receives an event webhook containing device and event metadata. To produce an AI visual description for a deaf resident, the backend must make a secondary outbound HTTP request to `POST /v1/devices/{id}/media/image/download`, wait for media generation and transfer, and then invoke Amazon Bedrock. This introduces additional network latency before multimodal AI analysis can begin.
- **Developer Request:** Would the Ring team consider offering an optional webhook subscription parameter (such as `include_snapshot: true` or `snapshot_format: "jpeg"`) that delivers a short-lived presigned snapshot URL directly in `data.attributes.snapshot_url`? For assistive applications serving deaf residents, eliminating one HTTP round-trip can save valuable seconds, allowing residents to be notified before a delivery driver walks away.

### 1.3 Official First-Party Ring Developer Emulator / Local Mock CLI
- **Context:** Community-created tools like `ring-sandbox` (by Joseph Mayo) are helpful for offline development, but developers must currently infer or reverse-engineer webhook behavior without first-party validation.
- **Developer Request:** We would love if Ring could provide an official first-party Docker container or CLI mock server (similar to the Stripe CLI or AWS LocalStack). An official local sandbox that signs webhooks with HMAC-SHA256, simulates doorbell rings, and provides mock endpoints for `api.amazonvision.com` would dramatically accelerate partner development and eliminate testing bottlenecks on physical hardware.

### 1.4 Tiered Developer Sandbox & Test Credentials
- **Context:** Production Ring partner credentials currently require formal enterprise partner agreements and corporate organizational verification. This prevents independent developers, accessibility researchers, and hackathon teams from testing against live APIs.
- **Developer Request:** Could Ring consider introducing a self-serve "Developer Sandbox / Playground" mode with simulated virtual doorbells and test API keys (similar to Twilio Test Credentials or Stripe Test Mode)? This would empower developers to prototype and validate accessible integrations before requesting formal production partner approvals.

---

## 2. Amazon Bedrock Converse API Feedback & Requests

### 2.1 Multimodal In-Memory Byte Ingestion
- **Positive Feedback:** The Converse API (`@aws-sdk/client-bedrock-runtime`) provides outstanding support for raw in-memory image byte buffers (`image.source.bytes: Uint8Array`) without requiring temporary S3 bucket uploads or local disk caching. This design was crucial for SignalDoor's zero-disk privacy requirement, ensuring camera frames never touch permanent storage.
- **Developer Request:** In `@aws-sdk/client-bedrock-runtime` TypeScript type definitions, `ContentBlock` is modeled as a union of shapes (`{ text?: string } | { image?: ... }`) without a common `.type` discriminator tag. Developers must use `'text' in block && typeof block.text === 'string'` to avoid TypeScript compiler errors. Could the SDK team consider adding a uniform discriminator (e.g., `{ type: 'text', text: string }`), or exporting standard type guards such as `isTextContentBlock(block)`? This would make typed handling of Bedrock outputs much cleaner.

### 2.2 Word-Count Guardrails vs. Hard Token Truncation
- **Context:** Setting `inferenceConfig: { maxTokens: 40 }` can cause multimodal models to cut off mid-word or mid-sentence (e.g., *"A delivery courier holding a pack..."*). In accessibility applications, partial sentence fragments can be confusing or misleading.
- **Developer Request:** Would the Bedrock team consider supporting soft word-count parameters or syntactic sentence-completion guardrails in Bedrock Guardrails? Allowing developers to request "a single complete sentence within 20 words" that naturally completes before stopping would be a valuable enhancement for assistive and notification use cases.

### 2.3 AbortController Integration & Latency Telemetry
- **Positive Feedback:** The AWS SDK v3 seamlessly honors `AbortSignal` via `send(command, { abortSignal })`. In SignalDoor, passing an `AbortController` with a 5.0-second timeout allowed us to guarantee that the user interface never freezes, falling back cleanly to the Phase 1 notification text (*"Someone is at your door"*) whenever network latency fluctuates.
- **Developer Request:** It would be helpful if the SDK's `ResponseMetadata` or returned error object could provide an explicit `serverDurationMs` or `inferenceTimeMs` property when aborts or completions occur, facilitating end-to-end latency monitoring without manual stopwatch wrappers.

---

## 3. Summary & Collaboration

SignalDoor demonstrates how combining Ring doorbells with Amazon Bedrock multimodal AI and WCAG 2.1 AA accessibility safeguards can create life-changing assistive technology for deaf and hard-of-hearing individuals. We welcome direct collaboration with the Ring and AWS developer advocacy teams to further refine these developer experiences.
