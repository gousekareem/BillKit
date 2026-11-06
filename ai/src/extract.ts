/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G7 — Structured extraction from OCR rows (rule-based, evidence-preserving).
 *
 * Principles:
 *  - Every value carries the OCR row it came from (text, page, bbox).
 *  - Values are never invented: when nothing qualifies, the field is missing.
 *  - Total, subtotal, tax, discount, amount paid and balance due are kept
 *    strictly separate by label; an unlabelled "largest number" is only used
 *    as a weak, clearly marked inference for the total.
 */
import type { BBox, DateOrder, Evidence, LineItem } from '@billkit/shared';
import { amountsEqual, detectCurrency, findDateCandidates, parseTime, round2 } from '@billkit/shared';
import type { LayoutAnalysis, Row } from './layout.ts';
import { KNOWN_MERCHANTS } from './lexicon.ts';

export const EXTRACTOR_VERSION = 'billkit-rules-v1';

export interface RawField<T> {
  value: T | null;
  status: 'extracted' | 'inferred' | 'ambiguous' | 'missing';
  ruleScore: number | null;
  ocrConfidence: number | null;
  evidence: Evidence | null;
  alternatives: Array<{ value: T; evidence: string | null }>;
  note: string | null;
}

export interface RawExtraction {
  merchantName: RawField<string>;
  merchantAddress: RawField<string>;
  merchantPhone: RawField<string>;
  taxId: RawField<string>;
  billDate: RawField<string>;
  billTime: RawField<string>;
  dueDate: RawField<string>;
  currency: RawField<string>;
  totalAmount: RawField<number>;
  subtotal: RawField<number>;
  tax: RawField<number>;
  discount: RawField<number>;
  serviceCharge: RawField<number>;
  tip: RawField<number>;
  roundOff: RawField<number>;
  amountPaid: RawField<number>;
  balanceDue: RawField<number>;
  invoiceNumber: RawField<string>;
  receiptNumber: RawField<string>;
  paymentMethod: RawField<string>;
  transactionReference: RawField<string>;
  lineItems: LineItem[];
}

export function missing<T>(note: string | null = null): RawField<T> {
  return { value: null, status: 'missing', ruleScore: null, ocrConfidence: null, evidence: null, alternatives: [], note };
}

function evidenceOf(row: Row, text?: string): Evidence {
  return { text: (text ?? row.text).slice(0, 500), page: row.page, bbox: row.nbbox as BBox, lineIndex: row.index };
}

function found<T>(value: T, row: Row, ruleScore: number, status: RawField<T>['status'] = 'extracted', ocrConfidence?: number): RawField<T> {
  return { value, status, ruleScore, ocrConfidence: ocrConfidence ?? row.confidence, evidence: evidenceOf(row), alternatives: [], note: null };
}

/* ------------------------------------------------------------------ */
/* Amount fields                                                       */
/* ------------------------------------------------------------------ */

interface AmountRule {
  re: RegExp;
  score: number;
  exclude?: RegExp;
}

