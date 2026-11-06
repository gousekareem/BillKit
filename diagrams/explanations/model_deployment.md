# Model Deployment

**Diagrams:** D13 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

Exported artefacts (categoriser JSON; future classifier ONNX) are registered in `ai/models/registry.json` with version, file, report and sha256 via `training/scripts/register_model.py`. After tests and the evaluation harness pass, restarting the backend loads the active model. Every processing job records pipeline, classifier and model versions in `job_metrics`, and the admin Operations page shows them. `register_model.py --rollback` reactivates the previous version; `--deactivate` returns to rules only. Large weights must not be committed: store them externally and record download location and checksum.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
