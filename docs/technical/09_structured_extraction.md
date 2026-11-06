# 9. Structured extraction

`ai/src/extract.ts` turns the layout (rows with words, boxes, regions and money tokens) into 21 fields. Every value carries **evidence**: the OCR row text, the page and a normalised box. When nothing qualifies, the field is `missing`. Values are never invented.

## Amounts
Labels decide what a number is. Each rule has a score:

| Field | Labels (examples) | Score |
|---|---|---|
| Total | "Grand total" | 0.95 |
| | "Net amount/payable", "Amount payable", "Total amount", "Bill amount", "Amount due", "Invoice total", … | 0.9 |
| | "Total", but not "Sub total", "Total qty/items/savings/discount/tax/GST/weight", "taxable" | 0.8 |
| Subtotal | "Sub total" 0.9; "Total before tax", "Taxable amount/value", "Gross amount" 0.8 | |
| Tax | "Total tax/GST/VAT" 0.9; otherwise sums CGST + SGST (+ IGST/cess) lines | |
| Discount, service charge, tip, round-off, amount paid, balance due | each has its own labels | |

The candidate amount on a labelled row is the right-most money token. Dates, times, phone-like integers of 7+ digits without decimals or currency, and `#ids` are masked out first. Rows lower on the page and in the *totals* region rank higher. The **largest unlabelled amount** is used only as a last resort; it is marked `inferred` and capped in confidence, so it is always shown for review. Competing candidates (for example the subtotal) become `alternatives` that the user can pick with one tap.

## Dates
`findDateCandidates` understands numeric (d/m/y, y-m-d, 2-digit years), textual ("06 Nov 2026", "Nov 6, 2026") and OCR-damaged forms ("0ct"). Rows with a date label ("Date", "Bill date", "Invoice date", "Txn date") score 0.9, header rows 0.75, others 0.6. Due, expiry and validity dates are excluded. A date such as 03/04/2026 is **ambiguous**. It is read in the user's preferred order and flagged, unless another unambiguous date on the same bill shows the order (`resolvedByContext`). Impossible dates (30 February) are rejected.

## Merchant
Header rows are scored: position near the top, larger font (word height), capitals, and words such as "restaurant", "mart" or "Pvt Ltd" raise the score. Rows that look like addresses, phone numbers, GSTINs, dates or "Tax invoice" lower it. The score is `min(0.93, 0.45 + 0.6·s)`. The runner-up becomes an alternative.

## Other fields
Time, invoice number (needs a label *and* a digit, so "TAX INVOICE" is never read as a number), payment method (cash, card, UPI, wallet, bank transfer), currency (symbol/code evidence; INR *inferred* from GST terms), address, GSTIN/tax id, phone, and line items (description, qty × rate = amount, with an arithmetic check).

## Optional VLM merge
When used, the VLM returns the same fields through a forced tool call. `llm/merge.ts` handles the outcome:
- *agree* (both found the same value) → confidence raised, `source = ocr_rules+vlm`;
- *disagree* → keep the rule value if its evidence is strong, otherwise the VLM's; the other value becomes an alternative, and the field is always flagged;
- *single source* → a VLM-only value is checked against the OCR text, and if it is not found there it is capped at 0.45 and marked unverified.

© 2026 Shaik Gouse Kareem. All rights reserved.
