# Confidence System

**Diagrams:** D08 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

Four signals are kept apart in `FieldSignals`: **OCR confidence**, **rule strength**, **model-reported confidence** (recorded, never used as a probability), and **validation** (plus arithmetic corroboration). `heuristicScore()` combines them: `rule × (0.55 + 0.45 × OCR)`, raised by agreement or arithmetic corroboration, lowered by disagreement, capped at 0.6 for inferred/ambiguous values, 0.7 for validation warnings, 0.4 for failures, and 0.45 for model-only values the OCR cannot confirm.

A field shows **High confidence** only if its score ≥ the user's review threshold (default 0.85) and no validation issue applies; otherwise **Needs review**, **Validation warning** or **Missing**. The UI labels scores as "heuristic, not a probability". `training/scripts/calibrate.py` measures ECE, Brier score and reliability on a labelled validation set and can register a histogram-binning table; only then does `applyCalibration()` replace the score and the UI say "calibrated". No calibration table is registered in this delivery because no real labelled data was available.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
