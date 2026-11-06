"""Export a trained checkpoint to ONNX for server-side inference (onnxruntime) or conversion to
LiteRT/Core ML for on-device use. python training/classification/export_onnx.py --checkpoint best.pt"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)
    import torch
    from torch import nn
    from torchvision import models

    ck = torch.load(args.checkpoint, map_location="cpu")
    cfg = ck["config"]
    model = models.mobilenet_v3_small()
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, cfg["model"]["num_classes"])
    model.load_state_dict(ck["state_dict"])
    model.eval()
    out = Path(args.out or cfg["output"]["onnx_path"])
    size = cfg["input"]["size"]
    torch.onnx.export(model, torch.zeros(1, 3, size, size), out, input_names=["image"], output_names=["logits"], dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17)
    print(f"Exported {out}. Record its sha256 and register it with training/scripts/register_model.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
