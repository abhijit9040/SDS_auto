# SignalDoor — Project Implementation Plan (PLAN.md)

## 1. Confirmed Ring Developer Specifications

Based on official Ring Developer / Amazon Vision API documentation (`api.amazonvision.com`):

### 1.1 Webhook Signature Header & Algorithm
- **Header Name:** `X-Signature`
- **Format:** `sha256=<hex_encoded_hmac>` (e.g. `sha256=a1b2c3d4...`)
- **Algorithm:** HMAC-SHA256 computed over the raw request body bytes using the developer's registered HMAC Signature Key.
- **Verification Requirement:** Must capture the raw unparsed request body and compare using constant-time equality check (`crypto.timingSafeEqual`) to prevent timing attacks.
- *Assumption (Standard Webhook SLA):* Returning HTTP 200 within 5 seconds is treated as an assumed operational best practice to prevent retries (unconfirmed in public documentation, but designed for immediate 200 return after HMAC verification and deduplication).

### 1.2 Doorbell-Press Payload Structure
```json
{
  "meta": {
    "version": "1.0",
    "time": 1729000000000,
    "account_id": "ring-user-account-id-uuid",
    "request_id": "unique-delivery-request-id-for-idempotency"
  },
  "data": {
    "id": "event-instance-uuid",
    "type": "button_press",
    "attributes": {
      "source": "device-uuid-front-doorbell",
      "timestamp": 1729000000123
    }
  }
}
```
*(Note: Do not hard-code `sub_type`, as Ring payload schemas vary by device model and firmware).*

---

## 2. Schedule & Time Budget Overview

- **Target Deadline:** October 21, 2026 (compressed 5-day timeline for early hackathon submission).
- **Format:** Solo build, focused MVP.
- **Budget:** ~28 hours across 4 active development days + 1 submission day.
- **Milestones:** Task 6 begins on Day 5 (Oct 21). Rough demo video checkpoint recorded at Task 3.

| Phase | Target Date | Focus | Est. Hours |
|---|---|---|---|
| **Phase 1: Core Walking Skeleton** | Day 1 (Oct 17) | HMAC-verified signed webhook &rarr; Phase 1 alert on resident UI | 5.5h [DONE] |
| **Phase 2: Bedrock AI Enrichment** | Day 2 (Oct 18) | Multimodal Bedrock Converse API & Timeout Fallback | 6.0h [DONE] |
| **Phase 3: Two-Way & Checkpoint** | Day 3 (Oct 19) | Quick Replies, Visitor Screen (`/visitor`), & rough video checkpoint | 5.5h [DONE] |
| **Phase 4: Accessibility Hardening**| Day 3 (Oct 19) | WCAG AA Contrast, 24px Text, Flashing Safety | 4.0h [DONE] |
| **Phase 5-lite: Ring Sandbox & Mocked Snapshots** | Day 4 (Oct 20) | `ring-sandbox` emulator verification + Mocked Snapshots client (no live/OAuth) | 3.5h |
| **Phase 6: Submission & Video** | Day 5 (Oct 21) | Demo Video, Product Feedback, Friction Log, Devpost submission | 4.5h |

---

## 3. Ordered Task Checklist

### [x] Task 1: Walking Skeleton — HMAC-Verified Webhook to Phase 1 Alert End-to-End
*Serves as the Walking Skeleton (Stage 5) and the Day-2 Ring integration check.* [COMPLETED]
- **Objective:**
  1. Capture raw request body bytes in Express.
  2. Implement HMAC-SHA256 verification (`X-Signature: sha256=<hex>`, `crypto.timingSafeEqual`).
  3. Webhook handler responds with HTTP 200 immediately upon signature verification and request deduplication (`meta.request_id`).
  4. Emulator signs its webhooks with the configured secret.
  5. Asynchronously trigger `RingAdapter` and dispatch Phase 1 visual alert (`"Someone is at your door"`) to resident UI via WebSocket within $\le 2.0$ seconds.
  6. Test-driven first.
