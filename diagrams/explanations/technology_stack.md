# D25 — Technology stack

The diagram groups the actual dependencies by where they run:

- **Client (website/)**: React 19, TypeScript, Vite 8 and React Router 8; lucide-react icons; the Inter font, self-hosted; a service worker and IndexedDB for offline viewing.
- **Shared (packages/shared)**: zod 4 schemas, normalisation and validation, used by the client, server and evaluation harness alike.
- **Server (backend/)**: Node.js 22 and Fastify 5 with its helmet, cookie, multipart, rate-limit and static plugins; Argon2id password hashing and hashed sessions; SQLite in WAL mode; local image storage.
- **AI pipeline (ai/)**: sharp, heic-convert and pdfjs-dist for decoding; tesseract.js 7 for OCR; BillKit's own evidence classifier, rule extractor and TF-IDF + LR categoriser. The Anthropic Messages API is optional.
- **Offline training (training/)**: Python, scikit-learn, numpy, Pillow and PyYAML; PyTorch/torchvision and ONNX only for the (untrained) image classifier. Models reach the app only as exported files listed in `ai/models/registry.json`.
- **Quality**: Vitest, Testing Library, Playwright, axe-core, pytest, ESLint, tsc, npm audit and esbuild.

Why each was chosen: `docs/architecture.md` and `docs/model_selection.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
