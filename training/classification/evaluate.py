"""Evaluate a classifier checkpoint on the independent TEST split: accuracy, precision,
recall, F1, confusion matrix, Brier score, ECE, and an optional temperature fitted on the
VALIDATION split (never on test).

  python training/classification/evaluate.py --checkpoint training/checkpoints/classifier/best.pt

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import save_json  # noqa: E402
from training.scripts.calibrate import brier, expected_calibration_error, fit_temperature  # noqa: E402


def logits_for(model, ds, device):
    import torch
    from torch.utils.data import DataLoader

    out, ys = [], []
    with torch.no_grad():
        for x, y in DataLoader(ds, batch_size=64):
            out.append(model(x.to(device)).cpu().numpy())
            ys.append(y.numpy())
    return np.concatenate(out), np.concatenate(ys)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--checkpoint", required=True)
    args = ap.parse_args(argv)
    import torch
    from torch import nn
    from torchvision import models

    from training.classification.dataset_loader import ManifestDataset, load_split
    from training.classification.preprocessing import build_transforms

    ck = torch.load(args.checkpoint, map_location="cpu")
    cfg = ck["config"]
    model = models.mobilenet_v3_small()
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, cfg["model"]["num_classes"])
    model.load_state_dict(ck["state_dict"])
    model.eval()
    tf = build_transforms(cfg, False)
    val_logits, val_y = logits_for(model, ManifestDataset(load_split("validation"), tf), "cpu")
    test_logits, test_y = logits_for(model, ManifestDataset(load_split("test"), tf), "cpu")
    T = fit_temperature(val_logits, val_y)

    def softmax(z):
        e = np.exp(z - z.max(1, keepdims=True))
        return e / e.sum(1, keepdims=True)

    p = softmax(test_logits / T)
    pred = p.argmax(1)
    tp = int(((pred == 0) & (test_y == 0)).sum())
    fp = int(((pred == 0) & (test_y == 1)).sum())
    fn = int(((pred == 1) & (test_y == 0)).sum())
    tn = int(((pred == 1) & (test_y == 1)).sum())
    prec = tp / max(1, tp + fp)
    rec = tp / max(1, tp + fn)
    conf = p.max(1)
    result = {
        "test_examples": int(len(test_y)), "accuracy": float((pred == test_y).mean()), "precision_bill": prec, "recall_bill": rec,
        "f1_bill": 2 * prec * rec / max(1e-9, prec + rec), "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn}, "temperature": T,
        "ece": expected_calibration_error(conf, pred == test_y), "brier": brier(p[:, 0], (test_y == 0).astype(float)),
    }
    save_json(Path(args.checkpoint).with_name("test_evaluation.json"), result)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
