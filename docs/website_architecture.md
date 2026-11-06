# Website architecture

The public website and the web app are one React 19 + TypeScript SPA built by Vite 8 (`website/`). The details are in `technical/02_frontend_architecture.md`.

| Area | Routes | Rendering |
|---|---|---|
| Public site | `/`, `/features`, `/how-it-works`, `/technology`, `/privacy-security`, `/about`, `/faq`, `/contact`, `/legal/{privacy,terms,data-handling,ai-limitations,cookies,data-deletion}` | **Prerendered** to static HTML at build time, then hydrated |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | Client-rendered |
| Web app (PWA) | `/app` (dashboard), `/app/scan`, `/app/scans/:id` (processing + review), `/app/bills`, `/app/bills/:id`, `/app/analytics`, `/app/categories`, `/app/settings`, `/app/admin` | Client-rendered, auth-protected |
| Errors | `*` → 404 page | — |

In production the Fastify backend serves `website/dist` (`STATIC_DIR`): prerendered HTML for public paths and `index.html` for app routes. In development Vite proxies `/api` to the backend.

Diagrams W01 (website architecture), W02 (components), W03 (navigation), W13 (responsive layout).

© 2026 Shaik Gouse Kareem. All rights reserved.
