"""Register (or roll back to) a model version in ai/models/registry.json.

  python training/scripts/register_model.py --task categoriser --file categoriser/<version>.json
  python training/scripts/register_model.py --task categoriser --rollback        # activate previous entry
  python training/scripts/register_model.py --task categoriser --deactivate      # rules only
The backend reads the registry at start-up; restart it after changing the active model.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import REPO, save_json  # noqa: E402

REG = REPO / "ai/models/registry.json"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--task", required=True, choices=["categoriser", "calibration", "classifier"])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--file")
    g.add_argument("--rollback", action="store_true")
    g.add_argument("--deactivate", action="store_true")
    args = ap.parse_args(argv)
    reg = json.loads(REG.read_text()) if REG.exists() else {"format": "billkit-model-registry/1", "active": {}, "models": []}
    entries = [m for m in reg["models"] if m["task"] == args.task]
    if args.deactivate:
        reg["active"].pop(args.task, None)
    elif args.rollback:
        current = reg["active"].get(args.task)
        older = [m for m in entries if m["file"] != current]
        if not older:
            print("No earlier version to roll back to.")
            return 1
        reg["active"][args.task] = older[-1]["file"]
    else:
        path = REPO / "ai/models" / args.file
        if not path.exists():
            print(f"{path} not found")
            return 1
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if not any(m["file"] == args.file for m in entries):
            reg["models"].append({"task": args.task, "version": path.stem, "file": args.file, "sha256": digest, "created": dt.date.today().isoformat()})
        reg["active"][args.task] = args.file
    save_json(REG, reg)
    print(json.dumps(reg["active"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
