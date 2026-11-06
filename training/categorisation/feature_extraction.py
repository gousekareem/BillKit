"""TF-IDF features for the categorisation baseline (kept identical to ai/src/categorise.ts inference)."""
from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer


def make_vectorizer(cfg: dict) -> TfidfVectorizer:
    f = cfg.get("features", {})
    return TfidfVectorizer(
        analyzer=f.get("analyzer", "word"),
        ngram_range=tuple(f.get("ngram_range", [1, 2])),
        min_df=f.get("min_df", 1),
        sublinear_tf=False,  # the TypeScript inference uses raw term counts x idf with l2 norm
        lowercase=True,
        token_pattern=r"(?u)\b\w\w+\b",
        norm="l2",
    )
