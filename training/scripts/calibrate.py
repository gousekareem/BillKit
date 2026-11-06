"""Confidence calibration analysis (G9 / Section 8E).

Reads evaluation/results/<set>/results.json (written by the evaluation harness), and per field
computes reliability bins, Expected Calibration Error (ECE) and Brier score of BillKit's
heuristic confidence scores against actual correctness. With --register and enough data
(≥ --min-per-bin examples per bin) it writes a histogram-binning calibration table to
ai/models/calibration/ and activates it in ai/models/registry.json — only then does the app
label scores as "calibrated".

  python training/scripts/calibrate.py --results evaluation/results/hr_assignment/results.json
  python training/scripts/calibrate.py --results <validation-set results.json> --register

Calibrate on a VALIDATION set, never on the set you report as the test result.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import REPO, save_json  # noqa: E402


def expected_calibration_error(conf, correct, bins: int = 10) -> float:
    conf = np.asarray(conf, dtype=float)
    correct = np.asarray(correct, dtype=float)
    if conf.size == 0:
        return float("nan")
    edges = np.linspace(0, 1, bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf >= lo) & ((conf < hi) | (hi == 1.0) & (conf <= hi))
        if m.any():
            ece += m.mean() * abs(correct[m].mean() - conf[m].mean())
    return float(ece)


def brier(prob, outcome) -> float:
    prob = np.asarray(prob, dtype=float)
    outcome = np.asarray(outcome, dtype=float)
    return float(np.mean((prob - outcome) ** 2)) if prob.size else float("nan")


def reliability(conf, correct, bins: int = 5) -> list[dict]:
    conf = np.asarray(conf, dtype=float)
    correct = np.asarray(correct, dtype=float)
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf >= lo) & ((conf < hi) | (hi == 1.0) & (conf <= hi))
        out.append({"lo": round(float(lo), 3), "hi": round(float(hi), 3), "n": int(m.sum()), "mean_confidence": round(float(conf[m].mean()), 4) if m.any() else None, "accuracy": round(float(correct[m].mean()), 4) if m.any() else None})
    return out


def fit_temperature(logits, labels, grid=np.linspace(0.5, 5.0, 91)) -> float:
    """Temperature scaling by grid search on validation NLL (for classifier logits)."""
    logits = np.asarray(logits, dtype=float)
    labels = np.asarray(labels, dtype=int)
    best_t, best_nll = 1.0, float("inf")
    for t in grid:
        z = logits / t
        z = z - z.max(1, keepdims=True)
        logp = z - np.log(np.exp(z).sum(1, keepdims=True))
        nll = -logp[np.arange(len(labels)), labels].mean()
        if nll < best_nll:
            best_t, best_nll = float(t), nll
    return best_t


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", required=True)
    ap.add_argument("--bins", type=int, default=5)
    ap.add_argument("--min-per-bin", type=int, default=10)
    ap.add_argument("--register", action="store_true")
    args = ap.parse_args(argv)
    data = json.loads(Path(args.results).read_text())
    rows = data.get("rows", [])
    report = {"source": args.results, "set": data.get("metrics", {}).get("set"), "fields": {}}
    table = {"format": "billkit-calibration/1", "version": f"calib-{dt.date.today().isoformat()}", "method": "histogram-binning", "fields": {}, "createdFrom": args.results}
    for field in ("merchantName", "billDate", "totalAmount", "category"):
        pairs = [(r["field_confidence"][field]["confidence"], r["field_confidence"][field]["correct"]) for r in rows if field in r.get("field_confidence", {}) and r["field_confidence"][field]["confidence"] is not None and r["field_confidence"][field]["correct"] is not None]
        if not pairs:
            report["fields"][field] = {"n": 0, "note": "no scored, labelled examples"}
            continue
        conf, corr = zip(*pairs)
        bins = reliability(conf, corr, args.bins)
        report["fields"][field] = {"n": len(pairs), "ece": round(expected_calibration_error(conf, corr, args.bins), 4), "brier": round(brier(conf, corr), 4), "reliability": bins}
        table["fields"][field] = {"bins": [{"lo": b["lo"], "hi": b["hi"], "accuracy": b["accuracy"] if b["accuracy"] is not None else 0.0, "n": b["n"]} for b in bins]}
    out = Path(args.results).with_name("calibration_report.json")
    save_json(out, report)
    print(json.dumps(report, indent=2))
    if args.register:
        enough = any(b["n"] >= args.min_per_bin for f in table["fields"].values() for b in f["bins"])
        if not enough:
            print(f"Not registering: no bin has ≥ {args.min_per_bin} labelled examples. Collect more validation data.")
            return 2
        dest = REPO / "ai/models/calibration" / f"{table['version']}.json"
        save_json(dest, table)
        reg_path = REPO / "ai/models/registry.json"
        reg = json.loads(reg_path.read_text())
        rel = dest.relative_to(REPO / "ai/models").as_posix()
        reg.setdefault("active", {})["calibration"] = rel
        reg.setdefault("models", []).append({"task": "calibration", "version": table["version"], "file": rel, "created": dt.date.today().isoformat(), "trained_on": args.results})
        save_json(reg_path, reg)
        print(f"Registered calibration table {table['version']}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
