# 1. Complete system architecture

BillKit has four parts that live in one npm-workspaces repository:

| Package | Role | Main tech |
|---|---|---|
| `packages/shared` | Contracts and pure logic shared by everyone: zod schemas (`ExtractionResult`, API payloads, settings), money/date/merchant normalisation, validation | TypeScript, zod 4 |
| `ai` | The document pipeline `processDocument()` — no HTTP or DB knowledge | sharp, tesseract.js 7, pdfjs-dist, heic-convert, optional Anthropic API |
| `backend` | HTTP API, auth, processing queue, storage, analytics, CLI tools | Fastify 5, better-sqlite3, @node-rs/argon2 |
| `website` | Public site and the `/app` web app (PWA) | React 19, Vite 8, React Router 8 |

Supporting folders: `database/migrations`, `evaluation/` (harness + results), `dataset/` and `training/` (data and Python tooling), `diagrams/`, `docs/`.

## End-to-end flow

1. The user captures or uploads a bill in the browser (`/app/scan`). The browser can rotate, crop, reorder and remove pages before upload.
2. `POST /api/scans` stores the originals under random UUID paths, creates a `scans` row (`queued`) and returns `202`.
3. The in-process **ProcessingQueue** (concurrency 1–4) calls `processDocument()`. Each stage reports progress to the `scans.stage` column.
4. The browser polls `GET /api/scans/:id` and shows the real stage names. When it finishes, it shows either the **polite rejection** (not a bill, with reasons and a "this is a bill" override) or the **review screen**.
5. The user confirms or corrects flagged fields and saves. `POST /api/bills` re-validates, checks duplicates and records provenance and corrections.
6. Saved bills appear in history, analytics and exports. Viewed bills are cached in IndexedDB for offline reading.

Why one pipeline function: the backend and the evaluation harness both call `processDocument()`, so **the evaluation measures exactly what users get**.

Diagrams: D01 (overall architecture), D03 (bill processing flow), D19 (deployment), D22 (offline).

© 2026 Shaik Gouse Kareem. All rights reserved.
