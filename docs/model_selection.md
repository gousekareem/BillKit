# Model and engine selection

These decisions were made on 6 November 2026 from current package releases and documentation. No claim is made that any engine is "the most accurate". The choices are justified by fit, licence, privacy, cost and testability in this project.

## OCR

| Option | Fit for BillKit | Licence / cost | Privacy | Decision |
|---|---|---|---|---|
| **Tesseract 5 (LSTM) via tesseract.js 7** | Runs in Node (and potentially the browser) as WASM; word boxes and confidences; English model on npm → reproducible offline installs | Apache-2.0, free | Image stays on our server | **Selected** |
| Google ML Kit text recognition | Strong on-device recognition, but only through Android/iOS SDKs; not callable from a Node server or the web app | Free SDK, Google terms | On device | Rejected for this architecture (no native app) |
| PaddleOCR | Good accuracy on many layouts and multilingual text; requires a Python + Paddle runtime and model downloads | Apache-2.0 | On server | Deferred: a reasonable future second engine behind the same `OcrPage` interface |
| Cloud OCR (e.g. document AI services) | High quality with layout | Per-page fees, account needed | Data leaves the server | Not used; the optional VLM already covers hard cases |

Observed during development: with Tesseract PSM 3 (auto) the right-hand amount column of receipts was sometimes dropped, and a forced `user_defined_dpi=300` made it worse. PSM 4 (single column) fixed both on the synthetic fixtures, so PSM 4 is the default (`OCR_PSM` overrides it).

## Bill / non-bill classification

A trained image classifier needs hundreds of labelled, licensed images per class. Training on the 20 HR images is explicitly ruled out (they are the evaluation set). BillKit therefore ships a **transparent evidence scorer** (`billkit-evidence-v1`) and resolves ambiguous cases with the optional VLM or the user. A MobileNetV3-Small transfer-learning pipeline (small, CPU-friendly, Apache-2.0 torchvision weights, ONNX-exportable for LiteRT/Core ML) is provided in `training/classification/` for when data exists. EfficientNet-B0 and ResNet-18 are drop-in alternatives; selection must be made on measured validation results.

## Structured extraction

OCR + layout + labelled rules give evidence-linked values without training. A vision-language model is an optional cross-checker, not the source of truth. Fine-tuning a layout model (for example LayoutLM-family or Donut) was not justified: suitable commercially licensed training data was not available (CORD is CC BY 4.0 but contains Indonesian receipts; SROIE and FUNSD are research-only — see `docs/dataset/acquisition_guide.md`), and the project size does not warrant it.

## Vision-language model

The Anthropic Messages API is used with a forced tool call whose input schema mirrors the zod schema. The default model ID is configurable (`AI_MODEL`, default `claude-sonnet-5-5`); operators should check the current model list. A cheaper model (Haiku class) can be configured for cost. It is used only when needed (`AI_VLM_MODE=ambiguous_only`).

## Categorisation

Keyword rules are the always-on baseline. On synthetic template data, TF-IDF + logistic regression was compared with multinomial Naive Bayes and with rules under grouped 5-fold cross-validation (macro-F1: LR 0.990, rules 0.976, NB 0.972). These figures overstate real performance because the data is template-generated. LR was exported (JSON, exact inference parity verified against the TypeScript implementation) and registered. It contributes only when its softmax is ≥ 0.5, and it is labelled "uncalibrated" in the reasons. A transformer model is not justified at this scale.

## Confidence

LLM self-reported confidence is recorded but never used as a probability. Calibration uses histogram binning (simple, robust with small n). Temperature scaling is provided for future classifier logits. Both must be fitted on a validation set.

© 2026 Shaik Gouse Kareem. All rights reserved.
