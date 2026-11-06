# BillKit architecture

## Decision summary

| Concern | Choice | Why | Alternatives considered |
|---|---|---|---|
| Client | **One React 19 + TypeScript SPA** (Vite 8, React Router 8) with public pages and the `/app` web app, installable as a **PWA** | One codebase gives the camera (`getUserMedia` / `capture`), offline shell and responsive UI on phones and desktops. Public pages are prerendered at build time for SEO. | React Native/Expo (a second codebase, device builds and store signing could not be tested here); Next.js (SSR not needed for an authenticated app — static prerendering gives the SEO benefit) |
| API | **Fastify 5** on Node.js 22 | Fast, schema-friendly, mature plugins (cookie, helmet, multipart, rate-limit, static) | Express (older plugin ecosystem), NestJS (heavier) |
| Database | **SQLite** via better-sqlite3 (WAL) | Zero-ops, transactional, a single file to back up, plenty for one server; satisfies "save locally" | PostgreSQL (better for multi-instance — a migration path is documented) |
| OCR | **Tesseract 5 LSTM via tesseract.js 7** | Runs on our server (privacy, no per-page fees), Apache-2.0, word boxes and confidences, model installed from npm | Google ML Kit (on-device SDK only), PaddleOCR (Python runtime), cloud OCR APIs (cost, data leaves the server) — see `model_selection.md` |
| Classification/extraction | **Transparent rules with evidence** + optional VLM | Works without training data, explainable, testable | Training a classifier on 20 images (rejected by the brief and by statistics) |
| VLM | **Anthropic Messages API** (tool use + zod) — optional | Strong document reading; structured output through a forced tool call | Making it mandatory (cost, privacy, no offline) |
| Validation | Shared pure functions (`packages/shared`) | The same rules run live in the browser and authoritatively on the server | Server-only validation |
| Auth | Own implementation: Argon2id + hashed server sessions | No external provider needed; full control of data | Auth SaaS (extra account and data processor) |
| Images | Local disk, UUID paths | Simple, private; S3-compatible storage is a documented extension | Storing images as database BLOBs |

## Components

```
browser/PWA ──HTTPS──► Fastify API ─► ProcessingQueue ─► @billkit/ai pipeline ─(optional)► Anthropic
                         │   │                                  │
                         │   └─► SQLite (users, scans, bills, corrections, job_metrics)
                         └─────► DATA_DIR/uploads (originals, corrected pages)
```

- **packages/shared** – zod schemas (`ExtractionResult` v`billkit.extraction/1.0`, API payloads, settings), normalisation (amounts, dates, merchants, currencies) and validation.
- **ai** – `processDocument()` and its stages (see `ai_ml_pipeline.md`). It has no knowledge of HTTP or the database, so the backend and the evaluation harness call the same function.
- **backend** – routes (`auth`, `scans`, `bills`, `misc`), services (`processing` queue, `bills` save/diff/duplicates, `analytics`, `email`), `storage`, CLI tools (migrate, grant admin, export corrections).
- **website** – layouts (marketing, app), pages, services (`api`, `auth`, `offline`, `toast`, `theme`), components, a service worker, and a prerender script.

## Request lifecycle (scan)

1. `POST /api/scans` (multipart) → magic-byte validation → originals written → `scans` row `queued` → `202 {id}`.
2. The queue runs `processDocument` with the user's settings. Each `onStage` callback updates `scans.stage`.
3. The client polls `GET /api/scans/:id` every 700 ms and renders real stages. On completion it shows the review screen (or the polite rejection).
4. `POST /api/bills` with the approved values → server validation, duplicate check, provenance and corrections → `bills`.

## Scaling notes

A single process with an in-process queue (`PROCESSING_CONCURRENCY` 1–4) suits a personal or small-team deployment. To scale out: move to PostgreSQL, an external queue (for example BullMQ/Redis), S3-compatible object storage and stateless API instances. The `ai` package needs no changes for that.

Diagrams: `diagrams/source/D01_overall_architecture.mmd`, `D15_api_architecture.mmd`, `D19_deployment_architecture.mmd`.

© 2026 Shaik Gouse Kareem. All rights reserved.
