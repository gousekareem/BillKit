# 3. Backend architecture

`backend/src`:

- `config.ts` reads the environment once. Empty values count as unset, placeholder API keys count as "not configured", and the production defaults are secure (secure cookies, HSTS).
- `app.ts` builds the Fastify app with Helmet (CSP), cookies, rate limiting on `/api`, multipart limits, a CSRF/Origin hook, a central error handler that maps zod/HttpError/PipelineError to JSON, `Cache-Control: no-store` on API responses, and optional static serving of the built site with prerendered fallbacks.
- `routes/`: `auth`, `scans`, `bills`, `misc` (health, public config, settings, categories, analytics, corrections summary, contact, admin metrics).
- `services/processing.ts` is a FIFO queue with bounded concurrency and AbortController-based cancellation. On start-up it re-queues `queued` jobs and marks jobs that were mid-processing as failed (`interrupted`) so the user can retry. It writes `job_metrics`.
- `services/bills.ts` handles save and update: server-side validation, diffing against the AI snapshot (provenance and corrections), duplicate checks (SHA-256, dHash, merchant+date+total, invoice number), and removing originals when the user chose not to keep them.
- `services/analytics.ts` builds the monthly series, category and merchant totals, comparisons, budgets and unusual-bill detection, per currency.
- `storage.ts` writes and reads files under `DATA_DIR/uploads`. Paths are built only from UUIDs, so they cannot be traversed.
- `auth/`: Argon2id hashing and server-side sessions (only the hashed token is stored).
- `cli/`: `migrate`, `grant-admin`, `export-corrections` (consented rows only).
- `server.ts` starts the server, runs the hourly retention clean-up and shuts down gracefully.

Built with esbuild into a single `dist/server.js`. Native modules (better-sqlite3, sharp, argon2) stay external.

Diagram: D15 (API architecture).

© 2026 Shaik Gouse Kareem. All rights reserved.
