/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Server-side sessions: a 256-bit random token lives only in an HttpOnly,
 * SameSite=Lax cookie; the database stores its SHA-256 hash, so a database
 * leak does not leak usable sessions.
 */
import crypto from 'node:crypto';
import type { DB } from '../db.ts';
import { nowIso } from '../db.ts';

export const SESSION_COOKIE = 'bk_session';

export const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(db: DB, userId: string, days: number): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 86400_000);
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)').run(tokenHash(token), userId, nowIso(), expiresAt.toISOString(), nowIso());
  return { token, expiresAt };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  settings_json: string;
  created_at: string;
}

export function lookupSession(db: DB, token: string | undefined): SessionUser | null {
  if (!token || token.length > 100) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.settings_json, u.created_at, s.expires_at, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(tokenHash(token)) as (SessionUser & { expires_at: string; last_seen_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(tokenHash(token));
    return null;
  }
  if (Date.now() - new Date(row.last_seen_at).getTime() > 3600_000) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(nowIso(), tokenHash(token));
  }
  const { expires_at: _e, last_seen_at: _l, ...user } = row;
  return user;
}

export function destroySession(db: DB, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(tokenHash(token));
}

export function destroyAllSessions(db: DB, userId: string, exceptToken?: string): void {
  if (exceptToken) db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, tokenHash(exceptToken));
  else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}
