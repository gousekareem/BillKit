# 10. Confidence calculation and its limitations

## Four separate signals (stored per field in `signals`)
1. **OCR confidence**: Tesseract's mean word confidence for the evidence tokens.
2. **Rule score**: how strong the extraction rule was (for example 0.95 for "Grand total").
3. **Model-reported confidence**: what the VLM says about itself. It is recorded, **never used as a probability**.
4. **Validation result**: pass / warn / fail from the deterministic checks.

## Heuristic combination (`heuristicScore` in `ai/src/confidence.ts`)
```
s = rule × (0.55 + 0.45 × ocr)              # rule defaults: 0.5 (0.6 if only the VLM)
agree with VLM        → s = 1 − (1 − s) × 0.4
disagree              → s × 0.6
VLM-only, not in OCR  → min(s, 0.45);  VLM-only, found in OCR → min(s, 0.75)
ambiguous / inferred  → min(s, 0.6)
validation warn/fail  → min(s, 0.7) / min(s, 0.4)
validation pass       → +0.05
arithmetic corroborated (e.g. subtotal + tax = total) → s = 1 − (1 − s) × 0.5
```

## Review states
`missing` (no value) → `validation_warning` (warn/fail) → `needs_review` (ambiguous/inferred, or score < threshold) → `high_confidence` (score ≥ threshold, default **0.85**, configurable from 0.5 to 0.99 in Settings). The UI shows each state with an icon *and* text. With the default approval policy (`always_review`), Save stays disabled until every flagged merchant/date/total/category field has been confirmed (tick) or edited; validation warnings must be acknowledged when saving.

## Calibration
Without calibration the score is a **ranking heuristic** (`confidenceKind: "heuristic"`): higher means "more likely right" but 0.9 does not mean 90 %. `training/scripts/calibrate.py` fits **histogram binning** on a labelled validation set: for each score bin, the observed accuracy. The table is registered in `ai/models/registry.json`; then `applyCalibration` maps scores to empirical accuracy (only bins with ≥ 10 examples are trusted), and `confidenceKind` becomes `calibrated`. The script also reports reliability bins, ECE and the Brier score. Temperature scaling is provided for classifier logits.

## Limitations
- No calibration table is registered yet: there is no labelled real data.
- Calibration fitted on one population (for example Indian restaurant receipts) does not transfer to another.
- OCR confidence can be high on the wrong line, which is why label rules and validation matter more.
- The weights above were chosen by reasoning and synthetic tests, not fitted.

© 2026 Shaik Gouse Kareem. All rights reserved.
