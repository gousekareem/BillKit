# AI/ML pipeline (G1–G24)

How each AI/ML group in the brief is implemented, where the code lives, and how it was verified.

| Group | Implementation | Code | Verified by |
|---|---|---|---|
| **G1 Acquisition** | Camera (`getUserMedia`, `capture=environment`), gallery, drag-drop; server-side format detection from magic bytes; EXIF orientation; HEIC→JPEG; PDF pages + text layer; ≤ 5 pages, 15 MB, 50 MP limits | `website/src/pages/app/Scan.tsx`, `ai/src/image/decode.ts` | `ai/tests/image.test.ts`, e2e Journey B |
| **G2 Quality** | Laplacian variance, luminance, over/under-exposure, glare blocks, lighting unevenness, resolution, skew, border contact, OCR readability → score, verdict, retake tips; never blocks | `ai/src/quality.ts` | `image.test.ts` |
| **G3 Preprocessing** | Size limit, Otsu document mask → quad → homography, projection-profile deskew, illumination flattening, greyscale/contrast/sharpen/upscale; original kept | `ai/src/preprocess.ts`, `ai/src/image/raster.ts` | `image.test.ts` (perspective, skew, shadow) |
| **G4 Classification** | Evidence scorer (bill vocabulary, money rows, dates vs ID/certificate/letter/chat/newspaper; colourfulness, skin-tone, screenshot traits); bill subtypes; ambiguous → VLM or user | `ai/src/classify.ts` | `pipeline.test.ts`, backend `flow.test.ts`, e2e Journey C |
| **G5 OCR** | tesseract.js 7, LSTM, PSM 4, worker pool, rotation search, words/lines with boxes and confidences | `ai/src/ocr.ts` | all pipeline tests use real OCR |
| **G6 Layout** | Visual rows, regions, table header, key-values, item rows, money-token detection | `ai/src/layout.ts` | `extract.test.ts` |
| **G7 Extraction** | Label-priority amount rules (total ≠ subtotal ≠ tax ≠ paid ≠ balance), dates with disambiguation, merchant scoring, ids, payment, line items; evidence per field; `null` when missing | `ai/src/extract.ts` | `extract.test.ts` (16 cases) |
| **G8 Categorisation** | Lexicon rules (merchant/item/context), registered TF-IDF+LR model, VLM hint; subcategories; custom categories; abstains ("Unknown") | `ai/src/categorise.ts`, `ai/src/lexicon.ts`, `training/categorisation/` | `categorise.test.ts` |
| **G9 Confidence** | Four separate signals; heuristic score; optional calibration table; configurable threshold; abstention | `ai/src/confidence.ts` | `confidence.test.ts` |
| **G10 Validation** | Arithmetic with legitimate interpretations, plausibility, dates, currency, items, paid/balance; live in UI and re-run on save | `packages/shared/src/validation.ts` | `validation.test.ts`, backend flow, website review test |
| **G11 LLM / prompts** | Versioned system prompt (`bill-extract-v1.0`), forced tool call with JSON schema, zod validation, no-guessing rules, untrusted-data markers, injection flag, model/prompt version recorded | `ai/src/llm/*` | `llm.test.ts` (mocked API) |
| **G12 Hybrid architecture** | VLM only if allowed and (mode=always, or classification ambiguous, or required fields weak); evidence-aware merge; no duplicate model calls (one call does classification + extraction) | `ai/src/pipeline.ts`, `ai/src/llm/merge.ts` | `pipeline.test.ts` |
| **G13 Human in the loop** | Review screen, badges, evidence boxes, alternatives, confirm checkboxes, approval gate, provenance, correction rows, reprocess keeps edits | `website/src/pages/app/ScanDetail.tsx`, `backend/src/services/bills.ts` | `review.test.tsx`, backend flow, e2e B/D |
| **G14 Dataset management** | Folder hierarchy, manifests, annotation templates, HR slot, acquisition and privacy guides | `dataset/`, `docs/dataset/` | `training/tests` |
| **G15 Evaluation** | Harness: accuracy/precision/recall/F1/confusion, field accuracy with Wilson CIs, all-required rate, latency, VLM calls/failures/cost; CSV/JSON/Markdown | `evaluation/scripts/run-evaluation.ts` | synthetic smoke run |
| **G16 Failure analysis** | Reasons derived from OCR text, field status, validation issues and quality issues | same | smoke run (no failures), code review |
| **G17 Training** | Categoriser trained, compared and exported (synthetic seed data); classifier framework (not executed); experiment log | `training/` | `training/tests` |
| **G18 Edge/on-device** | Evaluated: OCR runs on the server; tesseract.js can run in the browser (future); ONNX export enables LiteRT/Core ML conversion; offline viewing via PWA | `docs/technical/19_offline_functionality.md` | — |
| **G19 Security & privacy** | See `privacy_security.md` | backend | `auth.test.ts`, `flow.test.ts` |
| **G20 Reliability** | Timeouts, bounded retries with backoff and Retry-After, permanent-error classification, OCR fallback, cancellation, polling, token/cost tracking | `ai/src/llm/provider.ts`, `backend/src/services/processing.ts` | `llm.test.ts`, `pipeline.test.ts` |
| **G21 Duplicates** | sha256, 64-bit dHash (Hamming ≤ 6), merchant + date + total, merchant + invoice number; warnings only | `ai/src/duplicates.ts`, `backend/src/services/bills.ts` | `duplicates.test.ts`, backend flow |
| **G22 Expense intelligence** | Monthly series, category/merchant totals, month-on-month comparison, budgets, 3σ unusual flags, filters, search, CSV/JSON export; per currency, no FX | `backend/src/services/analytics.ts` | backend flow, e2e E |
| **G23 Feedback** | Corrections with consent flag and `unreviewed` status; export CLI for consented rows only; correction stats in settings and admin | `backend/src/cli/export-corrections.ts` | backend flow |
| **G24 Monitoring** | `job_metrics` (outcome, decision, timings, versions, VLM tokens/cost/errors) without bill content; `/api/health`; `/api/admin/metrics`; redacted structured logs | backend | `flow.test.ts` (admin) |

## Pipeline stages and what the user sees

`decoding → quality → preprocessing → ocr → classification → layout → extraction → (vlm) → categorisation → validation → confidence → done` — the same stage names are shown in the app and on the How-it-works page.

## Output contract

`ExtractionResult` (`packages/shared/src/schemas.ts`): `isBill`, `classification`, `quality`, `fields` (21 fields, each with value/status/confidence/confidenceKind/review/source/evidence/signals/alternatives/note), `category`, `lineItems`, `validation`, `overallReview`, `meta` (versions, timings, VLM usage, calibration) and `ocrText`.

© 2026 Shaik Gouse Kareem. All rights reserved.
