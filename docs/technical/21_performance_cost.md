# 21. Performance and cost analysis

## Measured (this environment, synthetic smoke set, OCR + rules only)
15 images: mean **1,650 ms**, median 1,476 ms, p95 2,933 ms, max 3,298 ms per image (from `evaluation/results/synthetic_smoke/metrics.json`). The first image also pays the OCR worker start-up time. Real phone photos are larger and noisier, so expect them to be slower. The HR run will measure this.

Where the time goes: OCR dominates, and the rotation search (up to 3 extra OCR passes) is the slow path for sideways photos. Decoding and preprocessing take a few hundred ms; classification, extraction and validation take a few ms.

## Throughput
One worker processes roughly one page every 1–3 s on one CPU core. `PROCESSING_CONCURRENCY` and `OCR_WORKERS` up to the number of cores scale this roughly linearly. Memory: about 150–300 MB per OCR worker.

## Cost
- **OCR + rules: no per-scan fee** (only server cost).
- **VLM** (optional): cost per call = input tokens × input price + output tokens × output price. Token counts are recorded per scan (`job_metrics`, `meta.vlm`). Cost is estimated only when `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK` are set; prices are **not hard-coded** because they change (see https://docs.claude.com). An image counts as roughly (width × height) / 750 input tokens, and BillKit downscales the page before sending it.
- `ambiguous_only` mode limits calls to the uncertain cases. The admin page shows the actual call rate and estimated spend.

## Optimisations already in place
Lazy worker reuse; size limit before processing; PDF text layers skip OCR; rotation search only when needed; one VLM call does both classification and extraction; the page sent to the VLM is downscaled to ≤ 1568 px.

© 2026 Shaik Gouse Kareem. All rights reserved.
