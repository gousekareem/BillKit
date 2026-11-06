# BillKit — Every bill, in your pocket.

BillKit is an AI-assisted app for scanning, understanding, checking and organising bills and receipts. You photograph or upload a bill. BillKit checks image quality, decides whether the image is a bill at all, reads it with OCR, and extracts the merchant, date, total and other fields. Each value is linked to the line of text it was read from. BillKit then suggests a category, checks the arithmetic, highlights anything uncertain, and saves the bill **only after you review and approve it.**

> **Design principle:** accuracy, evidence, transparency and user trust matter more than pretending AI is always correct. Missing values stay empty. Uncertain values are highlighted. Confidence scores are labelled as heuristic until they are calibrated. Your corrections always win.

© 2026 Shaik Gouse Kareem. All rights reserved. (This is an ownership notice. No registration is claimed. See [LICENSE_OR_OWNERSHIP.md](LICENSE_OR_OWNERSHIP.md).)

---

## What's in this repository

| Path | Contents |
|---|---|
| `website/` | One connected **React 19 + TypeScript** single-page app. It contains the public marketing site (14 prerendered public pages) and the authenticated web app (dashboard, scan, review, history, analytics, categories, settings, admin). It installs on phones as a **PWA**. |
| `backend/` | **Fastify** REST API: authentication, uploads, processing queue, bills, analytics, export, contact, admin metrics |
| `ai/` | The **AI pipeline** (G1–G12, G21): decoding, quality, preprocessing, Tesseract OCR, layout analysis, bill classifier, extraction, categoriser, validation, confidence, duplicates, and an optional vision-language model |
| `packages/shared/` | Versioned zod schemas, normalisation and validation rules shared by the browser, the server and the evaluation harness |
| `database/migrations/` | SQLite schema |
| `evaluation/` | 20-image evaluation harness, synthetic smoke-test set and results |
| `dataset/` | Real-world dataset framework: folders, manifests, annotation templates and the HR 20-image slot (images **pending**) |
| `training/` | Python dataset tools (validate, split, statistics, augment) plus training and evaluation for the categoriser (**executed**), the image classifier (**framework only — not executed**), OCR CER/WER and calibration |
| `diagrams/` | 39 Mermaid diagrams (sources, SVG/PNG/PDF renders) and written explanations |
| `docs/` | Architecture, AI/ML, API, database, security, setup, deployment, testing, limitations, reflection, interview prep, and `docs/technical/` (23 explainers) |
| `presentation/` | Slide deck (`.pptx`) and presentation images |
| `submission/` | Demo script, storyboard, live-change exercise, HR submission checklist, evaluation report template |
| `assets/` | Branding (logo, icons, social image) and real screenshots taken by the end-to-end tests |

## Quick start (development)

Requirements: **Node.js ≥ 22.12** and npm 10. Python 3.11+ is needed only for `training/`.

```bash
npm ci                     # installs all workspaces (native deps: sharp, better-sqlite3, argon2 prebuilt)
                           # behind a restrictive proxy: npm_config_nodedir=$(dirname $(dirname $(which node))) npm ci
cp .env.example .env       # optional: defaults work for local development
npm run dev                # API on http://127.0.0.1:8787 and website on http://localhost:5173
```

Open http://localhost:5173, click **Get started**, create an account and scan a bill. To try the pipeline without real bills, run `npm run fixtures:synthetic` and upload an image from `evaluation/synthetic_smoke/images/`. These are clearly labelled computer-generated test documents.

### Production build (single process serves API + website)

```bash
npm run build                                   # backend/dist/server.js + website/dist (prerendered)
APP_ENV=production STATIC_DIR=$PWD/website/dist PUBLIC_ORIGIN=https://your-domain \
  COOKIE_SECURE=true node backend/dist/server.js
```

Put it behind HTTPS (reverse proxy or platform TLS). See [docs/deployment_guide.md](docs/deployment_guide.md).

### Optional services

| Feature | Needs | Without it |
|---|---|---|
| Vision-language cross-check (Anthropic) | `AI_PROVIDER=anthropic`, `AI_PROVIDER_API_KEY`, `AI_MODEL` — **and** each user must turn on "Use cloud vision" | OCR + rules only (fully functional) |
| Password-reset and contact emails | `SMTP_*`, `CONTACT_TO_EMAIL` | Reset links print to the server console in development only; contact messages are stored in the database and the UI says so |
| Extra OCR languages | `OCR_LANGS`, `OCR_LANG_PATH` with Tesseract traineddata | English only |

