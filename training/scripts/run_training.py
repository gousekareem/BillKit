"""Run every training task enabled in training/configs/training_config.yaml.

  python training/scripts/run_training.py            # categorisation (enabled) ; classifier only if enabled + data
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import REPO, load_yaml  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default="training/configs/training_config.yaml")
    ap.add_argument("--register", action="store_true")
    args = ap.parse_args(argv)
    tasks = load_yaml(REPO / args.config)["tasks"]
    status = 0
    if tasks["categorisation"]["enabled"]:
        from training.categorisation import train as cat_train

        status |= cat_train.main(["--config", tasks["categorisation"]["config"], *(["--register"] if args.register else [])])
    if tasks["classification"]["enabled"]:
        from training.classification import train as cls_train

        status |= cls_train.main(["--config", tasks["classification"]["config"]])
    else:
        print("classification: disabled (needs a licensed labelled image dataset; see TRAINING_GUIDE.md)")
    for t in ("ocr", "extraction"):
        if not tasks[t]["enabled"]:
            print(f"{t}: not trained — an established engine/approach is used (see training/README.md)")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
