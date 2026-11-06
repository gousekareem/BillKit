# Ocr

**Diagrams:** D05 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

**Engine choice.** Tesseract 5 (LSTM) through **tesseract.js 7** was selected over Google ML Kit (on-device only, mobile SDK, not usable from a Node server or browser without native wrappers) and PaddleOCR (stronger on some layouts but requires a Python/Paddle runtime and model downloads, complicating a reproducible Node deployment). Tesseract is Apache-2.0, provides word boxes and confidences, and its English model installs from npm (`@tesseract.js-data/eng`), so OCR runs offline on the server with no per-page fees and no image leaving the deployment.

**Details.** Page segmentation mode 4 (single column) is used because on receipts PSM 3 frequently split a label from its right-aligned amount and, in testing, dropped right-hand columns. A DPI override was removed for the same reason. If fewer than six "solid" words are read, 90°/180°/270° rotations are tried and the best is kept. Words are regrouped into visual rows by vertical overlap so labels and amounts in different Tesseract blocks end up on one row. Reading order is top-to-bottom, left-to-right. Other languages need `OCR_LANGS` and `OCR_LANG_PATH`; handwriting is read poorly.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
