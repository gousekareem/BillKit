/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Health, public config, settings, categories, analytics, corrections summary,
 * contact form and admin operational metrics.
 */
import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BUILT_IN_CATEGORIES, ContactSchema, SUBCATEGORIES, UserSettingsSchema, isBuiltInCategory } from '@billkit/shared';
import { MAX_PAGES, MAX_UPLOAD_BYTES, PIPELINE_VERSION, PROMPT_VERSION, CLASSIFIER_VERSION, EXTRACTOR_VERSION, CATEGORISER_VERSION, loadCategoriserModel, loadCalibration } from '@billkit/ai';
import { requireAdmin, requireUser } from '../app.ts';
import { nowIso } from '../db.ts';
import { HttpError, notFound } from '../errors.ts';
import { analyticsSummary } from '../services/analytics.ts';

export const miscRoutes: FastifyPluginAsync = async (app) => {
  const { db, config, mailer, vlm, queue, version } = app.ctx;

  app.get('/health', async () => {
    let dbOk = true;
    try {
      db.prepare('SELECT 1').get();
    } catch {
      dbOk = false;
    }
    return { status: dbOk ? 'ok' : 'degraded', version, pipeline: PIPELINE_VERSION, db: dbOk, queueDepth: queue.depth, time: nowIso() };
  });

  app.get('/config/public', async () => ({
    vlmAvailable: Boolean(vlm),
    vlmProvider: vlm ? vlm.name : null,
    maxUploadMb: MAX_UPLOAD_BYTES / 1048576,
    maxPages: MAX_PAGES,
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
    emailConfigured: mailer.configured,
    registrationOpen: config.registrationOpen,
    versions: { app: version, pipeline: PIPELINE_VERSION, classifier: CLASSIFIER_VERSION, extractor: EXTRACTOR_VERSION, categoriser: CATEGORISER_VERSION, prompt: PROMPT_VERSION },
  }));

  /* ---------------- Settings ---------------- */
  app.get('/settings', async (req) => {
    const user = requireUser(req);
    return { settings: UserSettingsSchema.parse(JSON.parse(user.settings_json || '{}')) };
  });
  app.put('/settings', async (req) => {
    const user = requireUser(req);
    const current = UserSettingsSchema.parse(JSON.parse(user.settings_json || '{}'));
    const next = UserSettingsSchema.parse({ ...current, ...(req.body as object) });
    if (next.useCloudVision && !vlm) throw new HttpError(400, 'vlm_not_configured', 'Cloud vision is not configured on this server.');
    db.prepare('UPDATE users SET settings_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), nowIso(), user.id);
    return { settings: next };
  });

  /* ---------------- Categories ---------------- */
  app.get('/categories', async (req) => {
    const user = requireUser(req);
    const counts = db.prepare('SELECT category, COUNT(*) n, SUM(total_amount) total, currency FROM bills WHERE user_id = ? GROUP BY category, currency').all(user.id) as Array<{ category: string; n: number; total: number; currency: string }>;
    const custom = db.prepare('SELECT id, name, created_at FROM categories WHERE user_id = ? ORDER BY name').all(user.id) as Array<{ id: string; name: string; created_at: string }>;
    const stats = (name: string) => {
      const rows = counts.filter((c) => c.category === name);
      return { count: rows.reduce((s, r) => s + r.n, 0), totals: rows.map((r) => ({ currency: r.currency, total: Math.round(r.total * 100) / 100 })) };
    };
    return {
      categories: [
        ...BUILT_IN_CATEGORIES.map((name) => ({ id: null, name, builtIn: true, subcategories: SUBCATEGORIES[name], ...stats(name) })),
        ...custom.map((c) => ({ id: c.id, name: c.name, builtIn: false, subcategories: [], ...stats(c.name) })),
      ],
    };
  });
  app.post('/categories', async (req, reply) => {
    const user = requireUser(req);
    const { name } = z.object({ name: z.string().trim().min(2, 'Use at least 2 characters').max(40).regex(/^[\p{L}\p{N} &'-]+$/u, 'Use letters, numbers, spaces, & or -') }).parse(req.body);
    if (isBuiltInCategory(name) || name.toLowerCase() === 'unknown') throw new HttpError(409, 'exists', 'That category already exists.');
    const count = (db.prepare('SELECT COUNT(*) n FROM categories WHERE user_id = ?').get(user.id) as { n: number }).n;
    if (count >= 30) throw new HttpError(400, 'limit', 'You can create up to 30 custom categories.');
    try {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO categories (id, user_id, name, created_at) VALUES (?, ?, ?, ?)').run(id, user.id, name, nowIso());
      return reply.status(201).send({ category: { id, name } });
    } catch {
      throw new HttpError(409, 'exists', 'That category already exists.');
    }
  });
  app.delete('/categories/:id', async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = db.prepare('SELECT name FROM categories WHERE id = ? AND user_id = ?').get(id, user.id) as { name: string } | undefined;
    if (!row) throw notFound('Category');
    const moved = db.transaction(() => {
      const r = db.prepare(`UPDATE bills SET category = 'Other', subcategory = NULL, updated_at = ? WHERE user_id = ? AND category = ?`).run(nowIso(), user.id, row.name);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return r.changes;
    })();
    return { ok: true, billsMovedToOther: moved };
  });

  /* ---------------- Analytics ---------------- */
  app.get('/analytics/summary', async (req) => {
    const user = requireUser(req);
    const q = z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        category: z.string().max(60).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
      })
      .parse(req.query);
    const settings = UserSettingsSchema.parse(JSON.parse(user.settings_json || '{}'));
    return analyticsSummary(db, user.id, q, settings.budgets);
  });

  app.get('/corrections/summary', async (req) => {
    const user = requireUser(req);
    const byField = db.prepare(`SELECT field, phase, COUNT(*) n FROM corrections WHERE user_id = ? GROUP BY field, phase ORDER BY n DESC`).all(user.id);
    const saved = (db.prepare('SELECT COUNT(*) n FROM bills WHERE user_id = ?').get(user.id) as { n: number }).n;
    const corrected = (db.prepare(`SELECT COUNT(DISTINCT bill_id) n FROM corrections WHERE user_id = ? AND phase = 'review'`).get(user.id) as { n: number }).n;
    return { savedBills: saved, billsWithReviewCorrections: corrected, byField };
  });

  /* ---------------- Contact ---------------- */
  app.post('/contact', { config: { rateLimit: { max: 5 * app.ctx.config.rateLimitScale, timeWindow: '1 hour' } } }, async (req, reply) => {
    const body = ContactSchema.parse(req.body);
    if (body.website) throw new HttpError(400, 'spam', 'Message rejected.');
    if (body.elapsedMs < 2500) throw new HttpError(400, 'too_fast', 'That was quick! Please take a moment and submit again.');
    let delivered: 'stored' | 'emailed' | 'email_failed' = 'stored';
    if (mailer.configured && config.contactTo) {
      const ok = await mailer.send(config.contactTo, `[BillKit contact] ${body.subject}`, `From: ${body.name} <${body.email}>\n\n${body.message}`);
      delivered = ok ? 'emailed' : 'email_failed';
    }
    const ipHash = crypto.createHash('sha256').update(`${req.ip}|billkit`).digest('hex').slice(0, 16);
    db.prepare('INSERT INTO contact_messages (id, name, email, subject, message, delivered, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), body.name, body.email, body.subject, body.message, delivered, ipHash, nowIso(),
    );
    return reply.status(201).send({ ok: true, delivery: delivered });
  });

  /* ---------------- Admin (operational metrics only; no bill content) ---------------- */
  app.get('/admin/metrics', async (req) => {
    requireAdmin(req);
    const since = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query);
    const from = new Date(Date.now() - since.days * 86400_000).toISOString();
    const outcomes = db.prepare('SELECT outcome, COUNT(*) n FROM job_metrics WHERE created_at >= ? GROUP BY outcome').all(from);
    const decisions = db.prepare('SELECT decision, COUNT(*) n FROM job_metrics WHERE created_at >= ? AND decision IS NOT NULL GROUP BY decision').all(from);
    const errors = db.prepare('SELECT error_code, COUNT(*) n FROM job_metrics WHERE created_at >= ? AND error_code IS NOT NULL GROUP BY error_code ORDER BY n DESC').all(from);
    const latency = db.prepare(`SELECT AVG(total_ms) avg, MAX(total_ms) max, COUNT(*) n FROM job_metrics WHERE created_at >= ? AND outcome = 'completed'`).get(from) as { avg: number | null; max: number | null; n: number };
    const timingRows = db.prepare(`SELECT timings_json FROM job_metrics WHERE created_at >= ? AND timings_json IS NOT NULL ORDER BY created_at DESC LIMIT 500`).all(from) as Array<{ timings_json: string }>;
    const stageSums: Record<string, { sum: number; n: number }> = {};
    for (const r of timingRows) for (const [k, v] of Object.entries(JSON.parse(r.timings_json) as Record<string, number>)) {
      stageSums[k] ??= { sum: 0, n: 0 };
      stageSums[k].sum += v;
      stageSums[k].n++;
    }
    const vlmUsage = db.prepare('SELECT vlm_model model, prompt_version, COUNT(*) calls, SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens, SUM(cost_usd) cost_usd, SUM(CASE WHEN vlm_error IS NOT NULL THEN 1 ELSE 0 END) errors FROM job_metrics WHERE created_at >= ? AND (vlm_used = 1 OR vlm_error IS NOT NULL) GROUP BY vlm_model, prompt_version').all(from);
    const versions = db.prepare('SELECT pipeline_version, classifier, ocr_engine, COUNT(*) n FROM job_metrics WHERE created_at >= ? GROUP BY pipeline_version, classifier, ocr_engine').all(from);
    const users = (db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n;
    const corrections = db.prepare('SELECT field, COUNT(*) n, SUM(consent_for_improvement) consented FROM corrections WHERE created_at >= ? GROUP BY field ORDER BY n DESC').all(from);
    return {
      windowDays: since.days,
      users,
      queueDepth: queue.depth,
      outcomes,
      decisions,
      errors,
      latencyMs: { average: latency.avg === null ? null : Math.round(latency.avg), max: latency.max, completedJobs: latency.n },
      stageAverageMs: Object.fromEntries(Object.entries(stageSums).map(([k, v]) => [k, Math.round(v.sum / v.n)])),
      vlm: { configured: Boolean(vlm), model: vlm?.config.model ?? null, usage: vlmUsage },
      versions,
      models: { categoriser: loadCategoriserModel()?.version ?? null, calibration: loadCalibration()?.version ?? null },
      corrections,
      emailConfigured: mailer.configured,
    };
  });
};
