# Reflection

*Written by the project owner about building BillKit. The section on HR-set results is to be completed once the 20-image evaluation has been run. Until then it contains no numbers on purpose.*

## What I set out to build

The assignment asked for a bill scanner that can tell a bill from something that is not one, read merchant, date and total, suggest a category, show where it is unsure, let the user fix things, and save the result. I wanted it to be trustworthy rather than impressive. The app should be confident only when it has evidence, and it should be easy to correct when it is wrong.

## What users may like
- They can see *why* a value was chosen (the highlighted line on the photo) and fix it with one tap, for example by choosing the subtotal or the other date offered as an alternative.
- Selfies, ID cards and chat screenshots are rejected politely, with the reason, and the user can still override.
- Arithmetic checks catch misread totals before they reach the history.
- It is fast on clear bills without any cloud call, and it works as an installable app with offline viewing.
- An honest privacy page; export and full account deletion.

## What users may dislike
- The review step: even good scans need a glance and a tap before saving (it can be relaxed with the approval policy).
- Scanning needs a connection; there is no offline OCR.
- Handwritten and faded thermal receipts often need manual typing.
- English OCR only by default; regional-language bills are not read well.
- No bank or accounting integrations, no shared or team expenses.

## AI/ML failure cases I expect (to be confirmed by the HR run)
- **Wrong total line** on receipts that print several totals (for example "Total" before a discount and "Net payable" after it, when the labels are unusual), or when the amount is far from its label.
- **Merchant name** read from a slogan or a franchise line instead of the shop name, or missed because it appears only in a logo.
- **OCR errors on faded thermal paper** (for example 8 read as 3, or decimals lost), which then cause arithmetic warnings.
- **Dates** with ambiguous day/month order, and two-digit years.
- **Bill-like non-bills** (order confirmations, price lists, bank statements) scored as ambiguous or even as bills.
- **Categories** for general stores that sell both groceries and household goods.

## Key decisions and why

1. **OCR + rules first, cloud AI optional.** A vision-language model can read most receipts well, but it costs money, sends images to a third party and can "fill in" values that are not on the page. I made OCR and labelled rules the baseline. Every value they produce points back to the OCR line it came from. The VLM is a second opinion for hard cases, and its answers are merged only where they agree with the evidence or fill a gap.
2. **No model trained on the 20 images.** Twenty images are an evaluation set, not a training set. Training on them would make any reported accuracy meaningless. Instead I built the dataset and training framework so that a proper, licensed or consented dataset can be added later without leaking into the test.
3. **Human in the loop as a feature, not a fallback.** The review screen shows the evidence box, the confidence level and alternatives (for example the subtotal when the total is uncertain). Saving is blocked until every flagged field has been confirmed or corrected. Corrections are stored with the AI's original value, so they can later be used for improvement, but only with consent.
4. **Validation shared by client and server.** The same arithmetic and plausibility checks run as the user types and again when the bill is saved.
5. **Honesty in the product and the documentation.** The privacy page says images go to the server and, if enabled, to the AI provider. Reports say "pending" when there is no data.

## What was hard

- **Tesseract's page segmentation.** The automatic mode sometimes dropped the right-hand column, which is where the amounts are. Switching to single-column mode fixed it on my test images. This was a reminder to check the raw OCR before blaming the extraction rules.
- **Telling the total apart from other numbers.** Phone numbers, GSTINs, dates, invoice numbers and "TAX INVOICE" headings all look like amounts or ids to a naive regex. Each fix came with a regression test.
- **Dates.** 03/04/2026 cannot be resolved from the text alone. BillKit uses the user's preferred order, flags the date, and resolves it automatically only when another date on the same bill is unambiguous.
- **Testing the whole journey.** The end-to-end tests caught real bugs that unit tests missed: a sign-out race, a rate limiter that also limited static files, and an accessibility violation.

## What I would do next

1. Run the HR evaluation, read every failure and group the failures by cause before changing anything.
2. Collect a consented, redacted development set of about 300 Indian receipts, so that thresholds and calibration can be fitted on data that is not the test set.
3. Fit a calibration table so confidence scores mean what they say.
4. Add a second OCR engine (PaddleOCR) behind the same interface and compare the two on the development set.
5. Add MFA, e-mail verification and encryption at rest before any public launch.

## Results on the HR set

*To be completed after `npm run eval:hr`:* classification accuracy, field accuracy with confidence intervals, how many wrong values were caught by the review flags, the three most common failure causes, and what I would change because of them.

© 2026 Shaik Gouse Kareem. All rights reserved.
