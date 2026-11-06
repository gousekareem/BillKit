# Setup guide (local development)

## Requirements

- Node.js **22.12 or newer** (developed on 22.23) and npm 10+
- About 1.5 GB of disk space for dependencies. No system Tesseract is needed: the English model comes from npm.
- Optional: Python 3.11+ for `training/` and the dataset scripts
- Optional: Google Chrome/Chromium for the Playwright end-to-end tests

## Steps

```bash
unzip BillKit_Shaik_Gouse_Kareem_Final.zip && cd BillKit
npm ci                      # installs all workspaces from package-lock.json
cp .env.example .env        # edit values; nothing is required for local use
npm run db:migrate          # optional – the server also migrates on start
npm run dev                 # API on :8787 and website on :5173 (Vite proxies /api)
```

Open http://localhost:5173, create an account and scan a bill. Synthetic sample images are in `evaluation/synthetic_smoke/images/`. They are generated, fictional receipts for testing, not real bills.

### Optional features

| Feature | Set in `.env` |
|---|---|
| Cloud VLM for difficult bills | `AI_PROVIDER=anthropic`, `AI_PROVIDER_API_KEY=<your key>` (and optionally `AI_MODEL`, pricing) |
| Password-reset and contact e-mails | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACT_TO_EMAIL` |
| More OCR languages | `OCR_LANGS=eng+hin` and `OCR_LANG_PATH=/path/with/traineddata` |
| Admin metrics page | `npm run admin:grant -- you@example.com` |

### Python tooling

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r training/requirements.txt          # numpy, pillow, scikit-learn, pyyaml, pytest
pytest training/tests                              # 10 tests
pip install -r training/requirements-classifier.txt   # torch/torchvision — only to train the image classifier
```

### Everything at once

```bash
npm run check     # lint + typecheck + unit/integration tests + production build
npm run test:e2e  # Playwright (set CHROME_PATH if Chrome is not on the default path)
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `better-sqlite3` / `sharp` install errors | Use Node 22 LTS; delete `node_modules` and run `npm ci` again |
| `node-gyp` 403 when downloading Node headers (restricted network: the prebuilt binary could not be fetched, so better-sqlite3 builds from source) | Point node-gyp at the local headers: `npm_config_nodedir=$(dirname $(dirname $(which node))) npm ci` (needs a C++ toolchain: `build-essential`/`python3`) |
| First scan is slow | The OCR worker starts on the first job (a few seconds), and later scans reuse it |
| "Cloud vision is not configured" | Either set both AI variables or switch the setting off |
| Port in use | Change `PORT` (API) or run `npm run dev -w website -- --port 5174` |

© 2026 Shaik Gouse Kareem. All rights reserved.
