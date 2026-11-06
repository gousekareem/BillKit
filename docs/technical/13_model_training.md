# 13. Model training guide

See [`TRAINING_GUIDE.md`](../../TRAINING_GUIDE.md) for the commands. What exists:

| Model | Status | Data | Code |
|---|---|---|---|
| Categoriser: TF-IDF (word 1–2 grams) + logistic regression | **Trained and registered** | 324 *synthetic* template examples | `training/categorisation/` |
| Calibration table (histogram binning) | Code ready; not fitted | Needs a labelled validation set | `training/scripts/calibrate.py` |
| Bill/non-bill image classifier (MobileNetV3-Small transfer learning) | Code ready (`--dry-run` checks the config and data); **not trained** | Needs licensed/consented images | `training/classification/` |

## Categoriser: what was done
1. `generate_seed_data.py` creates synthetic merchant + item text per category (seeded, reproducible).
2. `train.py` runs grouped 5-fold cross-validation (groups = merchant template) comparing keyword rules, multinomial Naive Bayes and logistic regression. Macro-F1: LR 0.990, rules 0.976, NB 0.972.
3. The winning model is refitted on all data and exported to JSON (vocabulary, idf, coefficients). `evaluate.py` checks that the Python and TypeScript implementations give **identical** predictions.
4. `register_model.py --task categoriser --file …` updates `ai/models/registry.json` and keeps the previous entry for `--rollback`.

These scores come from template-generated text and **overstate** real performance. In production the model contributes only when its softmax is ≥ 0.5, after the rules.

## Training vs inference separation
Training is Python (`training/`), offline and reproducible from YAML configs with fixed seeds. Inference is TypeScript (`ai/`) and reads only exported artefacts listed in the registry. No training code runs in the server, and no user correction retrains anything automatically.

© 2026 Shaik Gouse Kareem. All rights reserved.
