# SignalDoor — Developer Friction Log & Product Feedback

> **Purpose:** Document real-time developer friction, SDK/API ergonomics, and integration learnings while building SignalDoor for the Amazon Developer Hackathon (Ring Track + AWS Builder).

---

## 1. Ring Developer Experience & Webhooks

### Task 1: Walking Skeleton Ingestion & HMAC Verification
- **Express Raw Body Ingestion for HMAC:**
  - *Friction:* Express's default `express.json()` parser consumes and decodes the stream directly into an object, discarding raw bytes. If you re-serialize with `JSON.stringify(req.body)`, key ordering or whitespace discrepancies break the HMAC-SHA256 digest comparison.
  - *Solution:* Implemented `express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } })` to preserve the original payload buffer.
- **Timing Safe Equal Guard:**
  - *Friction:* Node's `crypto.timingSafeEqual(bufA, bufB)` crashes with `RangeError` if the two buffers have different byte lengths (e.g. if an attacker supplies an invalid hex length).
  - *Solution:* Added an explicit buffer length equality check prior to executing `crypto.timingSafeEqual`.
- **Request Deduplication & Webhook SLA:**
  - *Learning:* Returning an immediate HTTP 200 upon verifying signature and checking `meta.request_id` prevents webhook retries, while downstream WebSocket dispatch runs asynchronously via `setImmediate`.
- **Ring Webhook Schema Nuances:**
  - *Learning:* Ring's envelope schema uses `meta.time` (epoch millis) and `meta.version` rather than generic `timestamp` properties, while event data attributes can vary by device model. Designed payload interfaces with open index signatures to avoid fragile hard-coded assumptions.

---

## 2. Amazon Bedrock Converse API Experience
*(Entries to be added during Task 2 implementation)*

---

## 3. Real-Time & Accessibility Implementation
*(Entries to be added during Tasks 3 & 4 implementation)*

---

## 4. Overall Hackathon Summary & Recommendations
*(Entries to be finalized during Task 6)*
