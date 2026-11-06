"""Dataset statistics: counts by class/category/difficulty/source, dimensions, formats,
corrupted files, duplicates, missing annotations, class imbalance, split distribution and
basic image quality (blur, brightness).

Writes dataset/reports/{dataset_statistics.json, class_distribution.csv, image_quality_report.csv, dataset_quality_report.md}.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import DATASET, dhash, hamming, laplacian_variance, open_image, read_csv, save_json, sha256_file, write_csv  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dataset", default=None)
    args = ap.parse_args(argv)
    dataset = Path(args.dataset) if args.dataset else DATASET
    rows = read_csv(dataset / "manifests" / "dataset_manifest.csv")
    reports = dataset / "reports"
    quality_rows, corrupted, dims, formats, shas, dhs = [], [], [], Counter(), Counter(), []
    ann_dir = dataset / "annotations" / "complete_ground_truth"
    missing_ann = 0
    for r in rows:
        p = dataset / r["file_path"]
        if not (ann_dir / f"{r['image_id']}.json").exists():
            missing_ann += 1
        try:
            img = open_image(p)
        except Exception:
            corrupted.append(r["image_id"])
            continue
        g = np.asarray(img.convert("L"), dtype=np.float64)
        lv = laplacian_variance(img)
        dims.append((img.width, img.height))
        formats[p.suffix.lower()] += 1
        shas[sha256_file(p)] += 1
        dhs.append((r["image_id"], dhash(img)))
        quality_rows.append({"image_id": r["image_id"], "width": img.width, "height": img.height, "laplacian_variance": round(lv, 1), "mean_brightness": round(float(g.mean()), 1), "blur_flag": lv < 60, "dark_flag": g.mean() < 75})
    near_dups = sum(1 for i in range(len(dhs)) for j in range(i + 1, len(dhs)) if hamming(dhs[i][1], dhs[j][1]) <= 4)
    by_class = Counter(r["class"] for r in rows)
    imbalance = (max(by_class.values()) / max(1, min(by_class.values()))) if len(by_class) == 2 else None
    stats = {
        "total_images": len(rows),
        "bill_images": by_class.get("bill", 0),
        "non_bill_images": by_class.get("non_bill", 0),
        "by_subclass": dict(Counter(r["subclass"] for r in rows)),
        "by_difficulty": dict(Counter(r.get("difficulty") or "unlabelled" for r in rows)),
        "by_source": dict(Counter(r.get("source") or "unknown" for r in rows)),
        "formats": dict(formats),
        "dimensions": {"min": [min(d[0] for d in dims), min(d[1] for d in dims)] if dims else None, "max": [max(d[0] for d in dims), max(d[1] for d in dims)] if dims else None},
        "corrupted_files": corrupted,
        "exact_duplicate_files": sum(c - 1 for c in shas.values() if c > 1),
        "near_duplicate_pairs": near_dups,
        "missing_annotations": missing_ann,
        "class_imbalance_ratio": round(imbalance, 2) if imbalance else None,
        "split_distribution": {s: dict(Counter(r["class"] for r in rows if r.get("split") == s)) for s in ("train", "validation", "test", "")},
    }
    save_json(reports / "dataset_statistics.json", stats)
    write_csv(reports / "class_distribution.csv", [{"class": k, "count": v} for k, v in by_class.items()] + [{"class": f"subclass:{k}", "count": v} for k, v in stats["by_subclass"].items()], ["class", "count"])
    write_csv(reports / "image_quality_report.csv", quality_rows, ["image_id", "width", "height", "laplacian_variance", "mean_brightness", "blur_flag", "dark_flag"])
    md = ["# Dataset quality report", "", f"Total images: **{stats['total_images']}** (bills {stats['bill_images']}, non-bills {stats['non_bill_images']}).", ""]
    if not rows:
        md.append("The dataset is empty: no images have been registered yet. See `dataset/README.md` for how to add consented or licensed images.")
    else:
        md += [f"- Corrupted files: {len(corrupted)}", f"- Exact duplicates: {stats['exact_duplicate_files']}; near-duplicate pairs: {near_dups}", f"- Missing annotations: {missing_ann}",
               f"- Class imbalance ratio: {stats['class_imbalance_ratio']}", f"- Blurry (Laplacian variance < 60): {sum(q['blur_flag'] for q in quality_rows)}", f"- Dark (mean < 75): {sum(q['dark_flag'] for q in quality_rows)}"]
    (reports / "dataset_quality_report.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
