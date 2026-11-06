# BillKit training guide

This guide covers the whole path from data to a deployed model, and records **what was actually trained**. Training logs and metrics below come from real runs; nothing is invented. Where a model was not trained, this guide says so.

## 0. What is trained, and why

| Task | Trained? | Reason |
|---|---|---|
| Expense categorisation | **Yes**: TF-IDF + logistic regression on synthetic seed text | Cheap, transparent, and useful as a second opinion next to the keyword rules. Will be retrained on reviewed real corrections |
| Confidence calibration | Code ready, **not fitted** | Needs a labelled validation set of real bills |
| Bill/non-bill image classifier | Code ready, **not trained** | No licensed, labelled image data; the 20 HR images are evaluation-only |
| OCR | Not trained | An established engine (Tesseract LSTM) is used; fine-tuning needs thousands of transcribed lines |
| Field extraction (layout model / LLM fine-tune) | Not trained | Not justified at this project's size or with the licensed data available |

## 1. Set up

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r training/requirements.txt              # numpy, pillow, scikit-learn, pyyaml, pytest
pip install -r training/requirements-classifier.txt   # + torch, torchvision, onnx (only for the image classifier)
pytest training/tests                                 # 10 tests
```

## 2. Data → splits (strict separation)

```bash
python training/scripts/validate_dataset.py --write-hashes   # manifest/annotation checks, SHA-256 + dHash
python training/scripts/split_dataset.py                     # grouped split
python training/scripts/generate_statistics.py               # dataset/reports/
python training/scripts/augment.py                           # TRAIN split only
```

- Sets: **train / validation / independent test** from `dataset/`, plus the **HR 15 bills** and **HR 5 non-bills**, which are never mixed into any of them. `dataset/hr_assignment` is listed in `excluded_dirs`, and `training/common.py` raises an error if any tool tries to read it.
- **Split method:** grouped random split by `document_group_id` (all photos of one physical bill, or one merchant series, stay together). Ratios 0.70 / 0.15 / 0.15. **Seed 20261106** (`training/configs/dataset_config.yaml`).
- Exact duplicates are errors. Near-duplicates (dHash distance ≤ 4) in different groups are reported so they can be merged into one group.
- Augmentation is applied to the training split only, never to validation or test.
- With small datasets, report confidence intervals. 20 images cannot support claims about "all receipts".

## 3. Categoriser (trained)

```bash
python training/categorisation/generate_seed_data.py     # writes data/seed_examples.csv (synthetic)
python training/categorisation/train.py --register       # CV comparison, export, register
python training/categorisation/evaluate.py               # Python ⇄ TypeScript parity check
# or: python training/scripts/run_training.py --register  (runs every enabled task)
```

| # | Item | Value (actual) |
|---|---|---|
| 1 | Model name | `billkit-tfidf-lr-2026-11-06` |
| 2 | Architecture | TF-IDF (word 1–2-grams, sublinear tf, l2) + multinomial logistic regression (C = 4, max_iter 2000) |
| 3 | Purpose | Suggest an expense category from merchant + item text, as a second signal after the keyword rules |
| 4 | Training dataset | `training/categorisation/data/seed_examples.csv` |
| 5 | Source | **Synthetic**: generated from merchant/item templates by `generate_seed_data.py` (seeded) |
| 6 | Licence | Original to this project |
| 7 | Training examples | 324 (all used for the final fit after CV) |
| 8 | Validation | Grouped 5-fold CV (GroupKFold by `template_id`) |
| 9 | Test examples | None separate. A real test needs real bills, so CV figures are not a test result |
| 10 | Input | Lower-cased text: merchant name + item descriptions + bill keywords |
| 11 | Output | Softmax over 11 classes (Education, Entertainment, Food, Fuel, Groceries, Healthcare, Personal care, Shopping, Transportation, Travel, Utilities) |
| 12 | Preprocessing | Lower-casing, tokenisation by the TF-IDF vectoriser (same in TS) |
| 13 | Augmentation | None |
| 14 | Loss | Multinomial cross-entropy (log loss) with L2 regularisation |
| 15 | Optimiser | scikit-learn lbfgs |
| 16 | Learning rate | n/a (lbfgs) |
| 17 | Batch size | Full batch |
| 18 | Epochs | n/a (lbfgs to convergence, ≤ 2000 iterations) |
| 19 | Hardware | x86_64 CPU, Python 3.13 |
| 20 | Training time | 0.23 s |
| 21 | Metrics (CV macro-F1) | LR **0.990**, keyword rules 0.976, multinomial NB 0.972 (accuracy 0.988 / 0.991 / 0.991). **Optimistic**: template text |
| 22 | Checkpoint | `ai/models/categoriser/billkit-tfidf-lr-2026-11-06.json` (+ `.report.json`) |
| 23 | Version | `billkit-tfidf-lr-2026-11-06`, active in `ai/models/registry.json` |
| 24 | Inference | Pure TypeScript (`ai/src/categorise.ts`); 228 KB JSON; used only if p ≥ 0.5 |
| 25 | Limitations | Synthetic data; no Housing/Other classes; English only; does not learn from corrections automatically |

Experiment log: `training/experiments/experiment_log.csv` (rows `CAT-2026-11-06`).

## 4. Calibration (not fitted yet)

```bash
npm run eval:hr                    # or an evaluation on a VALIDATION set
python training/scripts/calibrate.py --results evaluation/results/<validation_set>/results.json --register
```
This fits histogram binning per field, reports ECE and the Brier score, and activates the table only if every bin has enough examples. **Never calibrate on the set you report as the test result.**

## 5. Bill/non-bill image classifier (not trained)

```bash
python training/classification/train.py --dry-run     # validates config + manifests, no torch needed
python training/classification/train.py               # trains when data exists
python training/classification/evaluate.py            # test split metrics
python training/classification/export_onnx.py         # ONNX for deployment / LiteRT / Core ML conversion
```

| # | Item | Planned configuration (`training/configs/classification_config.yaml`). **Not executed** |
|---|---|---|
| 1–3 | Name / architecture / purpose | `billkit-classifier` / MobileNetV3-Small, ImageNet weights, 2-class head / bill vs non-bill |
| 4–9 | Data | To be collected (see `docs/dataset/acquisition_guide.md`); grouped 70/15/15 split; targets in `dataset_config.yaml` (baseline 500 + 500) |
| 10–11 | Input / output | 224×224 RGB, ImageNet normalisation / softmax(bill, non_bill) |
| 12–13 | Preprocessing / augmentation | Resize + normalise / rotation 8°, perspective 0.08, brightness 0.35, contrast 0.30, blur σ 0.1–1.5, JPEG 45–95, greyscale p = 0.15 (train only) |
| 14–18 | Loss / optimiser / LR / batch / epochs | Cross-entropy (label smoothing 0.05) / AdamW (wd 1e-4) / 3e-4 / 32 / 15 (backbone frozen for 3, early stopping patience 4); seed 20261106 |
| 19–20 | Hardware / time | Not run |
| 21 | Metrics | Accuracy, precision/recall/F1 per class, confusion matrix; reject threshold chosen on validation |
| 22–23 | Checkpoint / version | `training/checkpoints/classifier/` (git-ignored) → registered with `register_model.py --task classifier` |
| 24 | Inference | ONNX; not wired into the Node pipeline yet (needs `onnxruntime-node`) |
| 25 | Limitations | Untrained; must be compared against the evidence scorer before it replaces anything |

## 6. Registry, deployment and rollback

```bash
python training/scripts/register_model.py --task categoriser --file ai/models/categoriser/<file>.json
python training/scripts/register_model.py --task categoriser --rollback      # previous version
python training/scripts/register_model.py --task categoriser --deactivate    # rules only
python training/scripts/compare_models.py --task categorisation --metric cv_macro_f1
```
Restart the server after changing the registry. Versions are recorded in every result. More detail: `docs/technical/13`–`15`.

## 7. Feedback loop (corrections)

User corrections are stored with `consent_for_improvement` and `review_status = unreviewed`. `npm run corrections:export -w backend` exports **consented rows only**. A person reviews them before they become training data. Nothing retrains automatically.

© 2026 Shaik Gouse Kareem. All rights reserved.
