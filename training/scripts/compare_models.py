"""Compare registered models / experiment runs from experiments/experiment_log.csv.

  python training/scripts/compare_models.py --task categorisation --metric cv_macro_f1
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import REPO, read_csv  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--task", default=None)
    ap.add_argument("--metric", default=None)
    args = ap.parse_args(argv)
    rows = [r for r in read_csv(REPO / "training/experiments/experiment_log.csv") if (not args.task or r["task"] == args.task) and (not args.metric or r["metric"] == args.metric)]
    if not rows:
        print("No matching experiments recorded.")
        return 0
    rows.sort(key=lambda r: float(r["value"] or 0), reverse=True)
    print(f"{'experiment':<16} {'model':<34} {'metric':<14} value   notes")
    for r in rows:
        print(f"{r['experiment_id']:<16} {r['model_version']:<34} {r['metric']:<14} {float(r['value']):.4f}  {r['notes']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
