# BillKit — 20-image evaluation report

> Template. Fill it in only from `evaluation/results/hr_assignment/` produced by `npm run eval:hr`. Do not type numbers by hand that are not in `metrics.json` / `predictions.csv`.

**Date of run:** ____  **Pipeline version:** ____ (from `results.json` meta)  **Cloud AI used:** yes / no
**Images:** 15 bills (own photos, consent: ____), 5 non-bills (types: ____)
**Ground truth prepared by:** ____ (from the paper bills, before running the app)

## 1. Classification

| | Predicted bill | Predicted not bill | Ambiguous |
|---|---|---|---|
| Actual bill (15) | | | |
| Actual not bill (5) | | | |

Accuracy ____ (95 % CI ____), precision ____, recall ____, F1 ____.

## 2. Field accuracy (bills only)

| Field | Correct / n | Accuracy | 95 % CI (Wilson) |
|---|---|---|---|
| Merchant | /15 | | |
| Date | /15 | | |
| Total | /15 | | |
| Category | /15 | | |
| All required (merchant + date + total) | /15 | | |

## 3. Review behaviour
Wrong values: ____, of which flagged for review: ____, accepted silently: ____. Correct values flagged unnecessarily: ____ (____ %).

## 4. Per-image results
Paste or link `predictions.csv` (image id, expected/predicted class, merchant, date, total, category, correctness, uncertainty status, failure reason, processing ms).

## 5. Failure analysis
| Image | Field(s) | Observable cause (from evidence) | Image conditions |
|---|---|---|---|
| | | | |

Most common causes: 1. ____ 2. ____ 3. ____

## 6. Performance
Mean ____ ms, median ____, p95 ____, max ____. VLM calls ____, API failures ____, estimated cost ____.

## 7. Limitations of this evaluation
n = 20 is small: the intervals above are wide. The images come from ____ (one person/phone/city?), so results may not generalise. Ground truth was single-annotated.

## 8. What I would change
____

© 2026 Shaik Gouse Kareem. All rights reserved.
