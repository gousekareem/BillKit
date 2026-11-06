"""Classify one image with a trained checkpoint: python training/classification/predict.py --checkpoint best.pt image.jpg"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("image")
    args = ap.parse_args(argv)
    import torch
    from torch import nn
    from torchvision import models

    from training.classification.preprocessing import build_transforms
    from training.common import open_image

    ck = torch.load(args.checkpoint, map_location="cpu")
    cfg = ck["config"]
    model = models.mobilenet_v3_small()
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, cfg["model"]["num_classes"])
    model.load_state_dict(ck["state_dict"])
    model.eval()
    x = build_transforms(cfg, False)(open_image(Path(args.image))).unsqueeze(0)
    with torch.no_grad():
        p = torch.softmax(model(x), 1)[0].tolist()
    print({name: round(v, 4) for name, v in zip(cfg["model"]["class_names"], p)}, "(uncalibrated softmax unless a temperature is applied)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
