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

- **Run all tests:**
  ```bash
  npm test
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

## Security & Privacy Notice

- **Public Tunnel Restrictions:** If using a tunnel (e.g., ngrok) to receive external webhooks, only expose `/webhooks/ring`, `/ring/link`, and `/oauth/token`. Keep `/api/simulator/trigger` and WebSockets bound locally.
- **Ephemeral Image Storage:** Visitor snapshots and media frames are processed purely in memory and immediately discarded after the Amazon Bedrock call. No video or visitor imagery is saved to disk.
- **Zero Credentials:** Secrets, tokens, and AWS keys are managed via environment variables and never logged or committed.

---

## License

This project is licensed under the [MIT License](LICENSE).
