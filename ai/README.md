# @billkit/ai — document pipeline

`processDocument({ files, options, vlm, onStage, signal })` → `{ result: ExtractionResult, correctedPages, … }`.

The brief's folder names map to modules like this:

| Brief folder | Module(s) |
|---|---|
| classification | `src/classify.ts` |
| ocr | `src/ocr.ts`, `src/image/*`, `src/preprocess.ts`, `src/quality.ts` |
| extraction | `src/layout.ts`, `src/extract.ts`, `src/llm/*` (optional VLM) |
| categorisation | `src/categorise.ts`, `src/lexicon.ts`, `models/categoriser/` |
| validation | `packages/shared/src/validation.ts` (re-exported by `src/validate.ts`; shared with the browser) |
| confidence | `src/confidence.ts`, `models/calibration/` (empty until a calibration table is fitted) |
| evaluation | `../evaluation/scripts/run-evaluation.ts` |

Also here: `src/duplicates.ts`, `src/pipeline.ts` (orchestration), `models/registry.json` (active model versions), `scripts/synthetic.ts` (fictional test receipts), and `tests/` (66 tests).

```bash
npm run test -w @billkit/ai
npm run fixtures:synthetic   # regenerate synthetic fixtures
```

Explanations: `docs/ai_ml_pipeline.md` and `docs/technical/05`–`11`.

© 2026 Shaik Gouse Kareem. All rights reserved.
