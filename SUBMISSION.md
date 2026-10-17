# Devpost Submission — SignalDoor

> **Hackathon:** Build, Ship, Shape: Amazon Developer Hackathon  
> **Tracks Entered:** Ring Track • AWS Builder Track • Open Source Mini-Challenge  
> **Repository:** [https://github.com/abhijit9040/SDS_auto](https://github.com/abhijit9040/SDS_auto)  
> **Demo Video:** [Link to 3-minute Demo Video]  

---

## 1. Project Title
**SignalDoor — Accessible, Visual, Two-Way Smart Doorbell for Deaf & Hard-of-Hearing Residents**

---

## 2. Elevator Pitch / Short Description (1-2 Sentences)
SignalDoor transforms Ring doorbells into an accessible, visual communication hub for deaf and hard-of-hearing individuals, delivering instant seizure-safe visual alerts (<2.0s), Amazon Bedrock multimodal AI visitor summaries (<5.0s), and accessible two-way quick replies to a dedicated exterior visitor screen.

---

## 3. Inspiration
Over 430 million people worldwide live with disabling hearing loss. Yet nearly all smart home doorbells and chimes are built with an inherent auditory bias: loud chimes, audio rings, and two-way voice intercoms.

When a visitor rings, deaf individuals face significant daily friction:
- **Missed deliveries:** Couriers ring and leave after 10 seconds when no sound is acknowledged.
- **Ambiguous alerts:** Smartphone push notifications say *"Motion detected"* or *"Doorbell rang"*, forcing residents to open an app and wait for video streams without knowing if it's a delivery, a neighbor, or an emergency.
- **Communication barriers:** Audio intercoms are completely inaccessible for non-verbal or deaf individuals.

We built **SignalDoor** to give deaf and hard-of-hearing residents full independence, security, and two-way communication at their front door.

---

## 4. What It Does

SignalDoor is a complete, accessible smart doorbell system connecting Ring doorbells to both resident and visitor interfaces:

1. **Immediate High-Contrast Visual Alert (<2.0s):**
   - The instant a doorbell event triggers, the resident screen displays a full-screen, high-contrast alert banner (**19.3:1 contrast ratio**, far exceeding WCAG AA).
   - Features a calm visual strobe (0.8s cycle = 1.25 flashes/second) strictly capped below the 2.0 flashes/sec threshold to eliminate photosensitive seizure risks (WCAG 2.3.1).
   - Automatically respects OS-level `prefers-reduced-motion` and includes an in-app `FlashToggle` with persistent settings.
   - **Persistent Alert Guarantee:** Hearing apps auto-dismiss notifications after 5 seconds because residents heard a chime. SignalDoor alerts never auto-clear on a timer—they remain visible until explicitly dismissed via an accessible $\ge 48$px touch target.

2. **Amazon Bedrock Multimodal AI Visitor Context (<5.0s):**
   - In the background, Amazon Bedrock analyzes the camera snapshot using Claude 3 Haiku via the Converse API.
   - Within 5.0 seconds, the alert enriches with an objective plain-language summary (e.g., *"A delivery courier in uniform holding a parcel on the porch"*).
   - **Responsible AI Guardrails:** System prompts strictly forbid guessing identity, age, gender, ethnicity, or criminal intent. If an image is ambiguous, it returns *"unclear"*.
   - **Two-Phase Fallback Resilience:** If Bedrock times out or encounters high latency, an `AbortController` cleanly falls back to Phase 1 text (*"Someone is at your door"*) without UI delays or confusing error states.

3. **Accessible Two-Way Quick Replies (<1.5s):**
   - Deaf residents cannot use voice intercoms. SignalDoor provides three one-tap quick replies with large 48px touch targets:
     - *"Leave it at the door"*
     - *"Coming in 2 minutes"*
     - *"I can't hear, please text me"*
   - The backend strictly whitelists inputs, records the transaction in an internal SQLite audit ledger (`node:sqlite`), and pushes the message to the visitor screen.

4. **Dedicated Exterior Visitor Display (`/visitor`):**
   - An exterior-facing screen displays the resident's response in large (32px), high-contrast text with delivery timestamps.
   - **Anti-Stale Reset:** When a new visitor rings, the exterior screen automatically resets back to *"Waiting for response..."* so outdated instructions from a prior delivery are never shown to a new visitor.

---

## 5. How We Built It

We designed SignalDoor as an enterprise-grade TypeScript monorepo combining modern web standards, native Node.js capabilities, and AWS cloud intelligence:

- **Ring Webhook Ingestion & HMAC Security:**
  - Ingestion endpoint at `POST /webhooks/ring`.
  - Captures raw request body buffers in Express and verifies `X-Signature: sha256=<hex>` using `crypto.timingSafeEqual` with byte-length crash guards.
  - Returns HTTP 200 immediately upon signature validation and `meta.request_id` deduplication, delegating WebSocket broadcast to `setImmediate`.
- **Ring Partner REST Client (`api.amazonvision.com`):**
  - Implemented `RingRestClient` for device discovery (`GET /v1/devices`) and binary snapshot media retrieval (`POST /v1/devices/{id}/media/image/download`).
  - Implements exponential backoff on HTTP 429 rate limits, honors `Retry-After` headers, and includes fail-fast configuration guards.
  - Verified compatibility with `ring-sandbox` v1.1 open-source emulator.
- **Amazon Bedrock Converse API:**
  - Connected using `@aws-sdk/client-bedrock-runtime` with Claude 3 Haiku.
  - **Zero-Disk In-Memory Privacy:** Image bytes are buffered strictly in Node memory and transmitted directly as `Uint8Array`. No visitor images are written to disk, cached, or logged.
  - Enforces a 5.0-second SLA timeout using `AbortController`.
- **Real-Time WebSockets & Node.js 22 SQLite:**
  - Real-time event propagation via `ws` with deterministic connection handshake confirmations.
  - Persists all quick-reply interactions using Node 22's built-in `node:sqlite` (`DatabaseSync`), avoiding external C++ compilation dependencies.
- **Frontend & Accessibility Architecture:**
  - Built with React 19 and Vite.
  - Styling in pure Vanilla CSS design tokens ([`src/client/styles/index.css`](src/client/styles/index.css)).
  - Mathematically validated color contrast: 19.3:1 primary text, 15.4:1 alert banner, 9.0:1 focus rings.
  - Automated `axe-core` accessibility audits integrated into CI.

---

## 6. Challenges We Ran Into

1. **Express Raw Body Ingestion for HMAC Verification:**
   Express's default JSON parser deserializes into a JavaScript object, discarding raw byte sequences. Re-serializing with `JSON.stringify` altered spacing and broke signature verification. We solved this using Express's `verify` callback to preserve the untouched `rawBody` buffer.
2. **Timing Safe Equal Guard:**
   Node's `crypto.timingSafeEqual` throws a fatal `RangeError` if the two compared buffers have different byte lengths. We implemented an explicit buffer length validation step before invoking the timing-safe comparator.
3. **Balancing Real-Time Notification with AI Latency:**
   Deaf residents cannot wait 3–5 seconds for an AI model before learning someone is at the door. We resolved this by inventing our **Two-Phase Alert Architecture**: Phase 1 visual strobe triggers in <2 seconds with fallback text, while Phase 2 Bedrock enrichment arrives smoothly via `aria-live="polite"` once generated.
4. **Bedrock Converse API Union Typings in TypeScript:**
   AWS SDK v3 types `ContentBlock` as a union without a common `.type` discriminator property. Checking `block.type === 'text'` resulted in TypeScript compiler errors (TS2339). We resolved this using type-safe `'text' in block && typeof block.text === 'string'` guards.
5. **Headless Dynamic CSS Contrast Testing:**
   Hard-coding contrast numbers in tests creates brittle audits. We engineered a Vitest test suite that parses the actual CSS variables directly from `index.css` and calculates relative luminance ($L = 0.2126 R + 0.7152 G + 0.0722 B$) via the official W3C formula.

---

## 7. Accomplishments That We're Proud Of

- **59 Automated Tests Passing Across 6 Suites:** Comprehensive coverage spanning webhook HMAC ingestion, Bedrock Converse API timeouts, quick reply validation, SQLite persistence, Ring REST client error handling, and axe-core accessibility audits.
- **19.3:1 Dynamic Color Contrast:** Surpassing WCAG 2.1 AA standards (4.5:1) with a high-contrast dark theme designed specifically for deaf and low-vision users.
- **WCAG 2.3.1 Seizure Safety:** Visual pulse cycle of 0.8s (1.25 flashes/sec), safely below the 2.0/s cap and far from the 3.0 Hz danger threshold, paired with OS `prefers-reduced-motion` auto-disabling.
- **Zero-Disk In-Memory Privacy Pipeline:** Absolute privacy guarantee—visitor frames are never written to disk, stored in temporary files, or leaked into telemetry logs.
- **Honest & Transparent Engineering:** Complete live-vs-emulator disclosure table, clear documentation, and clean offline evaluation without hardware dependencies.

---

## 8. What We Learned

- **Accessibility Must Be Architectural:** Building for deaf and hard-of-hearing users isn't just about large text—it requires rethinking alert persistence, timing fallbacks, non-auditory two-way feedback, and photosensitive safety.
- **Power of Node 22 Built-ins:** Using built-in `node:sqlite` eliminated cross-platform compilation headaches that typically plague native SQLite bindings on Windows and CI runners.
- **Bedrock Converse API Ergonomics:** The Converse API makes multimodal in-memory image processing clean and straightforward, eliminating the need to intermediate through S3 buckets.

---

## 9. What's Next for SignalDoor

- **Smartwatch & Wearable Haptic Integration:** Expanding alerts to Apple Watch and Wear OS with distinct vibrotactile patterns for different visitor types (courier vs. guest).
- **Smart Bulb & IoT Strobe Integration:** Direct integration with Philips Hue and Zigbee/Z-Wave smart bulbs to flash ambient home lighting when the doorbell rings.
- **Customizable Resident Quick Replies:** Allowing residents to configure personalized quick-reply buttons (e.g., *"Please place packages behind the gate"*).
- **Production Ring Partner Deployment:** Pursuing official Ring Partner OAuth approval to bring SignalDoor to commercial Ring App users worldwide.

---

## 10. Track Nominations & Specific Challenge Questions

### 10.1 Ring Track Nomination
SignalDoor directly addresses the Ring Track by extending Ring smart doorbells into an accessible assistive platform:
- Implements the official Ring Partner Webhook specification with HMAC-SHA256 signature verification.
- Implements the official Ring Partner REST API (`RingRestClient`) for device discovery (`GET /v1/devices`) and binary image snapshot retrieval (`POST /v1/devices/{id}/media/image/download`).
- Fully tested against the open-source `ring-sandbox` emulator.
- Adds a groundbreaking two-way exterior visitor screen (`/visitor`) that bridges the communication gap between visitors and deaf residents.

### 10.2 AWS Builder Track Nomination
SignalDoor leverages Amazon Bedrock as the core multimodal cognitive engine:
- Integrates the Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) with Anthropic Claude 3 Haiku.
- Features isolated responsible-AI prompt engineering ([`bedrock-prompt.txt`](src/server/services/bedrock-prompt.txt)) with zero demographic inference, anti-hallucination guardrails, and plain-language limits ($\le 20$ words).
- Enforces an `AbortController` 5.0-second SLA timeout with graceful Two-Phase fallback.
- Operates with 100% ephemeral in-memory byte buffers for strict privacy compliance.

