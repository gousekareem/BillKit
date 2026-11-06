# BillKit dataset

**This folder contains structure, manifests (header only) and templates, no images.** No real bills and no third-party datasets are included.

| Path | What goes there |
|---|---|
| `raw/bills/0NN_<condition_or_type>/` | Original bill photos (git-ignored) |
| `raw/non_bills/0NN_<type>/` | Original non-bill images (git-ignored) |
| `processed/{resized,cropped,corrected,enhanced,augmented,rejected}/` | Derived images |
| `splits/{train,validation,test}/` | Output of `split_dataset.py` |
| `annotations/complete_ground_truth/<image_id>.json` | One annotation per image (see templates) |
| `annotations/{classification,merchant,date,total,category,currency,line_items,bounding_boxes,layout}/` | Optional per-task exports |
| `manifests/` | `dataset_manifest.csv` (one row per image: id, path, class, group, source, licence, consent, split, hashes, size, difficulty, conditions, annotation status) and per-split manifests |
| `reports/` | Statistics and validation reports |
| `templates/` | Annotation, line-item, bounding-box and consent-record templates |
| `hr_assignment/` | The 20 evaluation images (15 bills + 5 non-bills) and `ground_truth.csv`. **Evaluation only**: training tooling refuses to read it |
| `ground_truth_template.csv` | Column reference for evaluation ground truth |

Guides: `docs/dataset/acquisition_guide.md`, `annotation_guide.md`, `redaction_guide.md`, `privacy_*.md`, `pii_handling.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
