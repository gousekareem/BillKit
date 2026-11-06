"""Text normalisation used before computing OCR error rates."""
from __future__ import annotations

import re
import unicodedata


def normalise(text: str, lowercase: bool = True, collapse_whitespace: bool = True, strip_punctuation: bool = False) -> str:
    t = unicodedata.normalize("NFKC", text)
    if lowercase:
        t = t.lower()
    if strip_punctuation:
        t = re.sub(r"[^\w\s.,]", "", t)
    if collapse_whitespace:
        t = re.sub(r"\s+", " ", t).strip()
    return t