const TOTAL_RULES: AmountRule[] = [
  { re: /\bgrand\s?-?total\b/i, score: 0.95 },
  {
    re: /\b(net\s?(amount|amt|payable|total|bill)|amount\s?payable|total\s?payable|total\s?amount|bill\s?amount|total\s?due|invoice\s?total|total\s?(inr|rs\.?|₹)|amount\s?due|payable\s?amount|total\s?bill)\b/i,
    score: 0.9,
    exclude: /\b(sub|before|taxable|savings|saved|discount|qty|items?|tax\s?amount)\b/i,
  },
  { re: /\btotal\b/i, score: 0.8, exclude: /\b(sub\s?-?total|total\s?(qty|quantity|items?|savings?|discount|tax|gst|cgst|sgst|vat|weight)|before|taxable)\b/i },
];
const SUBTOTAL_RULES: AmountRule[] = [
  { re: /\bsub\s?-?total\b/i, score: 0.9 },
  { re: /\b(total\s?before\s?tax|taxable\s?(amount|value)|gross\s?(amount|total)|amount\s?before\s?tax)\b/i, score: 0.8 },
];
const TAX_TOTAL_RULES: AmountRule[] = [{ re: /\b(total\s?(tax|gst|vat)|tax\s?(total|amount)|gst\s?(total|amount))\b/i, score: 0.9 }];
const TAX_PART = /\b(c\.?gst|s\.?gst|u\.?t\.?gst|i\.?gst|vat|cess|service\s?tax|sales\s?tax|tax)\b/i;
const DISCOUNT_RULES: AmountRule[] = [{ re: /\b(discount|disc\.?|savings|you\s?saved|coupon|promo|offer|less)\b/i, score: 0.85, exclude: /\bbefore\s?discount\b/i }];
const SERVICE_RULES: AmountRule[] = [{ re: /\b(service\s?charge|svc\s?chg|s\.\s?c\.)\b/i, score: 0.9 }];
const TIP_RULES: AmountRule[] = [{ re: /\b(tip|gratuity)\b/i, score: 0.9 }];
const ROUND_RULES: AmountRule[] = [{ re: /\b(round(ing|ed)?\s?(off|adj(ustment)?)?|r\/o)\b/i, score: 0.9 }];
const PAID_RULES: AmountRule[] = [
  { re: /\b(amount\s?paid|amount\s?received|paid\s?amount|tendered|cash\s?(received|tendered|paid)|received)\b/i, score: 0.85 },
  { re: /^\s*(cash|card|upi|paid|visa|master\s?card|rupay|g\s?pay|phonepe|paytm)\b/i, score: 0.7, exclude: /\b(change|balance|back)\b/i },
];
const BALANCE_RULES: AmountRule[] = [{ re: /\b(balance\s?(due|payable|amount)?|outstanding)\b/i, score: 0.85, exclude: /\bopening\b/i }];

/** Pick the amount for a labelled row: rightmost money token; if none, the next row when it is mostly a number. */
function amountForRow(rows: Row[], row: Row, label: RegExp): { value: number; row: Row; text: string } | null {
  const after = row.text.slice((label.exec(row.text)?.index ?? 0));
  const candidates = row.amounts.filter((a) => after.includes(a.raw) || row.amounts.length === 1);
  const pick = candidates[candidates.length - 1] ?? row.amounts[row.amounts.length - 1];
  if (pick) return { value: pick.value, row, text: row.text };
  const next = rows[row.index + 1];
  if (next && next.page === row.page && next.amounts.length && next.text.replace(/[\d.,₹$€£\s-]/g, '').length <= 4) {
    const a = next.amounts[next.amounts.length - 1]!;
    return { value: a.value, row: next, text: `${row.text} ${next.text}` };
  }
  return null;
}

function bestAmount(layout: LayoutAnalysis, rules: AmountRule[], opts: { region?: Array<Row['region']>; preferLast?: boolean } = {}): RawField<number> {
  const hits: Array<{ value: number; score: number; row: Row; text: string }> = [];
  for (const row of layout.rows) {
    if (opts.region && !opts.region.includes(row.region) && row.region !== 'body') continue;
    for (const rule of rules) {
      const m = rule.re.exec(row.text);
      if (!m) continue;
      if (rule.exclude?.test(row.text)) continue;
      const amt = amountForRow(layout.rows, row, rule.re);
      if (!amt) continue;
      hits.push({ value: amt.value, score: rule.score, row: amt.row, text: amt.text });
      break;
    }
  }
  if (!hits.length) return missing();
  hits.sort((a, b) => b.score - a.score || (opts.preferLast ? b.row.index - a.row.index : a.row.index - b.row.index));
  const best = hits[0]!;
  const field = found(best.value, best.row, best.score);
  field.evidence = evidenceOf(best.row, best.text);
  field.alternatives = hits
    .slice(1)
    .filter((h) => !amountsEqual(h.value, best.value))
    .slice(0, 3)
    .map((h) => ({ value: h.value, evidence: h.text }));
  const conflicting = hits.filter((h) => h.score === best.score && !amountsEqual(h.value, best.value));
  if (conflicting.length) {
    field.status = 'ambiguous';
    field.note = `Several lines carry the same label with different amounts (${[best, ...conflicting].map((h) => h.value).join(', ')}).`;
  }
  return field;
}

