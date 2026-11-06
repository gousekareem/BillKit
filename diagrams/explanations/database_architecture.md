# Database Architecture

**Diagrams:** D14, W11 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

SQLite (better-sqlite3, WAL mode, foreign keys on) with migrations in `database/migrations/` applied in order at start-up and recorded in `schema_migrations`. Main tables: `users` (Argon2id hash, role, settings JSON), `sessions` (sha256 of token), `password_resets`, `categories` (custom), `scans` (status, real stage, `result_json`), `bill_images` (original/corrected, UUID relative paths, sha256, perceptual hash), `bills` (approved values, validation of approved values, provenance, AI snapshot, acknowledged duplicates), `line_items`, `corrections`, `job_metrics` (no bill content) and `contact_messages`. Deleting a user cascades to all of their data; deleting a bill removes its images and corrections. All queries use bound parameters.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
