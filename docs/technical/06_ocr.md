# 6. How OCR works in BillKit

**Engine.** Tesseract 5's LSTM recogniser compiled to WebAssembly (tesseract.js 7). The English `traineddata` comes from the npm package `@tesseract.js-data/eng`, so no download happens at run time.

**Steps (`ai/src/ocr.ts`)**

1. A worker pool (`OCR_WORKERS`, default 1) is created lazily and reused, because starting a worker takes a few seconds.
2. The preprocessed page (greyscale, contrast-stretched, small text upscaled) is recognised with **PSM 4 – single column of variable-sized text**. On receipts this keeps "TOTAL" and its right-aligned amount on one line; PSM 3 (auto) often split them or dropped the amount column. `user_defined_dpi` is left unset because forcing 300 made results worse.
3. **Rotation search.** If few "solid" words come back (fewer than 8 words, under 55 % upright-looking words, or fewer "solid" words — confidence > 0.7 with 3+ consecutive letters/digits — than max(6, 35 % of words)), the page is also tried at 90°, 180° and 270°, and the best orientation wins. This handles sideways phone photos whose EXIF data is wrong.
4. Words come back with bounding boxes and 0–1 confidences. `groupWordsIntoRows` rebuilds visual rows from word centres (receipts often have uneven baselines), and every row keeps pointers to its words.
5. **Born-digital PDFs** skip OCR: the PDF's own text layer is converted into the same `OcrPage` structure (`pageFromPdfText`) with confidence 1.

**What OCR confidence means.** It is Tesseract's per-word recognition confidence. It says how sure the recogniser is about the characters, not whether the right line was picked as the total. That is why it is only one of several signals.

**Typical errors and mitigations.** Confusions such as 0/O, 1/l, 5/S and 8/B are handled in amount and date parsing (for example "0ct" → "Oct"). Faint thermal print is handled by contrast stretching and illumination flattening. Very small text is upscaled. Handwriting is not handled well: the result is flagged and the VLM or the user fills the gaps.

**Languages.** Set `OCR_LANGS=eng+hin` (etc.) and `OCR_LANG_PATH`. Untested.

© 2026 Shaik Gouse Kareem. All rights reserved.