No real secrets are included anywhere in this repository.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server with `/api` proxy |
| `npm test` | Unit and integration tests: shared, ai (real OCR), backend (Fastify inject + real pipeline), website (jsdom) |
| `npm run test:e2e` | Playwright journeys A–F, responsive and axe accessibility checks against the production build (`CHROME_PATH=…` to use a system Chrome) |
| `npm run lint` · `npm run typecheck` · `npm run build` | ESLint, TypeScript (all workspaces), production builds |
| `npm run eval:hr` | Evaluates the HR 20-image set (writes a PENDING report until images are added) |
| `npm run eval:smoke` | Runs the evaluation harness on the synthetic smoke set |
| `npm run fixtures:synthetic` | Regenerates the synthetic smoke-test images |
| `npm run admin:grant -- you@example.com` | Grants the admin role to an existing account (there is no default admin) |
| `npm run diagrams:render` | Re-renders the Mermaid diagrams |
| `python -m pytest training/tests` | Python tooling tests (after `pip install -r training/requirements.txt`) |

## Status — what is done and what is not

| Status | Items |
|---|---|
| **Implemented and tested** | Registration/login/logout/password change/account deletion; camera, gallery and drag-drop upload with rotate/crop/replace/remove, progress and cancel; JPG/PNG/WebP/HEIC/PDF (multi-page); quality assessment; perspective/deskew/shadow correction; Tesseract OCR with auto-rotation; bill/non-bill classification with polite rejection and user override; extraction of merchant/date/total and 18 more fields with evidence; categorisation (13 categories, custom categories, abstention); live and server validation; confidence states; review with mandatory confirmation of flagged fields; corrections and provenance; duplicate warnings; history with search/filter/sort/pagination; bill detail/edit/delete/export; analytics, budgets, unusual-expense flags; CSV/JSON export; settings; admin operations metrics; offline viewing (PWA); public website with SEO; 14 legal/public pages; contact form. **Tests:** 136 unit/integration tests, 11 Playwright end-to-end tests (including axe-core) and 10 Python tests — all passing. |
| **Implemented but requires credentials** | Vision-language cross-check (Anthropic) — integration code, retries, schema validation and merge logic are covered by mocked tests; **not tested against the live API**. SMTP email — **not tested against a real server**. |
| **Implemented but awaiting the real 20-image dataset** | HR evaluation (harness, templates, metrics, failure analysis and report generator are ready; status **PENDING**). Confidence calibration (script ready; no table registered). |
| **Not completed (environment/data limits)** | Image-classifier training (framework ready, needs licensed labelled data plus torch); native mobile app (BillKit ships as a PWA instead); real screen recording (script and storyboard provided); live deployment (no hosting credentials); Safari/Firefox testing (only Chrome was available). |

See [docs/limitations.md](docs/limitations.md) for the full list.

## Evaluation

- **HR 20-image evaluation:** pending real images. Put 15 bills and 5 non-bills in `dataset/hr_assignment/`, fill `ground_truth.csv`, and run `npm run eval:hr`. This writes `predictions.csv`, `results.json`, `metrics.json` and `report.md` to `evaluation/results/hr_assignment/` (and copies the CSV and the report to `dataset/hr_assignment/`).
- **Synthetic smoke test** (`evaluation/results/synthetic_smoke/report.md`): the harness ran end to end on 15 computer-generated, fictional images (10 bills with simulated photo degradations, 5 non-bills). All decisions and fields matched. **This only shows the pipeline and harness work. It is not an estimate of real-world accuracy:** synthetic documents are much cleaner and more uniform than real phone photos.

## Documentation map

Start with [docs/architecture.md](docs/architecture.md), [docs/ai_ml_pipeline.md](docs/ai_ml_pipeline.md) and [docs/setup_guide.md](docs/setup_guide.md). For the HR deliverables see [submission/submission_checklist.md](submission/submission_checklist.md), [docs/reflection.md](docs/reflection.md), [docs/interview_preparation.md](docs/interview_preparation.md) and [submission/demo_script.md](submission/demo_script.md). For training see [TRAINING_GUIDE.md](TRAINING_GUIDE.md).

---
Created and developed by **Shaik Gouse Kareem**. © 2026 Shaik Gouse Kareem. All rights reserved.
