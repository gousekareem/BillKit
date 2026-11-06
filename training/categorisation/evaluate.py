"""Evaluate an exported categoriser JSON on a labelled CSV (text,category) using the same
TF-IDF + softmax maths as the TypeScript inference.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import read_csv  # noqa: E402


def predict(model: dict, text: str) -> dict[str, float]:
    words = re.findall(r"(?u)\b\w\w+\b", text.lower() if model["lowercase"] else text)
    lo, hi = model["ngramRange"]
    counts: Counter = Counter()
    for n in range(lo, hi + 1):
        for i in range(len(words) - n + 1):
            idx = model["vocabulary"].get(" ".join(words[i : i + n]))
            if idx is not None:
                counts[idx] += 1
    vec = {i: c * model["idf"][i] for i, c in counts.items()}
    norm = np.sqrt(sum(v * v for v in vec.values())) or 1.0
    logits = np.array([model["intercept"][k] + sum(model["coef"][k][i] * v / norm for i, v in vec.items()) for k in range(len(model["classes"]))])
    p = np.exp(logits - logits.max())
    p /= p.sum()
    return dict(zip(model["classes"], p.tolist()))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", required=True)
    ap.add_argument("--data", required=True, help="CSV with text,category columns")
    args = ap.parse_args(argv)
    model = json.loads(Path(args.model).read_text())
    rows = read_csv(Path(args.data))
    correct = sum(max(predict(model, r["text"]).items(), key=lambda kv: kv[1])[0] == r["category"] for r in rows)
    print(json.dumps({"model": model["version"], "examples": len(rows), "accuracy": round(correct / max(1, len(rows)), 4)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
