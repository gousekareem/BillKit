# 12. Dataset annotation guide

The full guide is in [`docs/dataset/annotation_guide.md`](../dataset/annotation_guide.md). Summary:

- **One JSON per image** (`dataset/annotations/complete_ground_truth/<image_id>.json`) with `document_class`, `is_bill`, `annotation_status` (draft → reviewed → verified), `fields`, optional `boxes` and `line_items`, `not_visible`, `conditions` and `difficulty`.
- **Annotate what is printed.** The total is the final payable amount. ISO dates, ISO currency codes and `null` for fields that are not visible. Never copy BillKit's output into ground truth.
- **Grouping.** `document_group_id` ties together photos of the same physical bill, so the train/validation/test split never separates them.
- **Validation.** `training/scripts/validate_dataset.py` checks required keys, ISO dates, numeric amounts, class agreement with the manifest, arithmetic plausibility (warning), non-bills without bill fields, exact duplicates (error) and near-duplicates across groups (warning).
- **Privacy.** Consent and redaction come first: `docs/dataset/privacy_consent.md`, `redaction_guide.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
