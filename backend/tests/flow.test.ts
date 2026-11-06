import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { shutdownOcr } from '@billkit/ai';
import { RECEIPTS, NON_BILLS, renderPng, degrade, syntheticPhoto } from '../../ai/scripts/synthetic.ts';
import { Client, makeApp } from './helpers.ts';

/** Mirror what the review screen submits: every reviewable field, pre-filled with the AI value. */
function reviewed(result: any, over: Record<string, unknown> = {}) {
  const f = result.fields;
  return {
    merchantName: f.merchantName.value, billDate: f.billDate.value, totalAmount: f.totalAmount.value, currency: f.currency.value ?? 'INR',
    category: result.category.value ?? 'Other', subcategory: result.category.subcategory, billTime: f.billTime.value, subtotal: f.subtotal.value, tax: f.tax.value,
    discount: f.discount.value, serviceCharge: f.serviceCharge.value, tip: f.tip.value, invoiceNumber: f.invoiceNumber.value ?? f.receiptNumber.value,
    paymentMethod: f.paymentMethod.value, merchantAddress: f.merchantAddress.value, ...over,
  };
}

let app: FastifyInstance;
let dataDir: string;
const a = () => new Client(app);
let alice: Client;
let bob: Client;

beforeAll(async () => {
  ({ app, dataDir } = await makeApp());
  alice = a();
  bob = a();
  await alice.post('/api/auth/register', { name: 'Alice', email: 'alice@example.com', password: 'alice password 1' });
  await bob.post('/api/auth/register', { name: 'Bob', email: 'bob@example.com', password: 'bob password 12' });
});
afterAll(async () => {
  await app.close();
  await shutdownOcr();
});

