# Document Understanding

**Diagrams:** D06 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

`ai/src/layout.ts` turns OCR words into **rows** that keep links to their words and bounding boxes (normalised to the page), then labels coarse **regions**: header (until a table header or first item row), items, totals (from the first *Total/Subtotal/Net amount* row with an amount, below 20% of the page), and footer (thank-you lines, terms, URLs). A **table header** is any row with at least two of item/qty/rate/amount/description/MRP/HSN. **Money tokens** are found per row after masking dates, clock times, percentages, phone numbers and `#ids`. **Item rows** are rows in the items region with an amount and letters, excluding phone/date/table/consumer/meter rows. **Key-value rows** (`Label: value`) are recorded for explicit merchant labels. Multi-page documents concatenate rows; totals are expected on the last page.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
