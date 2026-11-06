# Model registry

The live registry is `ai/models/registry.json`, next to the artefacts that inference loads, so that one source of truth exists. It lists every registered model (task, version, file, report, creation date, training data) and the `active` version per task. Manage it with `training/scripts/register_model.py` (`--file`, `--rollback`, `--deactivate`).
