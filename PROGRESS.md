# PROGRESS

Current stage: 6 (Stage 6 — Feature Implementation: current task = Task 3)
Completed:
- Stage 0: Idea Brief (`BRIEF.md` created, gate verified)
- Stage 1: Requirements and Scope (`SPEC.md` created & amended, gate verified)
- Stage 2: Architecture and Tech Stack (`ARCHITECTURE.md` created & amended, gate verified)
- Stage 3: Project Setup (Scaffolded per `ARCHITECTURE.md`, git initialized, `.gitignore`, `.env.example`, `LICENSE`, `README.md`, ESLint, Prettier, Vitest, and TypeScript passing)
- Stage 4: Plan and Task Breakdown (`PLAN.md` created & amended with HMAC in Task 1, Snapshots API in Task 5, gate verified)
- Stage 5: Walking Skeleton (Task 1: HMAC Webhook to Phase 1 Alert End-to-End completed and verified)
- Stage 6 (Task 2): Bedrock AI Multimodal Phase 2 Enrichment completed with 5s timeout fallback, AbortController, prompt isolation, zero-disk in-memory processing, clean fallback rejection for >25 words, and prompt tightened to 20 words

Decisions:
- Project Name: SignalDoor (Deaf-friendly Doorbell)
- Target: Amazon Developer Hackathon (Build, Ship, Shape) — Ring Track + AWS Builder + Open Source
- Architecture Selection: Option A — Unified TypeScript Monorepo (Node.js/Express backend + React/Vite client)
- Ring Ingestion & Webhooks:
  * Ingest endpoint: `POST /webhooks/ring`
  * Signature verification: HMAC-SHA256 (`X-Signature: sha256=<hex>`) over raw body bytes with `crypto.timingSafeEqual`
  * Immediate 200 Response & Deduplication: Returns HTTP 200 immediately upon signature check & `meta.request_id` dedupe; asynchronous broadcast follows
  * Payload types: `meta.time`, `meta.version`, `meta.request_id`, `meta.account_id`; `data.id`, `data.type`, `data.attributes.source`, `data.attributes.timestamp` (flexible attributes)
  * Emulator signs its webhooks with the configured secret
- Live Ring Mode (Task 5 Stretch): Ring Image Snapshots API (JPEG/PNG, watermarked) and OAuth
- Two-Phase Alerting: Immediate Phase 1 notification (<2.0s) with fallback text, Phase 2 enrichment (<5.0s) with Bedrock summary
- Bedrock Multimodal Enrichment:
  * Model & Region: Loaded from environment variables (`BEDROCK_MODEL_ID`, `AWS_REGION`), zero hard-coded models
  * Timeout & SLA: 5.0s hard timeout enforced via `AbortController` signal passed to `@aws-sdk/client-bedrock-runtime`
  * Memory Isolation: In-memory image byte buffers strictly; zero disk retention and zero image data in console/telemetry logs
  * Safety & Prompt Design: Isolated in `src/server/services/bedrock-prompt.txt`; tightened toward 20 words (max 25); explicitly prohibits identity, age, or ethnicity inference, with graceful "unclear" fallbacks
  * Word Limit Fallback: If summary exceeds 25 words, discard partial text and fall back to clean Phase 1 alert text rather than cut-off sentences with ellipsis
  * Failure & Timeout Resilience: UI stays on Phase 1 text without flashing errors or disappearing alerts
  * Live Smoke Test: `RUN_LIVE_BEDROCK=1 npm test -- tests/bedrock-service.test.ts` (skipped in standard CI)
- Demo Milestones: Rough demo video checkpoint at Task 3; Task 6 starts no later than Day 5; README, feedback, and friction log updated in every task

Open questions & Contingencies:
- Day 2 Fallback Trigger: Fallback to Alexa+ MCP server (Streamable HTTP) if no simulated/live Ring webhook events work by end of Day 2
- AWS Bedrock region/model access verification





