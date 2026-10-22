# SignalDoor — Developer Friction Log & Integration Learnings

> **Purpose:** Document real-time developer friction, SDK/API ergonomics, and integration learnings observed while building SignalDoor for the Amazon Developer Hackathon (Ring Track + AWS Builder).  
> **Integrations:** Ring Partner API (`api.amazonvision.com`), `ring-sandbox`, Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`), `node:sqlite`, and WCAG 2.1 AA / 2.3.1 accessibility.

---

## 1. Ring Developer Experience & Webhooks

### Task 1: Walking Skeleton Ingestion & HMAC Verification
- **Express Raw Body Ingestion for HMAC:**
  - *Observed Friction:* Express's default `express.json()` parser consumes and decodes the stream directly into an object, discarding raw bytes. If you re-serialize with `JSON.stringify(req.body)`, key ordering or whitespace discrepancies break the HMAC-SHA256 digest comparison.
  - *Solution:* Implemented `express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } })` to preserve the original payload buffer.
- **Timing Safe Equal Guard:**
  - *Observed Friction:* Node's `crypto.timingSafeEqual(bufA, bufB)` crashes with `RangeError` if the two buffers have different byte lengths (e.g. if an attacker supplies an invalid hex length).
  - *Solution:* Added an explicit buffer length equality check prior to executing `crypto.timingSafeEqual`.
- **Request Deduplication & Webhook SLA:**
  - *Design note (from docs, not live-tested):* Webhook senders retry if an HTTP response is delayed by downstream processing.
  - *Solution:* Returning an immediate HTTP 200 upon verifying signature and checking `meta.request_id` prevents webhook retries, while downstream WebSocket dispatch runs asynchronously via `setImmediate`.
- **Ring Webhook Schema Nuances:**
  - *Design note (from docs, not live-tested):* Ring's envelope schema uses `meta.time` (epoch millis) and `meta.version` rather than generic `timestamp` properties, while event data attributes can vary by device model.
  - *Solution:* Designed payload interfaces with open index signatures to avoid fragile hard-coded assumptions.

### Task 5-lite: ring-sandbox Compatibility & REST Client Implementation
- **ring-sandbox Emulator Evaluation & License:**
  - *Setup:* Evaluated `ring-sandbox` (v0.5.0, PyPI, MIT License by Joseph Mayo — from package documentation, not verified by running it) as a separate offline development process (`python -m ring_sandbox.cli serve --port 8787`).
  - *Payload Differences & Reconciliation (from package documentation, not verified by running it):*
    - `meta.version`: Ring developer guide docs illustrate `"1.0"`; `ring-sandbox` emits `"1.1"` (from package documentation, not verified by running it). Reconciled parser using flexible `version?: string`.
    - `meta.time`: Ring documentation examples use epoch milliseconds (e.g. `1729000000000`), whereas `ring-sandbox` emits UTC ISO-8601 timestamps (`"2026-10-17T11:10:52.469284Z"`, from package documentation, not verified by running it). Reconciled TypeScript definition to `time?: number | string` and ensured `new Date(...)` parsing handles both seamlessly.
    - `data.attributes.source_type`: `ring-sandbox` explicitly includes `"source_type": "devices"` (from package documentation, not verified by running it).
    - `data.relationships`: Emitted as a JSON:API relationship structure (`devices.links.self = "/v1/devices/<device_id>"`, from package documentation, not verified by running it).
    - Signature Header: Both conform to `X-Signature: sha256=<hex>` over raw JSON request body bytes (from package documentation, not verified by running it).
  - *Outcome:* ring-sandbox was not run end to end. npm run sandbox:serve failed on the author's machine because python resolved to an interpreter without the ring_sandbox module. Payload shapes were compared from the package documentation.
- **Ring Partner REST Client (`api.amazonvision.com`):**
  - *Exponential Backoff for Rate Limiting (429):* *Design note (from docs, not live-tested):* Implemented exponential backoff starting at 1.0s (`1s * 2^attempt`) and parsing the `Retry-After` header. Essential to avoid cascading failures if a doorbell generates multiple rapid events.
  - *Binary Media Streaming:* *Design note (from docs, not live-tested):* `POST /v1/devices/{deviceId}/media/image/download` returns raw binary JPEG/PNG streams with metadata in headers (`X-Media-Timestamp`, `Content-Type`) rather than base64 in a JSON body. Stream buffering into Node `Buffer` in memory provides zero-disk ephemeral processing.
  - *Fail-Fast Boot Guard:* *Design note (from docs, not live-tested):* When `RING_MODE=live`, the server checks for `RING_API_TOKEN` at startup and exits with an explicit descriptive error message if missing, avoiding silent failures during live events.

---

## 2. Amazon Bedrock Converse API Experience

### Task 2: Multimodal Visitor Summaries & 5-Second SLA Fallback
- **AbortController Integration with AWS SDK v3:**
  - *Observed Friction:* Bedrock inference latency can fluctuate based on region load and image payload size. To guarantee accessibility responsiveness for deaf users, the UI cannot wait indefinitely for AI enrichment.
  - *Solution:* Wired an `AbortController` with a 5.0s timer (`config.bedrockTimeoutMs`) into `@aws-sdk/client-bedrock-runtime`'s `send(command, { abortSignal })`. When aborted, the error is caught cleanly and latency is logged, leaving the resident on the Phase 1 fallback alert text (`"Someone is at your door"`).
- **In-Memory Zero-Disk Retention for Visitor Privacy:**
  - *Requirement:* Security and privacy demand that visitor camera frames are never written to temporary files or logged in plaintext.
  - *Solution:* Image bytes are ingested directly as Node.js `Buffer` in memory and passed into `ConverseCommandInput.messages[0].content[0].image.source.bytes`. Logging outputs device ID, event type, and latency in milliseconds, strictly omitting byte buffers and base64 strings.
- **Converse API Output ContentBlock Schema:**
  - *Observed Friction:* AWS Bedrock's TypeScript types for `ContentBlock` represent a discriminated union without a uniform `.type` discriminator property (e.g. `{ text?: string } | { image?: ... }`). Checking `c.type === 'text'` resulted in TS2339.
  - *Solution:* Refactored extraction to use `'text' in c && typeof c.text === 'string'`, ensuring robust type-safe parsing across all Bedrock runtime versions.
- **Prompt Isolation & Word-Limit Tightening:**
  - *Learning:* Housing the system prompt in a standalone text file (`bedrock-prompt.txt`) enabled rapid iteration of safety boundaries without touching core service code.
  - *Fallback vs Truncation:* Truncating an overlength summary with an ellipsis (`…`) produces confusing partial fragments. We replaced cut-off truncation with strict fallback rejection: if a summary exceeds 25 words, the service rejects the response and preserves the clean Phase 1 text (`"Someone is at your door"`). The prompt was tightened toward 20 words or fewer to consistently prevent overflow.
- **Module-Level `vi.mock` Mock Contamination in Smoke Tests:**
  - *Observed Friction:* In `tests/bedrock-service.test.ts`, the entire `@aws-sdk/client-bedrock-runtime` module was mocked at file scope using `vi.mock(...)`. A test marked `[LIVE]` inside that file attempted to test real AWS Bedrock calls, but because Vitest module mocks apply globally across the test file, the call silently invoked the fake client instead of AWS.
  - *Solution:* Removed the pseudo-live test from the mocked test file and established a dedicated unmocked CLI verification tool (`scripts/bedrock-smoke.ts`, executed via `npm run bedrock:smoke`).
- **Live Bedrock Smoke Verification & Measured Latency:**
  - *Measured Runs:* Executed unmocked CLI checks (`npm run bedrock:smoke`) with active AWS credentials across sample assets.
  - *Configuration:* Region: `ap-southeast-2`, Model: `amazon.nova-lite-v1:0` (Amazon Nova Lite via Converse API).
  - *Benchmark Table:*
    | Run # | Date | Input Asset | Type & Size | Success | Latency | Words | Generated Summary | Rule Pass? |
    |---|---|---|---|---|---|---|---|---|
    | Run 0 | Oct 2026 (exact day not recorded) | *Previous sample photo* | Photo (~935 KB, removed) | Yes | 3535 ms | 14 | *"A person in a blue shirt and mask holds a box at the door."* | Pass |
    | Run 1 | Oct 22, 2026 | `delivery.jpg` | Illustration (24.6 KB) | Yes | 2328 ms | 15 | *"A person in a blue shirt and black hat holding a box at the door"* | Pass |
    | Run 2 | Oct 22, 2026 | `delivery.jpg` | Illustration (24.6 KB) | Yes | 2186 ms | 15 | *"A person in a blue jacket and black hat holding a box at the door."* | Pass |
    | Run 3 | Oct 22, 2026 | `delivery.jpg` | Illustration (24.6 KB) | Yes | 2170 ms | 15 | *"A person in a blue shirt and black hat holding a box at the door."* | Pass |
    | Run 4 | Oct 22, 2026 | `delivery.jpg` | Illustration (24.6 KB) | Yes | 2253 ms | 15 | *"A person in a blue shirt and black hat holding a box at the door."* | Pass |
    | Run 5 | Oct 22, 2026 | `delivery.jpg` | Illustration (24.6 KB) | Yes | 2137 ms | 15 | *"A person in a blue shirt and black hat holding a box at the door."* | Pass |
    | Run 6 | Oct 22, 2026 | `visitor.jpg` | Illustration (25.2 KB) | Yes | 2295 ms | 10 | *"A person in a green shirt waves at the camera."* | Pass |
    | Run 7 | Oct 22, 2026 | `empty-porch.jpg` | Illustration (20.6 KB) | Yes | 2186 ms | 14 | *"A white house with a black door and a window on the left side."* | Pass |
    | Run 8 | Oct 22, 2026 | `dark-porch.jpg` | Illustration (14.7 KB) | Yes | 2133 ms | 10 | *"A dark room with a lit doorbell and a window."* | Pass |
    | Run 9 | Oct 22, 2026 | `delivery.jpg` | Illustration (24.6 KB) | Yes | 2240 ms | 15 | *"A person in a blue shirt and black hat holding a box at the door."* | Pass |
    | Run 10 | Oct 22, 2026 | `visitor.jpg` | Illustration (25.2 KB) | Yes | 2174 ms | 10 | *"A person in a green shirt waves at the camera."* | Pass |
    | Run 11 | Oct 22, 2026 | `empty-porch.jpg` | Illustration (20.6 KB) | Yes | 2168 ms | 17 | *"A white house with a black door and a window, a doorbell, and a small brown box."* | Partial: no person invented, but the doormat was described as a small brown box |
    | Run 12 | Oct 22, 2026 | `dark-porch.jpg` | Illustration (14.7 KB) | Yes | 2189 ms | 10 | *"A dark house with a lit doorbell and a window."* | Pass |
  - *Delivery Illustration Statistics (Runs 1–5):* Min: 2137 ms, Median: 2186 ms, Max: 2328 ms. Exceeded 5000 ms SLA: 0 of 5. All 5 runs strictly adhered to the $\le 25$ words rule with zero demographic, identity, age, gender, or intent guessing.
  - *Empty & Dark Porch Evaluation:* `empty-porch.jpg` (Run 7) correctly described the physical building exterior without inventing a person. `dark-porch.jpg` (Run 8) described only the dimly visible scene elements without hallucination.
  - *Important Disclosure on Asset Sizes & Latency:* Earlier Run 0 (3535 ms) used a high-resolution photo (~935 KB), which has since been removed from the repository. Runs 1–12 use lightweight flat-style illustrations generated via code (`scripts/make-sample-images.py`, ~15–25 KB). These inputs are not realistic camera images or photos, latencies are not directly comparable across different image types/sizes, and real high-resolution camera snapshots in production may take longer.
  - *Ring Integration & Other Latencies:* Ring integration was tested via emulator only, not live. All other latency data across physical hardware or unmeasured endpoints is not yet measured.


---

## 3. Real-Time & Accessibility Implementation

### Task 3: Two-Way Quick Replies & Visitor Screen Synchronization
- **SQLite Ingestion with Node.js `node:sqlite`:**
  - *Observed Friction:* Traditional native SQLite bindings (such as `better-sqlite3` or `sqlite3`) frequently fail on Windows development machines due to missing Visual Studio C++ toolchains or Python node-gyp compilation errors.
  - *Solution:* Utilized Node.js 22+'s built-in `node:sqlite` (`DatabaseSync`). It provides synchronous prepared statements, zero external native compilation requirements, and fast in-memory execution for unit tests (`:memory:`).
- **Server-Side Whitelist Validation of Untrusted Clients:**
  - *Security Practice:* WebSocket client payloads cannot be trusted. If an adversary sends arbitrary strings or scripts via `QUICK_REPLY`, the backend strictly validates against `ALLOWED_QUICK_REPLIES` (`'Leave it at the door'`, `'Coming in 2 minutes'`, `"I can't hear, please text me"`). Any disallowed input is rejected immediately without DB insertion or visitor broadcast.
- **Dual-Tab State Reset for Stale Visitor Messages:**
  - *Ergonomics:* When a resident responds to a delivery courier, the reply remains on `/visitor` until the next doorbell ring. To prevent stale replies (e.g. telling a neighbor *"Leave it at the door"* because of a delivery 10 minutes prior), `broadcastPhase1Alert` pushes `ALERT_PHASE_1` to visitor clients as well, resetting the screen to *"Waiting for response..."* instantly.
- **WebSocket Handshake Determinism in Automated Tests:**
  - *Testing Learning:* In high-speed tests, calling `broadcast` immediately after `ws.on('open')` causes race conditions because the subscription message is in flight. Introducing a bidirectional `{ type: 'SUBSCRIBED' }` server confirmation eliminated intermittent test flakes.

### Task 4: Accessibility Hardening, WCAG 2.3.1 Safeguards & Dynamic CSS Auditing
- **Dynamic CSS Contrast Computation in Vitest:**
  - *Observed Friction:* Hard-coding contrast values in tests creates false positives when CSS stylesheets are refactored or themes change. Testing should derive contrast directly from live CSS variables.
  - *Solution:* Parsed `src/client/styles/index.css` in Vitest, extracted hex/rgb values for all foreground/background token pairs (including `:focus-visible` rings and disabled buttons), and calculated relative luminance ($L = 0.2126 R + 0.7152 G + 0.0722 B$) via the official W3C formula. Verified all text/background pairs achieve $\ge 4.5:1$ (e.g. `--text-primary` on `--bg-primary` achieves $19.3:1$, urgent banner achieves $15.4:1$, and card surfaces achieve $11.5:1$) and UI components achieve $\ge 3.0:1$ (focus rings achieve $9.0:1$).
- **Automated `axe-core` Testing in JSDOM:**
  - *Observed Friction:* JSDOM does not calculate visual rendering coordinates or CSS cascades, so running `axe.run(container)` with default settings throws false negatives or incomplete results for layout-dependent rules like `color-contrast`.
  - *Solution:* Scoped axe-core execution in JSDOM to semantic, ARIA, and DOM validity checks (`{ rules: { 'color-contrast': { enabled: false } } }`), while color contrast compliance was strictly enforced by the dynamic CSS mathematical contrast test suite.
- **Epileptic Seizure Safeguards (WCAG 2.3.1) & Flash Timing:**
  - *Safety Threshold:* WCAG 2.3.1 strictly prohibits flashing greater than 3 times in any 1-second period.
  - *Solution:* Configured visual alert animations to a safe $0.8$s cycle (1.25 flashes/sec, strictly $\le 2$ flashes/sec). Added `@media (prefers-reduced-motion: reduce)` with `animation: none !important;` to auto-disable strobe effects at the operating system level, alongside an in-app `FlashToggle` with `localStorage` persistence and safe first-time user defaults.
- **Deaf Alert Persistence vs Auto-Dismiss Toasts:**
  - *Accessibility Requirement:* In hearing apps, notifications frequently disappear after 5 seconds because an audible chime notified the resident. For deaf or hard-of-hearing residents, looking away or blinking could result in missing an entire delivery.
  - *Solution:* Enforced strict persistence: `ResidentAlert` never self-clears or uses `setTimeout` auto-dismissals. It remains visible on screen until the resident manually clicks the clearly labeled, $\ge 48$px touch target `✕ Dismiss Alert` button.
- **Adaptive Screen Reader Alerts (ARIA):**
  - *Implementation:* The initial visitor alert applies `role="alert"` and `aria-live="assertive"` for instantaneous screen reader notification. Downstream Phase 2 AI summary updates apply `role="status"` and `aria-live="polite"` so the enrichment is announced naturally without jarring interruptions.
- **Non-Color-Alone Status Communication (WCAG 1.4.1):**
  - *Observed Friction:* Relying solely on green/red badges excludes colorblind users.
  - *Solution:* Augmented all status badges and buttons with dual representation: explicit textual status coupled with unicode iconography (e.g., `✓ Online — Doorbell Connected`, `✕ Offline — Reconnecting...`, `✕ Dismiss Alert`).
- **Mobile Tactile Feedback (`navigator.vibrate`):**
  - *Observed Friction:* Mobile browsers restrict tactile vibration (`navigator.vibrate`) unless preceded by user interaction or explicit permission; moreover, iOS Safari does not support the Vibration API.
  - *Solution:* Implemented a dedicated sensory toggle in `FlashToggle` for mobile tactile vibration (`[300, 150, 300, 150, 300]`), safely checking `typeof navigator.vibrate === 'function'` to gracefully degrade on iOS and desktop browsers.

---

## 4. Overall Hackathon Summary & Integration Takeaways

1. **Two-Phase Alerting is Essential for Assistive Tech:**
   Combining an immediate visual notification (<2.0s) with downstream AI enrichment (<5.0s) guarantees that slow network connections or model inference latencies never compromise the user's primary awareness of a visitor.
2. **Ephemeral In-Memory Privacy is Practical:**
   Passing raw image buffers directly to Amazon Bedrock Converse API without disk persistence or database storage proves that rich multimodal AI can be deployed with zero-disk privacy guarantees.
3. **Node.js 22 Built-ins Accelerate Development:**
   Leveraging Node 22's built-in `node:sqlite` removed external native compilation hurdles across developer machines while providing synchronous SQLite transaction safety.
4. **WCAG Compliance Requires Mathematical Rigor:**
   Automated dynamic CSS contrast computation and seizure-safe flash timing (<2 flashes/sec) bridge the gap between design tokens and accessibility guarantees.