describe('upload → process → review → correct → save → history (HR requirements 1–5)', () => {
  let scanId: string;
  let billId: string;
  let groceryPhoto: Buffer;

  it('rejects requests without a file or with an unsupported type', async () => {
    expect((await alice.upload([Buffer.from('this is not an image at all')])).statusCode).toBe(415);
    expect((await alice.req('POST', '/api/scans', {})).statusCode).toBe(415);
  });

  it('processes a bill photo through real pipeline stages', async () => {
    groceryPhoto = await degrade(await renderPng(RECEIPTS[0]!), 'photo_on_table');
    const up = await alice.upload([groceryPhoto]);
    expect(up.statusCode).toBe(202);
    scanId = up.json().id;
    const scan = await alice.waitForScan(scanId);
    expect(scan.status).toBe('completed');
    expect(scan.stage).toBe('done');
    expect(scan.result.isBill).toBe(true);
    expect(scan.result.fields.merchantName.value).toBe('GREENLEAF FRESH MART');
    expect(scan.result.fields.totalAmount.value).toBe(1275);
    expect(scan.result.category.value).toBe('Groceries');
    expect(scan.images).toEqual(expect.arrayContaining([{ kind: 'original', page: 0 }, { kind: 'corrected', page: 0 }]));
    const img = await alice.get(`/api/scans/${scanId}/images/corrected/0`);
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
  });

  it('keeps other users out of my scans and images', async () => {
    expect((await bob.get(`/api/scans/${scanId}`)).statusCode).toBe(404);
    expect((await bob.get(`/api/scans/${scanId}/images/original/0`)).statusCode).toBe(404);
  });

  it('saves the reviewed bill and records the human correction', async () => {
    const scan = (await alice.get(`/api/scans/${scanId}`)).json();
    const fields = reviewed(scan.result, { merchantName: 'Greenleaf Fresh Mart', notes: 'Weekly groceries' }); // user corrected the casing
    const res = await alice.post('/api/bills', { scanId, fields, confirmedFields: ['totalAmount'] });
    expect(res.statusCode).toBe(201);
    const bill = res.json().bill;
    billId = bill.id;
    expect(bill.provenance.merchantName).toBe('user_corrected');
    expect(bill.provenance.totalAmount).toBe('user_confirmed');
    expect(bill.provenance.billDate).toBe('ai');
    expect(bill.lineItems.length).toBeGreaterThan(0);
    const corr = app.ctx.db.prepare('SELECT field, ai_value, user_value, consent_for_improvement, review_status FROM corrections WHERE bill_id = ?').all(billId);
    expect(corr).toEqual([{ field: 'merchantName', ai_value: 'GREENLEAF FRESH MART', user_value: 'Greenleaf Fresh Mart', consent_for_improvement: 0, review_status: 'unreviewed' }]);
    expect((await alice.post('/api/bills', { scanId, fields })).statusCode).toBe(409); // already saved
  });

  it('warns about duplicates and lets the user decide', async () => {
    const up = await alice.upload([groceryPhoto]);
    const scan = await alice.waitForScan(up.json().id);
    expect(scan.duplicates[0]).toMatchObject({ id: billId, kind: 'exact_file' });
    const fields = reviewed(scan.result);
    const blocked = await alice.post('/api/bills', { scanId: scan.id, fields });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('possible_duplicate');
    const ok = await alice.post('/api/bills', { scanId: scan.id, fields, acknowledgeDuplicate: true });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().bill.duplicates.length).toBeGreaterThan(0);
    await alice.del(`/api/bills/${ok.json().bill.id}`);
  });

  it('requires acknowledging validation warnings and rejects invalid values', async () => {
    const up = await alice.upload([await renderPng(RECEIPTS[1]!)]);
    const scan = await alice.waitForScan(up.json().id);
    const f = scan.result.fields;
    const fields = reviewed(scan.result, { totalAmount: 9999 });
    const warn = await alice.post('/api/bills', { scanId: scan.id, fields });
    expect(warn.json().error.code).toBe('validation_warnings');
    expect(warn.json().error.details.issues[0].code).toBe('total_mismatch');
    const invalid = await alice.post('/api/bills', { scanId: scan.id, fields: { ...fields, billDate: '2026-02-30' }, acknowledgeWarnings: true });
    expect(invalid.statusCode).toBe(422);
    const ok = await alice.post('/api/bills', { scanId: scan.id, fields: { ...fields, totalAmount: f.totalAmount.value } });
    expect(ok.json()).toHaveProperty('bill');
  });

  it('lists, searches, filters, sorts and paginates saved bills', async () => {
    const all = (await alice.get('/api/bills')).json();
    expect(all.total).toBe(2);
    expect(all.bills[0].billDate >= all.bills[1].billDate).toBe(true);
    expect((await alice.get('/api/bills?q=greenleaf')).json().total).toBe(1);
    expect((await alice.get('/api/bills?q=%25')).json().total).toBe(0); // LIKE wildcards are escaped
    expect((await alice.get('/api/bills?category=Food')).json().bills[0].merchantName).toMatch(/SPICE/);
    expect((await alice.get('/api/bills?sort=amount&order=asc')).json().bills[0].totalAmount).toBe(1275);
    expect((await alice.get('/api/bills?from=2026-10-10&to=2026-10-31')).json().total).toBe(1);
    expect((await alice.get('/api/bills?pageSize=1&page=2')).json().bills).toHaveLength(1);
    expect((await bob.get('/api/bills')).json().total).toBe(0);
    expect((await alice.get('/api/bills?from=not-a-date')).statusCode).toBe(400);
  });

  it('shows bill details, edits with correction tracking, and exports', async () => {
    const d = (await alice.get(`/api/bills/${billId}`)).json().bill;
    expect(d.ai.fields.totalAmount.value).toBe(1275);
    expect(d.images).toEqual(expect.arrayContaining([{ kind: 'corrected', page: 0 }]));
    expect((await bob.get(`/api/bills/${billId}`)).statusCode).toBe(404);
    const edited = await alice.put(`/api/bills/${billId}`, { fields: { merchantName: d.merchantName, billDate: d.billDate, totalAmount: d.totalAmount, currency: d.currency, category: 'Shopping', notes: '=HYPERLINK("x")' } });
    expect(edited.json().bill.category).toBe('Shopping');
    expect(edited.json().bill.provenance.category).toBe('user_corrected');
    const csv = await alice.get('/api/bills/export.csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.body).toContain("'=HYPERLINK"); // formula injection neutralised
    const json = (await alice.get('/api/bills/export.json')).json();
    expect(json.bills).toHaveLength(2);
    const img = await alice.get(`/api/bills/${billId}/image/corrected/0`);
    expect(img.statusCode).toBe(200);
  });

  it('computes analytics only from saved bills', async () => {
    const s = (await alice.get('/api/analytics/summary')).json();
    expect(s.totalBills).toBe(2);
    expect(s.primaryCurrency).toBe('INR');
    expect(s.byCategory.map((c: { category: string }) => c.category).sort()).toEqual(['Food', 'Shopping']);
    expect(s.monthly).toHaveLength(12);
    expect((await bob.get('/api/analytics/summary')).json().totalBills).toBe(0);
    const corr = (await alice.get('/api/corrections/summary')).json();
    expect(corr.byField.length).toBeGreaterThan(0);
  });

  it('deletes a bill together with its images', async () => {
    const before = fs.readdirSync(path.join(dataDir, 'uploads')).length;
    expect(before).toBeGreaterThan(0);
    expect((await alice.del(`/api/bills/${billId}`)).statusCode).toBe(200);
    expect((await alice.get(`/api/bills/${billId}`)).statusCode).toBe(404);
    expect(app.ctx.db.prepare('SELECT COUNT(*) n FROM bill_images WHERE bill_id = ?').get(billId)).toEqual({ n: 0 });
  });
});

