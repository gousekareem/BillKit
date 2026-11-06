# 15. Model deployment guide

1. **Artefacts** live in `ai/models/<task>/<version>.json` with a `.report.json` next to them (data description, metrics, date).
2. **Registry.** `ai/models/registry.json` lists every model and the `active` one per task (`categoriser`, `calibration`, `classifier`). Register with `python training/scripts/register_model.py --task <task> --file <path>`. Roll back with `--rollback` (re-activates the previous version) or `--deactivate` (falls back to the rules).
3. **Loading.** The `ai` package reads the registry once per process (`BILLKIT_MODELS_DIR` overrides the folder). A deployment therefore means: commit or copy the artefact, update the registry, restart the server.
4. **Versioning.** The active versions are written into every `ExtractionResult.meta` and every `job_metrics` row, so each result can be traced to the model that produced it.
5. **Image classifier (future).** `export_onnx.py` exports to ONNX. Running it in Node would need `onnxruntime-node` and a small adapter implementing the classifier interface; for on-device use, convert the ONNX model to LiteRT or Core ML. This is not implemented yet.
6. **Gate.** Do not activate a model unless it beats the active one on the validation set by more than the noise level (compare runs with `compare_models.py`; use confidence intervals) and the HR/test evaluation has not regressed.

© 2026 Shaik Gouse Kareem. All rights reserved.
