# Ai Ml Architecture

**Diagrams:** D02 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

The pipeline (`ai/src/pipeline.ts`) is the single entry point used by both the backend and the evaluation harness, so evaluation measures exactly what users get.

1. **Decode (G1)** – format from magic bytes, EXIF orientation, HEIC→JPEG (`heic-convert`), PDF pages via `pdfjs-dist` with the text layer kept.
2. **Quality (G2)** – measurable metrics; warnings never block processing.
3. **Preprocess (G3)** – document quad, homography, deskew, shadow flattening, contrast.
4. **OCR (G5)** – Tesseract LSTM via tesseract.js, PSM 4, rotation search; PDFs with text skip OCR.
5. **Layout (G6) + Classification (G4)** – rows/regions, then the evidence classifier.
6. **Extraction (G7)** – labelled rules with evidence.
7. **VLM (G11/G12)** – optional, conditional, schema-validated, merged with evidence checks.
8. **Categorise (G8), Validate (G10), Confidence (G9)** – then the review-ready result (`billkit.extraction/1.0`).

Nothing is trained on the fly. The only trained artefact in use is the TF-IDF categoriser loaded from `ai/models/registry.json`.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