function extractTax(layout: LayoutAnalysis): RawField<number> {
  const total = bestAmount(layout, TAX_TOTAL_RULES, { region: ['totals', 'footer'] });
  if (total.value !== null) return total;
  // Sum individual tax components (CGST + SGST, IGST, VAT, cess) that appear in the totals area.
  const parts: Array<{ value: number; row: Row }> = [];
  for (const row of layout.rows) {
    if (row.region === 'header') continue;
    if (!TAX_PART.test(row.text) || /\b(gstin|incl(usive|uding)?|taxable|tax\s?invoice|before|excl)\b/i.test(row.text)) continue;
    if (/\btotal\b/i.test(row.text) && !/\btotal\s?(tax|gst)\b/i.test(row.text)) continue;
    const amt = row.amounts[row.amounts.length - 1];
    if (!amt || amt.value <= 0) continue;
    parts.push({ value: amt.value, row });
  }
  if (!parts.length) {
    const inclusive = layout.rows.find((r) => /\b(incl(usive|uding)?\.?\s?(of)?\s?(all)?\s?(taxes|gst|vat))\b/i.test(r.text));
    return inclusive ? { ...missing<number>('Bill states that taxes are included in the prices.'), evidence: evidenceOf(inclusive) } : missing();
  }
  const sum = round2(parts.reduce((s, p) => s + p.value, 0));
  const first = parts[0]!.row;
  return {
    value: sum,
    status: parts.length > 1 ? 'extracted' : 'extracted',
    ruleScore: parts.length > 1 ? 0.8 : 0.75,
    ocrConfidence: parts.reduce((s, p) => s + p.row.confidence, 0) / parts.length,
    evidence: { text: parts.map((p) => p.row.text).join(' | ').slice(0, 500), page: first.page, bbox: first.nbbox, lineIndex: first.index },
    alternatives: [],
    note: parts.length > 1 ? `Sum of ${parts.length} tax lines.` : null,
  };
}

function extractTotal(layout: LayoutAnalysis): RawField<number> {
  const labelled = bestAmount(layout, TOTAL_RULES, { region: ['totals', 'footer', 'items'], preferLast: true });
  if (labelled.value !== null) return labelled;
  // Weak inference: largest positive amount in the lower half (never in the header).
  const lower = layout.rows.filter((r) => r.yNorm > 0.4 && r.region !== 'header');
  let best: { value: number; row: Row } | null = null;
  for (const r of lower) for (const a of r.amounts) if (a.value > 0 && (!best || a.value > best.value)) best = { value: a.value, row: r };
  if (!best) return missing('No line labelled as a total was found.');
  const f = found(best.value, best.row, 0.4, 'inferred');
  f.note = 'No “Total” label was found; this is the largest amount in the lower part of the bill. Please verify.';
  return f;
}

/* ------------------------------------------------------------------ */
/* Text fields                                                         */
/* ------------------------------------------------------------------ */

const MERCHANT_NOISE =
  /\b(tax\s?invoice|invoice|receipt|bill\s?of\s?supply|cash\s?memo|retail\s?invoice|welcome|original|duplicate|copy|customer|gstin?|fssai|cin|pan|tin|ph(one)?|tel|mob(ile)?|e-?mail|www\.|http|date|time|table|order|token|kot|bill\s?no|cashier|counter|thank)\b/i;
