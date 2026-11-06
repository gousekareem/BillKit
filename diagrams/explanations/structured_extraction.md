# Structured Extraction

**Diagrams:** D07 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

`ai/src/extract.ts` produces a `RawExtraction`: for each field a value (or `null`), a status (extracted / inferred / ambiguous / missing), a rule strength, the OCR confidence of the evidence row, the evidence text with page and bbox, and alternatives.

- **Amounts** use prioritised label rules: *Grand Total* (0.95) > *Net amount / Amount payable / Bill amount / Total due* (0.90) > *Total* (0.80), excluding *Sub total, Total qty, Total savings, Total tax*. Subtotal, tax (a "total tax" line, or the sum of CGST/SGST/IGST/VAT/cess lines), discount, service charge, tip, round-off, amount paid and balance due have their own rules, so they can never be confused with the total. The amount is the rightmost money token on the labelled row, or on the next row if the row has none. Only if no label exists is the largest lower-half amount used — marked *inferred* with an explanatory note.
- **Dates**: labelled dates beat header dates; due/expiry/birth/period dates are excluded; ambiguous numeric dates are resolved by other unambiguous dates on the same bill, otherwise flagged with both readings.
- **Merchant**: explicit label → header-row scoring (font size, letters, uppercase, position, address/noise penalties) → known-brand lexicon.
- **Line items**: description + quantity/price/total with a qty × price check.

If a VLM ran, `ai/src/llm/merge.ts` merges field by field (agree / disagree / model-only verified against OCR) before typed fields are built.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
