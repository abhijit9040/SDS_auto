# SignalDoor — Functional & Technical Specification (SPEC.md)

## 1. Overview
SignalDoor is an accessible, visual smart-doorbell notification and response system built for deaf and hard-of-hearing individuals. When a Ring visitor event occurs, SignalDoor generates an immediate high-contrast, large-format visual alert, updates it with an Amazon Bedrock (Converse API) plain-language summary of the visitor, and allows one-tap quick replies communicated back to the visitor via a simulated doorbell screen.

---

## 2. User Stories
- **US-1 (Immediate Visual Awareness):** As a deaf or hard-of-hearing resident, when someone arrives at my door, I want an immediate, unmissable, high-contrast visual alert on my screen (with safe visual flashing/vibrate cues) so that I know a visitor is present instantly without waiting for AI processing or relying on sound.
- **US-2 (Context & Understanding):** As a deaf resident, I want a concise, plain-language description of who is at the door and why (derived from snapshot and event context), so that I can decide how to respond safely.
- **US-3 (Quick Response):** As a deaf resident, I want one-tap pre-composed quick replies so that I can communicate my instruction (e.g., "Leave it at the door" or "Coming in 2 minutes") back to the visitor within seconds.
- **US-4 (Resilience & Two-Phase Alerting):** As a user, if Bedrock takes several seconds or fails completely, I still receive the immediate alert ("Someone is at your door") without delay, and see it smoothly enrich if the AI description succeeds.
- **US-5 (Visitor Feedback):** As a visitor standing at the door, I want to see the resident's response on the simulated doorbell screen so that I know my presence was acknowledged.

---

## 3. Scope Boundaries (MVP vs. Later vs. Out-of-Scope)

### 3.1 In-Scope MVP (Strict 5 Must-Haves)
1. **Ring Visitor Event Ingestion:** Dedicated Ring adapter that connects to Ring SDK/simulator to capture visitor events and snapshots in executable code.
2. **Bedrock AI Multimodal Summarization:** Amazon Bedrock (Converse API) using a current small fast model to transform visitor snapshot image + metadata into a concise, plain-language description.
3. **Accessible Alert Web Interface:** High-contrast, WCAG AA compliant alert page featuring >=24px typography, safe visual flashing (<=3 flashes/sec, reduced-motion aware, user toggle), and high-contrast color scheme.
4. **One-Tap Quick Replies:** Pre-configured responses ("Leave it at the door", "Coming in 2 minutes", "I can't hear, please text me").
5. **Visitor-Facing Output:** Default simulated doorbell screen page that renders the resident's selected quick reply and records it in the backend event log.

### 3.2 Deferred ("Later" / Backlog)
- Persistent visitor history log UI.
- Configurable reading levels and multi-language translations.
- Custom user-created quick reply strings.
- Automated SMS/push fallback to trusted contacts/caregivers.

### 3.3 Out of Scope (Non-Goals)
- Native iOS or Android mobile applications.
- Live video streaming or WebRTC video feeds.
- Multi-tenant authentication, user registration, and role-based access control.

---

## 4. Functional Requirements (FR)
- **FR-1 (Event Ingestion):** The system shall expose a Ring Adapter that processes simulated or live Ring doorbell visitor events (payload with timestamp, event type, and visitor snapshot image).
- **FR-2 (Multimodal AI Context Generation):** The system shall invoke Amazon Bedrock (Converse API) using a current small fast model with a visitor snapshot image (sample images in simulator) plus metadata to produce a short (<= 25 words) plain-language summary.
- **FR-3 (Two-Phase Alert Delivery & Fallback):** Alert delivery shall operate in two phases:
  - *Phase 1 (Immediate):* Broadcast the visual alert instantly upon event arrival with default fallback text (`"Someone is at your door"`).
  - *Phase 2 (Enrichment):* If the Bedrock description resolves within 5.0 seconds, dynamically update the active alert with the AI summary. If Bedrock times out (> 5.0s) or fails, the alert retains the fallback text without disrupting the user.
- **FR-4 (Real-Time Communication):** The backend shall push Phase 1 alerts within 2.0 seconds of event ingestion to connected web clients via WebSocket or SSE, and stream Phase 2 enrichment updates immediately upon receipt.
- **FR-5 (Accessible Display & Flashing Controls):** The alert interface shall render text at >= 24px with high contrast (>= 4.5:1). Visual alert indicators must not flash faster than 3 flashes/second, must respect `prefers-reduced-motion`, and must provide a persistent in-app toggle to disable flashing.
- **FR-6 (Quick Reply Selection):** The interface shall present at least 3 distinct, accessible one-tap reply buttons:
  1. *"Leave it at the door"*
  2. *"Coming in 2 minutes"*
  3. *"I can't hear, please text me"*
- **FR-7 (Visitor Communication Delivery):** When a quick reply is tapped, the system shall transmit the message to the default simulated doorbell screen page and record the reply in the backend log.

---

