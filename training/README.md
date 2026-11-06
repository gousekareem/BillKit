# training/

Offline Python tooling for datasets and models. It is kept separate from inference (`ai/`, TypeScript), which only reads exported artefacts listed in `ai/models/registry.json`.

| Folder | Purpose | Status |
|---|---|---|
| `configs/` | YAML configs (dataset, classification, OCR, training, categorisation) with fixed seeds | — |
| `scripts/` | validate, split, statistics, augment, calibrate, compare, run_training, register_model | Tested (`tests/`) |
| `categorisation/` | Seed data generator, features, train, evaluate | **Trained** on synthetic data |
| `classification/` | Image classifier: loader, preprocessing, train (`--dry-run`), evaluate, predict, ONNX export | Not executed |
| `ocr/` | Text normalisation, CER/WER evaluation | Not executed (no transcriptions) |
| `extraction/` | Annotation loader, per-field evaluation | Not executed (no annotations) |
| `experiments/` | Experiment template and log | Categoriser runs logged |
| `checkpoints/` | Local training checkpoints (git-ignored) | Empty |
| `model_registry/` | Pointer to the registry | — |
| `evaluation/` | Pointer to evaluation outputs | — |
| `tests/` | pytest (10 tests) | Passing |

Full walkthrough: `../TRAINING_GUIDE.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
