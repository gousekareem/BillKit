"""Training-only data augmentation with realistic ranges and source tracking.

Refuses to augment anything outside the training split. Raw images are never overwritten.
Output: dataset/processed/augmented/<image_id>_aug<k>.jpg + dataset/manifests/augmented_manifest.csv

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import io
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import DATASET, open_image, read_csv, write_csv  # noqa: E402

AUG_COLUMNS = ["image_id", "source_image_id", "file_path", "class", "split", "operations", "document_group_id"]


def augment_once(img: Image.Image, rng: random.Random) -> tuple[Image.Image, list[str]]:
    ops: list[str] = []
    out = img
    if rng.random() < 0.7:
        deg = rng.uniform(-6, 6)
        out = out.rotate(deg, expand=True, fillcolor=(245, 245, 245), resample=Image.Resampling.BICUBIC)
        ops.append(f"rotate({deg:.1f})")
    if rng.random() < 0.4:  # small perspective change
        w, h = out.size
        d = 0.04
        coeffs = _perspective_coeffs(w, h, [rng.uniform(-d, d) * w for _ in range(4)], [rng.uniform(-d, d) * h for _ in range(4)])
        out = out.transform((w, h), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC, fillcolor=(245, 245, 245))
        ops.append("perspective(0.04)")
    if rng.random() < 0.7:
        f = rng.uniform(0.65, 1.3)
        out = ImageEnhance.Brightness(out).enhance(f)
        ops.append(f"brightness({f:.2f})")
    if rng.random() < 0.5:
        f = rng.uniform(0.7, 1.3)
        out = ImageEnhance.Contrast(out).enhance(f)
        ops.append(f"contrast({f:.2f})")
    if rng.random() < 0.35:
        s = rng.uniform(0.3, 1.4)
        out = out.filter(ImageFilter.GaussianBlur(s))
        ops.append(f"blur({s:.1f})")
    if rng.random() < 0.3:  # soft shadow gradient
        arr = np.asarray(out, dtype=np.float32)
        h, w = arr.shape[:2]
        grad = np.linspace(rng.uniform(0.6, 0.85), 1.0, w)[None, :, None]
        out = Image.fromarray(np.clip(arr * grad, 0, 255).astype(np.uint8))
        ops.append("shadow")
    if rng.random() < 0.3:
        arr = np.asarray(out, dtype=np.float32)
        noise = np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, rng.uniform(3, 10), arr.shape)
        out = Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))
        ops.append("gaussian_noise")
    if rng.random() < 0.15:
        out = ImageOps.grayscale(out).convert("RGB")
        ops.append("grayscale")
    if rng.random() < 0.25:
        f = rng.uniform(0.5, 0.85)
        out = out.resize((max(64, int(out.width * f)), max(64, int(out.height * f))), Image.Resampling.BILINEAR)
        ops.append(f"downscale({f:.2f})")
    q = rng.randint(45, 95)
    buf = io.BytesIO()
    out.save(buf, "JPEG", quality=q)
    ops.append(f"jpeg({q})")
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB"), ops


def _perspective_coeffs(w: int, h: int, dx: list[float], dy: list[float]) -> list[float]:
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = [(x + dx[i], y + dy[i]) for i, (x, y) in enumerate(src)]
    matrix = []
    for (x, y), (u, v) in zip(dst, src):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(matrix, dtype=np.float64)
    b = np.array(src, dtype=np.float64).reshape(8)
    return list(np.linalg.solve(a, b))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dataset", default=None)
    ap.add_argument("--per-image", type=int, default=3)
    ap.add_argument("--seed", type=int, default=20261106)
    ap.add_argument("--split", default="train")
    args = ap.parse_args(argv)
    if args.split != "train":
        print("Refusing to augment the validation or test split (would leak into evaluation).")
        return 2
    dataset = Path(args.dataset) if args.dataset else DATASET
    rows = [r for r in read_csv(dataset / "manifests" / "dataset_manifest.csv") if r.get("split") == "train"]
    if not rows:
        print("No training rows (run split_dataset.py first, or the dataset is empty).")
        return 0
    rng = random.Random(args.seed)
    out_dir = dataset / "processed" / "augmented"
    out_dir.mkdir(parents=True, exist_ok=True)
    aug_rows = []
    for r in rows:
        img = open_image(dataset / r["file_path"])
        for k in range(args.per_image):
            aug, ops = augment_once(img, rng)
            name = f"{r['image_id']}_aug{k + 1}.jpg"
            aug.save(out_dir / name, "JPEG", quality=92)
            aug_rows.append({"image_id": f"{r['image_id']}_aug{k + 1}", "source_image_id": r["image_id"], "file_path": f"processed/augmented/{name}", "class": r["class"], "split": "train", "operations": ";".join(ops), "document_group_id": r.get("document_group_id") or r["image_id"]})
    write_csv(dataset / "manifests" / "augmented_manifest.csv", aug_rows, AUG_COLUMNS)
    print(f"Wrote {len(aug_rows)} augmented training images from {len(rows)} sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
