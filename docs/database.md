# Database

SQLite (better-sqlite3, WAL mode, `foreign_keys=ON`). File: `$DATA_DIR/billkit.db`. Migrations: `database/migrations/*.sql`, applied in order at start-up and with `npm run db:migrate`. Applied versions are tracked in `schema_migrations`.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | `id` UUID, `email` (unique, case-insensitive), `name`, `password_hash` (Argon2id PHC string), `role` (`user`/`admin`), `settings_json` |
| `sessions` | Server-side sessions | `id` = SHA-256 of the cookie token (the raw token is never stored), `user_id`, `expires_at`, `last_seen_at` |
| `password_resets` | Reset tokens | `token_hash`, `expires_at`, `used_at` |
| `categories` | Custom categories per user | `name` (unique per user) |
| `scans` | Uploads and processing jobs | `status` (queued/processing/completed/failed/cancelled/saved/discarded), `stage`, `attempt`, `options_json`, `result_json` (ExtractionResult), `error_code`, `cancel_requested`, `bill_id` |
| `bills` | Saved, reviewed bills | merchant/date/time/total/currency/category/subcategory, subtotal/tax/discount/service charge/tip, invoice number, payment method, address, notes, `document_class`, `review_status`, `validation_json` (of the approved values), `provenance_json` (per field), `ai_snapshot_json` (what the AI proposed), `duplicate_json` (acknowledged warnings), `file_sha256`, `perceptual_hash` |
| `line_items` | Items per bill | `position`, `description`, `quantity`, `unit_price`, `line_total` |
| `bill_images` | Stored pages | `kind` (`original`/`corrected`), `page`, `rel_path` (built only from UUIDs, under `DATA_DIR/uploads`), `mime`, `bytes`, `sha256`, `perceptual_hash` |
| `corrections` | AI value vs user value | `field`, `ai_value`, `user_value`, `ai_confidence`, `ai_review_state`, `ai_source`, `phase` (`review`/`post_save_edit`), pipeline/model/prompt versions, `consent_for_improvement`, `review_status` (`unreviewed`/`accepted`/`rejected`) |
| `job_metrics` | Monitoring without bill content | outcome, decision, overall review, error code, timings, pages, quality score, versions, VLM used/model/error, tokens, cost |
| `contact_messages` | Contact form | name, email, subject, message, delivered flag, `ip_hash` (truncated salted SHA-256) |

Money is stored as REAL values rounded to 2 decimal places, together with an ISO 4217 currency code. Totals are never summed across currencies. Dates are stored as ISO `YYYY-MM-DD`.

**Deletion.** Deleting a bill removes its rows and image files. Deleting an account cascades through all user tables and removes the user's upload directory. Unsaved scans expire after `UNSAVED_SCAN_RETENTION_HOURS` (hourly clean-up).

**Backup.** Use `sqlite3 billkit.db ".backup backup.db"` (safe while running) plus a copy of `uploads/`.

**Scaling path.** The SQL is mostly portable; for PostgreSQL, replace `better-sqlite3` calls in `backend/src/db.ts` and the services with a pooled client and convert `TEXT` JSON columns to `jsonb`.

Diagram: `diagrams/source/D14_database_er.mmd`.

© 2026 Shaik Gouse Kareem. All rights reserved.