const ADDRESS_HINT =
  /\b(road|rd\.?|street|st\.?|lane|nagar|colony|layout|sector|block|floor|plot|near|opp\.?|main|cross|marg|bazaar|market|complex|mall|tower|building|bldg|chowk|circle|highway|pin(code)?|india|district|city|\d{6})\b|,/i;

function scoreMerchantRow(row: Row, rank: number, maxRel: number): number {
  const letters = (row.text.match(/[A-Za-zऀ-෿]/g) ?? []).length;
  const len = row.text.length;
  if (letters < 3 || len > 48) return 0;
  if (MERCHANT_NOISE.test(row.text)) return 0;
  if (findDateCandidates(row.text).length || /\d{5,}/.test(row.text)) return 0;
  const letterRatio = letters / len;
  const upperRatio = (row.text.match(/[A-Z]/g) ?? []).length / Math.max(1, letters);
  const sizeScore = maxRel > 0 ? row.relHeight / maxRel : 0.5;
  const addressPenalty = ADDRESS_HINT.test(row.text) ? 0.35 : 0;
  return Math.max(0, 0.35 * sizeScore + 0.25 * letterRatio + 0.15 * upperRatio + 0.25 * Math.max(0, 1 - rank * 0.2) - addressPenalty) * (0.5 + 0.5 * row.confidence);
}

function cleanMerchant(text: string): string {
  return text.replace(/^[^A-Za-z0-9ऀ-෿]+|[^A-Za-z0-9)ऀ-෿.]+$/g, '').replace(/\s{2,}/g, ' ').trim();
}

