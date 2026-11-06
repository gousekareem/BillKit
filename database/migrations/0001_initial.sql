-- BillKit — Every bill, in your pocket.
-- © 2026 Shaik Gouse Kareem. All rights reserved.
-- Initial schema (SQLite). Applied by backend/src/db.ts in filename order.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id             TEXT PRIMARY KEY,                 -- UUID v4
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,                    -- Argon2id (PHC string); never plain text
  role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  settings_json  TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,                  -- SHA-256 of the random session token (token itself only in the cookie)
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  token_hash  TEXT PRIMARY KEY,                    -- SHA-256 of the emailed token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, name)
);

-- One upload = one scan (processing job). A saved scan produces one bill.
CREATE TABLE scans (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL CHECK (status IN ('queued','processing','completed','failed','cancelled','saved','discarded')),
  stage             TEXT NOT NULL DEFAULT 'uploaded',
  attempt           INTEGER NOT NULL DEFAULT 1,
  file_count        INTEGER NOT NULL,
  options_json      TEXT NOT NULL DEFAULT '{}',
  result_json       TEXT,                          -- ExtractionResult (schema billkit.extraction/1.0)
  error_code        TEXT,
  error_message     TEXT,
  cancel_requested  INTEGER NOT NULL DEFAULT 0,
  bill_id           TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE INDEX idx_scans_user ON scans(user_id, created_at);

CREATE TABLE bills (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_id            TEXT REFERENCES scans(id) ON DELETE SET NULL,
  merchant_name      TEXT NOT NULL,
  bill_date          TEXT NOT NULL,                -- ISO yyyy-mm-dd
  bill_time          TEXT,
  total_amount       REAL NOT NULL,
  currency           TEXT NOT NULL,
  category           TEXT NOT NULL,
  subcategory        TEXT,
  subtotal           REAL,
  tax                REAL,
  discount           REAL,
  service_charge     REAL,
  tip                REAL,
  invoice_number     TEXT,
  payment_method     TEXT,
  merchant_address   TEXT,
  notes              TEXT,
  document_class     TEXT,
  review_status      TEXT NOT NULL DEFAULT 'verified',
  validation_json    TEXT NOT NULL DEFAULT '{}',   -- validation of the APPROVED values
  provenance_json    TEXT NOT NULL DEFAULT '{}',   -- per field: ai | user_corrected | user_confirmed | user_entered
  ai_snapshot_json   TEXT,                         -- what the AI proposed (traceability); deleted with the bill
  duplicate_json     TEXT,                         -- duplicate warnings the user acknowledged
  file_sha256        TEXT,
  perceptual_hash    TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_bills_user_date ON bills(user_id, bill_date);
CREATE INDEX idx_bills_user_category ON bills(user_id, category);
CREATE INDEX idx_bills_user_merchant ON bills(user_id, merchant_name);

CREATE TABLE line_items (
  id           TEXT PRIMARY KEY,
  bill_id      TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  description  TEXT NOT NULL,
  quantity     REAL,
  unit_price   REAL,
  line_total   REAL
);
CREATE INDEX idx_line_items_bill ON line_items(bill_id);

CREATE TABLE bill_images (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_id          TEXT REFERENCES scans(id) ON DELETE CASCADE,
  bill_id          TEXT REFERENCES bills(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('original','corrected')),
  page             INTEGER NOT NULL,
  rel_path         TEXT NOT NULL,                  -- relative to DATA_DIR/uploads; built only from UUIDs
  mime             TEXT NOT NULL,
  bytes            INTEGER NOT NULL,
  sha256           TEXT,
  perceptual_hash  TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_bill_images_scan ON bill_images(scan_id);
CREATE INDEX idx_bill_images_bill ON bill_images(bill_id);
CREATE INDEX idx_bill_images_sha ON bill_images(user_id, sha256);

-- Human corrections of AI output. NOT automatically used as training labels:
-- review_status starts 'unreviewed' and consent is recorded per row.
CREATE TABLE corrections (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id            TEXT REFERENCES bills(id) ON DELETE CASCADE,
  scan_id            TEXT,
  field              TEXT NOT NULL,
  ai_value           TEXT,
  user_value         TEXT,
  ai_confidence      REAL,
  ai_review_state    TEXT,
  ai_source          TEXT,
  phase              TEXT NOT NULL CHECK (phase IN ('review','post_save_edit')),
  pipeline_version   TEXT,
  model_version      TEXT,
  prompt_version     TEXT,
  consent_for_improvement INTEGER NOT NULL DEFAULT 0,
  review_status      TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','accepted','rejected')),
  created_at         TEXT NOT NULL
);
CREATE INDEX idx_corrections_user ON corrections(user_id);

-- Operational metrics per processing attempt. Contains NO bill content (no OCR text, no amounts, no merchant).
CREATE TABLE job_metrics (
  id                TEXT PRIMARY KEY,
  scan_id           TEXT,
  user_id           TEXT,
  outcome           TEXT NOT NULL,                 -- completed | failed | cancelled
  decision          TEXT,                          -- bill | not_bill | ambiguous
  overall_review    TEXT,
  error_code        TEXT,
  total_ms          INTEGER,
  timings_json      TEXT,
  pages             INTEGER,
  quality_score     INTEGER,
  pipeline_version  TEXT,
  ocr_engine        TEXT,
  classifier        TEXT,
  vlm_used          INTEGER NOT NULL DEFAULT 0,
  vlm_model         TEXT,
  vlm_error         TEXT,
  prompt_version    TEXT,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cost_usd          REAL,
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_job_metrics_created ON job_metrics(created_at);

CREATE TABLE contact_messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  delivered   TEXT NOT NULL CHECK (delivered IN ('stored','emailed','email_failed')),
  ip_hash     TEXT,
  created_at  TEXT NOT NULL
);