## 5. Non-Functional Requirements (NFR)
- **NFR-1 (Security & Secrets):** Zero API keys, AWS credentials, or secrets in version control. Must provide `.env.example` template with runtime environment validation.
- **NFR-2 (Local Execution):** The application must boot locally with a single command (e.g., `npm run dev` or `make run`).
- **NFR-3 (Accessibility & Contrast):** Web interface must satisfy WCAG 2.1 AA contrast requirements (text contrast ratio >= 4.5:1 against background) and responsive layout.
- **NFR-4 (Flashing Safety - WCAG 2.3.1):** Any flashing or strobe effect must remain <= 3 flashes per second to prevent photosensitive seizures, strictly respect CSS `prefers-reduced-motion`, and offer an explicit user toggle.
- **NFR-5 (Code Quality & Ring Integration):** Ring adapter code must exist as genuine integration code executing against the Ring SDK or simulated Ring client, called by the application entry point.
- **NFR-6 (Open-Source Licensing):** Codebase licensed under standard MIT license.
- **NFR-7 (Alert Latency):** Phase 1 immediate visual alert render latency shall be <= 2.0 seconds from event trigger. Phase 2 AI summary update arrives within <= 5.0 seconds when Bedrock succeeds.

---

## 6. Testable Acceptance Criteria

| ID | Test Scenario | Acceptance Criteria (Given - When - Then) | Verification Method |
|---|---|---|---|
| **AC-1** | Immediate Phase 1 Alert Arrival | **Given** a simulated Ring visitor event is triggered,<br>**When** received by the backend adapter,<br>**Then** the visual alert appears on the resident web UI within 2.0 seconds displaying `"Someone is at your door"`. | Automated test / Playwright / Timestamp diff |
| **AC-2** | Accessibility & Contrast | **Given** the resident alert UI is open,<br>**When** an alert is rendered,<br>**Then** main alert text size is >= 24px and color contrast ratio is >= 4.5:1 (WCAG AA). | Automated axe-core / CSS computed style assertion |
| **AC-3** | Flashing Safety & Preferences | **Given** an active alert with flashing enabled,<br>**When** inspected,<br>**Then** flashing rate is <= 3 flashes/second; and when `prefers-reduced-motion` is active or the user toggles flash off, all flashing ceases immediately. | Automated CSS animation timing test / toggle unit test |
| **AC-4** | Multimodal Bedrock Processing | **Given** a visitor event with a sample snapshot image and metadata,<br>**When** Bedrock Converse API processes the multimodal request,<br>**Then** the resulting description is concise (<= 25 words) and plain language. | Unit/Integration test with mocked & live Bedrock output |
| **AC-5** | Phase 2 Enrichment & Timeout Fallback | **Given** an active Phase 1 alert,<br>**When** Bedrock returns within 5s, the alert text updates to the AI description;<br>**When** Bedrock times out (>5s) or fails, the alert stays on `"Someone is at your door"` with no UI crash. | Integration test with 6s mock delay / network fault |
| **AC-6** | Two-Way Quick Reply to Visitor Screen | **Given** an active alert on the resident UI,<br>**When** the resident taps *"Leave it at the door"*,<br>**Then** the reply appears on the simulated doorbell screen page within 1.5 seconds and is recorded in the backend event log. | End-to-end integration test / UI automation |
| **AC-7** | App Entry Point Calls Ring Adapter | **Given** the application startup and test suite,<br>**When** the application entry point initializes,<br>**Then** it explicitly imports and calls the Ring adapter to register event listeners / start the simulator. | Test asserting entry point execution path and adapter invocation |

---

## 7. Hackathon Deliverables Tracker
- [ ] **Public GitHub Repository:** Clean git history, MIT License, no credentials.
- [ ] **Documentation:** Complete `README.md` with architecture diagram, local run instructions, and environment setup.
- [ ] **Demo Video:** Under 3 minutes, English voiceover or captions, hosted on YouTube/Vimeo, no copyrighted music, showing complete end-to-end flow.
- [ ] **Written Product Feedback:** Clear write-up on experience building with Ring and Amazon Bedrock.
- [ ] **Friction Log (Bonus):** Documented developer experience gaps, pain points, or suggestions for up to 10% bonus scoring.
- [ ] **Mini-Challenge Eligibility:** Form fields completed for AWS Builder and Open Source challenges.

---

## 8. Decisions & Open Questions

### 8.1 Confirmed Decisions
1. **Two-Phase Alerting:** Immediate notification with fallback text, followed by dynamic Bedrock summary update upon arrival within 5s.
2. **Multimodal Bedrock Input:** Snapshot image + event metadata evaluated via Converse API with current small fast model available in region with model access enabled.
3. **Visitor Output Mechanism:** Default to a dedicated simulated doorbell screen web page (`/visitor`) for two-way communication.
4. **Flashing Safeguards:** Strict adherence to WCAG 2.3.1 (<= 3 flashes/sec), respect for `prefers-reduced-motion`, and explicit UI toggle.

### 8.2 Open Questions & Contingency Triggers
1. **Ring Simulator / SDK Verification:** Can we verify the Ring developer simulator / SDK event generation locally by end of Day 2?
2. **Contingency Trigger (Day 2 Deadline):** If simulated Ring events cannot be received end-to-end by end of Day 2, trigger fallback to Alexa+ MCP server (Streamable HTTP) implementing the identical visual alert and Bedrock summarization architecture.
3. **Bedrock Region & Model Access:** Confirm AWS account model access is active for the current small fast multimodal model in target region (e.g. `us-east-1` or `us-west-2`).
