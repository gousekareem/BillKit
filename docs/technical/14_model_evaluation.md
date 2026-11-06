# 14. Model evaluation guide

- **System evaluation** (what users get): `evaluation/scripts/run-evaluation.ts`, run with `npm run eval:hr` or `npm run eval:smoke`. Methodology, matching rules, metrics and leakage rules are in [`docs/evaluation_methodology.md`](../evaluation_methodology.md).
- **Component evaluation**:
  - OCR: `training/ocr/ocr_evaluation.py` (character and word error rate against transcriptions, after `text_normalisation.py`).
  - Extraction: `training/extraction/extraction_evaluation.py` (per-field accuracy from annotations vs predictions).
  - Classifier: `training/classification/evaluate.py` (accuracy, precision/recall/F1, confusion matrix).
  - Categoriser: `training/categorisation/evaluate.py`.
  - Calibration: `training/scripts/calibrate.py` (reliability bins, ECE, Brier).
  - Comparison: `training/scripts/compare_models.py` lists recorded experiments for a task and metric from `training/experiments/experiment_log.csv` side by side.
- **Reporting rules.** Always state n, the set's provenance (real/synthetic), confidence intervals and failure reasons. Never tune on the test set. Re-run the full HR evaluation after any rule change, and compare it with the previous `metrics.json`.

Current measured results: synthetic smoke set only (15/15 correct classification and fields). **Not** a real-world estimate. HR set: pending.

© 2026 Shaik Gouse Kareem. All rights reserved.
