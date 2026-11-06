# Database schema

The schema is defined by the migrations in `../migrations/` (currently `0001_initial.sql`), which are the single source of truth. A copy is not kept here, to avoid drift.

- Table reference: `docs/database.md`
- Diagram: `diagrams/source/D14_database_er.mmd` (rendered in `diagrams/rendered/`)
- Dump the live schema: `sqlite3 $DATA_DIR/billkit.db .schema`

© 2026 Shaik Gouse Kareem. All rights reserved.
