# 23. Future research opportunities

1. **Representative data.** A consented, redacted Indian receipt set (about 300 bills, 150 non-bills) to fit thresholds, calibration and the classifier without touching the test set.
2. **Learned layout extraction.** Fine-tune a layout-aware model (LayoutLM-family, or an OCR-free model such as Donut) on that data. Compare it with the rules on the same split, and keep the rules as a fallback and for explanations.
3. **Second OCR engine.** PaddleOCR behind the `OcrPage` interface, with a per-region ensemble by confidence. Measure CER on a transcription set.
4. **Calibration studies.** Is histogram binning enough, or is isotonic regression better? Does calibration transfer across bill types?
5. **Active learning from corrections.** Prioritise consented corrections where the model was confident and wrong, review them, and add them to the training data, without automatic retraining.
6. **On-device processing.** Browser OCR in a Web Worker, an ONNX classifier in the browser (onnxruntime-web) and offline upload queues; measure the latency and battery trade-off.
7. **Multilingual bills.** Hindi, Tamil, Telugu and others: OCR models, script-aware normalisation and mixed-script merchant names.
8. **Fraud and tampering signals** (for expense-claim use cases): error-level analysis, font inconsistencies, duplicate detection across users. Fair use and privacy implications must be considered first.
9. **Smarter VLM routing.** Learn when the cheap path is likely wrong from features (quality, rule scores, validation), to reduce calls further.

© 2026 Shaik Gouse Kareem. All rights reserved.