describe('non-bills (HR requirement 2)', () => {
  it('politely rejects a selfie and an ID card and refuses to save them', async () => {
    for (const img of [await syntheticPhoto(), await renderPng(NON_BILLS[0]!)]) {
      const up = await alice.upload([img]);
      const scan = await alice.waitForScan(up.json().id);
      expect(scan.result.isBill).toBe(false);
      expect(scan.result.overallReview).toBe('rejected_not_bill');
      const save = await alice.post('/api/bills', { scanId: scan.id, fields: { merchantName: 'x', billDate: '2026-01-01', totalAmount: 1, currency: 'INR', category: 'Other' } });
      expect(save.json().error.code).toBe('not_a_bill');
    }
  }, 60_000);

  it('lets the user override with explicit confirmation and reprocess', async () => {
    const up = await alice.upload([await renderPng(NON_BILLS[1]!)]);
    const first = await alice.waitForScan(up.json().id);
    expect(first.result.isBill).toBe(false);
    expect((await alice.post(`/api/scans/${first.id}/reprocess`, { userConfirmedBill: true })).statusCode).toBe(200);
    const second = await alice.waitForScan(first.id);
    expect(second.attempt).toBe(2);
    expect(second.result.isBill).toBe(true);
    expect((await alice.del(`/api/scans/${first.id}`)).statusCode).toBe(200);
    expect((await alice.get(`/api/scans/${first.id}`)).statusCode).toBe(404);
  }, 60_000);
});

describe('categories, contact, admin', () => {
  it('manages custom categories', async () => {
    const c = await alice.post('/api/categories', { name: 'Pets' });
    expect(c.statusCode).toBe(201);
    expect((await alice.post('/api/categories', { name: 'Food' })).statusCode).toBe(409);
    expect((await alice.post('/api/categories', { name: '<script>' })).statusCode).toBe(400);
    const list = (await alice.get('/api/categories')).json().categories;
    expect(list.find((x: { name: string }) => x.name === 'Pets').builtIn).toBe(false);
    expect((await alice.del(`/api/categories/${c.json().category.id}`)).json().ok).toBe(true);
  });

  it('accepts contact messages honestly and blocks obvious bots', async () => {
    const anon = a();
    const msg = { name: 'Visitor', email: 'v@example.com', subject: 'Hello there', message: 'I have a question about BillKit.', elapsedMs: 8000 };
    const ok = await anon.post('/api/contact', msg);
    expect(ok.statusCode).toBe(201);
    expect(ok.json().delivery).toBe('stored'); // email not configured → stored only, never a fake "sent"
    expect((await anon.post('/api/contact', { ...msg, website: 'http://spam' })).statusCode).toBe(400);
    expect((await anon.post('/api/contact', { ...msg, elapsedMs: 100 })).statusCode).toBe(400);
  });

  it('restricts admin metrics to admins and returns no bill content', async () => {
    expect((await alice.get('/api/admin/metrics')).statusCode).toBe(403);
    app.ctx.db.prepare(`UPDATE users SET role = 'admin' WHERE email = 'alice@example.com'`).run();
    const m = await alice.get('/api/admin/metrics');
    expect(m.statusCode).toBe(200);
    const body = JSON.stringify(m.json());
    expect(m.json().outcomes.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/GREENLEAF|SPICE|1275/);
  });
});
