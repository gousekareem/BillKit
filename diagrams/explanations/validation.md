# Validation

**Diagrams:** D09 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

`packages/shared/src/validation.ts` is pure and shared, so the same rules run on the server and live in the browser. It checks required fields; total plausibility (negative = possible refund, zero, implausibly large); tax > total; discount > subtotal; **arithmetic** using several legitimate interpretations — standard, discount already deducted, tax-inclusive prices, without round-off — with tolerance max(1, 0.5% of total); line-item sums and qty × price; paid + balance = total; calendar validity, future dates, dates before 2000, due ≥ bill date, ambiguous dates; ISO currency codes. Results are `passed / needs_review / failed` with per-field status. On save, the server re-validates the **approved** values: `failed` → 422; warnings → 409 until the user acknowledges them.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
