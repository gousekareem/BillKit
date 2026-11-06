/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Verified bills: save (from review), list/search/filter/sort, detail, edit,
 * delete, image, CSV/JSON export.
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SaveBillSchema, UpdateBillSchema, UserSettingsSchema } from '@billkit/shared';
import { requireUser } from '../app.ts';
import { notFound } from '../errors.ts';
import { saveReviewedBill, serializeBill, updateBill, type BillRow } from '../services/bills.ts';

const ListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(60).optional(),
  merchant: z.string().max(200).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(['date', 'amount', 'merchant', 'created']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const SORT_COLUMNS = { date: 'bill_date', amount: 'total_amount', merchant: 'merchant_name COLLATE NOCASE', created: 'created_at' } as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const billRoutes: FastifyPluginAsync = async (app) => {
  const { db, storage } = app.ctx;
  const settingsOf = (json: string) => UserSettingsSchema.parse(JSON.parse(json || '{}'));

  app.post('/', async (req, reply) => {
    const user = requireUser(req);
    const body = SaveBillSchema.parse(req.body);
    const { billId, removedOriginals } = saveReviewedBill(db, {
      userId: user.id, settings: settingsOf(user.settings_json), scanId: body.scanId, fields: body.fields, confirmedFields: body.confirmedFields,
      acknowledgeWarnings: body.acknowledgeWarnings, acknowledgeDuplicate: body.acknowledgeDuplicate,
    });
    for (const rel of removedOriginals) await storage.remove(rel);
    const row = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as BillRow;
    return reply.status(201).send({ bill: serializeBill(db, row) });
  });

  const buildWhere = (userId: string, q: z.infer<typeof ListQuery>) => {
    const parts = ['user_id = ?'];
    const params: unknown[] = [userId];
    if (q.q) {
      parts.push(`(merchant_name LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR IFNULL(invoice_number,'') LIKE ? ESCAPE '\\' OR IFNULL(notes,'') LIKE ? ESCAPE '\\')`);
      const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like, like, like);
    }
    if (q.category) { parts.push('category = ?'); params.push(q.category); }
    if (q.merchant) { parts.push('merchant_name = ? COLLATE NOCASE'); params.push(q.merchant); }
    if (q.currency) { parts.push('currency = ?'); params.push(q.currency); }
    if (q.from) { parts.push('bill_date >= ?'); params.push(q.from); }
    if (q.to) { parts.push('bill_date <= ?'); params.push(q.to); }
    return { sql: parts.join(' AND '), params };
  };

  app.get('/', async (req) => {
    const user = requireUser(req);
    const q = ListQuery.parse(req.query);
    const w = buildWhere(user.id, q);
    const total = (db.prepare(`SELECT COUNT(*) n FROM bills WHERE ${w.sql}`).get(...w.params) as { n: number }).n;
    const rows = db
      .prepare(`SELECT b.*, (SELECT COUNT(*) FROM bill_images i WHERE i.bill_id = b.id AND i.kind='corrected') has_image FROM bills b WHERE ${w.sql} ORDER BY ${SORT_COLUMNS[q.sort]} ${q.order === 'asc' ? 'ASC' : 'DESC'}, created_at DESC LIMIT ? OFFSET ?`)
      .all(...w.params, q.pageSize, (q.page - 1) * q.pageSize) as Array<BillRow & { has_image: number }>;
    const merchants = db.prepare('SELECT DISTINCT merchant_name m FROM bills WHERE user_id = ? ORDER BY m COLLATE NOCASE LIMIT 200').all(user.id) as Array<{ m: string }>;
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      merchants: merchants.map((m) => m.m),
      bills: rows.map((r) => ({
        id: r.id, merchantName: r.merchant_name, billDate: r.bill_date, totalAmount: r.total_amount, currency: r.currency, category: r.category, subcategory: r.subcategory,
        reviewStatus: r.review_status, hasImage: r.has_image > 0, hasDuplicateWarning: Boolean(r.duplicate_json),
        corrected: Object.values(JSON.parse(r.provenance_json || '{}')).some((p) => p === 'user_corrected'), createdAt: r.created_at,
      })),
    };
  });

  const exportRows = (userId: string, query: unknown) => {
    const q = ListQuery.parse({ ...(query as object), page: 1, pageSize: 100 });
    const w = buildWhere(userId, q);
    return db.prepare(`SELECT * FROM bills WHERE ${w.sql} ORDER BY bill_date DESC`).all(...w.params) as BillRow[];
  };

  app.get('/export.csv', async (req, reply) => {
    const user = requireUser(req);
    const rows = exportRows(user.id, req.query);
    const header = ['id', 'bill_date', 'bill_time', 'merchant_name', 'category', 'subcategory', 'total_amount', 'currency', 'subtotal', 'tax', 'discount', 'service_charge', 'tip', 'invoice_number', 'payment_method', 'notes', 'created_at'];
    const lines = [header.join(','), ...rows.map((r) => header.map((h) => csvCell((r as unknown as Record<string, unknown>)[h])).join(','))];
    reply.header('Content-Disposition', `attachment; filename="billkit-bills-${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.type('text/csv; charset=utf-8').send(`\uFEFF${lines.join('\r\n')}\r\n`);
  });

  app.get('/export.json', async (req, reply) => {
    const user = requireUser(req);
    const rows = exportRows(user.id, req.query);
    reply.header('Content-Disposition', `attachment; filename="billkit-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return {
      format: 'billkit-export/1',
      exportedAt: new Date().toISOString(),
      note: 'Bill images are not included in this export.',
      bills: rows.map((r) => {
        const s = serializeBill(db, r);
        return { ...s, ai: undefined };
      }),
    };
  });

  app.get('/:id', async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(id, user.id) as BillRow | undefined;
    if (!row) throw notFound('Bill');
    return { bill: serializeBill(db, row) };
  });

  app.put('/:id', async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = UpdateBillSchema.parse(req.body);
    updateBill(db, user.id, id, body.fields, settingsOf(user.settings_json));
    const row = db.prepare('SELECT * FROM bills WHERE id = ?').get(id) as BillRow;
    return { bill: serializeBill(db, row) };
  });

  app.delete('/:id', async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = db.prepare('SELECT id, scan_id FROM bills WHERE id = ? AND user_id = ?').get(id, user.id) as { id: string; scan_id: string | null } | undefined;
    if (!row) throw notFound('Bill');
    const images = db.prepare('SELECT rel_path FROM bill_images WHERE bill_id = ? OR scan_id = ?').all(id, row.scan_id) as Array<{ rel_path: string }>;
    db.transaction(() => {
      db.prepare('DELETE FROM bill_images WHERE bill_id = ? OR scan_id = ?').run(id, row.scan_id);
      db.prepare('DELETE FROM bills WHERE id = ?').run(id);
      if (row.scan_id) db.prepare('DELETE FROM scans WHERE id = ?').run(row.scan_id);
    })();
    for (const i of images) await storage.remove(i.rel_path);
    if (row.scan_id) await storage.removeScanDir(user.id, row.scan_id);
    return { ok: true };
  });

  app.get('/:id/image/:kind/:page', async (req, reply) => {
    const user = requireUser(req);
    const p = z.object({ id: z.string().uuid(), kind: z.enum(['original', 'corrected']), page: z.coerce.number().int().min(0).max(10) }).parse(req.params);
    const img = db.prepare('SELECT rel_path, mime FROM bill_images WHERE bill_id = ? AND user_id = ? AND kind = ? AND page = ?').get(p.id, user.id, p.kind, p.page) as { rel_path: string; mime: string } | undefined;
    if (!img) throw notFound('Image');
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.type(img.mime).send(await storage.read(img.rel_path));
  });
};
