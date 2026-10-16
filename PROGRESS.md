# PROGRESS

Current stage: 5 (Stage 5 — Walking Skeleton in progress)
Completed:
- Stage 0: Idea Brief (`BRIEF.md` created, gate verified)
- Stage 1: Requirements and Scope (`SPEC.md` created & amended, gate verified)
- Stage 2: Architecture and Tech Stack (`ARCHITECTURE.md` created & amended, gate verified)
- Stage 3: Project Setup (Scaffolded per `ARCHITECTURE.md`, git initialized, `.gitignore`, `.env.example`, `LICENSE`, `README.md`, ESLint, Prettier, Vitest, and TypeScript passing)
- Stage 4: Plan and Task Breakdown (`PLAN.md` created & amended with HMAC in Task 1, Snapshots API in Task 5, gate verified)

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
- Demo Milestones: Rough demo video checkpoint at Task 3; Task 6 starts no later than Day 5; README, feedback, and friction log updated in every task

Open questions & Contingencies:
- Day 2 Fallback Trigger: Fallback to Alexa+ MCP server (Streamable HTTP) if no simulated/live Ring webhook events work by end of Day 2
- AWS Bedrock region/model access verification





