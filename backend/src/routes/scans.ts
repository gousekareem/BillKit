/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Upload → asynchronous processing → poll status → review.
 */
import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { detectFormat, MAX_PAGES, sha256 } from '@billkit/ai';
import { STAGE_LABELS, type ExtractionResult, type PipelineStage } from '@billkit/shared';
import { requireUser } from '../app.ts';
import { nowIso } from '../db.ts';
import { HttpError, notFound } from '../errors.ts';
import { duplicateCandidates } from '../services/bills.ts';

const ScanOptionsSchema = z.object({
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  disableAutoCrop: z.boolean().optional(),
  userConfirmedBill: z.boolean().optional(),
  allowVlm: z.boolean().optional(),
});
const IdParams = z.object({ id: z.string().uuid() });
const EXT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', heic: 'heic', pdf: 'pdf' };
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf' };

export const scanRoutes: FastifyPluginAsync = async (app) => {
  const { db, storage, queue, vlm } = app.ctx;

  const getScan = (id: string, userId: string) =>
    db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(id, userId) as
      | { id: string; status: string; stage: string; attempt: number; file_count: number; options_json: string; result_json: string | null; error_code: string | null; error_message: string | null; bill_id: string | null; created_at: string; updated_at: string; completed_at: string | null }
      | undefined;

  app.post('/', { config: { rateLimit: { max: 30 * app.ctx.config.rateLimitScale, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = requireUser(req);
    if (!req.isMultipart()) throw new HttpError(415, 'multipart_required', 'Upload the bill as multipart/form-data.');
    const files: Array<{ buf: Buffer; ext: string }> = [];
    let options: z.infer<typeof ScanOptionsSchema> = {};
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buf = await part.toBuffer();
        const fmt = detectFormat(buf);
        if (!fmt) throw new HttpError(415, 'unsupported_format', 'Unsupported file type. Use JPG, PNG, WebP, HEIC or PDF.');
        files.push({ buf, ext: EXT[fmt]! });
      } else if (part.fieldname === 'options') {
        options = ScanOptionsSchema.parse(JSON.parse(String(part.value || '{}')));
      }
    }
    if (!files.length) throw new HttpError(400, 'no_file', 'Choose a bill image to upload.');
    if (files.length > MAX_PAGES) throw new HttpError(413, 'too_many_files', `Upload at most ${MAX_PAGES} pages.`);
    if (files.some((f) => f.ext === 'pdf') && files.length > 1) throw new HttpError(400, 'mixed_upload', 'Upload a PDF on its own.');

    const scanId = crypto.randomUUID();
    const now = nowIso();
    db.prepare(`INSERT INTO scans (id, user_id, status, stage, file_count, options_json, created_at, updated_at) VALUES (?, ?, 'queued', 'uploaded', ?, ?, ?, ?)`).run(
      scanId, user.id, files.length, JSON.stringify(options), now, now,
    );
    for (const [i, f] of files.entries()) {
      const rel = storage.relPath(user.id, scanId, `original-${i}.${f.ext}`);
      await storage.write(rel, f.buf);
      db.prepare(`INSERT INTO bill_images (id, user_id, scan_id, kind, page, rel_path, mime, bytes, sha256, created_at) VALUES (?, ?, ?, 'original', ?, ?, ?, ?, ?, ?)`).run(
        crypto.randomUUID(), user.id, scanId, i, rel, MIME[f.ext]!, f.buf.length, sha256(f.buf), now,
      );
    }
    queue.enqueue(scanId);
    return reply.status(202).send({ id: scanId, status: 'queued' });
  });

  app.get('/', async (req) => {
    const user = requireUser(req);
    const rows = db.prepare(`SELECT id, status, stage, error_code, created_at, bill_id FROM scans WHERE user_id = ? AND status != 'discarded' ORDER BY created_at DESC LIMIT 10`).all(user.id);
    return { scans: rows };
  });

  app.get('/:id', async (req) => {
    const user = requireUser(req);
    const { id } = IdParams.parse(req.params);
    const s = getScan(id, user.id);
    if (!s) throw notFound('Scan');
    const result = s.result_json ? (JSON.parse(s.result_json) as ExtractionResult) : null;
    const images = db.prepare('SELECT kind, page FROM bill_images WHERE scan_id = ? ORDER BY kind, page').all(id) as Array<{ kind: string; page: number }>;
    let duplicates: unknown[] = [];
    if (result?.isBill && s.status === 'completed') {
      const orig = db.prepare(`SELECT sha256 FROM bill_images WHERE scan_id = ? AND kind='original' AND page=0`).get(id) as { sha256: string } | undefined;
      const corr = db.prepare(`SELECT perceptual_hash FROM bill_images WHERE scan_id = ? AND kind='corrected' AND page=0`).get(id) as { perceptual_hash: string | null } | undefined;
      duplicates = duplicateCandidates(db, user.id, {
        fileSha256: orig?.sha256, perceptualHash: corr?.perceptual_hash, merchantName: result.fields.merchantName.value, billDate: result.fields.billDate.value,
        totalAmount: result.fields.totalAmount.value, invoiceNumber: result.fields.invoiceNumber.value,
      });
    }
    return {
      id: s.id,
      status: s.status,
      stage: s.stage,
      stageLabel: STAGE_LABELS[s.stage as PipelineStage] ?? s.stage,
      attempt: s.attempt,
      options: JSON.parse(s.options_json),
      error: s.error_code ? { code: s.error_code, message: s.error_message } : null,
      result,
      images,
      duplicates,
      billId: s.bill_id,
      vlmConfigured: Boolean(vlm),
      createdAt: s.created_at,
      completedAt: s.completed_at,
    };
  });

  app.post('/:id/cancel', async (req) => {
    const user = requireUser(req);
    const { id } = IdParams.parse(req.params);
    const s = getScan(id, user.id);
    if (!s) throw notFound('Scan');
    if (!['queued', 'processing'].includes(s.status)) throw new HttpError(409, 'not_running', 'This scan is not being processed.');
    queue.cancel(id);
    return { ok: true };
  });

  app.post('/:id/reprocess', { config: { rateLimit: { max: 20 * app.ctx.config.rateLimitScale, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req);
    const { id } = IdParams.parse(req.params);
    const s = getScan(id, user.id);
    if (!s) throw notFound('Scan');
    if (!['completed', 'failed', 'cancelled'].includes(s.status)) throw new HttpError(409, 'not_reprocessable', 'This scan cannot be reprocessed now.');
    const prev = JSON.parse(s.options_json) as Record<string, unknown>;
    const next = { ...prev, ...ScanOptionsSchema.parse(req.body ?? {}) };
    const originals = db.prepare(`SELECT COUNT(*) n FROM bill_images WHERE scan_id = ? AND kind='original'`).get(id) as { n: number };
    if (!originals.n) throw new HttpError(409, 'original_deleted', 'The original image is no longer stored, so this scan cannot be reprocessed.');
    db.prepare(`UPDATE scans SET status='queued', stage='uploaded', attempt=attempt+1, options_json=?, result_json=NULL, error_code=NULL, error_message=NULL, cancel_requested=0, updated_at=? WHERE id=?`).run(
      JSON.stringify(next), nowIso(), id,
    );
    queue.enqueue(id);
    return { ok: true, status: 'queued' };
  });

  app.delete('/:id', async (req) => {
    const user = requireUser(req);
    const { id } = IdParams.parse(req.params);
    const s = getScan(id, user.id);
    if (!s) throw notFound('Scan');
    if (s.status === 'saved') throw new HttpError(409, 'saved', 'This scan belongs to a saved bill. Delete the bill instead.');
    if (['queued', 'processing'].includes(s.status)) queue.cancel(id);
    await queue.idle().catch(() => undefined);
    db.prepare('DELETE FROM bill_images WHERE scan_id = ?').run(id);
    db.prepare('DELETE FROM scans WHERE id = ?').run(id);
    await storage.removeScanDir(user.id, id);
    return { ok: true };
  });

  app.get('/:id/images/:kind/:page', async (req, reply) => {
    const user = requireUser(req);
    const p = z.object({ id: z.string().uuid(), kind: z.enum(['original', 'corrected']), page: z.coerce.number().int().min(0).max(MAX_PAGES) }).parse(req.params);
    const img = db.prepare('SELECT rel_path, mime FROM bill_images WHERE scan_id = ? AND user_id = ? AND kind = ? AND page = ?').get(p.id, user.id, p.kind, p.page) as { rel_path: string; mime: string } | undefined;
    if (!img) throw notFound('Image');
    reply.header('Cache-Control', 'private, max-age=3600');
    reply.header('Content-Disposition', 'inline');
    return reply.type(img.mime).send(await storage.read(img.rel_path));
  });
};
