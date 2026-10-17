# SignalDoor — Deaf-Friendly Smart Doorbell

> **An accessible, visual, two-way smart doorbell interface for deaf and hard-of-hearing individuals.**  
> Built for the **Build, Ship, Shape: Amazon Developer Hackathon** (Ring Track + AWS Builder + Open Source).

---

## Overview

Traditional doorbells and smart home alerts rely predominantly on auditory signals or generic, low-contrast push notifications. For deaf and hard-of-hearing residents, this leads to missed deliveries, unanswered visitors, and safety concerns.

**SignalDoor** solves this by converting Ring doorbell visitor events into:
1. **Immediate High-Contrast Visual Alert:** A full-screen, high-contrast (WCAG AA &ge; 4.5:1), large-font notification (< 2.0s) with seizure-safe flashing (&le; 3 flashes/sec, `prefers-reduced-motion` compliance, and user toggle).
2. **Bedrock AI Multimodal Visitor Context:** Amazon Bedrock (Converse API) analyzes visitor snapshot images and metadata to enrich the alert with a concise plain-language summary (&le; 25 words).
3. **One-Tap Quick Replies:** Resident can select from accessible one-tap responses (*"Leave it at the door"*, *"Coming in 2 minutes"*, *"I can't hear, please text me"*) that display directly on the visitor-facing doorbell screen (`/visitor`) in real time.

---

## System Architecture & Modes

SignalDoor implements a unified `RingAdapter` interface supporting two modes:

- **`RING_MODE=emulator` (Default / Hackathon Demo):**
  Uses the local emulator or `ring-sandbox` to emit signed HMAC-SHA256 webhooks to `POST /webhooks/ring` with curated sample snapshot images.  
  *Disclosure: Demonstrations using emulator mode allow full end-to-end evaluation of the accessible UI and Bedrock AI pipeline without requiring physical Ring hardware or approved production Ring partner credentials.*
- **`RING_MODE=live`:**
  Receives live webhooks on `POST /webhooks/ring`, verifies HMAC signatures, and fetches device media clips from `api.amazonvision.com` to extract a single frame for multimodal analysis.

---

## Quickstart

### Prerequisites
- **Node.js:** v20+ (tested on Node v24)
- **npm:** v10+

### Setup & Local Boot

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/amzon.git
   cd amzon
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Run development server (single command):**
   ```bash
   npm run dev
   ```
   - **Resident UI:** `http://localhost:3000/`
   - **Visitor Screen:** `http://localhost:3000/visitor`
   - **Healthcheck:** `http://localhost:3000/api/health`

---

## Testing & Quality Assurance

- **Run all automated unit & integration tests (mocked Bedrock):**
  ```bash
  npm test
  ```
- **Run optional live Amazon Bedrock smoke test:**
  *(Requires valid AWS credentials in your environment)*
  ```bash
  RUN_LIVE_BEDROCK=1 npm test -- tests/bedrock-service.test.ts
  ```
- **Run lint checks:**
  ```bash
  npm run lint
  ```
- **Format check:**
  ```bash
  npm run format:check
  ```

---

## Amazon Bedrock Multimodal AI Enrichment

SignalDoor uses the Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) to generate concise, plain-language descriptions ($\le 25$ words) of incoming doorbell visitors:
- **Two-Phase Delivery:** When a doorbell event occurs, Phase 1 (`"Someone is at your door"`) flashes immediately ($\le 2.0$s) so deaf residents never miss a visitor. Phase 2 enriches the alert with AI description if Bedrock responds within 5.0 seconds. If Bedrock times out or errors, the UI remains cleanly on the Phase 1 notification.
- **Privacy First (In-Memory Processing):** Image bytes are kept exclusively in memory buffers during inference; they are never written to disk or logged.
- **Tunable Prompt:** System instructions and accessibility guardrails live in `src/server/services/bedrock-prompt.txt`.
- **Environment Variables:**
  - `AWS_REGION`: Bedrock region (e.g. `us-east-1`)
  - `BEDROCK_MODEL_ID`: Configured multimodal model ID (e.g. `anthropic.claude-3-haiku-20240307-v1:0`)
  - `BEDROCK_TIMEOUT_MS`: Hard SLA timeout in ms (default: `5000`)

---

