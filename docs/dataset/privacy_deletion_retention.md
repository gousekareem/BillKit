# Deletion and retention for dataset images

| Data | Retention | Deletion |
|---|---|---|
| Raw real images | Until the project ends or consent is withdrawn | Delete the file from `dataset/raw/` (and backups) |
| Derived files (`dataset/processed/*`, augmentations) | Same as the source | Find them by `image_id` prefix and delete; re-run `split_dataset.py` |
| Annotations | Same as the source | Delete `annotations/**/<image_id>.*` and the manifest rows |
| Evaluation outputs | Keep (they contain extracted values, no images) | Remove the rows for withdrawn images and re-run the evaluation |
| Trained models | A model trained on withdrawn data should be retrained without it when practical; record this in `training/experiments/experiment_log.csv` | |
| HR assignment images | Until the assignment has been assessed | Delete the images; keep the aggregate report |

Run `python training/scripts/validate_dataset.py` after deletions to check that manifests and files are consistent.

© 2026 Shaik Gouse Kareem. All rights reserved.
