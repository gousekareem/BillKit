# Evaluation

| Path | Contents |
|---|---|
| `scripts/run-evaluation.ts` | The harness: runs the production pipeline on a labelled image folder and writes per-image predictions, metrics, a JSON dump and a Markdown report |
| `scripts/dump-ocr.ts` | Prints the OCR rows for one image (for debugging failures) |
| `synthetic_smoke/` | 15 computer-generated fictional images + ground truth. **Not real bills** |
| `results/synthetic_smoke/` | Last smoke-test run (pipeline check only) |
| `results/hr_assignment/` | HR 20-image results. **PENDING** until the images are supplied |
| `templates/` | Ground-truth and report templates |
| `reports/` | Place for written analysis of a run (copy `templates/evaluation_report_template.md`) |

```bash
npm run eval:smoke                               # synthetic smoke test
npm run eval:hr                                  # HR set (dataset/hr_assignment)
npm run eval:hr -- --allow-vlm --date-order MDY  # options
npx tsx evaluation/scripts/run-evaluation.ts --images DIR --gt FILE.csv --out DIR
```

The method is described in `docs/evaluation_methodology.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
