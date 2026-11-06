"""Transfer-learning trainer for the bill/non-bill image classifier (MobileNetV3-Small).

Status in this delivery: NOT EXECUTED — no licensed, labelled image dataset was available and
the 20 HR evaluation images must never be used for training. Use --dry-run to validate the
configuration and manifests without torch.

  python training/classification/train.py --config training/configs/classification_config.yaml --dry-run
  python training/classification/train.py --config training/configs/classification_config.yaml

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.classification.dataset_loader import ManifestDataset, load_split  # noqa: E402
from training.common import REPO, load_yaml, save_json  # noqa: E402

MIN_PER_CLASS = 50


def check_data() -> dict:
    counts = {}
    for split in ("train", "validation", "test"):
        items = load_split(split)
        counts[split] = {"bill": sum(1 for _, y in items if y == 0), "non_bill": sum(1 for _, y in items if y == 1)}
    return counts


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default="training/configs/classification_config.yaml")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    cfg = load_yaml(REPO / args.config)
    counts = check_data()
    ok = all(counts["train"][c] >= MIN_PER_CLASS for c in ("bill", "non_bill")) and all(counts[s][c] > 0 for s in ("validation", "test") for c in ("bill", "non_bill"))
    print(json.dumps({"config": args.config, "architecture": cfg["model"]["architecture"], "data": counts, "ready": ok}, indent=2))
    if args.dry_run:
        return 0
    if not ok:
        print(f"Not enough labelled data: need ≥ {MIN_PER_CLASS} training images per class and non-empty validation/test splits. Training was not run.")
        return 2
    import torch
    from torch import nn
    from torch.utils.data import DataLoader
    from torchvision import models

    from training.classification.preprocessing import build_transforms

    torch.manual_seed(cfg["train"]["seed"])
    tr = ManifestDataset(load_split("train", include_augmented=True), build_transforms(cfg, True))
    va = ManifestDataset(load_split("validation"), build_transforms(cfg, False))
    dl_tr = DataLoader(tr, batch_size=cfg["train"]["batch_size"], shuffle=True, num_workers=2)
    dl_va = DataLoader(va, batch_size=cfg["train"]["batch_size"], num_workers=2)
    model = models.mobilenet_v3_small(weights=getattr(models.MobileNet_V3_Small_Weights, cfg["model"]["pretrained_weights"]))
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, cfg["model"]["num_classes"])
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=cfg["train"]["label_smoothing"])
    opt = torch.optim.AdamW(model.parameters(), lr=cfg["train"]["learning_rate"], weight_decay=cfg["train"]["weight_decay"])
    out = REPO / cfg["output"]["checkpoint_dir"]
    out.mkdir(parents=True, exist_ok=True)
    best, patience, log = -1.0, 0, []
    t0 = time.time()
    for epoch in range(cfg["train"]["epochs"]):
        freeze = epoch < cfg["train"]["freeze_backbone_epochs"]
        for p in model.features.parameters():
            p.requires_grad = not freeze
        model.train()
        total = 0.0
        for x, y in dl_tr:
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            opt.step()
            total += loss.item() * len(y)
        model.eval()
        correct = n = 0
        with torch.no_grad():
            for x, y in dl_va:
                pred = model(x.to(device)).argmax(1).cpu()
                correct += (pred == y).sum().item()
                n += len(y)
        acc = correct / max(1, n)
        log.append({"epoch": epoch + 1, "train_loss": total / len(tr), "val_accuracy": acc})
        print(log[-1])
        if acc > best:
            best, patience = acc, 0
            torch.save({"state_dict": model.state_dict(), "config": cfg, "epoch": epoch + 1, "val_accuracy": acc}, out / "best.pt")
        else:
            patience += 1
            if patience >= cfg["train"]["early_stopping_patience"]:
                break
    save_json(out / "training_log.json", {"log": log, "best_val_accuracy": best, "device": device, "seconds": round(time.time() - t0, 1), "data": counts})
    print(f"Best validation accuracy {best:.3f}. Evaluate on the independent test split with evaluate.py before registering.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
