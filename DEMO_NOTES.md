# SignalDoor — Rough Demo Video Script & Checkpoint Notes

> **Target:** Under 3 minutes for hackathon submission video (Devpost Ring Track + AWS Builder + Open Source).  
> **Format:** Side-by-side screen recording of Resident UI and Visitor Screen (`/visitor`).

---

## 1. Setup & Environment Preparation

1. **Start the local development server:**
   ```bash
   npm run dev
   ```
2. **Open two browser windows side-by-side:**
   - **Left Window (Resident UI):** `http://localhost:5173/`
   - **Right Window (Visitor Doorbell Screen):** `http://localhost:5173/visitor`
3. **Verify connections:** Both tabs should display a green badge (*"Doorbell Connected"* / *"Doorbell Display Active"*).

---

## 2. Step-by-Step Recording Script (<3 Minutes)

### [0:00 – 0:25] The Problem & Introduction
- **Spoken / Caption:**  
  *"For deaf and hard-of-hearing residents, doorbells and smart-home chimes are purely auditory. When someone rings, visual alerts often just say 'motion detected' without context—leaving residents wondering who is there, what they need, or how to reply quickly."*
- **Visual:** Focus on the clean Resident UI showing idle state.

---

### [0:25 – 0:55] Step 1: Doorbell Ring & Immediate Phase 1 Alert (<2s)
- **Action:** Click **"🔔 Trigger Doorbell Press"** on the Resident UI.
- **Spoken / Caption:**  
  *"A visitor presses the Ring doorbell. Within two seconds, SignalDoor triggers an immediate, accessible visual strobe safely capped under two flashes per second. The resident instantly sees the emergency fallback text: 'Someone is at your door'."*
- **Visual:** High-contrast alert banner pulses with safe strobe; `aria-live="assertive"` announces the alert.

---

### [0:55 – 1:30] Step 2: Phase 2 Bedrock Multimodal AI Enrichment (<5s)
- **Spoken / Caption:**  
  *"Behind the scenes, Amazon Bedrock Converse API processes the watermarked camera snapshot in memory—without saving frames to disk. In under 5 seconds, the alert smoothly updates with a plain-language summary: 'A person holding a large cardboard package near the door.' The resident knows immediately that it's a delivery without guessing."*
- **Visual:** Badge updates to *✨ Bedrock AI Summary*, and body text politely updates (`aria-live="polite"`).

---

### [1:30 – 2:05] Step 3: One-Tap Two-Way Quick Reply (<1.5s)
- **Action:** Click the **"Leave it at the door"** button.
- **Spoken / Caption:**  
  *"Instead of struggling to open a slow video intercom or typing a custom text, the resident taps a single 48-pixel accessible quick reply: 'Leave it at the door'. The button confirms delivery with an instant checkmark, logged to an internal SQLite audit ledger."*
- **Visual:** Button changes to green confirmed state (`✓ Leave it at the door`); status reads *Delivered to visitor screen*.

---

### [2:05 – 2:35] Step 4: Dedicated Visitor Display (`/visitor`)
- **Visual:** Switch focus to the Right Window (`/visitor`).
- **Spoken / Caption:**  
  *"Over on the exterior doorbell screen, the visitor sees large, high-contrast text: 'Leave it at the door' along with the delivery timestamp. The visitor gets clear instructions without delay."*
- **Visual:** Smooth card highlights the quote in cyan accent with timestamp.

---

### [2:35 – 2:55] Step 5: Stale Reply Reset on New Visitor Event
- **Action:** Click **"🔔 Trigger Doorbell Press"** again in the Resident UI.
- **Spoken / Caption:**  
  *"When a subsequent visitor arrives, the system automatically resets the exterior display back to 'Waiting for response...', ensuring stale instructions from a prior delivery are never shown."*
- **Visual:** Right tab clears instantly back to waiting state; Left tab shows fresh Phase 1 alert.

---

### [2:55 – 3:00] Wrap-up & Open Source Callout
- **Spoken / Caption:**  
  *"SignalDoor delivers accessibility, privacy, and two-way interaction built on Ring, AWS Bedrock, and open-source TypeScript."*

---

## 3. Accessibility & Technical Verification Checklist

- [x] **Safe Flashing:** Strobe rate $\le 2$ flashes/second (well below WCAG 2.3.1 3/s threshold).
- [x] **Large Touch Targets:** All quick reply buttons have $\ge 48$px height.
- [x] **WCAG AA Typography:** Alert body font $\ge 24$px, visitor screen $\ge 32$px.
- [x] **High Contrast:** Greater than $4.5:1$ contrast ratio for all text elements.
- [x] **Zero Stale Replies:** Automatic reset on new doorbell press.
- [x] **SQLite Logging:** Every reply logged with event ID, reply text, and ISO timestamp.
