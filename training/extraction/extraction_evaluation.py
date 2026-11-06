"""Field-level extraction accuracy (exact and normalised match) from evaluation predictions.

Reads predictions.csv produced by evaluation/scripts/run-evaluation.ts and reports per-field
exact-match and normalised-match accuracy. (Normalised rules mirror packages/shared/src/normalise.ts.)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import read_csv  # noqa: E402

SUFFIX = re.compile(r"\b(private limited|pvt\.? ltd\.?|pvt|ltd\.?|limited|llp|inc\.?|co\.?|the)\b")


def norm_merchant(s: str) -> str:
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower().replace("&", " and "))
    return re.sub(r"\s+", " ", SUFFIX.sub(" ", s)).strip()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--predictions", required=True)
    args = ap.parse_args(argv)
    rows = [r for r in read_csv(Path(args.predictions)) if r["expected_class"] == "bill"]
    report = {}
    for field, exp, got in (("merchant", "expected_merchant", "extracted_merchant"), ("date", "expected_date", "extracted_date"), ("total", "expected_total", "extracted_total"), ("category", "expected_category", "predicted_category")):
        labelled = [r for r in rows if r[exp]]
        exact = sum(r[exp] == r[got] for r in labelled)
        if field == "merchant":
            normed = sum(norm_merchant(r[exp]) == norm_merchant(r[got]) for r in labelled)
        elif field == "total":
            normed = sum(r[got] != "" and abs(float(r[exp]) - float(r[got])) <= 0.01 for r in labelled)
        else:
            normed = sum(r[exp].lower() == r[got].lower() for r in labelled)
        report[field] = {"labelled": len(labelled), "exact_match": exact, "normalised_match": normed}
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
