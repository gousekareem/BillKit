import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Client, makeApp } from './helpers.ts';

let app: FastifyInstance;
beforeAll(async () => ({ app } = await makeApp()));
afterAll(() => app.close());

describe('authentication', () => {
  it('registers, reads /me, logs out and logs back in', async () => {
    const c = new Client(app);
    const reg = await c.post('/api/auth/register', { name: 'Asha', email: 'Asha@Example.com', password: 'correct horse 42' });
    expect(reg.statusCode).toBe(201);
    expect(reg.headers['set-cookie']).toMatch(/HttpOnly/i);
    expect(reg.headers['set-cookie']).toMatch(/SameSite=Lax/i);
    expect(reg.json().user).toMatchObject({ email: 'asha@example.com', name: 'Asha', role: 'user' });
    expect(JSON.stringify(reg.json())).not.toMatch(/password/i);
    expect((await c.get('/api/auth/me')).json().user.email).toBe('asha@example.com');
    await c.post('/api/auth/logout');
    expect((await c.get('/api/auth/me')).json().user).toBeNull();
    expect((await c.get('/api/bills')).statusCode).toBe(401);
    expect((await c.post('/api/auth/login', { email: 'asha@example.com', password: 'wrong password 1' })).statusCode).toBe(401);
    expect((await c.post('/api/auth/login', { email: 'asha@example.com', password: 'correct horse 42' })).statusCode).toBe(200);
  });

  it('stores Argon2id hashes, never plain text', async () => {
    const row = app.ctx.db.prepare('SELECT password_hash FROM users WHERE email = ?').get('asha@example.com') as { password_hash: string };
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(row.password_hash).not.toContain('correct horse');
  });

  it('validates input and rejects duplicate emails without leaking details', async () => {
    const c = new Client(app);
    const weak = await c.post('/api/auth/register', { name: 'B', email: 'b@example.com', password: 'short' });
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error.fields[0].path).toBe('password');
    expect((await c.post('/api/auth/register', { name: 'A', email: 'asha@example.com', password: 'another pass 77' })).statusCode).toBe(409);
    const unknown = await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'whatever 12345' });
    expect(unknown.json().error.message).toBe('Email or password is incorrect.');
  });

  it('blocks state-changing requests without the CSRF header or from foreign origins', async () => {
    const noHeader = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.co', password: 'x' } });
    expect(noHeader.statusCode).toBe(403);
    const foreign = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.co', password: 'x' }, headers: { 'x-billkit-csrf': '1', origin: 'https://evil.example' } });
    expect(foreign.statusCode).toBe(403);
  });

  it('resets a password with a single-use, expiring token and revokes sessions', async () => {
    const sent: string[] = [];
    app.ctx.mailer.send = async (_to, _s, text) => (sent.push(text), true);
    const c = new Client(app);
    await c.post('/api/auth/login', { email: 'asha@example.com', password: 'correct horse 42' });
    const anon = new Client(app);
    const r1 = await anon.post('/api/auth/forgot-password', { email: 'asha@example.com' });
    const r2 = await anon.post('/api/auth/forgot-password', { email: 'nobody@example.com' });
    expect(r1.json().ok).toBe(true);
    expect(r2.json().ok).toBe(true); // same response for unknown accounts
    expect(sent).toHaveLength(1);
    const token = /token=([\w-]+)/.exec(sent[0]!)![1]!;
    expect((await anon.post('/api/auth/reset-password', { token, password: 'brand new pass 9' })).statusCode).toBe(200);
    expect((await anon.post('/api/auth/reset-password', { token, password: 'again new pass 9' })).statusCode).toBe(400);
    expect((await c.get('/api/auth/me')).json().user).toBeNull(); // old session revoked
    expect((await anon.post('/api/auth/login', { email: 'asha@example.com', password: 'brand new pass 9' })).statusCode).toBe(200);
  });

  it('changes password, updates profile and settings, and deletes the account', async () => {
    const c = new Client(app);
    await c.post('/api/auth/register', { name: 'Del', email: 'del@example.com', password: 'delete me pass 1' });
    expect((await c.post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'newer pass 123' })).statusCode).toBe(400);
    expect((await c.post('/api/auth/change-password', { currentPassword: 'delete me pass 1', newPassword: 'newer pass 123' })).statusCode).toBe(200);
    expect((await c.put('/api/auth/profile', { name: 'Deleted User' })).statusCode).toBe(200);
    const s = await c.put('/api/settings', { defaultCurrency: 'USD', ambiguousDateOrder: 'MDY', reviewThreshold: 0.9 });
    expect(s.json().settings).toMatchObject({ defaultCurrency: 'USD', ambiguousDateOrder: 'MDY', reviewThreshold: 0.9 });
    expect((await c.put('/api/settings', { useCloudVision: true })).statusCode).toBe(400); // not configured on this server
    expect((await c.put('/api/settings', { reviewThreshold: 3 })).statusCode).toBe(400);
    expect((await c.del('/api/auth/account', { password: 'nope' })).statusCode).toBe(400);
    expect((await c.del('/api/auth/account', { password: 'newer pass 123' })).statusCode).toBe(200);
    expect(app.ctx.db.prepare('SELECT COUNT(*) n FROM users WHERE email = ?').get('del@example.com')).toEqual({ n: 0 });
  });

  it('exposes health and public config without secrets', async () => {
    const h = await app.inject({ url: '/api/health' });
    expect(h.json().status).toBe('ok');
    const cfg = (await app.inject({ url: '/api/config/public' })).json();
    expect(cfg.vlmAvailable).toBe(false);
    expect(JSON.stringify(cfg)).not.toMatch(/key|secret|pass/i);
  });
});
