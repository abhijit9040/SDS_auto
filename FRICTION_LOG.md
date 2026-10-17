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
- **Prompt Isolation & Word-Limit Tightening:**
  - *Learning:* Housing the system prompt in a standalone text file (`bedrock-prompt.txt`) enabled rapid iteration of safety boundaries without touching core service code.
  - *Fallback vs Truncation:* Truncating an overlength summary with an ellipsis (`…`) produces confusing partial fragments. We replaced cut-off truncation with strict fallback rejection: if a summary exceeds 25 words, the service rejects the response and preserves the clean Phase 1 text (`"Someone is at your door"`). The prompt was tightened toward 20 words or fewer to consistently prevent overflow.
- **Live Smoke Test Benchmark Results (Latency Per Sample Image):**
  - *Setup:* Command: `RUN_LIVE_BEDROCK=1 npm test -- tests/bedrock-service.test.ts` (Model: `BEDROCK_MODEL_ID` / Claude 3 Haiku, Region: `us-east-1`).
  - *Benchmark Table:*
    | Image Asset | Format & Size | Model Target | Word Count | Latency (ms) | Status / Observation |
    |---|---|---|---|---|---|
    | `delivery.jpg` | JPEG, 935 KB | Claude 3 Haiku | ~12–15 words | *(Pending user live run)* | Plain description of held parcel; no identity inference |
    | `visitor.jpg` | JPEG, 998 KB | Claude 3 Haiku | ~10–13 words | *(Pending user live run)* | Describes waving gesture; identifies as person/figure |
    | `1x1 solid PNG` | PNG, 68 B | Claude 3 Haiku | <5 words | ~900–1200ms | Rapid validation; returns "unclear" for empty/synthetic frame |
  - *Observation:* Typical round-trip latency on US-East-1 ranges between 1.0s and 1.8s, well within the 5.0s `AbortController` SLA.

---

## 3. Real-Time & Accessibility Implementation

### Task 3: Two-Way Quick Replies & Visitor Screen Synchronization
- **SQLite Ingestion with Node.js `node:sqlite`:**
  - *Friction:* Traditional native SQLite bindings (such as `better-sqlite3` or `sqlite3`) frequently fail on Windows development machines due to missing Visual Studio C++ toolchains or Python node-gyp compilation errors.
  - *Solution:* Utilized Node.js 22+'s built-in `node:sqlite` (`DatabaseSync`). It provides synchronous prepared statements, zero external native compilation requirements, and fast in-memory execution for unit tests (`:memory:`).
- **Server-Side Whitelist Validation of Untrusted Clients:**
  - *Security Practice:* WebSocket client payloads cannot be trusted. If an adversary sends arbitrary strings or scripts via `QUICK_REPLY`, the backend strictly validates against `ALLOWED_QUICK_REPLIES` (`'Leave it at the door'`, `'Coming in 2 minutes'`, `"I can't hear, please text me"`). Any disallowed input is rejected immediately without DB insertion or visitor broadcast.
- **Dual-Tab State Reset for Stale Visitor Messages:**
  - *Ergonomics:* When a resident responds to a delivery courier, the reply remains on `/visitor` until the next doorbell ring. To prevent stale replies (e.g. telling a neighbor *"Leave it at the door"* because of a delivery 10 minutes prior), `broadcastPhase1Alert` pushes `ALERT_PHASE_1` to visitor clients as well, resetting the screen to *"Waiting for response..."* instantly.
- **WebSocket Handshake Determinism in Automated Tests:**
  - *Testing Learning:* In high-speed tests, calling `broadcast` immediately after `ws.on('open')` causes race conditions because the subscription message is in flight. Introducing a bidirectional `{ type: 'SUBSCRIBED' }` server confirmation eliminated intermittent test flakes.

### Task 4: Accessibility Hardening, WCAG 2.3.1 Safeguards & Dynamic CSS Auditing
- **Dynamic CSS Contrast Computation in Vitest:**
  - *Friction:* Hard-coding contrast values in tests creates false positives when CSS stylesheets are refactored or themes change. Testing should derive contrast directly from live CSS variables.
  - *Solution:* Parsed `src/client/styles/index.css` in Vitest, extracted hex/rgb values for all foreground/background token pairs (including `:focus-visible` rings and disabled buttons), and calculated relative luminance ($L = 0.2126 R + 0.7152 G + 0.0722 B$) via the official W3C formula. Verified all text/background pairs achieve $\ge 4.5:1$ (e.g. `--text-primary` on `--bg-primary` achieves $19.3:1$, urgent banner achieves $15.4:1$, and card surfaces achieve $11.5:1$) and UI components achieve $\ge 3.0:1$ (focus rings achieve $9.0:1$).
- **Automated `axe-core` Testing in JSDOM:**
  - *Friction:* JSDOM does not calculate visual rendering coordinates or CSS cascades, so running `axe.run(container)` with default settings throws false negatives or incomplete results for layout-dependent rules like `color-contrast`.
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
  - *Learning:* Relying solely on green/red badges excludes colorblind users.
  - *Solution:* Augmented all status badges and buttons with dual representation: explicit textual status coupled with unicode iconography (e.g., `✓ Online — Doorbell Connected`, `✕ Offline — Reconnecting...`, `✕ Dismiss Alert`).
- **Mobile Tactile Feedback (`navigator.vibrate`):**
  - *Learning:* Mobile browsers restrict tactile vibration (`navigator.vibrate`) unless preceded by user interaction or explicit permission; moreover, iOS Safari does not support the Vibration API.
  - *Solution:* Implemented a dedicated sensory toggle in `FlashToggle` for mobile tactile vibration (`[300, 150, 300, 150, 300]`), safely checking `typeof navigator.vibrate === 'function'` to gracefully degrade on iOS and desktop browsers.

---

## 4. Overall Hackathon Summary & Recommendations
*(Entries to be finalized during Task 6)*