## Two-Way Quick Replies & Dedicated Visitor Screen (`/visitor`)

Deaf residents can send instant responses to visitors without audio intercoms or typing:
- **One-Tap Quick Replies:** Resident taps one of three accessible options ($\ge 48$px touch targets):
  1. *"Leave it at the door"*
  2. *"Coming in 2 minutes"*
  3. *"I can't hear, please text me"*
- **Server Whitelist Security:** The backend strictly accepts only allowed strings; arbitrary text is rejected.
- **Dedicated Visitor Display (`/visitor`):** Shows large, high-contrast instructions with timestamps. Automatically resets to *"Waiting for response..."* when a subsequent visitor rings.
- **SQLite Audit Logging:** All dispatched replies are persisted in SQLite (`node:sqlite`) tied to the doorbell event ID.
- **Demo Script:** See [`DEMO_NOTES.md`](DEMO_NOTES.md) for a 3-minute step-by-step recording script.

---

## Accessibility & WCAG 2.1 AA Compliance

SignalDoor is engineered from the ground up for deaf and hard-of-hearing residents and adheres strictly to WCAG 2.1 Level AA and WCAG 2.3.1 requirements:

- **Dynamically Computed Color Contrast (&ge; 4.5:1 / &ge; 3.0:1):**
  - Text pairs and UI components are tested against the actual CSS color variables using the W3C relative luminance formula ($L = 0.2126 R + 0.7152 G + 0.0722 B$).
  - Primary text on dark background achieves **18.3:1** (far exceeding the 4.5:1 requirement).
  - Secondary text on card surfaces achieves **11.2:1**.
  - Interactive focus rings (`#38bdf8`) achieve **7.8:1** (exceeding the 3.0:1 UI component threshold).
- **Epileptic Seizure & Flashing Safeguards (WCAG 2.3.1):**
  - Alert strobe animations pulse at $0.8$s per cycle (1.25 flashes/second), strictly capped below the 2.0 flashes/second specification and comfortably below the 3.0 flashes/second danger threshold.
  - Automatically disabled via `@media (prefers-reduced-motion: reduce)` with `animation: none !important;`.
  - Configurable persistent in-app toggle (`FlashToggle`) saved in `localStorage`, defaulting to safe behavior for all first-time users.
- **Persistent Resident Alerts (No Auto-Dismiss):**
  - Because deaf residents may look away and cannot hear doorbell chimes, alert cards **never auto-clear or time out**.
  - A clearly labeled, accessible dismiss button (`✕ Dismiss Alert`) with a &ge; 48px touch target is provided for manual dismissal.
- **Keyboard Navigation & Visible Focus:**
  - Full keyboard operability with logical tab order.
  - High-contrast `:focus-visible` outline rings with 3px offset.
  - Quick reply buttons and switches are fully operable via `Enter` and `Space`.
- **Non-Color-Alone Status (WCAG 1.4.1):**
  - Doorbell connectivity, delivery states, and error badges use both explicit descriptive text and distinct icons (`✓ Online — Doorbell Connected`, `✕ Offline — Reconnecting...`, `✓ Delivered to Door`).
- **Responsive Layout & Zoom Support:**
  - Validated down to 320px viewport widths and 200% browser zoom with zero horizontal scrollbars or clipping (`overflow-wrap: break-word`).
  - Document configured with `lang="en"`, descriptive `<title>`, and mobile viewport meta tags.
- **Automated `axe-core` Testing:**
  - Automated CI accessibility audit tests verify `ResidentAlert`, `VisitorScreen`, `QuickReplies`, and `FlashToggle` with zero critical or serious accessibility violations.

---

## Security & Privacy Notice

- **Public Tunnel Restrictions:** If using a tunnel (e.g., ngrok) to receive external webhooks, only expose `/webhooks/ring`, `/ring/link`, and `/oauth/token`. Keep `/api/simulator/trigger` and WebSockets bound locally.
- **Ephemeral Image Storage:** Visitor snapshots and media frames are processed purely in memory and immediately discarded after the Amazon Bedrock call. No video or visitor imagery is saved to disk.
- **Zero Credentials:** Secrets, tokens, and AWS keys are managed via environment variables and never logged or committed.

---

## License

This project is licensed under the [MIT License](LICENSE).
