"""Group-aware, class-stratified train/validation/test split with a fixed seed.

Augmentation must run AFTER this split and only on the training split.
HR assignment images are never part of any split.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import DATASET, MANIFEST_COLUMNS, SplitRatios, group_split, load_yaml, read_csv, save_json, write_csv  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default="training/configs/dataset_config.yaml")
    ap.add_argument("--dataset", default=None)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args(argv)
    cfg = load_yaml(args.config).get("split", {}) if Path(args.config).exists() else {}
    seed = args.seed if args.seed is not None else int(cfg.get("seed", 20261106))
    ratios = SplitRatios(cfg.get("train", 0.7), cfg.get("validation", 0.15), cfg.get("test", 0.15))
    dataset = Path(args.dataset) if args.dataset else DATASET
    manifests = dataset / "manifests"
    rows = [r for r in read_csv(manifests / "dataset_manifest.csv") if "hr_assignment" not in r.get("file_path", "")]
    if not rows:
        print("No images in the manifest yet; nothing to split.")
        return 0
    assignment = group_split(rows, ratios, seed)
    for r in rows:
        r["split"] = assignment[r["document_group_id"] or r["image_id"]]
    write_csv(manifests / "dataset_manifest.csv", rows, MANIFEST_COLUMNS)
    for split in ("train", "validation", "test"):
        write_csv(manifests / f"{split}_manifest.csv", [r for r in rows if r["split"] == split], MANIFEST_COLUMNS)
    # Leakage self-check
    groups_by_split: dict[str, set[str]] = {}
    for r in rows:
        groups_by_split.setdefault(r["document_group_id"] or r["image_id"], set()).add(r["split"])
    leaks = [g for g, s in groups_by_split.items() if len(s) > 1]
    summary = {"seed": seed, "ratios": vars(ratios), "counts": {s: dict(Counter(r["class"] for r in rows if r["split"] == s)) for s in ("train", "validation", "test")}, "leaking_groups": leaks}
    save_json(dataset / "reports" / "split_report.json", summary)
    print(summary)
    return 1 if leaks else 0


if __name__ == "__main__":
    raise SystemExit(main())