- **Files Touched:**
  - `src/server/index.ts`
  - `src/server/routes/ring-webhook.ts`
  - `src/server/adapters/ring-adapter.interface.ts`
  - `src/server/adapters/ring-simulator-adapter.ts`
  - `src/server/services/ws-hub.ts`
  - `src/client/hooks/useDoorbellSocket.ts`
  - `src/client/components/ResidentAlert.tsx`
  - `src/client/App.tsx`
  - `tests/two-phase-alert.test.ts`
  - `FRICTION_LOG.md`
  - `README.md`
- **Dependencies:** Stage 3 scaffold (`types.ts`, `config.ts`, express, ws, react).
- **Verification Command:** `npm test -- tests/two-phase-alert.test.ts`
- **Estimate:** 5.5 hours
- **Recurring Step:** Update `FRICTION_LOG.md` and `README.md` notes.

---

### [x] Task 2: Multimodal Bedrock Phase 2 Enrichment with 5s Timeout Fallback
*Multimodal Bedrock Converse API with AbortController 5.0s SLA.* [COMPLETED]
- **Objective:** Connect `BedrockService` using `@aws-sdk/client-bedrock-runtime` Converse API. Send watermarked visitor snapshot + event metadata to produce a concise ($\le 25$ words) plain-language summary. Broadcast Phase 2 update. Enforce strict 5.0s timeout with seamless fallback to Phase 1 text. If summary exceeds 25 words, fall back cleanly without cut-offs; prompt tightened toward 20 words.
- **Files Touched:**
  - `src/server/services/bedrock.ts`
  - `src/server/services/bedrock-prompt.txt`
  - `src/server/controllers/event-controller.ts`
  - `src/server/assets/sample-visitors/delivery.jpg`
  - `src/server/assets/sample-visitors/visitor.jpg`
  - `src/client/components/ResidentAlert.tsx`
  - `tests/bedrock-service.test.ts`
  - `FRICTION_LOG.md`
  - `PRODUCT_FEEDBACK.md`
- **Dependencies:** Task 1.
- **Verification Command:** `npm test -- tests/bedrock-service.test.ts`
- **Estimate:** 6.0 hours
- **Recurring Step:** Update `FRICTION_LOG.md` and draft Amazon Bedrock notes in `PRODUCT_FEEDBACK.md`.

---

### [x] Task 3: Two-Way Quick Replies, Visitor Screen & Video Checkpoint
*Two-way quick replies, /visitor screen, SQLite transaction logging, and DEMO_NOTES.md checkpoint.* [COMPLETED]
- **Objective:**
  1. Resident taps one of 3 quick replies (*"Leave it at the door"*, *"Coming in 2 minutes"*, *"I can't hear, please text me"*).
  2. Send reply over WebSocket to dedicated visitor screen (`/visitor`), render message within $\le 1.5$ seconds, and log event transaction in SQLite (`better-sqlite3` / `node:sqlite`).
  3. **Checkpoint:** Record a rough internal screen-recording checkpoint to validate end-to-end timing (<3 minutes) and visual flow. Produced `DEMO_NOTES.md`.
- **Files Touched:**
  - `src/server/db/index.ts`
  - `src/server/services/ws-hub.ts`
  - `src/client/components/QuickReplies.tsx`
  - `src/client/components/VisitorScreen.tsx`
  - `src/client/App.tsx`
  - `DEMO_NOTES.md`
  - `tests/quick-reply.test.ts`
  - `FRICTION_LOG.md`
- **Dependencies:** Task 1, Task 2.
- **Verification Command:** `npm test -- tests/quick-reply.test.ts`
- **Estimate:** 5.5 hours
- **Recurring Step:** Update `FRICTION_LOG.md` and record rough demo checkpoint video.

---

