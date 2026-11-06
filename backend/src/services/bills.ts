/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G13 — Saving reviewed bills: server-side re-validation of the APPROVED
 * values, duplicate warnings (G21), per-field provenance and correction
 * tracking (G23). A user's value always wins over the AI value; nothing here
 * ever replaces a correction with an AI result.
 */
import crypto from 'node:crypto';
import { findDuplicates, validateBill, type DuplicateMatch } from '@billkit/ai';
import { amountsEqual, type ExtractionResult, type ReviewedFields, type UserSettings } from '@billkit/shared';
import type { DB } from '../db.ts';
import { nowIso } from '../db.ts';
import { HttpError } from '../errors.ts';

export type Provenance = 'ai' | 'user_confirmed' | 'user_corrected' | 'user_entered' | 'user_removed';

const FIELD_MAP: Array<{ reviewed: keyof ReviewedFields; ai: (r: ExtractionResult) => unknown; kind: 'number' | 'string' }> = [
  { reviewed: 'merchantName', ai: (r) => r.fields.merchantName.value, kind: 'string' },
  { reviewed: 'billDate', ai: (r) => r.fields.billDate.value, kind: 'string' },
  { reviewed: 'totalAmount', ai: (r) => r.fields.totalAmount.value, kind: 'number' },
  { reviewed: 'currency', ai: (r) => r.fields.currency.value, kind: 'string' },
  { reviewed: 'category', ai: (r) => r.category.value, kind: 'string' },
  { reviewed: 'subcategory', ai: (r) => r.category.subcategory, kind: 'string' },
  { reviewed: 'billTime', ai: (r) => r.fields.billTime.value, kind: 'string' },
  { reviewed: 'subtotal', ai: (r) => r.fields.subtotal.value, kind: 'number' },
  { reviewed: 'tax', ai: (r) => r.fields.tax.value, kind: 'number' },
  { reviewed: 'discount', ai: (r) => r.fields.discount.value, kind: 'number' },
  { reviewed: 'serviceCharge', ai: (r) => r.fields.serviceCharge.value, kind: 'number' },
  { reviewed: 'tip', ai: (r) => r.fields.tip.value, kind: 'number' },
  { reviewed: 'invoiceNumber', ai: (r) => r.fields.invoiceNumber.value ?? r.fields.receiptNumber.value, kind: 'string' },
  { reviewed: 'paymentMethod', ai: (r) => r.fields.paymentMethod.value, kind: 'string' },
  { reviewed: 'merchantAddress', ai: (r) => r.fields.merchantAddress.value, kind: 'string' },
];

function aiMeta(r: ExtractionResult, key: keyof ReviewedFields): { confidence: number | null; review: string | null; source: string | null } {
  if (key === 'category' || key === 'subcategory') return { confidence: r.category.confidence, review: r.category.review, source: r.category.source };
  const f = (r.fields as unknown as Record<string, { confidence: number | null; review: string; source: string }>)[key === 'invoiceNumber' ? 'invoiceNumber' : key];
  return f ? { confidence: f.confidence, review: f.review, source: f.source } : { confidence: null, review: null, source: null };
}

function sameValue(kind: 'number' | 'string', a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '';
  if (b === null || b === undefined || b === '') return false;
  if (kind === 'number') return amountsEqual(Number(a), Number(b));
  return String(a).trim() === String(b).trim();
}

export function diffAgainstAi(result: ExtractionResult | null, fields: ReviewedFields, confirmed: string[]): { provenance: Record<string, Provenance>; changes: Array<{ field: string; ai: unknown; user: unknown }> } {
  const provenance: Record<string, Provenance> = {};
  const changes: Array<{ field: string; ai: unknown; user: unknown }> = [];
  for (const m of FIELD_MAP) {
    const user = fields[m.reviewed];
    const ai = result ? m.ai(result) : null;
    if (sameValue(m.kind, ai, user)) {
      if (ai === null || ai === undefined) continue;
      provenance[m.reviewed] = confirmed.includes(m.reviewed) ? 'user_confirmed' : 'ai';
    } else if (ai === null || ai === undefined || ai === '') {
      provenance[m.reviewed] = 'user_entered';
      changes.push({ field: m.reviewed, ai: null, user });
    } else if (user === null || user === undefined || user === '') {
      provenance[m.reviewed] = 'user_removed';
      changes.push({ field: m.reviewed, ai, user: null });
    } else {
      provenance[m.reviewed] = 'user_corrected';
      changes.push({ field: m.reviewed, ai, user });
    }
  }
  return { provenance, changes };
}

