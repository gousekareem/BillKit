# Model Training

**Diagrams:** D12 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

Training is justified only where data exists. **Categoriser**: `training/categorisation/train.py` compares keyword rules, TF-IDF + logistic regression and TF-IDF + multinomial Naive Bayes with GroupKFold (groups = template id), exports LR to JSON and can register it — executed in this delivery on 324 **synthetic** template examples (grouped-CV macro-F1 ≈ 0.99, which overestimates real performance). **Image classifier**: `training/classification/train.py` (MobileNetV3-Small transfer learning, early stopping, temperature scaling on validation, single test evaluation, ONNX export) — **not executed**, because no licensed labelled images were available; `--dry-run` validates config and manifests. **OCR and extraction** are not trained: an established engine and transparent rules are used, and fine-tuning is not justified at this data scale.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
