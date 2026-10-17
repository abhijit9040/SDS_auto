# SignalDoor — Official Demo Video Script (3 Minutes)

> **Submission Track:** Amazon Developer Hackathon (Ring Track + AWS Builder + Open Source)  
> **Duration:** 2 minutes 50 seconds (Target: Strictly $\le 3$ minutes)  
> **Layout:** 1080p Split Screen (Left: Resident Interface | Right: Exterior Visitor Screen `/visitor`)

---

## 1. Setup & Recording Layout

### Screen Recording Setup
- **Resolution:** 1920 × 1080 (60 fps or 30 fps)
- **Window Layout:**
  - **Left 50%:** Browser window navigated to `http://localhost:3000/` (Resident UI)
  - **Right 50%:** Browser window navigated to `http://localhost:3000/visitor` (Visitor Screen)
- **Pre-flight Checks:**
  - `npm run dev` running in background on port 3000.
  - Left tab status: `✓ Online — Doorbell Connected`.
  - Right tab status: `✓ Doorbell Screen Online — Ready for Visitors`.
  - Audio/Voiceover: Clear spoken audio with subtitles/closed captions enabled for deaf judges.

---

## 2. Timed Scene-by-Scene Script

### [0:00 – 0:30] Scene 1: The Problem & Accessibility Gap
- **Visual:** Focus on the split-screen view. Both screens are idle. The resident screen shows the high-contrast dashboard with sensory controls.
- **Voiceover / Caption:**  
  > *"Smart doorbells were designed around hearing: loud chimes and tiny push notification badges. For over 430 million deaf and hard-of-hearing people worldwide, auditory chimes are completely inaccessible. When a visitor rings, deaf residents are left wondering: who is at the door, is it urgent, and how can I respond quickly without an audio intercom?*  
  > *This is SignalDoor: an accessible, visual, two-way smart doorbell powered by Ring and Amazon Bedrock."*

---

### [0:30 – 0:55] Scene 2: Ring Webhook & Immediate Phase 1 Alert (<2s)
- **Action:** Click **"🔔 Simulate Delivery Courier"** in the Resident UI control bar.
- **Visual:** 
  - Immediately, the Resident UI triggers a high-contrast visual alert banner with a calm strobe animation (0.8s cycle = 1.25 flashes/sec, strictly compliant with WCAG 2.3.1 seizure safety).
  - Screen displays Phase 1 fallback text: **"Someone is at your door"**.
  - Highlight the `FlashToggle` switch: show that residents can adjust flashing or disable it instantly.
- **Voiceover / Caption:**  
  > *"When a visitor rings, SignalDoor prioritizes speed and safety. Within two seconds, an immediate visual alert pulses across the resident's screen. The strobe is engineered strictly to WCAG 2.3.1 standards—capped well below danger thresholds to prevent photosensitive seizures—and automatically respects system reduced-motion settings.*  
  > *Crucially, unlike standard apps, the alert never auto-dismisses on a timer: it stays until the resident explicitly interacts."*

---

### [0:55 – 1:35] Scene 3: Phase 2 Amazon Bedrock Multimodal Context (<5s)
- **Visual:**
  - The alert badge transitions smoothly from *Phase 1: Doorbell Ring* to **✨ Bedrock AI Summary**.
  - The alert body text politely updates (via `aria-live="polite"`):  
    **"A delivery courier holding a package standing on the doorstep."**
  - Show the simulated snapshot thumbnail with `"SIMULATED – SAMPLE IMAGE"` watermark.
- **Voiceover / Caption:**  
  > *"While the resident is immediately notified, Amazon Bedrock analyzes the camera snapshot in the background using Claude 3 Haiku via the Converse API.*  
  > *In under five seconds, the alert enriches with a plain-language summary: 'A delivery courier holding a package standing on the doorstep.'*  
  > *For privacy and security, image bytes are processed strictly in memory and never stored on disk. Our responsible AI guardrails strictly prohibit guessing identity, ethnicity, age, or intent, ensuring objective, respectful assistive descriptions."*

---

### [1:35 – 2:10] Scene 4: Accessible Two-Way Quick Replies (<1.5s)
- **Action:** Click the **"Leave it at the door"** quick reply button on the Resident UI.
- **Visual:**
  - Button state instantly transforms with a green checkmark: `✓ Leave it at the door`.
  - Subtext confirms: `✓ Delivered to visitor screen • Just now`.
  - Point out that touch targets are $\ge 48$px with high-contrast visible focus rings (9.0:1 contrast ratio).
- **Voiceover / Caption:**  
  > *"Deaf residents cannot use two-way voice intercoms. SignalDoor provides three one-tap quick replies with large 48-pixel accessible touch targets.*  
  > *The resident taps 'Leave it at the door'. The backend validates the text against a strict whitelist, logs the transaction in an internal SQLite ledger, and pushes the message to the visitor screen in under 1.5 seconds."*

---

### [2:10 – 2:35] Scene 5: Exterior Visitor Display (`/visitor`) & Anti-Stale Reset
- **Visual:**
  - Focus switches to the Right Window (`/visitor`).
  - Screen displays large, high-contrast text: **"Leave it at the door"** with a visible timestamp.
  - Action: Click **"🔔 Simulate Friendly Visitor"** on the resident side.
  - Watch the Right Window instantly clear the old delivery message and reset to:  
    `"Doorbell Rang — Waiting for response from resident..."`
- **Voiceover / Caption:**  
  > *"Outside, the delivery driver sees high-contrast 32-pixel instructions right on the doorbell display: 'Leave it at the door'. They know exactly what to do without waiting.*  
  > *And when the next visitor rings, SignalDoor automatically resets the exterior display back to waiting mode, guaranteeing that old instructions are never displayed to a new visitor."*

---

### [2:35 – 2:55] Scene 6: Architecture & Honest Disclosure
- **Visual:**
  - Briefly display the architecture diagram and test runner terminal showing 59 passing tests.
- **Voiceover / Caption:**  
  > *"SignalDoor implements a unified RingAdapter supporting both live Ring Cloud webhooks and offline developer emulators like ring-sandbox. We built full HMAC-SHA256 signature verification, a resilient REST client with exponential backoff, and 59 automated tests covering accessibility, dynamic CSS contrast, and WCAG compliance."*

---

### [2:55 – 3:00] Scene 7: Wrap-up & Mission Callout
- **Visual:** Full view of the SignalDoor application with the dismiss button clicked, returning gracefully to standby.
- **Voiceover / Caption:**  
  > *"SignalDoor: making smart homes truly accessible for everyone. Open source on GitHub under the MIT License. Thank you!"*

---

## 3. Post-Recording Checklist

- [ ] Duration is strictly $\le 3$ minutes (02:50 target).
- [ ] Visual subtitles / closed captions burned in or uploaded as `.srt`.
- [ ] Audio volume is balanced with zero background hum.
- [ ] No third-party trademarks or brand logos visible in video.
- [ ] Exported in 1080p MP4 format.