function extractMerchant(layout: LayoutAnalysis): { merchant: RawField<string>; merchantRow: Row | null } {
  const all = layout.rows.map((r) => r.text).join('\n');
  // 1. Explicit label ("Merchant:", "Store:", "Sold by:")
  for (const kv of layout.keyValues) {
    if (/^(merchant|store|shop|outlet|restaurant|sold\s?by|seller|vendor|supplier|biller)\b/i.test(kv.key) && kv.value.length >= 2) {
      const row = layout.rows[kv.rowIndex]!;
      return { merchant: found(cleanMerchant(kv.value), row, 0.9), merchantRow: row };
    }
  }
  // 2. Header candidates
  const header = layout.rows.filter((r) => r.page === 0 && r.yNorm < 0.4).slice(0, 10);
  const maxRel = Math.max(0, ...header.map((r) => r.relHeight));
  const scored = header.map((r, i) => ({ r, s: scoreMerchantRow(r, i, maxRel) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  // 3. Known brand names anywhere near the top (exact lexicon match)
  for (const brand of KNOWN_MERCHANTS) {
    const re = new RegExp(`\\b${brand.pattern}\\b`, 'i');
    const row = layout.rows.find((r) => r.yNorm < 0.5 && re.test(r.text));
    if (row && (!scored[0] || scored[0].r.index >= row.index || re.test(scored[0].r.text))) {
      const f = found(scored[0] && re.test(scored[0].r.text) ? cleanMerchant(scored[0].r.text) : brand.name, row, 0.85);
      return { merchant: f, merchantRow: row };
    }
  }
  if (!scored.length) {
    void all;
    return { merchant: missing('No merchant name could be identified in the header of the bill.'), merchantRow: null };
  }
  const top = scored[0]!;
  const second = scored[1];
  const f = found(cleanMerchant(top.r.text), top.r, Math.min(0.93, 0.45 + top.s * 0.6), top.s > 0.55 ? 'extracted' : 'inferred');
  if (second && second.s > top.s * 0.9) f.alternatives = [{ value: cleanMerchant(second.r.text), evidence: second.r.text }];
  return { merchant: f, merchantRow: top.r };
}

function extractAddress(layout: LayoutAnalysis, merchantRow: Row | null): RawField<string> {
  if (!merchantRow) return missing();
  const parts: Row[] = [];
  for (let i = merchantRow.index + 1; i < Math.min(layout.rows.length, merchantRow.index + 5); i++) {
    const r = layout.rows[i]!;
    if (r.page !== merchantRow.page || r.region !== 'header') break;
    if (/\b(gstin?|ph(one)?|tel|mob|date|invoice|bill\s?no|receipt|fssai|e-?mail)\b/i.test(r.text) || findDateCandidates(r.text).length) break;
    if (ADDRESS_HINT.test(r.text) || /\d/.test(r.text)) parts.push(r);
    else if (parts.length) break;
  }
  if (!parts.length) return missing();
  const first = parts[0]!;
  return {
    value: parts.map((p) => p.text).join(', ').slice(0, 300),
    status: 'extracted',
    ruleScore: 0.6,
    ocrConfidence: parts.reduce((s, p) => s + p.confidence, 0) / parts.length,
    evidence: { text: parts.map((p) => p.text).join(' | '), page: first.page, bbox: first.nbbox, lineIndex: first.index },
    alternatives: [],
    note: null,
  };
}

function regexField(layout: LayoutAnalysis, re: RegExp, group: number, score: number, filter?: (row: Row) => boolean): RawField<string> {
  for (const row of layout.rows) {
    if (filter && !filter(row)) continue;
    const m = re.exec(row.text);
    const v = m?.[group] ?? m?.[group + 1];
    if (v) return found(v.trim(), row, score);
  }
  return missing();
}

const DATE_LABEL = /\b(date|dt\.?|dated|bill\s?date|invoice\s?date|txn\s?date|issue\s?date)\b/i;
const NON_BILL_DATE = /\b(due|valid|expiry|exp\.?|mfg|dob|birth|period|from|to|last\s?date|next|reading)\b/i;

function extractDates(layout: LayoutAnalysis, order: DateOrder): { billDate: RawField<string>; dueDate: RawField<string>; billTime: RawField<string> } {
  type Cand = { iso: string; raw: string; ambiguous: boolean; row: Row; score: number; resolvedByContext?: boolean };
  const cands: Cand[] = [];
  let due: Cand | null = null;
  // If other numeric dates on this document are unambiguous, they reveal its day/month convention.
  const allText = layout.rows.map((r) => r.text).join('\n');
  const formats = new Set(findDateCandidates(allText, order).filter((d) => !d.ambiguous && (d.format === 'DMY' || d.format === 'MDY')).map((d) => d.format));
  const docOrder: DateOrder | null = formats.size === 1 ? ([...formats][0] as DateOrder) : null;
  for (const row of layout.rows) {
    const ds = findDateCandidates(row.text, docOrder ?? order).map((d) =>
      d.ambiguous && docOrder ? { ...d, ambiguous: false, resolvedByContext: true } : d,
    );
    for (const d of ds) {
      if (/\b(due\s?date|pay\s?by|last\s?date)\b/i.test(row.text)) {
        due ??= { ...d, row, score: 0.9 };
        continue;
      }
      if (NON_BILL_DATE.test(row.text) && !/\b(bill|invoice|txn|issue)\s?date\b/i.test(row.text)) continue;
      const score = DATE_LABEL.test(row.text) ? 0.9 : row.region === 'header' ? 0.75 : 0.6;
      cands.push({ ...d, row, score });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.row.index - b.row.index);
  let billDate: RawField<string> = missing('No date was found on the bill.');
  if (cands.length) {
    const best = cands[0]!;
    billDate = found(best.iso, best.row, best.score, best.ambiguous ? 'ambiguous' : 'extracted');
    billDate.evidence = evidenceOf(best.row);
    if ((best as Cand).resolvedByContext) billDate.note = `Day/month order inferred from other unambiguous dates on this bill (${docOrder}).`;
    if (best.ambiguous) {
      const [y, m, d] = best.iso.split('-');
      billDate.note = `“${best.raw}” could be read as day/month or month/day. Interpreted using your ${order} preference.`;
      billDate.alternatives = [{ value: `${y}-${d}-${m}`, evidence: best.raw }];
    }
    const others = [...new Set(cands.slice(1).filter((c) => c.iso !== best.iso && c.score >= best.score).map((c) => c.iso))];
    if (others.length) {
      billDate.alternatives.push(...others.slice(0, 2).map((v) => ({ value: v, evidence: null })));
      if (billDate.status === 'extracted') {
        billDate.status = 'ambiguous';
        billDate.note = 'More than one date is printed with similar labels.';
      }
    }
  }
  const dueDate = due ? found(due.iso, due.row, due.score, due.ambiguous ? 'ambiguous' : 'extracted') : missing<string>();
  let billTime: RawField<string> = missing();
  const timeRow = (cands[0] && parseTime(cands[0].row.text) ? cands[0].row : null) ?? layout.rows.find((r) => /\btime\b/i.test(r.text) && parseTime(r.text));
  if (timeRow) {
    const t = parseTime(timeRow.text);
    if (t) billTime = found(t, timeRow, 0.8);
  }
  return { billDate, dueDate, billTime };
}

const PAYMENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(upi|g\s?pay|google\s?pay|phone\s?pe|paytm|bhim)\b/i, 'UPI'],
  [/\b(visa|master\s?card|rupay|amex|credit\s?card|debit\s?card|card)\b/i, 'Card'],
  [/\b(net\s?banking|neft|imps|rtgs)\b/i, 'Bank transfer'],
  [/\b(wallet)\b/i, 'Wallet'],
  [/\bcash\b/i, 'Cash'],
];

function extractPayment(layout: LayoutAnalysis): RawField<string> {
  for (const [re, label] of PAYMENT_PATTERNS) {
    const row = layout.rows.find((r) => r.region !== 'header' && re.test(r.text) && !/\bcash\s?memo\b/i.test(r.text));
    if (row) return found(label, row, 0.75);
  }
  return missing();
}

/* ------------------------------------------------------------------ */
/* Line items                                                          */
/* ------------------------------------------------------------------ */

function extractLineItems(layout: LayoutAnalysis): LineItem[] {
  const items: LineItem[] = [];
  for (const idx of layout.itemRows) {
    const row = layout.rows[idx]!;
    const firstAmountWord = row.amounts[0]?.words[0];
    const cut = firstAmountWord ? row.words.indexOf(firstAmountWord) : row.words.length;
    let description = row.words.slice(0, Math.max(0, cut)).map((w) => w.text).join(' ').replace(/^\d+[.)]\s*/, '').trim();
    const nums = row.amounts.map((a) => a.value);
    const xMatch = /(\d+(?:\.\d+)?)\s?[x×@*]\s?(\d+(?:[.,]\d+)?)/i.exec(row.text);
    let quantity: number | null = null;
    let unitPrice: number | null = null;
    const lineTotal: number | null = nums[nums.length - 1] ?? null;
    if (xMatch) {
      quantity = Number(xMatch[1]);
      unitPrice = Number(xMatch[2]!.replace(',', '.'));
      description = description.replace(xMatch[0], '').trim();
    } else if (nums.length >= 3) {
      quantity = nums[nums.length - 3]!;
      unitPrice = nums[nums.length - 2]!;
    } else if (nums.length === 2) {
      const [a, b] = nums as [number, number];
      if (Number.isInteger(a) && a > 0 && a <= 100 && b >= a) quantity = a;
      else unitPrice = a;
    }
    if (description.replace(/[^A-Za-zऀ-෿]/g, '').length < 2) continue;
    const arithmeticOk = quantity !== null && unitPrice !== null && lineTotal !== null ? amountsEqual(quantity * unitPrice, lineTotal, Math.max(0.05, lineTotal * 0.01)) : null;
    if (arithmeticOk === false && quantity !== null && unitPrice !== null && amountsEqual(unitPrice, lineTotal)) {
      // "Item 2 45.00 45.00": second number is the line total, the first is likely an MRP/rate column.
    }
    items.push({
      description: description.slice(0, 300),
      quantity,
      unitPrice,
      lineTotal: lineTotal === null ? null : round2(lineTotal),
      confidence: Math.round(row.confidence * 100) / 100,
      evidence: evidenceOf(row),
      arithmeticOk,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */

export function extractFields(layout: LayoutAnalysis, options: { dateOrder: DateOrder }): RawExtraction {
  const text = layout.rows.map((r) => r.text).join('\n');
  const { merchant, merchantRow } = extractMerchant(layout);
  const dates = extractDates(layout, options.dateOrder);
  const cur = detectCurrency(text);
  const currencyRow = cur ? layout.rows.find((r) => r.text.includes(cur.evidence)) : undefined;
  const currency: RawField<string> = cur && currencyRow
    ? cur.inferred
      ? { ...found(cur.code, currencyRow, 0.6, 'inferred'), note: `No currency symbol printed; inferred from “${cur.evidence}”.` }
      : { ...found(cur.code, currencyRow, cur.evidence.length > 1 ? 0.85 : 0.7), evidence: evidenceOf(currencyRow) }
    : missing('No currency symbol or code is printed on the bill.');

  const idFilter = (r: Row) => !layout.itemRows.includes(r.index);
  return {
    merchantName: merchant,
    merchantAddress: extractAddress(layout, merchantRow),
    merchantPhone: regexField(layout, /(?:ph(?:one)?|tel|mob(?:ile)?|contact)?\s*[:.]?\s*((?:\+?91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}|0\d{2,4}[-\s]?\d{6,8})\b/i, 1, 0.8),
    taxId: regexField(layout, /\b(?:gstin|gst\s?no|gst\s?in)\s*[:.]?\s*([0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z])\b/i, 1, 0.85),
    billDate: dates.billDate,
    billTime: dates.billTime,
    dueDate: dates.dueDate,
    currency,
    totalAmount: extractTotal(layout),
    subtotal: bestAmount(layout, SUBTOTAL_RULES, { region: ['totals', 'items'] }),
    tax: extractTax(layout),
    discount: (() => {
      const d = bestAmount(layout, DISCOUNT_RULES, { region: ['totals', 'items'] });
      return d.value !== null ? { ...d, value: Math.abs(d.value) } : d;
    })(),
    serviceCharge: bestAmount(layout, SERVICE_RULES, { region: ['totals', 'items'] }),
    tip: bestAmount(layout, TIP_RULES, { region: ['totals', 'footer'] }),
    roundOff: bestAmount(layout, ROUND_RULES, { region: ['totals', 'footer'] }),
    amountPaid: bestAmount(layout, PAID_RULES, { region: ['totals', 'footer'], preferLast: true }),
    balanceDue: bestAmount(layout, BALANCE_RULES, { region: ['totals', 'footer'] }),
    invoiceNumber: regexField(layout, /\b(?:invoice|inv)\.?\s*(?:no\.?|number|num|#)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9/-]{0,24}\d[A-Z0-9/-]*)\b|\b(?:invoice|inv)\s*[:#]\s*([A-Z0-9][A-Z0-9/-]{0,24}\d[A-Z0-9/-]*)\b/i, 1, 0.85, idFilter),
    receiptNumber: regexField(layout, /\b(?:bill|receipt|rcpt|order|token|kot)\s*(?:no\.?|number|num|#)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9/-]{0,24})\b/i, 1, 0.8, idFilter),
    paymentMethod: extractPayment(layout),
    transactionReference: regexField(layout, /\b(?:txn|transaction|ref(?:erence)?|rrn|utr|approval)\s*(?:id|no\.?|number|#|code)?\s*[:.#-]?\s*([A-Z0-9]{6,30})\b/i, 1, 0.75),
    lineItems: extractLineItems(layout),
  };
}
