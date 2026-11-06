"""Validate the BillKit dataset: manifest, files, annotations, duplicates and leakage.

Usage:
  python training/scripts/validate_dataset.py --scan       # (re)build the manifest from dataset/raw/
  python training/scripts/validate_dataset.py              # validate manifest + annotations
Exit code 1 if errors are found.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import (  # noqa: E402
    CLASSES, DATASET, IMAGE_EXTS, MANIFEST_COLUMNS, dhash, hamming, load_yaml, open_image, read_csv, sha256_file, write_csv,
)

REQUIRED_ANNOTATION_FIELDS = {"image_id", "document_class", "annotation_status"}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def scan(dataset: Path, manifest_path: Path) -> list[dict]:
    """Add any image under raw/ that is not yet in the manifest. Existing rows are preserved."""
    existing = {r["file_path"]: r for r in read_csv(manifest_path)}
    rows = list(existing.values())
    for cls_dir, cls in (("bills", "bill"), ("non_bills", "non_bill")):
        for p in sorted((dataset / "raw" / cls_dir).rglob("*")):
            if p.suffix.lower() not in IMAGE_EXTS:
                continue
            rel = p.relative_to(dataset).as_posix()
            if rel in existing:
                continue
            rows.append({
                "image_id": f"{'B' if cls == 'bill' else 'N'}{len(rows) + 1:05d}", "file_path": rel, "class": cls, "subclass": p.parent.name,
                "document_group_id": "", "source": "", "licence": "", "consent": "", "split": "", "difficulty": "", "conditions": "", "annotation_status": "missing",
            })
    write_csv(manifest_path, rows, MANIFEST_COLUMNS)
    return rows


def validate_annotation(ann: dict, row: dict | None) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    missing = REQUIRED_ANNOTATION_FIELDS - ann.keys()
    if missing:
        errors.append(f"missing fields {sorted(missing)}")
    cls = ann.get("document_class")
    is_bill = ann.get("is_bill", cls not in (None, "non_bill") and not str(cls).startswith("non_bill"))
    if row and row.get("class") and (row["class"] == "bill") != bool(is_bill):
        errors.append(f"class contradiction: manifest says {row['class']}, annotation says is_bill={is_bill}")
    f = ann.get("fields", {})
    date = f.get("bill_date")
    if date not in (None, "") and not ISO_DATE.match(str(date)):
        errors.append(f"bill_date '{date}' is not YYYY-MM-DD")
    for k in ("total_amount", "subtotal", "tax", "discount", "service_charge", "tip"):
        v = f.get(k)
        if v not in (None, "") and not isinstance(v, (int, float)):
            errors.append(f"{k} must be a number or null, got {v!r}")
    if is_bill:
        if f.get("total_amount") in (None, ""):
            warnings.append("bill without total_amount (allowed only if genuinely not visible — document in notes)")
        if not f.get("merchant_name"):
            warnings.append("bill without merchant_name")
        sub, tax, tot = f.get("subtotal"), f.get("tax"), f.get("total_amount")
        if all(isinstance(x, (int, float)) for x in (sub, tax, tot)) and abs(sub + tax - tot) > max(1, 0.01 * abs(tot)):
            disc = f.get("discount") or 0
            sc = (f.get("service_charge") or 0) + (f.get("tip") or 0)
            if abs(sub + tax + sc - disc - tot) > max(1, 0.01 * abs(tot)):
                warnings.append(f"arithmetic: subtotal {sub} + tax {tax} != total {tot} (check labels)")
    else:
        if any(f.get(k) not in (None, "") for k in ("merchant_name", "total_amount", "bill_date")):
            errors.append("non-bill annotation has bill fields filled in")
    for box in ann.get("bounding_boxes", []):
        b = box.get("bbox")
        if not (isinstance(b, list) and len(b) == 4 and all(isinstance(x, (int, float)) and 0 <= x <= 1 for x in b)):
            errors.append(f"bounding box {box.get('field')} must be normalised [x, y, w, h] in 0..1")
    if ann.get("annotation_status") not in ("draft", "reviewed", "verified"):
        errors.append("annotation_status must be draft | reviewed | verified")
    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default="training/configs/dataset_config.yaml")
    ap.add_argument("--dataset", default=None, help="override dataset root")
    ap.add_argument("--scan", action="store_true", help="add new raw images to the manifest")
    ap.add_argument("--write-hashes", action="store_true", help="store sha256/dhash/size in the manifest")
    args = ap.parse_args(argv)
    cfg = load_yaml(args.config) if Path(args.config).exists() else {}
    dataset = Path(args.dataset) if args.dataset else DATASET
    manifest_path = dataset / "manifests" / "dataset_manifest.csv"
    max_d = int(cfg.get("duplicates", {}).get("perceptual_hash_max_distance", 4))

    rows = scan(dataset, manifest_path) if args.scan else read_csv(manifest_path)
    errors: list[str] = []
    warnings: list[str] = []
    if not rows:
        print("Dataset manifest is empty — no images registered yet. Add images under dataset/raw/ and run with --scan.")
        return 0
    seen_ids: set[str] = set()
    hashes: list[tuple[str, str, str, str]] = []  # image_id, sha, dhash, group
    ann_dir = dataset / "annotations" / "complete_ground_truth"
    for r in rows:
        iid = r.get("image_id", "")
        if not iid or iid in seen_ids:
            errors.append(f"duplicate or empty image_id: {iid!r}")
        seen_ids.add(iid)
        if r.get("class") not in CLASSES:
            errors.append(f"{iid}: class must be one of {CLASSES}")
        if "hr_assignment" in r.get("file_path", ""):
            errors.append(f"{iid}: HR assignment images must not be in the training manifest")
        p = dataset / r.get("file_path", "")
        if not p.exists():
            errors.append(f"{iid}: file not found {r.get('file_path')}")
            continue
        try:
            img = open_image(p)
        except Exception as exc:  # corrupted or unsupported
            errors.append(f"{iid}: unreadable image ({exc.__class__.__name__})")
            continue
        sha, dh = sha256_file(p), dhash(img)
        if args.write_hashes:
            r.update(sha256=sha, dhash=dh, width=img.width, height=img.height, format=p.suffix.lower().lstrip("."))
        hashes.append((iid, sha, dh, r.get("document_group_id") or iid))
        if r.get("consent", "").lower() not in ("yes", "na", "licensed", "public_licence"):
            warnings.append(f"{iid}: consent/licence not recorded")
        ann_file = ann_dir / f"{iid}.json"
        if ann_file.exists():
            try:
                ann = json.loads(ann_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                errors.append(f"{iid}: malformed annotation JSON ({exc.msg})")
                continue
            e, w = validate_annotation(ann, r)
            errors += [f"{iid}: {x}" for x in e]
            warnings += [f"{iid}: {x}" for x in w]
        else:
            warnings.append(f"{iid}: missing annotation")
    # Duplicates and cross-group near-duplicates (leakage risk)
    for i in range(len(hashes)):
        for j in range(i + 1, len(hashes)):
            a, b = hashes[i], hashes[j]
            if a[1] == b[1]:
                errors.append(f"exact duplicate files: {a[0]} and {b[0]}")
            elif hamming(a[2], b[2]) <= max_d and a[3] != b[3]:
                warnings.append(f"near-duplicate images in different document groups: {a[0]} ~ {b[0]} (assign the same document_group_id)")
    if args.write_hashes:
        write_csv(manifest_path, rows, MANIFEST_COLUMNS)
    print(f"Validated {len(rows)} images: {len(errors)} error(s), {len(warnings)} warning(s).")
    for e in errors:
        print(f"ERROR   {e}")
    for w in warnings[:200]:
        print(f"WARNING {w}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