### 10.3 Open Source Mini-Challenge Nomination
SignalDoor is completely open-source and engineered for community adoption:
- Permissive **MIT License** ([LICENSE](LICENSE)).
- Clean, verified **Quickstart** for a fresh clone (`git clone`, `npm install`, `cp .env.example .env`, `npm run dev`).
- Honest live-vs-emulator comparison table clearly distinguishing production hardware from offline testing.
- Comprehensive third-party license disclosures table in `README.md`.
- 59 automated tests passing with zero external native compilation requirements.

### 10.4 Friction Log & Product Feedback Bonus
- **`FRICTION_LOG.md`:** Detailed 4-section log documenting 12 specific observed friction points and production-grade engineering solutions across Ring webhooks, AWS Bedrock Converse API, SQLite, and WCAG accessibility.
- **`PRODUCT_FEEDBACK.md`:** Polished product feedback written as polite, constructive developer requests for the Ring Developer Platform and Amazon Bedrock teams.

---

## 11. Links & Resources

- **GitHub Repository:** [https://github.com/abhijit9040/SDS_auto](https://github.com/abhijit9040/SDS_auto)
- **Demo Script:** [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- **Developer Friction Log:** [`FRICTION_LOG.md`](FRICTION_LOG.md)
- **Product Feedback & Requests:** [`PRODUCT_FEEDBACK.md`](PRODUCT_FEEDBACK.md)
- **Architecture Documentation:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Requirements Specification:** [`SPEC.md`](SPEC.md)
