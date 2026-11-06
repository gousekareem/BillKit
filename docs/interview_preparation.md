# Demo and interview preparation

## 1. Project overview (30-second version)
BillKit is a web app and installable PWA. You photograph or upload a bill. The app checks that it is a bill (and politely rejects selfies, ID cards and screenshots), reads the merchant, date, total and other fields with OCR and rules, suggests a category, and checks the arithmetic. It then shows you what it is unsure about, with the evidence, before anything is saved. Saved bills go into a searchable history with analytics and export. The guiding idea is that **trust beats looking clever**: every value points to the text it came from, and uncertain values must be confirmed.

## 2. Architecture (2 minutes)
React SPA/PWA → Fastify API → in-process queue → `@billkit/ai` pipeline → SQLite + local file storage. An optional Anthropic vision model is a second opinion. Shared TypeScript package for schemas and validation, so the browser and the server run the same checks. Python `training/` for offline model work, with a JSON model registry read by the TypeScript inference code. (`docs/architecture.md`, diagram D01.)

## 3. AI/ML pipeline
decode → quality → preprocess → OCR → classify → layout → extract → (VLM) → merge → categorise → validate → confidence. (`docs/ai_ml_pipeline.md`.)

## 4. Why Tesseract (tesseract.js)?
It runs on my own server (privacy, no per-page fees), it is Apache-2.0, it gives word boxes and confidences, and the model installs from npm, so the build is reproducible. ML Kit only works inside native Android/iOS apps, and I built a PWA. PaddleOCR would need a Python runtime in production. I found and fixed a real problem: in auto page-segmentation mode Tesseract dropped the right-hand amount column, and single-column mode (PSM 4) fixed it.

## 5. Model selection
No trained classifier for bill vs non-bill, because there was no licensed data and the 20 HR images must stay a test set. Instead, a transparent evidence scorer. The categoriser is TF-IDF + logistic regression, compared with Naive Bayes and keyword rules under grouped CV, and labelled as trained on synthetic data. The VLM is optional and used only when the rules are unsure. (`docs/model_selection.md`.)

## 6. Confidence and uncertainty
Four signals are kept apart: OCR confidence, rule strength, the model's self-report (never treated as a probability) and validation. They are combined into a *heuristic* score that is labelled as heuristic. There is a configurable review threshold (0.85). Ambiguous or inferred values are always flagged, and the system abstains (Missing or Unknown) instead of guessing. Calibration by histogram binning is implemented but needs a real validation set. (`docs/technical/10_confidence.md`.)

## 7. Dataset
HR set: 15 real bills + 5 non-bills, evaluation only. Training tooling refuses to read that folder. The dataset framework has a folder per condition, manifests, annotation templates, grouped splits with a fixed seed, duplicate checks, and consent and redaction guides. Synthetic receipts exist only for tests and are labelled as such.

## 8. How accuracy is calculated
Per image: expected vs predicted, with normalisation. Merchant: case, punctuation and legal suffixes removed, then equal, contained, or Levenshtein similarity ≥ 0.85. Date: ISO equality. Total: within 0.01. Category: case-insensitive. Classification: accuracy, precision, recall, F1 and a confusion matrix (ambiguous counts as wrong). Field accuracy comes with Wilson 95 % intervals, because n = 15 is small: 14/15 is 93 %, but the interval is roughly 70–99 %. (`docs/evaluation_methodology.md`.)

## 9. Failure analysis
Reasons come from evidence: was the expected total in the OCR text at all? If not, it is an OCR problem; if yes, the wrong line was chosen. Plus quality issues (blur, glare), ambiguous date order, classification evidence and validation warnings. I don't write a reason I cannot show.

## 10. Security
Argon2id; hashed server-side sessions in HttpOnly cookies; CSRF header + Origin check; per-route rate limits; strict CSP; magic-byte upload checks and re-encoding; every query scoped by user; OCR text treated as untrusted in prompts and schema-validated output; no secrets in code. Gaps: no MFA, no encryption at rest, no pen test. (`docs/privacy_security.md`.)

