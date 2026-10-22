# PROGRESS

Current stage: 7 (Stage 7 — Security Hardening & Documentation Honesty completed; all Parts A & B implemented and verified)
Completed:
- Stage 0: Idea Brief (`BRIEF.md` created, gate verified)
- Stage 1: Requirements and Scope (`SPEC.md` created & amended, gate verified)
- Stage 2: Architecture and Tech Stack (`ARCHITECTURE.md` created & amended, gate verified)
- Stage 3: Project Setup (Scaffolded per `ARCHITECTURE.md`, git initialized, `.gitignore`, `.env.example`, `LICENSE`, `README.md`, ESLint, Prettier, Vitest, and TypeScript passing)
- Stage 4: Plan and Task Breakdown (`PLAN.md` created & amended with HMAC in Task 1, Snapshots API in Task 5, gate verified)
- Stage 5: Walking Skeleton (Task 1: HMAC Webhook to Phase 1 Alert End-to-End completed and verified)
- Stage 6 (Task 2): Bedrock AI Multimodal Phase 2 Enrichment completed with 5s timeout fallback, AbortController, prompt isolation, zero-disk in-memory processing, clean fallback rejection for >25 words, and prompt tightened to 20 words (Amazon Nova Lite via the Bedrock Converse API; region and model are configurable)
- Stage 6 (Task 3): Two-Way Quick Replies & Visitor Screen (`/visitor`) completed with strict server whitelist, SQLite audit logging (`node:sqlite`), `REPLY_ACK`, `>=48px` touch targets, stale reply reset, and `DEMO_NOTES.md` recording script
- Stage 6 (Task 4): Accessibility Hardening & WCAG 2.3.1 Flashing Safeguards completed with dynamic CSS contrast tests, axe-core audits, persistent alerts without auto-clear, $\le 2$ flashes/sec safe cycle, `prefers-reduced-motion` override, persistent user sensory toggle (`FlashToggle`), non-color-alone status badges, and mobile tactile vibration
- Stage 6 (Task 5-lite): Ring Sandbox Compatibility & Mocked REST Client completed with official api.amazonvision.com endpoint contracts (devices & snapshots), exponential backoff for 429, distinct 401/403/404 handling, fail-fast boot validation, in-memory token safety, ring-sandbox payload compatibility, and 14 mocked tests
- Stage 6 (Task 6): Hackathon Deliverables, Demo Video & Submission completed with finalized `README.md` (live vs emulator table, quickstart, architecture, accessibility, responsible-AI, licenses), `DEMO_SCRIPT.md` (3-minute split-screen walkthrough), finalized `PRODUCT_FEEDBACK.md` (requests for Ring and Bedrock), finalized `FRICTION_LOG.md` (observed friction only), and full `SUBMISSION.md` (Devpost fields drafted)
- Stage 7 (Part A: Documentation Honesty): Completed Tasks A1–A6 (commits `b496083`, `aeb1549`, `6b0f514`, `7fbbcb4`, `32568b0`, `1472ff5`). Eliminated unmeasured benchmarks, standardized Nova Lite disclosures, clarified Ring emulator payload support, fixed quickstart instructions, and updated license attribution.
- Stage 7 (Part B: Security Hardening): Completed Tasks B1–B9. Removed hardcoded default secrets, added `npm run setup` generator, enforced startup validation, secured simulator trigger with constant-time `X-Internal-Secret` and rejected forwarded proxy headers, secured WebSockets (origin allowlisting, 4 KB maxPayload, immediate 1008 closure on non-JSON, resident-only replies, server-side eventId verification, authoritative server timestamps), enforced raw request body buffer on webhooks with event freshness verification (`WEBHOOK_MAX_AGE_SECONDS`), added tunnel ingress documentation and header guards (B7: X-Forwarded-* rejection on /api and /ws, mandatory Origin header), established hermetic test environment passing with no .env (B8), and established 12 test files with 100 automated tests passing (B9).
- Stage 7 (Part C: Sample Images & Live Bedrock Measurements): Replaced sample photos with original CC0 flat-style illustrations via generator (`scripts/make-sample-images.py`, commit `2e403c0`). Executed 8 live unmocked Bedrock runs against `amazon.nova-lite-v1:0` in `ap-southeast-2` (Oct 22, 2026): delivery.jpg (5 runs: min 2137 ms, median 2186 ms, max 2328 ms, 0 > 5s, all 15 words), visitor.jpg (2295 ms, 10 words), empty-porch.jpg (2186 ms, 14 words, no hallucinated person), dark-porch.jpg (2133 ms, 10 words, no hallucination). Documented Run 0 vs Runs 1–8 asset size disclosure (photo ~935 KB vs illustrations ~15–25 KB).


Decisions:
- Project Name: SignalDoor (Deaf-friendly Doorbell)
- Target: Amazon Developer Hackathon (Build, Ship, Shape) — Ring Track + AWS Builder + Open Source
- Target Submission Date: October 21, 2026 (compressed 5-day timeline)
- Architecture Selection: Option A — Unified TypeScript Monorepo (Node.js/Express backend + React/Vite client)
- Ring Ingestion & Webhooks:
  * Ingest endpoint: `POST /webhooks/ring`
  * Signature verification: HMAC-SHA256 (`X-Signature: sha256=<hex>`) over raw body bytes with `crypto.timingSafeEqual`
  * Immediate 200 Response & Deduplication: Returns HTTP 200 immediately upon signature check & `meta.request_id` dedupe; asynchronous broadcast follows
  * Payload types: `meta.time`, `meta.version`, `meta.request_id`, `meta.account_id`; `data.id`, `data.type`, `data.attributes.source`, `data.attributes.timestamp` (flexible attributes)
  * Emulator signs its webhooks with the configured secret
