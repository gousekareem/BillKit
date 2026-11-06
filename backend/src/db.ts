/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * SQLite access via better-sqlite3. All queries use bound parameters
 * (no string concatenation of user input) to prevent SQL injection.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

export function openDatabase(dataDir: string, migrationsDir: string, file = 'billkit.db'): DB {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(file === ':memory:' ? ':memory:' : path.join(dataDir, file));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db, migrationsDir);
  return db;
}

export function migrate(db: DB, migrationsDir: string): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set((db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>).map((r) => r.version));
  const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const ran: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(f, new Date().toISOString());
    })();
    ran.push(f);
  }
  return ran;
}

export const nowIso = () => new Date().toISOString();
