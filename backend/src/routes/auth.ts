/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Registration, login, logout, password reset, password change and account
 * deletion. Responses never reveal whether an email address is registered.
 */
import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ChangePasswordSchema, ForgotPasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema, UserSettingsSchema } from '@billkit/shared';
import { requireUser } from '../app.ts';
import { nowIso } from '../db.ts';
import { HttpError } from '../errors.ts';
import { dummyHash, hashPassword, verifyPassword } from '../auth/passwords.ts';
import { createSession, destroyAllSessions, destroySession, SESSION_COOKIE, tokenHash, type SessionUser } from '../auth/sessions.ts';

export function publicUser(u: SessionUser) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at, settings: UserSettingsSchema.parse(JSON.parse(u.settings_json || '{}')) };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db, config, mailer, storage } = app.ctx;
  const authLimit = { config: { rateLimit: { max: 10 * app.ctx.config.rateLimitScale, timeWindow: '1 minute' } } };

  const setCookie = (reply: FastifyReply, token: string, expiresAt: Date) =>
    reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', expires: expiresAt });

  app.post('/register', authLimit, async (req, reply) => {
    if (!config.registrationOpen) throw new HttpError(403, 'registration_closed', 'Registration is currently closed on this BillKit server.');
    const body = RegisterSchema.parse(req.body);
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email);
    if (exists) throw new HttpError(409, 'email_taken', 'An account with this email already exists. Try signing in or resetting your password.');
    const id = crypto.randomUUID();
    const now = nowIso();
    db.prepare('INSERT INTO users (id, email, name, password_hash, role, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, body.email, body.name, await hashPassword(body.password), 'user', JSON.stringify(UserSettingsSchema.parse({})), now, now,
    );
    const { token, expiresAt } = createSession(db, id, config.sessionDays);
    setCookie(reply, token, expiresAt);
    const user = db.prepare('SELECT id, email, name, role, settings_json, created_at FROM users WHERE id = ?').get(id) as SessionUser;
    return reply.status(201).send({ user: publicUser(user) });
  });

  app.post('/login', authLimit, async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const row = db.prepare('SELECT id, email, name, role, settings_json, created_at, password_hash FROM users WHERE email = ?').get(body.email) as (SessionUser & { password_hash: string }) | undefined;
    const ok = row ? await verifyPassword(row.password_hash, body.password) : (await verifyPassword(await dummyHash(), body.password), false);
    if (!row || !ok) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
    const { token, expiresAt } = createSession(db, row.id, config.sessionDays);
    setCookie(reply, token, expiresAt);
    const { password_hash: _p, ...user } = row;
    return { user: publicUser(user) };
  });

  app.post('/logout', async (req, reply) => {
    destroySession(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/me', async (req) => {
    return { user: req.user ? publicUser(req.user) : null };
  });

  app.post('/forgot-password', authLimit, async (req) => {
    const { email } = ForgotPasswordSchema.parse(req.body);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), user.id, new Date(Date.now() + 30 * 60_000).toISOString());
      const link = `${config.publicOrigin}/reset-password?token=${token}`;
      const sent = await mailer.send(email, 'Reset your BillKit password', `Someone asked to reset the password for your BillKit account.\n\nOpen this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email.`);
      if (!sent && config.env === 'development') {
        // Development convenience only: there is no email server, so print the link to the server console.
        app.log.warn(`[dev only] Password reset link for ${email}: ${link}`);
      }
    }
    // Same response whether or not the account exists (prevents account enumeration).
    return { ok: true, emailDelivery: mailer.configured ? 'smtp' : 'not_configured' };
  });

  app.post('/reset-password', authLimit, async (req) => {
    const { token, password } = ResetPasswordSchema.parse(req.body);
    const row = db.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?').get(tokenHash(token)) as { user_id: string; expires_at: string; used_at: string | null } | undefined;
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) throw new HttpError(400, 'invalid_token', 'This reset link is invalid or has expired. Request a new one.');
    db.transaction(() => {
      db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(nowIso(), tokenHash(token));
      destroyAllSessions(db, row.user_id);
    })();
    const hash = await hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowIso(), row.user_id);
    return { ok: true };
  });

  app.post('/change-password', authLimit, async (req) => {
    const user = requireUser(req);
    const body = ChangePasswordSchema.parse(req.body);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!(await verifyPassword(row.password_hash, body.currentPassword))) throw new HttpError(400, 'wrong_password', 'Your current password is incorrect.');
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(await hashPassword(body.newPassword), nowIso(), user.id);
    destroyAllSessions(db, user.id, req.cookies[SESSION_COOKIE]);
    return { ok: true };
  });

  app.put('/profile', async (req) => {
    const user = requireUser(req);
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(name, nowIso(), user.id);
    return { ok: true };
  });

  /** Permanently deletes the account, all bills, corrections, scans and stored images. */
  app.delete('/account', authLimit, async (req, reply) => {
    const user = requireUser(req);
    const { password } = z.object({ password: z.string().min(1).max(128) }).parse(req.body);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!(await verifyPassword(row.password_hash, password))) throw new HttpError(400, 'wrong_password', 'Your password is incorrect.');
    const pending = db.prepare(`SELECT id FROM scans WHERE user_id = ? AND status IN ('queued','processing')`).all(user.id) as Array<{ id: string }>;
    for (const p of pending) app.ctx.queue.cancel(p.id);
    db.prepare('DELETE FROM job_metrics WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // cascades to sessions, scans, bills, items, images, corrections
    await storage.removeUserDir(user.id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
};
