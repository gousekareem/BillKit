"""Shared helpers for BillKit dataset and training scripts.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import csv
import hashlib
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent
DATASET = REPO / "dataset"
MANIFEST_COLUMNS = [
    "image_id", "file_path", "class", "subclass", "document_group_id", "source", "licence", "consent",
    "split", "sha256", "dhash", "width", "height", "format", "difficulty", "conditions", "annotation_status",
]
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff", ".bmp"}
CLASSES = ("bill", "non_bill")


def load_yaml(path: Path | str) -> dict:
    import yaml

    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def read_csv(path: Path) -> list[dict[str, str]]:
    assert_not_hr_assignment(path)
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        return [row for row in csv.DictReader(fh) if row and not (row.get(next(iter(row)), "") or "").startswith("#")]


def write_csv(path: Path, rows: Iterable[dict], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({c: row.get(c, "") for c in columns})


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


HR_ASSIGNMENT_DIR = DATASET / "hr_assignment"


def assert_not_hr_assignment(path: Path | str) -> None:
    """The HR assignment images are evaluation-only: refuse to use them for training or tuning."""
    p = Path(path).resolve()
    if p == HR_ASSIGNMENT_DIR.resolve() or HR_ASSIGNMENT_DIR.resolve() in p.parents:
        raise ValueError(f"{p} is in dataset/hr_assignment, which is evaluation-only and must not be used by training tooling")


def open_image(path: Path) -> Image.Image:
    assert_not_hr_assignment(path)
    img = Image.open(path)
    img.load()
    return ImageOps.exif_transpose(img).convert("RGB")


def dhash(img: Image.Image) -> str:
    """64-bit difference hash, identical in spirit to ai/src/duplicates.ts."""
    g = np.asarray(img.convert("L").resize((9, 8), Image.Resampling.BILINEAR), dtype=np.int16)
    bits = (g[:, :-1] > g[:, 1:]).flatten()
    value = 0
    for b in bits:
        value = (value << 1) | int(b)
    return f"{value:016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def laplacian_variance(img: Image.Image) -> float:
    g = np.asarray(img.convert("L").resize((min(1000, img.width), int(img.height * min(1000, img.width) / img.width))), dtype=np.float64)
    if g.shape[0] < 3 or g.shape[1] < 3:
        return 0.0
    lap = 4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())


@dataclass
class SplitRatios:
    train: float = 0.7
    validation: float = 0.15
    test: float = 0.15


def group_split(rows: list[dict], ratios: SplitRatios, seed: int) -> dict[str, str]:
    """Assign each document group to one split, stratified by class.

    All photos of the same physical document (same document_group_id) land in the
    same split, preventing leakage between training and evaluation.
    """
    rng = random.Random(seed)
    assignment: dict[str, str] = {}
    for cls in sorted({r["class"] for r in rows}):
        groups = sorted({r["document_group_id"] or r["image_id"] for r in rows if r["class"] == cls})
        rng.shuffle(groups)
        n = len(groups)
        n_test = max(1, round(n * ratios.test)) if n >= 3 else 0
        n_val = max(1, round(n * ratios.validation)) if n >= 3 else 0
        for i, g in enumerate(groups):
            assignment[g] = "test" if i < n_test else "validation" if i < n_test + n_val else "train"
    return assignment


def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
