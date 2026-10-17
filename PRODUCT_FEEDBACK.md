# SignalDoor — Product Feedback & Developer Recommendations

> **Target Teams:** Ring Developer Platform Team (`api.amazonvision.com`) & Amazon Bedrock Runtime Team (`aws-sdk`).  
> **Author:** SignalDoor Team (Amazon Developer Hackathon: Ring Track + AWS Builder).

---

## 1. Ring Developer Platform Feedback

### 1.1 Webhook Envelope Schema Consistency (`meta.time`)
- **Observation:** In the Ring Developer Documentation, `meta.time` in webhook payloads is shown as an integer epoch timestamp in milliseconds (e.g. `1729000000000`). However, sandbox and API implementations (such as `ring-sandbox`) emit UTC ISO-8601 strings (e.g. `"2026-10-17T11:10:52.469284Z"`).
- **Recommendation:** Clarify in the official OpenAPI/JSON:API specification whether `meta.time` is strictly an ISO-8601 string or epoch milliseconds, or officially document that developers should accept union `string | number` types.

### 1.2 Webhook Direct Snapshot Previews (Latency Reduction for Accessibility)
- **Observation:** Currently, when a doorbell rings, the partner receives a webhook with device and event metadata. To generate an AI visual description for a deaf resident, the server must make a secondary outbound HTTP request to `POST /v1/devices/{id}/media/image/download`, wait for media generation, and then invoke Amazon Bedrock. This adds ~800–1500ms of latency before AI processing starts.
- **Recommendation:** Provide an optional webhook subscription configuration (e.g. `include_snapshot: true`) that provides a temporary presigned snapshot URL directly in `data.attributes.snapshot_url`. For accessibility applications serving deaf residents, saving 1.0s of round-trip latency makes a decisive difference in preventing missed deliveries.

### 1.3 Official First-Party Ring Developer Emulator / Docker Container
- **Observation:** The community-created `ring-sandbox` package (by Joseph Mayo) is well-designed, but third-party emulators require reverse-engineering live payloads.
- **Recommendation:** Offer an official Ring-maintained Docker image or CLI mock server (similar to AWS LocalStack or Stripe CLI). An official local sandbox that signs webhooks with HMAC-SHA256 and mocks `api.amazonvision.com` would accelerate partner testing and eliminate test reliance on physical Ring hardware.

### 1.4 Tiered Sandbox Partner Credentials
- **Observation:** Access to production Ring partner credentials requires formal organizational partnership review, preventing solo developers and hackathon participants from testing live hardware.
- **Recommendation:** Introduce a self-serve "Ring Sandbox / Playground" mode with simulated virtual doorbells and test API keys (similar to Twilio Test Credentials or Stripe Test Mode), allowing developers to build and validate integrations before requesting production approvals.

---

## 2. Amazon Bedrock Converse API Feedback

### 2.1 Multimodal In-Memory Byte Ingestion
- **Positive Experience:** The Converse API (`@aws-sdk/client-bedrock-runtime`) provides clean support for raw in-memory image buffers (`image.source.bytes: Uint8Array`) without requiring temporary S3 uploads or local disk persistence. This was essential for SignalDoor's zero-disk privacy requirement.
- **Improvement Area (ContentBlock Typing):** The TypeScript definitions for `ContentBlock` represent a discriminated union without a uniform `.type` property (e.g. `{ text?: string } | { image?: ... }`). Checking `'text' in block` was required to avoid TypeScript compilation errors. Standardizing to `{ type: 'text', text: string }` would improve developer ergonomics.

### 2.2 Word-Count & Concise Output Constraints
- **Observation:** Setting `inferenceConfig: { maxTokens: 40 }` can cause language models to truncate sentences mid-word or mid-thought (e.g. `"Delivery driver holding a pack..."`).
- **Recommendation:** Provide native support for soft word-count guardrails in Bedrock Guardrails, allowing developers to request full single-sentence summaries without abrupt token-boundary clipping.

### 2.3 AbortController Cancellation Responsiveness
- **Positive Experience:** The AWS SDK v3 cleanly honors `AbortSignal` via `send(command, { abortSignal })`. In SignalDoor, this enabled a strict 5.0-second SLA timeout, ensuring the resident UI falls back smoothly to Phase 1 alert text rather than hanging indefinitely.

---

## 3. Summary & Contact

SignalDoor demonstrates how combining Ring doorbells with Amazon Bedrock multimodal AI and WCAG 2.1 AA accessibility safeguards can create life-changing assistive technology for deaf and hard-of-hearing individuals. We welcome direct collaboration with the Ring and AWS developer advocacy teams.
