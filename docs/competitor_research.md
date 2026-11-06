# Competitor research

This research was done on 6 November 2026 from public vendor pages and help articles. It is a summary in my own words, not an endorsement and not a measured comparison: none of these products was tested hands-on. Features and prices change, so check the linked pages.

| Product | What its public material describes | What BillKit takes from it | Where BillKit deliberately differs |
|---|---|---|---|
| **Expensify (SmartScan)** | Capture by photo, e-mail forwarding or SMS. Merchant, date, amount and currency are extracted automatically. Expenses are auto-categorised from policies and past behaviour. Its help centre says a scan fails when a readable date and total cannot be found, and then asks for manual entry. It recommends a flat receipt on a contrasting background with all edges visible. | Required fields (date + total) decide "could not read"; capture tips (contrast, edges, flat paper) appear in our retake advice | Every uncertain field is shown with its evidence and must be confirmed. We do not silently auto-file |
| **Zoho Expense (Autoscan)** | Upload from web/iOS/Android, a browser extension or a forwarding address. Autoscan fetches date, amount, merchant, currency and payment mode. Later expenses from a merchant are auto-categorised after the first one is categorised manually. JPG/HEIC/PNG/PDF are supported, and multi-page receipts are combined | Multi-page capture (≤ 5 pages), HEIC support, learning categories from user corrections (our corrections table + consent flag) | Self-hostable; no account with a third party needed |
| **Veryfi (OCR API)** | A developer API and mobile capture SDK. Many fields including line items, tax and document type, plus categorisation, auto-crop and fraud checks. The vendor's own marketing makes speed and accuracy claims, which we have not verified | Rich field schema (document type, line items, tax breakdown); auto-crop as a pre-processing step | We publish our measured numbers only, with confidence intervals, and say "pending" when there is no data |
| **Dext Prepare (formerly Receipt Bank)** | Aimed at accountants and bookkeepers. Collection from mobile, e-mail and supplier connections. Document type, date, due date, supplier and currency are extracted. Line-item extraction can be switched on per supplier. Duplicate detection and accounting-software publishing | Document-type classification; duplicate detection as a warning; per-field review | Personal-expense focus; no accounting integrations yet (listed as future work) |

## Gaps BillKit aims at

1. **Transparency.** Show why a value was chosen (the OCR evidence box and the rule label) and how sure the system is, instead of only filling in fields.
2. **Explicit non-bill rejection** with a reason and a "this is a bill" override.
3. **Self-hosting and optional cloud AI**, with a clear, honest data-flow statement.
4. **Honest evaluation**: a per-image report with failure reasons.

## Sources

- Expensify, receipt scanning app page — https://use.expensify.com/product
- Expensify Help, "Troubleshoot SmartScan Issues" — https://help.expensify.com/articles/expensify-classic/expenses/Troubleshoot-SmartScan-Issues
- Zoho Expense Help, "Autoscan Receipts" — https://www.zoho.com/expense/help/expenses/autoscan-receipts/ and https://www.zoho.com/en-kw/expense/help/expenses/autoscan-receipts/
- Veryfi, Receipt OCR API — https://www.veryfi.com/page/2/terms/resources/receipt-ocr-api/
- Dext Help, "What data is extracted by Dext Prepare" — https://help.dext.com/en/s/article/What-data-is-extracted-by-Dext-Prepare?
- Dext Help, "How to use Line Item Extraction" — https://help.dext.com/en/s/article/How-to-use-Line-Item-Extraction

© 2026 Shaik Gouse Kareem. All rights reserved.
