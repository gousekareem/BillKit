"""Load complete ground-truth annotations (dataset/annotations/complete_ground_truth/<image_id>.json)."""
from __future__ import annotations

import json
from pathlib import Path


def load_annotations(directory: Path) -> dict[str, dict]:
    out = {}
    for f in sorted(Path(directory).glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        out[data.get("image_id", f.stem)] = data
    return out
