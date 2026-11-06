"""Tests for the BillKit dataset/training tooling on a tiny generated dataset (synthetic images)."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.common import MANIFEST_COLUMNS, SplitRatios, dhash, group_split, hamming, read_csv, write_csv  # noqa: E402
from training.scripts import augment, generate_statistics, split_dataset, validate_dataset  # noqa: E402
from training.scripts.calibrate import brier, expected_calibration_error, fit_temperature, reliability  # noqa: E402
from training.ocr.ocr_evaluation import cer, wer  # noqa: E402


def _receiptish(path: Path, seed: int) -> None:
    rng = np.random.default_rng(seed)
    img = Image.new("RGB", (300, 420), (250, 250, 248))
    d = ImageDraw.Draw(img)
    for i in range(12):
        d.rectangle([20, 20 + i * 30, 20 + int(rng.integers(80, 260)), 32 + i * 30], fill=(30, 30, 30))
    img.save(path)


@pytest.fixture()
def tiny_dataset(tmp_path: Path) -> Path:
    ds = tmp_path / "dataset"
    for sub in ("raw/bills/015_grocery_bills", "raw/non_bills/001_selfies", "manifests", "annotations/complete_ground_truth", "reports", "processed/augmented"):
        (ds / sub).mkdir(parents=True)
    rows = []
    for i in range(8):
        p = ds / "raw/bills/015_grocery_bills" / f"b{i}.png"
        _receiptish(p, i)
        rows.append({"image_id": f"B{i}", "file_path": p.relative_to(ds).as_posix(), "class": "bill", "subclass": "015_grocery_bills", "document_group_id": f"G{i // 2}", "consent": "yes"})
    for i in range(6):
        p = ds / "raw/non_bills/001_selfies" / f"n{i}.png"
        Image.new("RGB", (300, 400), (40 * i, 120, 200)).save(p)
        rows.append({"image_id": f"N{i}", "file_path": p.relative_to(ds).as_posix(), "class": "non_bill", "subclass": "001_selfies", "document_group_id": "", "consent": "yes"})
    write_csv(ds / "manifests/dataset_manifest.csv", rows, MANIFEST_COLUMNS)
    (ds / "annotations/complete_ground_truth/B0.json").write_text(json.dumps({"image_id": "B0", "document_class": "grocery_receipt", "is_bill": True, "annotation_status": "reviewed", "fields": {"merchant_name": "X", "bill_date": "2026-10-01", "total_amount": 118, "subtotal": 100, "tax": 18}}))
    return ds


def test_validate_reports_missing_annotations_but_no_errors(tiny_dataset: Path, capsys):
    assert validate_dataset.main(["--dataset", str(tiny_dataset), "--config", "nonexistent.yaml"]) == 0
    out = capsys.readouterr().out
    assert "0 error(s)" in out and "missing annotation" in out


def test_validate_detects_bad_annotations_and_duplicates(tiny_dataset: Path, capsys):
    (tiny_dataset / "annotations/complete_ground_truth/N0.json").write_text(json.dumps({"image_id": "N0", "document_class": "non_bill", "is_bill": False, "annotation_status": "final", "fields": {"total_amount": "12"}}))
    shutil.copy(tiny_dataset / "raw/bills/015_grocery_bills/b0.png", tiny_dataset / "raw/bills/015_grocery_bills/copy.png")
    rows = read_csv(tiny_dataset / "manifests/dataset_manifest.csv") + [{"image_id": "B99", "file_path": "raw/bills/015_grocery_bills/copy.png", "class": "bill", "document_group_id": "G9", "consent": "yes"}]
    write_csv(tiny_dataset / "manifests/dataset_manifest.csv", rows, MANIFEST_COLUMNS)
    assert validate_dataset.main(["--dataset", str(tiny_dataset), "--config", "nonexistent.yaml"]) == 1
    out = capsys.readouterr().out
    assert "exact duplicate files" in out
    assert "non-bill annotation has bill fields" in out
    assert "annotation_status must be" in out


def test_validate_annotation_rules():
    errs, warns = validate_dataset.validate_annotation({"image_id": "x", "document_class": "receipt", "annotation_status": "draft", "fields": {"bill_date": "20/10/2026", "subtotal": 100, "tax": 18, "total_amount": 150}, "bounding_boxes": [{"field": "total", "bbox": [0.1, 0.2, 2, 0.1]}]}, {"class": "bill"})
    assert any("YYYY-MM-DD" in e for e in errs)
    assert any("normalised" in e for e in errs)
    assert any("arithmetic" in w for w in warns)


def test_group_split_keeps_groups_together_and_is_deterministic():
    rows = [{"image_id": f"I{i}", "class": "bill" if i < 20 else "non_bill", "document_group_id": f"G{i // 2}"} for i in range(30)]
    a = group_split(rows, SplitRatios(), seed=7)
    b = group_split(rows, SplitRatios(), seed=7)
    assert a == b
    assert set(a.values()) == {"train", "validation", "test"}


def test_split_then_augment_only_train(tiny_dataset: Path):
    assert split_dataset.main(["--dataset", str(tiny_dataset), "--config", "nonexistent.yaml", "--seed", "3"]) == 0
    report = json.loads((tiny_dataset / "reports/split_report.json").read_text())
    assert report["leaking_groups"] == []
    assert augment.main(["--dataset", str(tiny_dataset), "--split", "test"]) == 2
    assert augment.main(["--dataset", str(tiny_dataset), "--per-image", "2"]) == 0
    aug = read_csv(tiny_dataset / "manifests/augmented_manifest.csv")
    train_ids = {r["image_id"] for r in read_csv(tiny_dataset / "manifests/train_manifest.csv")}
    assert aug and all(r["source_image_id"] in train_ids for r in aug)
    assert all((tiny_dataset / r["file_path"]).exists() for r in aug)


def test_statistics(tiny_dataset: Path):
    assert generate_statistics.main(["--dataset", str(tiny_dataset)]) == 0
    stats = json.loads((tiny_dataset / "reports/dataset_statistics.json").read_text())
    assert stats["total_images"] == 14 and stats["bill_images"] == 8 and stats["missing_annotations"] == 13
    assert (tiny_dataset / "reports/image_quality_report.csv").exists()


def test_dhash_and_hamming():
    a = Image.new("RGB", (100, 100), "white")
    ImageDraw.Draw(a).rectangle([10, 10, 50, 90], fill="black")
    b = a.copy().resize((90, 90))
    assert hamming(dhash(a), dhash(b)) <= 4


def test_calibration_metrics():
    assert expected_calibration_error([0.9, 0.9, 0.9, 0.9], [1, 1, 1, 0]) == pytest.approx(0.15)
    assert brier([1.0, 0.0], [1, 0]) == 0
    assert reliability([0.1, 0.95], [0, 1], bins=2)[1]["n"] == 1
    logits = np.array([[4.0, 0.0]] * 50 + [[0.0, 4.0]] * 50)
    labels = np.array([0] * 40 + [1] * 10 + [1] * 40 + [0] * 10)  # overconfident by construction
    assert fit_temperature(logits, labels) > 1.0


def test_ocr_error_rates():
    assert cer("total 100", "total 100") == 0
    assert cer("abcd", "abed") == 0.25
    assert wer("grand total 100", "grand tota1 100") == pytest.approx(1 / 3)


def test_hr_assignment_is_refused():
    import pytest
    from training.common import DATASET, assert_not_hr_assignment, read_csv
    with pytest.raises(ValueError):
        read_csv(DATASET / "hr_assignment" / "ground_truth.csv")
    assert_not_hr_assignment(DATASET / "processed" / "train")  # allowed
