# 4. Database architecture

SQLite in WAL mode with foreign keys on. The full table reference is in [`docs/database.md`](../database.md); this page explains the design choices.

- **User scoping everywhere.** Every user-owned table has `user_id` with `ON DELETE CASCADE`, and every query filters by it. Deleting an account is a single `DELETE FROM users` plus removing the user's upload folder.
- **Scans vs bills.** A *scan* is a processing job and its AI result (`result_json`). A *bill* exists only after a human has approved it. This separation keeps unreviewed AI output out of history, analytics and exports.
- **Traceability.** `bills.ai_snapshot_json` keeps what the AI proposed, `provenance_json` records for each field whether it is `ai`, `user_confirmed`, `user_corrected`, `user_entered` or `user_removed`, and `corrections` has one row per changed field with model and prompt versions.
- **Monitoring without content.** `job_metrics` stores timings, outcomes and versions, and never merchant names or amounts.
- **Indexes** on (user, date), (user, category) and (user, merchant) for history and analytics; on (user, sha256) for duplicate checks.
- **Money** is stored as REAL rounded to 2 decimal places together with a currency code. Amounts are never summed across currencies. (Integer minor units would be the stricter choice; at personal-expense scale the rounding is applied on every write and in all aggregates.)
- **Migrations** are numbered SQL files, applied once and tracked in `schema_migrations`.

Diagram: D14 (database ER).

© 2026 Shaik Gouse Kareem. All rights reserved.
