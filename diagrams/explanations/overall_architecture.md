# Overall Architecture

**Diagrams:** D01, W01, D19 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

BillKit is a single-origin web system. The **browser/PWA** (React 19 + TypeScript, Vite) captures or uploads images and shows review, history and analytics. The **Fastify API** (Node.js 22) authenticates users with server-side sessions, validates every request with zod, enforces CSRF and rate limits, stores originals on local disk under UUID paths, and queues each upload. The **processing queue** runs the shared **AI pipeline** package (`ai/`), writing each real stage to the `scans` table so the UI can show genuine progress. Results, bills, corrections and operational metrics live in **SQLite**. The optional **Anthropic vision model** is called only when the operator configured a key *and* the user allowed cloud vision for that bill, and only when the cheaper path is uncertain.

**Data flow:** image → API → queue → pipeline → `scans.result_json` → review UI → approved values → API re-validation → `bills`. Offline copies of viewed data are kept in the browser's IndexedDB.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
