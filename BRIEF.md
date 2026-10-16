# SignalDoor — Project Brief

## 1. Two-Sentence Summary (Stage Gate)
SignalDoor turns Ring smart doorbell visitor events into accessible, high-contrast visual alerts with Amazon Bedrock AI descriptions for deaf and hard-of-hearing users. It empowers users to immediately understand who is at the door and respond in real time via one-tap quick replies sent back to the visitor.

---

## 2. Problem Statement
Traditional doorbells and smart-home notifications rely primarily on auditory alerts or small, generic push notifications. Deaf and hard-of-hearing individuals frequently miss deliveries, guests, or emergency responders. Furthermore, existing visual notifications merely announce that "motion was detected" or "someone is at the door" without conveying who is there, what they want, or providing an accessible, immediate way to reply.

---

## 3. Target Audience
- **Primary:** Deaf and hard-of-hearing individuals living independently or with families.
- **Secondary:** Family members, roommates, and caregivers who support accessible home environments.

---

## 4. Key Goals & Success Criteria
1. **Accessible Real-Time Alerts:** Deliver immediate, high-contrast, large-font visual notifications (with flash/vibrate support) when a Ring doorbell event occurs.
2. **AI-Powered Visitor Context:** Leverage Amazon Bedrock (Converse API) to summarize visitor context into concise, plain-language text.
3. **Two-Way Interaction:** Enable one-tap quick replies (e.g., "Leave it at the door", "Coming in 2 minutes", "I can't hear, please text me") communicated back to the visitor.
4. **Hackathon Demo Viability:** A complete, working end-to-end demonstration recordable within a 3-minute video presentation.

---

## 5. Scope & Constraints
- **Tracks:** Amazon Developer Hackathon (Build, Ship, Shape) — Primary Track: Ring; Mini-challenges: AWS Builder + Open Source.
- **Deadline:** October 23, 2026 (~7-day timeline).
- **Core Integration:** Dedicated Ring adapter calling the Ring SDK/simulator, backed by Amazon Bedrock for AI descriptions.
- **Contingency / Fallback:** If Ring developer access or OAuth presents blockers, fallback to an Alexa+ MCP server (Streamable HTTP) using the identical visual alert paradigm.
- **Non-Goals (Out of Scope for MVP):**
  - Native iOS/Android mobile apps.
  - Live video streaming / WebRTC pipelines.
  - Complex multi-tenant user authentication systems.
