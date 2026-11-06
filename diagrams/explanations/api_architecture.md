# Api Architecture

**Diagrams:** D15, W09, W10 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

REST endpoints under `/api` (see `docs/api_documentation.md`): **auth** (register, login, logout, me, forgot/reset, change password, profile, delete account), **scans** (multipart upload → 202, status/result polling, cancel, reprocess with options, delete, images), **bills** (save from review, list with search/filter/sort/pagination, detail, edit, delete, image, CSV/JSON export), **settings**, **categories**, **analytics**, **corrections summary**, **contact**, **health**, **public config** and **admin metrics**. Errors share one shape: `{error: {code, message, details?, fields?}}`. In production the same Fastify process serves the built website, including prerendered public pages; in development Vite proxies `/api`.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