- Ring Sandbox & Mocked Client (Task 5-lite):
  * Test compatibility of `ring-sandbox` emulator against `/webhooks/ring` verified in 15 minutes; handles ISO `meta.time`, `source_type`, and `relationships`
  * Ring Image Snapshots + devices REST client (`RingRestClient`) implemented for `api.amazonvision.com` with exponential backoff on 429, distinct 401/403/404/timeout error classes, and fail-fast startup guard
  * All tests and documentation clearly labeled as synthetic/mocked (not live-tested against production Ring servers)
  * Deferred live OAuth unless official Ring production partner approval is explicitly granted
  * Schedule compressed to submit by October 21
- Two-Phase Alerting: Immediate Phase 1 notification (<2.0s) with fallback text, Phase 2 enrichment (<5.0s) with Bedrock summary
- Bedrock Multimodal Enrichment:
  * Model & Region: Loaded from environment variables (`BEDROCK_MODEL_ID`, `AWS_REGION`), zero hard-coded models (configurable examples: `amazon.nova-lite-v1:0` in `ap-southeast-2`)
  * Timeout & SLA: 5.0s hard timeout enforced via `AbortController` signal passed to `@aws-sdk/client-bedrock-runtime`
  * Memory Isolation: In-memory image byte buffers strictly; zero disk retention and zero image data in console/telemetry logs
  * Safety & Prompt Design: Isolated in `src/server/services/bedrock-prompt.txt`; tightened toward 20 words (max 25); explicitly prohibits identity, age, or ethnicity inference, with graceful "unclear" fallbacks
  * Word Limit Fallback: If summary exceeds 25 words, discard partial text and fall back to clean Phase 1 alert text rather than cut-off sentences with ellipsis
  * Failure & Timeout Resilience: UI stays on Phase 1 text without flashing errors or disappearing alerts
  * Live Smoke Script: `npm run bedrock:smoke` (standalone unmocked CLI check; not run in CI)
- Two-Way Quick Replies & Visitor Display:
  * Server-Side Whitelist Validation: Only `'Leave it at the door'`, `'Coming in 2 minutes'`, and `"I can't hear, please text me"` are accepted; untrusted client input is rejected with `ERROR: REJECTED`
  * SQLite Transaction Audit Logging: Integrated Node.js built-in `node:sqlite` (`DatabaseSync`), logging every reply with `event_id`, `reply_text`, and ISO `timestamp`
  * Delivery Confirmation: Dispatches `{ type: 'REPLY_ACK', payload: { eventId, status: 'DELIVERED' } }` back to the resident
  * Exterior Screen (`/visitor`): Dedicated high-contrast visitor view with timestamp; automatically resets to *"Waiting for response..."* on new `ALERT_PHASE_1` doorbell events
  * Accessible Touch Targets: Buttons sized $\ge 48$px with visible focus indicators and `aria-live="polite"` on alert text
- Accessibility & Flashing Safeguards (WCAG 2.1 AA & WCAG 2.3.1):
  * Dynamic Real-CSS Contrast Testing: Relative luminance verified against `src/client/styles/index.css` via W3C formula; primary text achieves 19.3:1, urgent banner 15.4:1, surfaces 11.5:1, focus rings 9.0:1
  * Flash Rate Safety: 0.8s pulse cycle = 1.25 flashes/second (strictly $\le 2$ flashes/second, well below 3.0 Hz seizure risk threshold)
  * Reduced Motion & Strobe Toggles: Auto-disabled under `prefers-reduced-motion: reduce`; user preference persisted in `localStorage` via `FlashToggle` with safe first-time defaults
  * Persistent Alert Guarantee: Deaf alerts never self-clear or auto-dismiss on a timer; dismissed strictly via explicit `✕ Dismiss Alert` button ($\ge 48$px target)
  * Adaptive Screen Reader Announcements: Phase 1 immediate visitor alert announces via `role="alert"` & `aria-live="assertive"`; Phase 2 AI updates announce politely via `role="status"` & `aria-live="polite"`
  * Non-Color-Alone Status: All status badges include explicit text + unicode icons (`✓ Online`, `✕ Offline`, `✓ Delivered`)
  * Keyboard Operability: Full keyboard flow with high-contrast `:focus-visible` outline rings (3px offset) and Enter/Space triggers
  * Responsive Viewport: Validated at 320px width and 200% zoom with `lang="en"` and descriptive page titles
- Demo Milestones: Rough demo video checkpoint script produced in `DEMO_NOTES.md` (<3 minutes side-by-side); README, feedback, and friction log updated in every task

Open questions & Contingencies:
- Day 2 Fallback Trigger: [CLOSED] Ingestion and ring-sandbox emulator compatibility succeeded; no Alexa+ fallback required.
- Live Bedrock verification: [VERIFIED] Unmocked Bedrock Converse API verified on `ap-southeast-2` with `amazon.nova-lite-v1:0` (Nova Lite, ap-southeast-2: one run, 14 words, 3535 ms, measured Oct 18, 2026; other latencies not yet measured).
- Open Source mini challenge: confirm whether main repo counts or an additional project/PR is required.