### [x] Task 4: Accessibility Hardening & WCAG 2.3.1 Flashing Safeguards
*Full WCAG 2.1 AA and WCAG 2.3.1 compliance, dynamic CSS contrast checks, axe-core validation, persistent alerts, and sensory controls.* [COMPLETED]
- **Objective:** Implement full WCAG 2.1 AA & WCAG 2.3.1 compliance: minimum 24px typography for alert text, dynamically computed color contrast ratio $\ge 4.5:1$ from real CSS, strobe flash rate capped at $\le 2$ flashes/sec (0.8s cycle = 1.25/s), auto-disable on `prefers-reduced-motion`, persistent user sensory toggle (`FlashToggle`), persistent resident alert with manual dismiss ($\ge 48$px touch target), non-color-alone status badges, keyboard navigation, and automated axe-core audits.
- **Files Touched:**
  - `src/client/styles/index.css`
  - `src/client/components/FlashToggle.tsx`
  - `src/client/components/ResidentAlert.tsx`
  - `src/client/components/VisitorScreen.tsx`
  - `src/client/App.tsx`
  - `tests/accessibility.test.ts`
  - `FRICTION_LOG.md`
  - `README.md`
- **Dependencies:** Task 3.
- **Verification Command:** `npm test -- tests/accessibility.test.ts`
- **Estimate:** 4.0 hours
- **Recurring Step:** Update `FRICTION_LOG.md` and `README.md` with accessibility audit notes.

---

### Task 5-lite: Ring Sandbox Compatibility & Mocked REST Client
*Focused Ring integration without unapproved live OAuth dependencies.*
- **Objective:**
  1. **ring-sandbox Compatibility:** Test payload compatibility of the open-source `ring-sandbox` emulator against `POST /webhooks/ring`, validating HMAC signing, payload format, and event parsing.
  2. **Ring Image Snapshots + Devices REST Client:** Implement `RingApiAdapter` / client for `api.amazonvision.com` (device discovery and image snapshot retrieval) accompanied by comprehensive mocked tests (`tests/ring-api-adapter.test.ts`). Clearly label and annotate all tests as mocked/synthetic (not live-tested against production Ring servers).
  3. **No OAuth Gate:** Defer live OAuth flow (`/ring/link`, `/oauth/token`) unless official Ring production partner approval is explicitly confirmed. Focus purely on clean REST client contracts and emulator compatibility.
  4. Ensure sample images are watermarked to simulate live Ring Image Snapshots API output.
- **Files Touched:**
  - `src/server/adapters/ring-api-adapter.ts`
  - `src/server/adapters/ring-adapter.interface.ts`
  - `tests/ring-api-adapter.test.ts`
  - `FRICTION_LOG.md`
  - `README.md`
- **Dependencies:** Tasks 1–4.
- **Verification Command:** `npm test -- tests/ring-api-adapter.test.ts`
- **Estimate:** 3.5 hours
- **Recurring Step:** Update `FRICTION_LOG.md` with emulator findings.

---

### Task 6: Hackathon Deliverables, Demo Video & Submission
- **Objective:** Prepare and finalize all required hackathon deliverables (starts on Day 5, Oct 21):
  1. Finalize `README.md` with honest disclosure of `RING_MODE=emulator` vs live, architecture diagram, and quickstart.
  2. Final demo video ($\le 3$ minutes) demonstrating end-to-end doorbell press &rarr; immediate alert &rarr; Bedrock AI summary &rarr; quick reply on `/visitor` screen.
  3. Finalize written `PRODUCT_FEEDBACK.md` for Ring and Amazon Bedrock teams.
  4. Finalize `FRICTION_LOG.md` (for up to 10% bonus points).
  5. Mini-challenge form responses (AWS Builder + Open Source).
- **Files Touched:**
  - `README.md`
  - `DEMO_SCRIPT.md`
  - `PRODUCT_FEEDBACK.md`
  - `FRICTION_LOG.md`
  - `SUBMISSION.md`
- **Dependencies:** Tasks 1-4 (and Task 5-lite).
- **Verification Command:** `npm run build && npm test && npm run lint`
- **Estimate:** 4.5 hours
- **Recurring Step:** Complete final submission check.

---

## 4. Verification & Gate Check

- **Gate Requirement:** Every task is finishable in one session (estimates range from 3.5h to 6.0h).
- **Milestone Guarantee:** Working walking skeleton on Day 1 (Task 1), full AI context on Day 2 (Task 2), complete accessible two-way demo on Day 3 (Tasks 3-4), Ring compatibility and mocked client on Day 4 (Task 5-lite), submission finalized on Day 5 (Task 6, Oct 21).