## 11. Trade-offs I made
| Choice | Gain | Cost |
|---|---|---|
| PWA, not React Native | One codebase, testable here, installable | No native camera features, no app-store presence |
| Rules before ML | Explainable, works without data | Brittle on unusual layouts |
| Server OCR | Consistent results, small client | Images leave the phone; scanning needs a connection |
| SQLite | Zero ops | Single instance |
| Human approval required | Fewer silent errors | One more step for the user |

## 12. Known limitations and future work
See `docs/limitations.md` and `docs/technical/23_future_research.md`. Headline: there are no real-world accuracy numbers until the HR images are evaluated.

## 13. Likely questions, with answers

**Q: What is your accuracy?**
A: On real bills I don't have a number yet. The HR evaluation is set up and marked pending. On 15 synthetic images everything was correct, but that only shows that the pipeline runs end to end. I would report the HR result per field with confidence intervals.

**Q: Why not just send everything to GPT/Claude?**
A: Cost, privacy, latency, and the risk of plausible but invented values. The cheap path handles clear bills. The VLM is only called when the rules are unsure, and its answer is checked against the OCR text. If the VLM reports a value that is not on the page, it is capped at low confidence and flagged.

**Q: How do you stop the model from being prompt-injected by a receipt that says "ignore previous instructions"?**
A: The document text is wrapped in delimiters and labelled as untrusted data. The system prompt tells the model to ignore any instructions inside it. Injection-like phrases are flagged. The model can only return data through one forced tool whose output is validated by a strict zod schema, and it has no other tools or actions.

**Q: How do you tell Total from Subtotal?**
A: Label rules with priorities (Grand total > Net payable > Total, excluding Sub total, Total qty, Total savings…), position (totals region, lower rows), masking of dates, phone numbers and ids, and then arithmetic validation that accepts several legitimate receipt formats (tax inclusive or exclusive, discount already applied, round-off). The subtotal is offered as a one-tap alternative.

**Q: 03/04/2026: March or April?**
A: You cannot know from that string alone. BillKit uses the user's date-order setting and flags the field, unless another unambiguous date on the same bill shows the order.

**Q: Is the confidence score a probability?**
A: No. It is labelled "heuristic". It becomes "calibrated" only after a calibration table has been fitted on a labelled validation set. I would check calibration with a reliability diagram and ECE.

**Q: Why didn't you train a CNN?**
A: Twenty images are a test set. Training on them would make the test meaningless, and twenty is far too few anyway. I built the training pipeline (MobileNetV3-Small transfer learning, grouped splits, ONNX export) so it can be trained when there is licensed or consented data.

**Q: What happens when the AI is wrong and the user corrects it?**
A: The correction is saved with the AI's original value, its confidence and the model and prompt versions. It is marked *unreviewed* and used for improvement only if the user opted in. Nothing retrains automatically. A person reviews exported corrections before they become training data.

**Q: How do you prevent duplicate bills?**
A: SHA-256 of the file, a 64-bit perceptual hash (Hamming distance ≤ 6), merchant + date + total, and merchant + invoice number. These produce warnings; the user decides, because two identical coffees on one day can both be real.

**Q: What would you do in your first week if this went to production?**
A: Run the HR set and a larger consented set, fit calibration, add MFA and e-mail verification, set up monitoring alerts on the `job_metrics` error rates, and do a security review.

**Q: How does it work offline?**
A: The app shell and any bills, lists and analytics you have viewed are available offline from IndexedDB. Scanning needs the server, and the app says so.

**Q: How did you test it?**
A: 136 unit and integration tests (including real OCR on synthetic images, and API tests against a real Fastify instance and database), 11 Playwright end-to-end tests including axe accessibility checks, and 10 Python tests. Lint, typecheck and build run in `npm run check`. Output is in `docs/testing.md`.

## 14. Live-change exercise
See `submission/live_change_exercise.md`: add a new built-in category in about 10 minutes, with TypeScript pointing to every place that must change, and a test that proves it.

© 2026 Shaik Gouse Kareem. All rights reserved.
