# Known limitations

These are stated plainly so that reviewers and users can calibrate their trust.

## Accuracy and evaluation
- **No real-world accuracy figure exists yet.** The 20-image HR evaluation is pending because the images were not available in the build environment. The only measured numbers are from 15 synthetic, computer-generated images, and they say nothing about real phone photos.
- Even after the HR run, 20 images give wide confidence intervals (one error in 15 bills moves field accuracy by 6.7 points).
- Confidence scores are **heuristic** (combined evidence signals) until a calibration table is fitted on a real validation set. The UI labels them as such.

## OCR and extraction
- English (Latin script) OCR only by default. Other languages need extra Tesseract models (`OCR_LANGS`); Hindi/Tamil/etc. were not tested.
- Handwritten bills, thermal receipts that have faded, very long receipts photographed in parts, and heavily crumpled paper are likely to fail or need manual entry.
- The rules are tuned for common receipt layouts in India, the UK, the US and the EU. Unusual layouts (multi-column invoices, statements, tables without labels) may pick the wrong total. The validator and the review flags exist to catch this, but they cannot catch everything.
- Line-item extraction is best effort and is not evaluated.
- Merchant names are taken from the header lines. Logos (images) are not read.
- Dates such as 03/04/2026 are ambiguous. BillKit uses the user's setting and marks them for review unless another date on the bill resolves the order.

## Classification
- The bill/non-bill decision is a transparent rule scorer, not a trained classifier. Bill-like non-bills (bank statements, price lists, order confirmations without totals) can be ambiguous. Ambiguous cases are sent to the VLM (if enabled) or to the user.

## Categorisation
- The TF-IDF model was trained on **synthetic** seed examples. Its cross-validation scores are optimistic. Keyword rules do most of the work.

## Product and platform
- The mobile app is the installable PWA; there is no native iOS/Android build. Camera behaviour depends on the browser.
- Offline mode lets you view saved bills. Scanning needs the server.
- Single-server design (SQLite and an in-process queue). There is no multi-factor authentication, no e-mail verification, no encryption at rest by the app, and no malware scanning.
- No currency conversion: totals are reported per currency.
- E-mail features need SMTP. Without it, password reset is not possible by e-mail.
- Browser testing was automated in Chrome (desktop and a Pixel 7 profile). Safari and Firefox were **not tested**.
- Not deployed publicly; no load testing; no independent security or accessibility audit.
- The legal pages are drafts, not legal advice.

© 2026 Shaik Gouse Kareem. All rights reserved.
