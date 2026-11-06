# Classification

**Diagrams:** D04 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

`ai/src/classify.ts` implements **billkit-evidence-v1**, a transparent rule-based scorer — not a trained model, and its score is not a probability.

- **Bill evidence**: strong vocabulary (total, subtotal, invoice, receipt, GSTIN, CGST/SGST, VAT, amount payable…), supporting terms (qty, rate, cash, UPI, units consumed…), lines ending in money amounts, and dates.
- **Counter-evidence**: ID-card terms (date of birth, nationality, valid till…), certificate, letter/form, chat-screenshot (many clock times, "online", "typing"), newspaper (long running text, few amounts).
- **Image traits**: colourfulness (Hasler–Süsstrunk), YCbCr skin-tone fraction, aspect ratio and screenshot traits (PNG, no EXIF, phone dimensions).

`billScore = (0.6·vocabulary + 0.3·money rows + 0.1·date) × (1 − 0.75 × strongest counter-evidence)`. ≥ 0.5 → bill (with subtype); ≤ 0.22 → not a bill; otherwise ambiguous. With fewer than 5 readable words the decision comes from image traits (photo/selfie vs blank). Ambiguous cases go to the VLM if allowed, otherwise to the user. Every decision lists its evidence, and the UI states that detecting a bill-like document does not prove authenticity.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
