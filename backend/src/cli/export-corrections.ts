/**
 * G23 — Export user corrections for deliberate human review. Only rows where the
 * user consented are exported, and every row starts as review_status=unreviewed:
 * corrections are NOT verified training labels until a reviewer accepts them.
 */
import fs from 'node:fs';
import { loadConfig } from '../config.ts';
import { openDatabase } from '../db.ts';
const out = process.argv[2] ?? 'corrections_for_review.csv';
const config = loadConfig();
const db = openDatabase(config.dataDir, config.migrationsDir);
const rows = db.prepare(`SELECT id, field, ai_value, user_value, ai_confidence, ai_review_state, ai_source, phase, pipeline_version, model_version, prompt_version, review_status, created_at FROM corrections WHERE consent_for_improvement = 1 ORDER BY created_at`).all() as Array<Record<string, unknown>>;
const cols = ['id', 'field', 'ai_value', 'user_value', 'ai_confidence', 'ai_review_state', 'ai_source', 'phase', 'pipeline_version', 'model_version', 'prompt_version', 'review_status', 'created_at'];
const esc = (v: unknown) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(out, [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
console.log(`Exported ${rows.length} consented correction(s) to ${out}.`);
db.close();
