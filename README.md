# SignalDoor — Deaf-Friendly Smart Doorbell

> **An accessible, visual, two-way smart doorbell interface for deaf and hard-of-hearing individuals.**  
> Built for the **Build, Ship, Shape: Amazon Developer Hackathon** (Ring Track + AWS Builder + Open Source).

---

## 1. Overview

Traditional smart doorbells rely almost exclusively on audio chimes or small smartphone push notifications. For deaf and hard-of-hearing residents, this creates significant daily friction: missed package deliveries, ignored family or emergency visitors, and awkward interactions where visitors assume nobody is home.

**SignalDoor** transforms the Ring smart doorbell into an inclusive, accessible communication hub:
1. **Immediate High-Contrast Visual Alert (<2.0s):** Full-screen, high-contrast (WCAG AA $\ge 4.5:1$, primary text achieves **19.3:1**), large-typography alert with seizure-safe flashing ($\le 2$ flashes/sec, respecting `prefers-reduced-motion` and user sensory toggles).
2. **Bedrock Multimodal AI Visitor Context (<5.0s):** Amazon Nova Lite via the Bedrock Converse API (region and model are configurable) inspects the camera snapshot in memory and provides a single-sentence plain-language summary ($\le 20$ words) of who is at the door, without guessing identity, age, or intent.
3. **Instant Two-Way Quick Replies:** Residents can tap accessible, $\ge 48$px touch-target replies (*"Leave it at the door"*, *"Coming in 2 minutes"*, *"I can't hear, please text me"*) that render immediately on a dedicated exterior visitor screen ([`/visitor`](http://localhost:5173/visitor)) with full SQLite audit logging.

---

## 2. Live vs. Emulator Comparison (Honest Disclosure)

SignalDoor is engineered with a clean adapter architecture (`RingAdapter`) that supports both real Ring hardware and offline developer emulators.

| Capability / Dimension | Live Partner API (`RING_MODE=live`) | Emulator Mode (`RING_MODE=emulator` — Default) |
|---|---|---|
| **Doorbell Event Ingestion** | Live Ring Webhook pushed to `POST /webhooks/ring` | Local simulator or `ring-sandbox` CLI pushing to `POST /webhooks/ring` |
| **HMAC-SHA256 Verification** | Real `X-Signature: sha256=<hex>` verified with `crypto.timingSafeEqual` | Identical real `X-Signature: sha256=<hex>` verification with configured secret |
| **Snapshot Image Retrieval** | `POST /v1/devices/{id}/media/image/download` against `api.amazonvision.com` | Curated synthetic test images (`delivery.jpg`, `visitor.jpg`) |
| **REST Client Implementation** | [`RingRestClient`](src/server/services/ring-rest-client.ts) (JSON:API device discovery, snapshot download, 429 backoff) | Fully mocked with 14 unit tests (`tests/ring-api-adapter.test.ts`) |
| **Amazon Bedrock AI** | Amazon Nova Lite via the Bedrock Converse API; region and model are configurable | Mocked in automated test suite (11 unit tests); unmocked CLI check via `npm run bedrock:smoke` |
| **Hardware Required** | Physical Ring Doorbell + Ring Partner Account | Zero physical hardware; 100% offline-runnable |
| **Partner Access Barrier** | Requires formal corporate Ring Partner OAuth approval | None; completely self-contained for hackathon judges & developers |
| **Primary Use Case** | Production deployment in partner smart home environments | Hackathon evaluation, accessibility testing, and automated test suite |

### What Was Tested Live
- **Amazon Bedrock:** Amazon Nova Lite (`amazon.nova-lite-v1:0`) in region `ap-southeast-2`: one run, 14 words, 3535 ms, measured Oct 18, 2026. Other latencies not yet measured.
- **Ring Integration:** Emulator only, not live (simulated and `ring-sandbox` synthetic payloads).

---

## 3. System Architecture

```
                                  +-------------------------------------------------------------+
                                  |                     Incoming Doorbell Event                 |
                                  |  (Live Ring Cloud Webhook OR Offline ring-sandbox Emulator) |
                                  +------------------------------+------------------------------+
                                                                 |
                                                                 v  POST /webhooks/ring
                                                     [Raw Ingestion & HMAC Guard]
                                                     - X-Signature: sha256=<hex>
                                                     - crypto.timingSafeEqual
                                                     - Dedupes on meta.request_id
                                                                 |
                                       +-------------------------+-------------------------+
                                       |                                                   |
                     (Phase 1: Immediate Alert <2.0s)                  (Phase 2: Bedrock AI Enrichment <5.0s)
                                       |                                                   |
                                       v                                                   v
                         [WebSocket Broadcast Hub]                                [BedrockService]
                         - Dispatches ALERT_PHASE_1                               - Amazon Nova Lite via the Bedrock Converse API; region and model are configurable
                         - Resets visitor screen state                            - 5.0s AbortController SLA
                                       |                                          - Zero-disk in-memory buffer
                                       |                                          - Falls back to Phase 1 on timeout
                                       |                                                   |
                                       |                                  Dispatches ALERT_PHASE_2 (<25 words)
                                       +-------------------------+-------------------------+
                                                                 |
                                       +-------------------------+-------------------------+
                                       |                                                   |
                                       v                                                   v
                       +-------------------------------+                   +-------------------------------+
                       |   Resident UI (/)             |                   |   Visitor Display (/visitor)  |
                       | - Persistent Alert (No Auto-Dismiss)|             | - High-contrast responsive card|
                       | - Seizure-Safe Flashing (WCAG 2.3.1)|             | - Dispatches visitor updates  |
                       | - Dynamic Contrast: 19.3:1    |                   | - Resets to "Waiting..." on ring|
                       | - 3 Accessible Quick Replies  |                   +---------------+---------------+
                       +---------------+---------------+                                   ^
                                       | (Resident taps Quick Reply)                       |
                                       v                                                   |
                                [WebSocket Server]                                         |
                                - Whitelist validation                                     |
                                - Persists to SQLite (node:sqlite)                         |
                                - Sends REPLY_ACK to resident                              |
                                +----------------------------------------------------------+
```

### Architectural Highlights
- **Immediate Response SLA:** Webhook returns HTTP 200 immediately upon HMAC signature validation and `meta.request_id` deduplication, initiating downstream processing asynchronously via `setImmediate`.
- **Two-Phase Alert Delivery:** Visual alert fires within milliseconds (<2.0s). Multimodal Bedrock enrichment delivers context (<5.0s). If Bedrock times out or fails, the resident remains on the clear Phase 1 notification without jarring errors.
- **Strict Server Whitelist:** Quick replies (`"Leave it at the door"`, `"Coming in 2 minutes"`, `"I can't hear, please text me"`) are validated server-side; untrusted client input is rejected.
- **Zero Native Dependencies:** Uses Node 22's built-in `node:sqlite` (`DatabaseSync`), eliminating node-gyp compilation failures across operating systems.

---

## 4. Quickstart (Fresh Clone)

### Prerequisites
- **Node.js:** v22+ (required for built-in native `node:sqlite`. Note: Node emits an `ExperimentalWarning: SQLite is an experimental feature...` on startup, which is expected and does not impact functionality)
- **npm:** v10+

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abhijit9040/SDS_auto.git
   cd SDS_auto
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   npm run setup
   ```
   *(Initializes `.env` from `.env.example` and populates random 32-byte hex secrets for `RING_WEBHOOK_SECRET` and `INTERNAL_DEV_SECRET` without overwriting existing files)*

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application launches at:
   - **Resident UI:** [http://localhost:5173/](http://localhost:5173/)
   - **Visitor Screen:** [http://localhost:5173/visitor](http://localhost:5173/visitor)
   - **Backend API & Healthcheck:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

5. **Simulate a doorbell visitor event:**
   Open [http://localhost:5173/](http://localhost:5173/) in your browser and click the **"Simulate Doorbell Press"** button in the Simulator Controls panel.

   *Watch the Resident UI immediately pulse visually, enrich with Bedrock AI context, and update the Visitor Screen upon clicking a Quick Reply!*

### Bedrock Setup & Verification

- **Region & Model:** Specify `AWS_REGION` and `BEDROCK_MODEL_ID` in your `.env` (e.g. `ap-southeast-2` and `amazon.nova-lite-v1:0`; region and model are configurable).
- **On-Demand Access:** `BEDROCK_MODEL_ID` must be a model with on-demand access in that region (do not configure a cross-region inference profile if your AWS account blocks cross-region routing).
- **Run Smoke Verification:** Run `npm run bedrock:smoke` (or `npm run bedrock:smoke -- path/to/image.jpg`) to test live Bedrock connectivity and outputs directly.
- **Graceful Fallback:** Without AWS credentials, the application displays only the Phase 1 visual alert (*"Someone is at your door"*) by design.

---

## 5. Testing & Verification

SignalDoor features comprehensive automated test coverage across 6 test suites with 59 automated tests:

```bash
# Run all automated tests (unit, integration, accessibility, and mocked Bedrock/Ring)
npm test

# Run code linter
npm run lint

# Run code formatter check
npm run format:check

# Run standalone unmocked Bedrock smoke check (requires active AWS credentials)
npm run bedrock:smoke

# Or test against a specific image:
npm run bedrock:smoke -- path/to/image.jpg
```


---

## 6. Accessibility & WCAG 2.1 AA / 2.3.1 Compliance

SignalDoor was intentionally designed from day one to serve deaf, hard-of-hearing, and photosensitive individuals:

- **Mathematical Color Contrast Compliance:**
  - Evaluated directly against live CSS variables in [`src/client/styles/index.css`](src/client/styles/index.css) via the W3C relative luminance formula ($L = 0.2126 R + 0.7152 G + 0.0722 B$).
  - **Primary Text on Dark Background:** **19.3:1** (WCAG AA requirement: 4.5:1).
  - **Urgent Alert Banner:** **15.4:1**.
  - **Secondary Text on Surfaces:** **11.5:1**.
  - **Interactive Focus Visible Rings:** **9.0:1** (WCAG requirement: 3.0:1).
- **Epileptic Seizure & Flashing Safeguards (WCAG 2.3.1):**
  - Strobe pulse animation cycle is set to $0.8$s (1.25 flashes/second), strictly capped under the 2.0 flashes/second limit and far below the 3.0 Hz danger threshold.
  - Automatically disabled when the user has enabled OS-level reduced motion (`@media (prefers-reduced-motion: reduce)`).
  - In-app `FlashToggle` with `localStorage` persistence and safe first-time defaults.
- **Persistent Resident Alerts (No Auto-Dismiss):**
  - Hearing apps often auto-dismiss alerts after 5 seconds because residents heard a chime. For deaf individuals, looking away for a few seconds could cause a missed delivery.
  - Alert banners **never self-clear or auto-dismiss**. They persist until explicitly closed via the $\ge 48$px touch target `✕ Dismiss Alert` button.
- **Adaptive Screen Reader ARIA Announcements:**
  - Initial doorbell press uses `role="alert"` and `aria-live="assertive"` for immediate auditory notification for low-vision residents.
  - Phase 2 multimodal AI summary updates use `role="status"` and `aria-live="polite"` to avoid interrupting screen reader flow.
- **Non-Color-Alone Status Communication (WCAG 1.4.1):**
  - All status badges combine descriptive text with unicode iconography (`✓ Online — Doorbell Connected`, `✕ Offline — Reconnecting...`, `✓ Delivered to Door`).
- **Tactile Mobile Vibration (`navigator.vibrate`):**
  - Features an optional sensory vibration sequence (`[300, 150, 300, 150, 300]`) for mobile devices.
  - *Browser Support Note:* Supported on Android/Chromium mobile browsers; gracefully degrades with zero runtime errors on iOS Safari and desktop environments.
- **Automated axe-core Audits:**
  - Automated test suite executes `axe-core` across `ResidentAlert`, `VisitorScreen`, `QuickReplies`, and `FlashToggle` with zero critical or serious violations.

---

## 7. Responsible AI & Privacy Design

AI-powered camera analysis requires strict privacy and ethical safety controls:

1. **In-Memory Zero-Disk Ephemeral Processing:**
   - Visitor snapshot frames are ingested strictly as in-memory Node `Buffer` instances.
   - Images are **never written to disk, saved in temporary directories, or logged in server telemetry**.
2. **Strict Guardrail Prompting (`bedrock-prompt.txt`):**
   - The model prompt is isolated in [`src/server/services/bedrock-prompt.txt`](src/server/services/bedrock-prompt.txt).
   - Rules strictly mandate:
     - Output must be **one plain-language sentence, $\le 20$ words**.
     - Describe only observable physical objects (e.g. *"A person in a blue shirt and mask holds a box at the door."* — live run, Oct 18).
     - **Never infer or guess identity, name, age, gender, ethnicity, emotional state, or criminal intent**.
     - The prompt instructs the model to say *"unclear"* when the image is ambiguous; this behaviour has not yet been measured.
3. **Hard Word-Limit Fallback Rejection:**
   - If Bedrock generates a response exceeding 25 words, SignalDoor rejects the response entirely rather than displaying a cut-off fragment, cleanly retaining the Phase 1 text (*"Someone is at your door"*).
4. **5.0s SLA AbortController:**
   - Multimodal inference is wrapped in an `AbortController` signal with a 5.0-second timeout. If the AI model is slow or experiences high latency, the user is never left waiting in an indeterminate state.
5. **Sample Image Assets:**
   - Sample images (`delivery.jpg`, `visitor.jpg`) are used for offline simulator testing. See [Sample Images](#sample-images) below for provenance and licensing details (marked TODO for completion).

---

## 8. Third-Party Licenses & Attributions

SignalDoor builds upon high-quality open-source software and tools:

| Package / Resource | License | Purpose / Attribution |
|---|---|---|
| **SignalDoor (This Project)** | MIT License | Main application codebase |
| **`ring-sandbox`** | MIT License | Offline Ring developer emulator created by Joseph Mayo |
| **`@aws-sdk/client-bedrock-runtime`** | Apache-2.0 | Amazon Web Services SDK for Bedrock Converse API |
| **`react` & `react-dom`** | MIT License | Frontend UI rendering by Meta Platforms, Inc. |
| **`express`** | MIT License | Backend HTTP server framework (OpenJS Foundation) |
| **`ws`** | MIT License | WebSocket implementation for real-time messaging |
| **`axe-core`** | MPL-2.0 | Automated web accessibility testing engine (Deque Systems) |
| **`vitest`** | MIT License | Vite-native unit and integration test framework |
| **`typescript`** | Apache-2.0 | Static typing system (Microsoft Corporation) |

### Sample Images
<!-- TODO: User to fill in image provenance, creator, and license details below -->
- **delivery.jpg:**
  - Source: [TODO: Add source URL or repository]
  - Creator: [TODO: Add creator / author name]
  - License: [TODO: Add license type, e.g. CC-BY / Public Domain / Synthetic]
- **visitor.jpg:**
  - Source: [TODO: Add source URL or repository]
  - Creator: [TODO: Add creator / author name]
  - License: [TODO: Add license type, e.g. CC-BY / Public Domain / Synthetic]

---

## 9. Hackathon Submission & Team

- **Hackathon:** [Build, Ship, Shape: Amazon Developer Hackathon](https://amazon.devpost.com)
- **Tracks:** Ring Track & AWS Builder Track (plus Open Source Mini-Challenge)
- **Repository:** [https://github.com/abhijit9040/SDS_auto](https://github.com/abhijit9040/SDS_auto)
- **Full Submission Write-Up:** [`SUBMISSION.md`](SUBMISSION.md)
- **Video Walkthrough Script:** [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- **Developer Friction Log:** [`FRICTION_LOG.md`](FRICTION_LOG.md)
- **Product Feedback for Ring & AWS Teams:** [`PRODUCT_FEEDBACK.md`](PRODUCT_FEEDBACK.md)
