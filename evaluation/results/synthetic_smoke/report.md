# BillKit evaluation report

**Set:** SYNTHETIC smoke test — computer-generated fictional documents (NOT real-world accuracy)
**Generated:** 2026-11-06T13:16:49.813Z · **Images:** 15 (10 bills, 5 non-bills) · **Vision model:** not used (OCR + rules only) · **Ambiguous-date order:** DMY

> **Important:** these images are computer-generated, fictional documents used to check that the pipeline and this harness work end to end. They are far cleaner and more uniform than real phone photos. **These numbers are not an estimate of real-world accuracy.**

> With 15 images, every percentage below has a wide confidence interval and must not be generalised to all receipts.

## Bill / non-bill classification

| Metric | Value |
|---|---|
| Accuracy | 100.0% (95% CI 79.6%–100.0%) |
| Precision (bill) | 100.0% |
| Recall (bill) | 100.0% |
| F1 (bill) | 100.0% |
| Ambiguous decisions | 0 |

**Confusion matrix** (rows = expected, columns = predicted)

| expected \ predicted | bill | non_bill | ambiguous | error |
|---|---|---|---|---|
| bill | 10 | 0 | 0 | 0 |
| non_bill | 0 | 5 | 0 | 0 |

## Field extraction (bills only)

| Field | Correct / evaluated | Accuracy |
|---|---|---|
| Merchant | 10 / 10 | 100.0% (95% CI 72.2%–100.0%) |
| Date | 10 / 10 | 100.0% (95% CI 72.2%–100.0%) |
| Total | 10 / 10 | 100.0% (95% CI 72.2%–100.0%) |
| Category | 10 / 10 | 100.0% (95% CI 72.2%–100.0%) |
| All required (merchant + date + total) | 10 / 10 | 100.0% |

## Review behaviour (merchant, date, total, category)

| | Count |
|---|---|
| Wrong values | 0 — flagged for review: 0, accepted silently (high confidence): 0 |
| Correct values | 40 — flagged anyway: 4 (10.0%) |

## Performance

Latency per image: mean 1467 ms · median 1350 ms · p95 2582 ms · max 3274 ms. Vision-model calls: 0; API failures: 0; estimated cost: n/a.

## Per-image results

| ID | Expected | Predicted | Merchant | Date | Total | Category | Status | ms |
|---|---|---|---|---|---|---|---|---|
| S01 | bill | bill ✓ | ✓ GREENLEAF FRESH MART | ✓ 2026-10-14 | ✓ 1275 | ✓ Groceries | ready_for_approval | 2582 |
| S02 | bill | bill ✓ | ✓ GREENLEAF FRESH MART | ✓ 2026-10-14 | ✓ 1275 | ✓ Groceries | ready_for_approval | 2323 |
| S03 | bill | bill ✓ | ✓ SPICE COURTYARD RESTAURANT | ✓ 2026-10-05 | ✓ 1452 | ✓ Food | needs_review | 1734 |
| S04 | bill | bill ✓ | ✓ SPICE COURTYARD RESTAURANT | ✓ 2026-10-05 | ✓ 1452 | ✓ Food | needs_review | 1418 |
| S05 | bill | bill ✓ | ✓ COASTAL POWER DISTRIBUTION LTD | ✓ 2026-10-02 | ✓ 1596 | ✓ Utilities | ready_for_approval | 747 |
| S06 | bill | bill ✓ | ✓ COASTAL POWER DISTRIBUTION LTD | ✓ 2026-10-02 | ✓ 1596 | ✓ Utilities | ready_for_approval | 3274 |
| S07 | bill | bill ✓ | ✓ NORTHWIND COFFEE CO. | ✓ 2026-10-03 | ✓ 17.08 | ✓ Food | needs_review | 1350 |
| S08 | bill | bill ✓ | ✓ NORTHWIND COFFEE CO. | ✓ 2026-10-03 | ✓ 17.08 | ✓ Food | needs_review | 782 |
| S09 | bill | bill ✓ | ✓ CAREWELL PHARMACY | ✓ 2026-09-28 | ✓ 324 | ✓ Healthcare | ready_for_approval | 989 |
| S10 | bill | bill ✓ | ✓ CAREWELL PHARMACY | ✓ 2026-09-28 | ✓ 324 | ✓ Healthcare | ready_for_approval | 427 |
| S11 | non_bill | non_bill ✓ | –  | –  | –  | –  | rejected_not_bill | 2146 |
| S12 | non_bill | non_bill ✓ | –  | –  | –  | –  | rejected_not_bill | 573 |
| S13 | non_bill | non_bill ✓ | –  | –  | –  | –  | rejected_not_bill | 1746 |
| S14 | non_bill | non_bill ✓ | –  | –  | –  | –  | rejected_not_bill | 566 |
| S15 | non_bill | non_bill ✓ | –  | –  | –  | –  | rejected_not_bill | 1344 |

## Failure analysis

No failures on this set.

Reasons are derived only from processing evidence (OCR text, field status, validation issues, measured image-quality issues).

## Method

- **classificationAccuracy**: (correct bill/non-bill decisions) / images; ambiguous counts as incorrect
- **precision**: TP / (TP + FP), positive class = bill
- **recall**: TP / (TP + FN)
- **f1**: 2PR / (P + R)
- **merchant**: normalised match: case/punctuation/legal-suffix insensitive, containment (≥4 chars) or similarity ≥ 0.85
- **date**: exact ISO date after normalising the ground truth
- **total**: absolute difference ≤ 0.01
- **category**: case-insensitive exact match; abstaining (Unknown) counts as incorrect
- **allRequired**: merchant, date and total all correct for a bill
- **ci95**: Wilson score interval
- **reviewBehaviour**: a value is "flagged" when its review state is anything other than high_confidence

© 2026 Shaik Gouse Kareem. All rights reserved.
