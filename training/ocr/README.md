# OCR evaluation

`text_normalisation.py` applies the same NFKC normalisation, lower-casing, whitespace collapsing and optional punctuation stripping to reference and hypothesis text. `ocr_evaluation.py` computes the character error rate (CER) and word error rate (WER) from Levenshtein distance against transcriptions. Not run yet, because no transcribed real images exist. The OCR engine itself is not trained (see `TRAINING_GUIDE.md` §0).
