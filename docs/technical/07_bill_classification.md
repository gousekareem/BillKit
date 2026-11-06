# 7. How bill vs non-bill classification works

Method `billkit-evidence-v1` (`ai/src/classify.ts`) is a transparent scorer. It is **not** a trained model, and its score is **not** a probability.

**Positive evidence (from OCR text)**
- Strong bill vocabulary (×3): grand total, subtotal, total, invoice, receipt, bill no/date, GSTIN, CGST/SGST, VAT, amount payable, net amount, tax invoice, cash memo.
- Supporting terms (×1.5): qty, rate, price, amount, cash/card/UPI, paid, discount, due date, units consumed, kWh, MRP, cashier, …
- Weak terms (×0.5): thank you, visit again, customer, store, phone.
- `vocabScore = min(1, (3·strong + 1.5·medium + 0.5·weak) / 12)`, `amountScore = min(1, rowsEndingInMoney / 5)`, `billEvidence = 0.6·vocab + 0.3·amount + 0.1·[date found]`.

**Negative evidence (classes)**: ID card, certificate, letter or form, chat/app screenshot, newspaper. Each pattern hit adds 0.3 (capped at 1). Extra rules: three or more clock times without totals → chat; more than 250 words with fewer than 3 money rows → newspaper. Chat indicators are damped (×0.6) unless the image looks like a screenshot (PNG, no EXIF, phone-like dimensions).

`billScore = billEvidence × (1 − 0.75 × strongestNegative)`

**Decision**
- Fewer than 5 readable words → decide from image traits: colourful or skin-toned → *photo* (not a bill); uniform → *blank page* (not a bill); otherwise *ambiguous*.
- `billScore ≥ 0.5` → **bill**, with a subtype (utility, restaurant, grocery, invoice, retail, screenshot, handwritten, generic receipt).
- `billScore ≤ 0.22` → **not a bill**, labelled with the strongest negative class.
- In between → **ambiguous**. If cloud AI is enabled it decides; otherwise the user is asked ("Is this a bill?").

Every decision lists `evidence` and `counterEvidence` strings, and the rejection screen shows them. The user can always override a rejection (`userConfirmedBill`). Detecting a bill-like document does **not** prove a transaction happened or that the receipt is genuine.

**Why not a CNN?** There was no labelled, licensed training data, and the 20 HR images must stay a test set. A MobileNetV3 transfer-learning pipeline is ready in `training/classification/` for when data exists (see `TRAINING_GUIDE.md`).

© 2026 Shaik Gouse Kareem. All rights reserved.
