/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G22 — Expense intelligence computed ONLY from the user's saved, verified
 * bills. Amounts in different currencies are never summed together (no FX
 * conversion is performed). "Unusual" flags are a simple, documented
 * statistical rule — not a prediction.
 */
import type { DB } from '../db.ts';

export interface AnalyticsFilter {
  from?: string;
  to?: string;
  category?: string;
  currency?: string;
}

function where(userId: string, f: AnalyticsFilter): { sql: string; params: unknown[] } {
  const parts = ['user_id = ?'];
  const params: unknown[] = [userId];
  if (f.from) { parts.push('bill_date >= ?'); params.push(f.from); }
  if (f.to) { parts.push('bill_date <= ?'); params.push(f.to); }
  if (f.category) { parts.push('category = ?'); params.push(f.category); }
  if (f.currency) { parts.push('currency = ?'); params.push(f.currency); }
  return { sql: parts.join(' AND '), params };
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export function analyticsSummary(db: DB, userId: string, filter: AnalyticsFilter, budgets: Record<string, number>, today = new Date()) {
  const w = where(userId, filter);
  const currencies = db.prepare(`SELECT currency, COUNT(*) n, SUM(total_amount) total, AVG(total_amount) avg FROM bills WHERE ${w.sql} GROUP BY currency ORDER BY n DESC`).all(...w.params) as Array<{ currency: string; n: number; total: number; avg: number }>;
  const primary = filter.currency ?? currencies[0]?.currency ?? null;
  const pw = where(userId, { ...filter, currency: primary ?? undefined });
  const totalBills = (db.prepare(`SELECT COUNT(*) n FROM bills WHERE ${w.sql}`).get(...w.params) as { n: number }).n;

  const byCategory = primary ? (db.prepare(`SELECT category, COUNT(*) n, SUM(total_amount) total FROM bills WHERE ${pw.sql} GROUP BY category ORDER BY total DESC`).all(...pw.params) as Array<{ category: string; n: number; total: number }>) : [];
  const byMerchant = primary ? (db.prepare(`SELECT merchant_name merchant, COUNT(*) n, SUM(total_amount) total FROM bills WHERE ${pw.sql} GROUP BY lower(merchant_name) ORDER BY total DESC LIMIT 10`).all(...pw.params) as Array<{ merchant: string; n: number; total: number }>) : [];

  // Last 12 months series (primary currency), zero-filled so gaps are visible rather than hidden.
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(monthKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))));
  const monthlyRows = primary
    ? (db.prepare(`SELECT substr(bill_date, 1, 7) month, COUNT(*) n, SUM(total_amount) total FROM bills WHERE ${pw.sql} AND bill_date >= ? GROUP BY month`).all(...pw.params, `${months[0]}-01`) as Array<{ month: string; n: number; total: number }>)
    : [];
  const monthly = months.map((m) => {
    const r = monthlyRows.find((x) => x.month === m);
    return { month: m, total: r ? Math.round(r.total * 100) / 100 : 0, count: r?.n ?? 0 };
  });
  const thisMonth = monthly[11]!;
  const lastMonth = monthly[10]!;
  const comparison = {
    thisMonth: thisMonth.total,
    lastMonth: lastMonth.total,
    changePct: lastMonth.total > 0 ? Math.round(((thisMonth.total - lastMonth.total) / lastMonth.total) * 1000) / 10 : null,
  };

  // Unusual: bill total > mean + 3σ of the same category, with ≥ 5 prior bills in that category.
  const unusual: Array<{ id: string; merchant: string; date: string; total: number; category: string; reason: string }> = [];
  if (primary) {
    const rows = db.prepare(`SELECT id, merchant_name, bill_date, total_amount, category FROM bills WHERE ${pw.sql}`).all(...pw.params) as Array<{ id: string; merchant_name: string; bill_date: string; total_amount: number; category: string }>;
    for (const r of rows) {
      // Compare against the OTHER bills of the same category.
      const values = rows.filter((o) => o.category === r.category && o.id !== r.id).map((o) => o.total_amount);
      if (values.length < 5) continue;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      if (sd > 0 && r.total_amount > mean + 3 * sd) {
        unusual.push({ id: r.id, merchant: r.merchant_name, date: r.bill_date, total: r.total_amount, category: r.category, reason: `More than 3 standard deviations above your average ${r.category} bill (${mean.toFixed(2)}).` });
      }
    }
  }

  const monthStart = `${thisMonth.month}-01`;
  const budgetProgress = primary
    ? Object.entries(budgets).map(([category, budget]) => {
        const spent = (db.prepare(`SELECT COALESCE(SUM(total_amount),0) s FROM bills WHERE user_id = ? AND currency = ? AND category = ? AND bill_date >= ?`).get(userId, primary, category, monthStart) as { s: number }).s;
        return { category, budget, spent: Math.round(spent * 100) / 100, pct: budget > 0 ? Math.round((spent / budget) * 1000) / 10 : null };
      })
    : [];

  const recent = db.prepare(`SELECT id, merchant_name merchant, bill_date date, total_amount total, currency, category, created_at FROM bills WHERE ${w.sql} ORDER BY created_at DESC LIMIT 5`).all(...w.params);
  return {
    totalBills,
    currencies: currencies.map((c) => ({ currency: c.currency, count: c.n, total: Math.round(c.total * 100) / 100, average: Math.round(c.avg * 100) / 100 })),
    primaryCurrency: primary,
    byCategory: byCategory.map((c) => ({ category: c.category, count: c.n, total: Math.round(c.total * 100) / 100 })),
    byMerchant: byMerchant.map((m) => ({ merchant: m.merchant, count: m.n, total: Math.round(m.total * 100) / 100 })),
    monthly,
    comparison,
    unusual,
    budgets: budgetProgress,
    recent,
    note: currencies.length > 1 ? 'Bills in different currencies are reported separately; amounts are not converted.' : null,
  };
}
