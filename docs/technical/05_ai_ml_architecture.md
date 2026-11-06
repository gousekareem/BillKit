# 5. AI/ML architecture

`processDocument(input, options)` in `ai/src/pipeline.ts` runs these steps:

| # | Stage | What happens | Output |
|---|---|---|---|
| 1 | decoding | Magic-byte format detection; HEIC→JPEG; PDF pages rendered (and their text layer kept); EXIF rotation; pixel limits | page rasters + metadata |
| 2 | quality | Blur, exposure, glare, lighting, resolution, skew, border contact | `QualityReport` (score 0–100, issues, tips) |
| 3 | preprocessing | Boundary → perspective → deskew → illumination → contrast/sharpen | corrected pages (original kept) |
| 4 | ocr | Tesseract LSTM, PSM 4, rotation search when the text is poor | words/lines with boxes and confidences |
| 5 | classification | Evidence scorer over text and image traits | bill / not_bill / ambiguous + reasons |
| 6 | layout | Rows, regions, table header, key-values, money tokens | `LayoutAnalysis` |
| 7 | extraction | Label-based rules for 21 fields, each with evidence | raw fields + alternatives |
| 8 | vlm (optional) | Only if allowed and needed; one call does classification + extraction | schema-validated JSON |
| 9 | merge | Agreement/disagreement/single-source logic | merged fields |
| 10 | categorisation | Rules + TF-IDF LR + VLM hint; abstains | category, subcategory, reasons |
| 11 | validation | Arithmetic interpretations, plausibility, dates, currency | report + per-field status |
| 12 | confidence | Heuristic score (or calibrated), review state per field | final `ExtractionResult` |

**Design principles**

1. *Evidence before inference.* A value without supporting text is either missing or marked as inferred.
2. *Cheap path first.* OCR + rules handle most bills; the VLM is only called on uncertainty (`AI_VLM_MODE=ambiguous_only`).
3. *Separate signals.* OCR confidence, rule strength, model self-report and validation are stored separately (`signals`), and combined only for ranking.
4. *Versioned.* Pipeline, classifier, extractor, categoriser and prompt versions are written into every result and every `job_metrics` row.

Diagrams: D02 (AI/ML architecture), D03 (processing flow), D04–D10 (classification, OCR, layout, extraction, confidence, validation, human in the loop).

© 2026 Shaik Gouse Kareem. All rights reserved.
