# Dataset Lifecycle

**Diagrams:** D11 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

Raw images (personally captured with consent, voluntarily contributed, or from licensed datasets) are redacted, registered in `dataset/manifests/dataset_manifest.csv` with `validate_dataset.py --scan`, annotated with the JSON/CSV templates, and validated (schema, contradictions, exact and near-duplicate detection, leakage warnings). `split_dataset.py` assigns whole **document groups** to train/validation/test (seeded, class-stratified) and fails if any group spans splits. `augment.py` augments **training rows only** and records each source image. Models are trained on train, selected/calibrated on validation and reported once on test, then registered. The **HR 20-image set** in `dataset/hr_assignment/` is excluded from every manifest and is used only for evaluation.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