export interface BillRow {
  id: string;
  user_id: string;
  scan_id: string | null;
  merchant_name: string;
  bill_date: string;
  bill_time: string | null;
  total_amount: number;
  currency: string;
  category: string;
  subcategory: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  service_charge: number | null;
  tip: number | null;
  invoice_number: string | null;
  payment_method: string | null;
  merchant_address: string | null;
  notes: string | null;
  document_class: string | null;
  review_status: string;
  validation_json: string;
  provenance_json: string;
  ai_snapshot_json: string | null;
  duplicate_json: string | null;
  file_sha256: string | null;
  perceptual_hash: string | null;
  created_at: string;
  updated_at: string;
}

export function duplicateCandidates(db: DB, userId: string, subject: { id?: string; fileSha256?: string | null; perceptualHash?: string | null; merchantName?: string | null; billDate?: string | null; totalAmount?: number | null; invoiceNumber?: string | null }): Array<DuplicateMatch & { merchantName: string; billDate: string; totalAmount: number; currency: string }> {
  const rows = db
    .prepare('SELECT id, merchant_name, bill_date, total_amount, currency, invoice_number, file_sha256, perceptual_hash FROM bills WHERE user_id = ?')
    .all(userId) as Array<Pick<BillRow, 'id' | 'merchant_name' | 'bill_date' | 'total_amount' | 'currency' | 'invoice_number' | 'file_sha256' | 'perceptual_hash'>>;
  const matches = findDuplicates(
    subject,
    rows.map((r) => ({ id: r.id, merchantName: r.merchant_name, billDate: r.bill_date, totalAmount: r.total_amount, invoiceNumber: r.invoice_number, fileSha256: r.file_sha256, perceptualHash: r.perceptual_hash })),
  );
  return matches.map((m) => {
    const r = rows.find((x) => x.id === m.id)!;
    return { ...m, merchantName: r.merchant_name, billDate: r.bill_date, totalAmount: r.total_amount, currency: r.currency };
  });
}

