"""Character and word error rate of OCR output against reference transcriptions.

CER = Levenshtein(chars) / len(reference chars); WER = Levenshtein(words) / len(reference words).

  npx tsx evaluation/scripts/dump-ocr.ts --images DIR --out evaluation/results/ocr_output
  python training/ocr/ocr_evaluation.py --refs dataset/annotations/layout/transcriptions --hyps evaluation/results/ocr_output
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.ocr.text_normalisation import normalise  # noqa: E402


def levenshtein(a, b) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    return levenshtein(ref, hyp) / max(1, len(ref))


def wer(ref: str, hyp: str) -> float:
    r, h = ref.split(), hyp.split()
    return levenshtein(r, h) / max(1, len(r))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--refs", required=True)
    ap.add_argument("--hyps", required=True)
    args = ap.parse_args(argv)
    rows = []
    for ref_file in sorted(Path(args.refs).glob("*.txt")):
        hyp_file = Path(args.hyps) / ref_file.name
        if not hyp_file.exists():
            continue
        r, h = normalise(ref_file.read_text(encoding="utf-8")), normalise(hyp_file.read_text(encoding="utf-8"))
        rows.append({"image_id": ref_file.stem, "cer": round(cer(r, h), 4), "wer": round(wer(r, h), 4)})
    if not rows:
        print("No matching reference/hypothesis pairs found. No OCR metrics computed.")
        return 0
    summary = {"pairs": len(rows), "mean_cer": round(sum(x["cer"] for x in rows) / len(rows), 4), "mean_wer": round(sum(x["wer"] for x in rows) / len(rows), 4), "rows": rows}
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
