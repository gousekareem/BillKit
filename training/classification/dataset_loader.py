"""Manifest-driven dataset for the bill/non-bill classifier. Training may include
augmented copies of TRAINING images only (augmented_manifest.csv)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import DATASET, open_image, read_csv  # noqa: E402

CLASS_TO_IDX = {"bill": 0, "non_bill": 1}


def load_split(split: str, dataset: Path = DATASET, include_augmented: bool = False) -> list[tuple[Path, int]]:
    rows = read_csv(dataset / "manifests" / f"{split}_manifest.csv")
    items = [(dataset / r["file_path"], CLASS_TO_IDX[r["class"]]) for r in rows]
    if include_augmented and split == "train":
        items += [(dataset / r["file_path"], CLASS_TO_IDX[r["class"]]) for r in read_csv(dataset / "manifests" / "augmented_manifest.csv") if r.get("split") == "train"]
    return items


class ManifestDataset:  # torch.utils.data.Dataset protocol (no torch import needed here)
    def __init__(self, items: list[tuple[Path, int]], transform=None):
        self.items = items
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path, label = self.items[i]
        img = open_image(path)
        return (self.transform(img) if self.transform else img), label