export function serializeBill(db: DB, row: BillRow) {
  const items = db.prepare('SELECT description, quantity, unit_price, line_total FROM line_items WHERE bill_id = ? ORDER BY position').all(row.id) as Array<{
    description: string; quantity: number | null; unit_price: number | null; line_total: number | null;
  }>;
  const images = db.prepare('SELECT kind, page FROM bill_images WHERE bill_id = ? ORDER BY kind, page').all(row.id) as Array<{ kind: string; page: number }>;
  const snapshot = row.ai_snapshot_json ? (JSON.parse(row.ai_snapshot_json) as ExtractionResult) : null;
  return {
    id: row.id,
    scanId: row.scan_id,
    merchantName: row.merchant_name,
    billDate: row.bill_date,
    billTime: row.bill_time,
    totalAmount: row.total_amount,
    currency: row.currency,
    category: row.category,
    subcategory: row.subcategory,
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    serviceCharge: row.service_charge,
    tip: row.tip,
    invoiceNumber: row.invoice_number,
    paymentMethod: row.payment_method,
    merchantAddress: row.merchant_address,
    notes: row.notes,
    documentClass: row.document_class,
    reviewStatus: row.review_status,
    validation: JSON.parse(row.validation_json || '{}'),
    provenance: JSON.parse(row.provenance_json || '{}') as Record<string, Provenance>,
    duplicates: row.duplicate_json ? JSON.parse(row.duplicate_json) : [],
    lineItems: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total })),
    images,
    ai: snapshot
      ? {
          fields: snapshot.fields,
          category: snapshot.category,
          classification: snapshot.classification,
          quality: snapshot.quality,
          meta: snapshot.meta,
          validation: snapshot.validation,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SaveInput {
  userId: string;
  settings: UserSettings;
  scanId: string;
  fields: ReviewedFields;
  confirmedFields: string[];
  acknowledgeWarnings: boolean;
  acknowledgeDuplicate: boolean;
}

export function saveReviewedBill(db: DB, input: SaveInput): { billId: string; removedOriginals: string[] } {
  const scan = db.prepare('SELECT id, status, result_json, options_json FROM scans WHERE id = ? AND user_id = ?').get(input.scanId, input.userId) as
    | { id: string; status: string; result_json: string | null; options_json: string }
    | undefined;
  if (!scan) throw new HttpError(404, 'not_found', 'Scan not found.');
  if (scan.status === 'saved') throw new HttpError(409, 'already_saved', 'This bill has already been saved.');
  if (scan.status !== 'completed') throw new HttpError(409, 'not_ready', 'This scan has not finished processing.');
  const result = scan.result_json ? (JSON.parse(scan.result_json) as ExtractionResult) : null;
  if (result && !result.isBill) {
    throw new HttpError(409, 'not_a_bill', 'This image was identified as not being a bill. Confirm it is a bill and reprocess before saving.');
  }

  const f = input.fields;
  const { report } = validateBill({
    merchantName: f.merchantName, billDate: f.billDate, currency: f.currency, totalAmount: f.totalAmount, subtotal: f.subtotal, tax: f.tax,
    discount: f.discount, serviceCharge: f.serviceCharge, tip: f.tip, roundOff: result?.fields.roundOff.value ?? null,
  });
  if (report.status === 'failed') throw new HttpError(422, 'validation_failed', 'Some values are invalid. Fix them before saving.', { issues: report.issues });
  const warnings = report.issues.filter((i) => i.severity === 'warning');
  if (warnings.length && !input.acknowledgeWarnings) throw new HttpError(409, 'validation_warnings', 'Please review the validation warnings before saving.', { issues: warnings });

  const originals = db.prepare(`SELECT id, rel_path, sha256 FROM bill_images WHERE scan_id = ? AND kind='original' ORDER BY page`).all(scan.id) as Array<{ id: string; rel_path: string; sha256: string | null }>;
  const corrected = db.prepare(`SELECT perceptual_hash FROM bill_images WHERE scan_id = ? AND kind='corrected' AND page = 0`).get(scan.id) as { perceptual_hash: string | null } | undefined;
  const fileSha = originals[0]?.sha256 ?? null;
  const dups = duplicateCandidates(db, input.userId, {
    fileSha256: fileSha, perceptualHash: corrected?.perceptual_hash ?? null, merchantName: f.merchantName, billDate: f.billDate, totalAmount: f.totalAmount, invoiceNumber: f.invoiceNumber,
  });
  if (dups.length && !input.acknowledgeDuplicate) throw new HttpError(409, 'possible_duplicate', 'This bill may already be saved.', { duplicates: dups });

  const { provenance, changes } = diffAgainstAi(result, f, input.confirmedFields);
  const billId = crypto.randomUUID();
  const now = nowIso();
  const removedOriginals: string[] = [];
  db.transaction(() => {
    db.prepare(
      `INSERT INTO bills (id, user_id, scan_id, merchant_name, bill_date, bill_time, total_amount, currency, category, subcategory, subtotal, tax, discount, service_charge, tip,
        invoice_number, payment_method, merchant_address, notes, document_class, review_status, validation_json, provenance_json, ai_snapshot_json, duplicate_json, file_sha256, perceptual_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      billId, input.userId, scan.id, f.merchantName, f.billDate, f.billTime, f.totalAmount, f.currency, f.category, f.subcategory, f.subtotal, f.tax, f.discount,
      f.serviceCharge, f.tip, f.invoiceNumber, f.paymentMethod, f.merchantAddress, f.notes, result?.classification.documentClass ?? null,
      JSON.stringify(report), JSON.stringify(provenance), scan.result_json, dups.length ? JSON.stringify(dups) : null, fileSha, corrected?.perceptual_hash ?? null, now, now,
    );
    (result?.lineItems ?? []).forEach((li, i) => {
      db.prepare('INSERT INTO line_items (id, bill_id, position, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(), billId, i, li.description, li.quantity, li.unitPrice, li.lineTotal,
      );
    });
    const ins = db.prepare(
      `INSERT INTO corrections (id, user_id, bill_id, scan_id, field, ai_value, user_value, ai_confidence, ai_review_state, ai_source, phase, pipeline_version, model_version, prompt_version, consent_for_improvement, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?, ?, ?, ?, ?)`,
    );
    for (const c of changes) {
      const meta = result ? aiMeta(result, c.field as keyof ReviewedFields) : { confidence: null, review: null, source: null };
      ins.run(
        crypto.randomUUID(), input.userId, billId, scan.id, c.field, c.ai === null ? null : String(c.ai), c.user === null ? null : String(c.user), meta.confidence, meta.review,
        meta.source, result?.meta.pipelineVersion ?? null, result?.meta.vlm?.model ?? null, result?.meta.vlm?.promptVersion ?? null, input.settings.allowCorrectionsForImprovement ? 1 : 0, now,
      );
    }
    db.prepare(`UPDATE bill_images SET bill_id = ? WHERE scan_id = ?`).run(billId, scan.id);
    db.prepare(`UPDATE scans SET status='saved', bill_id=?, updated_at=? WHERE id=?`).run(billId, now, scan.id);
    if (!input.settings.keepOriginalImages) {
      for (const o of originals) {
        db.prepare('DELETE FROM bill_images WHERE id = ?').run(o.id);
        removedOriginals.push(o.rel_path);
      }
    }
  })();
  return { billId, removedOriginals };
}

export function updateBill(db: DB, userId: string, billId: string, fields: ReviewedFields, settings: UserSettings): void {
  const row = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(billId, userId) as BillRow | undefined;
  if (!row) throw new HttpError(404, 'not_found', 'Bill not found.');
  const { report } = validateBill({ merchantName: fields.merchantName, billDate: fields.billDate, currency: fields.currency, totalAmount: fields.totalAmount, subtotal: fields.subtotal, tax: fields.tax, discount: fields.discount, serviceCharge: fields.serviceCharge, tip: fields.tip });
  if (report.status === 'failed') throw new HttpError(422, 'validation_failed', 'Some values are invalid. Fix them before saving.', { issues: report.issues });
  const before: Record<string, unknown> = {
    merchantName: row.merchant_name, billDate: row.bill_date, totalAmount: row.total_amount, currency: row.currency, category: row.category, subcategory: row.subcategory,
    billTime: row.bill_time, subtotal: row.subtotal, tax: row.tax, discount: row.discount, serviceCharge: row.service_charge, tip: row.tip, invoiceNumber: row.invoice_number,
    paymentMethod: row.payment_method, merchantAddress: row.merchant_address, notes: row.notes,
  };
  const provenance = JSON.parse(row.provenance_json || '{}') as Record<string, Provenance>;
  const now = nowIso();
  db.transaction(() => {
    for (const [k, v] of Object.entries(fields)) {
      const kind = typeof v === 'number' || typeof before[k] === 'number' ? 'number' : 'string';
      if (sameValue(kind, before[k], v)) continue;
      provenance[k] = 'user_corrected';
      db.prepare(
        `INSERT INTO corrections (id, user_id, bill_id, scan_id, field, ai_value, user_value, phase, consent_for_improvement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'post_save_edit', ?, ?)`,
      ).run(crypto.randomUUID(), userId, billId, row.scan_id, k, before[k] == null ? null : String(before[k]), v == null ? null : String(v), settings.allowCorrectionsForImprovement ? 1 : 0, now);
    }
    db.prepare(
      `UPDATE bills SET merchant_name=?, bill_date=?, bill_time=?, total_amount=?, currency=?, category=?, subcategory=?, subtotal=?, tax=?, discount=?, service_charge=?, tip=?,
        invoice_number=?, payment_method=?, merchant_address=?, notes=?, validation_json=?, provenance_json=?, updated_at=? WHERE id=? AND user_id=?`,
    ).run(
      fields.merchantName, fields.billDate, fields.billTime, fields.totalAmount, fields.currency, fields.category, fields.subcategory, fields.subtotal, fields.tax, fields.discount,
      fields.serviceCharge, fields.tip, fields.invoiceNumber, fields.paymentMethod, fields.merchantAddress, fields.notes, JSON.stringify(report), JSON.stringify(provenance), now, billId, userId,
    );
  })();
}
