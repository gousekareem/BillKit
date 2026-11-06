/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G10 — Validation and error detection. Pure functions over plain values so
 * the same rules run on AI output (before review) and on the user's reviewed
 * values (before saving). Receipts vary — tax-inclusive prices, discounts
 * applied before the subtotal, service charges, tips and round-off are all
 * legitimate — so the arithmetic check tries the documented interpretations
 * before raising a warning.
 */
import type { ValidationIssue, ValidationReport } from './schemas.ts';
import { SUPPORTED_CURRENCIES, isValidDateParts, round2 } from './normalise.ts';

export interface ValidationInput {
  merchantName: string | null;
  billDate: string | null;
  dueDate?: string | null;
  currency: string | null;
  totalAmount: number | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  serviceCharge?: number | null;
  tip?: number | null;
  roundOff?: number | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  lineItems?: Array<{ lineTotal: number | null; arithmeticOk: boolean | null }>;
  dateAmbiguous?: boolean;
}

export interface ValidationOptions {
  today?: Date;
}

export type FieldValidation = Record<string, 'pass' | 'warn' | 'fail'>;

export function arithmeticTolerance(total: number): number {
  return Math.max(1, Math.abs(total) * 0.005);
}

interface Interpretation {
  name: string;
  expected: number;
}

export function validateBill(v: ValidationInput, options: ValidationOptions = {}): { report: ValidationReport; fieldStatus: FieldValidation; corroborated: string[] } {
  const corroborated: string[] = [];
  const today = options.today ?? new Date();
  const issues: ValidationIssue[] = [];
  const checks: ValidationReport['checks'] = [];
  const fieldStatus: FieldValidation = {};
  const mark = (fields: string[], s: 'pass' | 'warn' | 'fail') => {
    for (const f of fields) {
      const prev = fieldStatus[f];
      if (prev === 'fail' || (prev === 'warn' && s === 'pass')) continue;
      fieldStatus[f] = s;
    }
  };
  const issue = (code: string, severity: ValidationIssue['severity'], fields: string[], message: string) => {
    issues.push({ code, severity, fields, message });
    if (severity !== 'info') mark(fields, severity === 'error' ? 'fail' : 'warn');
  };

  // Required fields
  const missingRequired = (
    [
      ['merchantName', v.merchantName],
      ['billDate', v.billDate],
      ['totalAmount', v.totalAmount],
    ] as const
  ).filter(([, val]) => val === null || val === undefined || val === '');
  for (const [f] of missingRequired) issue('missing_required', 'warning', [f], `${f === 'merchantName' ? 'Merchant' : f === 'billDate' ? 'Date' : 'Total amount'} is missing.`);
  checks.push({ name: 'Required fields present', result: missingRequired.length ? 'warn' : 'pass', detail: missingRequired.length ? `Missing: ${missingRequired.map(([f]) => f).join(', ')}` : 'Merchant, date and total present' });

  // Total amount plausibility
  const total = v.totalAmount ?? null;
  if (total !== null) {
    if (!Number.isFinite(total)) issue('invalid_amount', 'error', ['totalAmount'], 'Total is not a valid number.');
    else if (total < 0) issue('negative_total', 'warning', ['totalAmount'], 'Total is negative — this may be a refund or credit note. Confirm before saving.');
    else if (total === 0) issue('zero_total', 'warning', ['totalAmount'], 'Total is zero.');
    else if (total > 10_000_000) issue('implausible_total', 'warning', ['totalAmount'], 'Total is unusually large. Check for a misread digit or decimal point.');
    else mark(['totalAmount'], 'pass');
  }
  for (const k of ['subtotal', 'tax', 'discount', 'serviceCharge', 'tip'] as const) {
    const val = v[k];
    if (val != null && val < 0) issue('negative_component', 'warning', [k], `${k} is negative.`);
  }
  if (total !== null && v.tax != null && v.tax > Math.abs(total) && total > 0) issue('tax_exceeds_total', 'error', ['tax', 'totalAmount'], 'Tax is larger than the total — one of the two values is probably misread.');
  if (v.discount != null && v.subtotal != null && v.discount > v.subtotal && v.subtotal > 0) issue('discount_exceeds_subtotal', 'error', ['discount', 'subtotal'], 'Discount is larger than the subtotal.');

  // Arithmetic: subtotal + tax + service + tip − discount + round-off ≈ total
  if (total !== null && v.subtotal != null) {
    const sub = v.subtotal;
    const tax = v.tax ?? 0;
    const sc = v.serviceCharge ?? 0;
    const tip = v.tip ?? 0;
    const disc = v.discount ?? 0;
    const ro = v.roundOff ?? 0;
    const tol = arithmeticTolerance(total);
    const interpretations: Interpretation[] = [
      { name: 'subtotal + tax + charges − discount + round-off', expected: sub + tax + sc + tip - disc + ro },
      { name: 'discount already deducted in subtotal', expected: sub + tax + sc + tip + ro },
      { name: 'prices include tax', expected: sub + sc + tip - disc + ro },
      { name: 'prices include tax, discount already deducted', expected: sub + sc + tip + ro },
      { name: 'without round-off line', expected: sub + tax + sc + tip - disc },
    ];
    const ok = interpretations.find((i) => Math.abs(i.expected - total) <= tol);
    if (ok) {
      checks.push({ name: 'Total arithmetic', result: 'pass', detail: `Total matches ${ok.name} (${round2(ok.expected)}).` });
      const fs = ['totalAmount', 'subtotal', ...(v.tax != null ? ['tax'] : []), ...(v.discount != null ? ['discount'] : []), ...(v.serviceCharge != null ? ['serviceCharge'] : []), ...(v.tip != null ? ['tip'] : [])];
      mark(fs, 'pass');
      corroborated.push(...fs);
    } else {
      const e = round2(interpretations[0]!.expected);
      checks.push({ name: 'Total arithmetic', result: 'warn', detail: `Expected ≈ ${e}, found ${round2(total)}.` });
      issue(
        'total_mismatch',
        'warning',
        ['totalAmount', 'subtotal', 'tax'],
        `Subtotal ${round2(sub)}${tax ? ` + tax ${round2(tax)}` : ''}${sc ? ` + service ${round2(sc)}` : ''}${tip ? ` + tip ${round2(tip)}` : ''}${disc ? ` − discount ${round2(disc)}` : ''}${ro ? ` ± round-off ${round2(ro)}` : ''} = ${e}, but the total reads ${round2(total)}. One of these values may be misread.`,
      );
    }
  } else {
    checks.push({ name: 'Total arithmetic', result: 'skipped', detail: total === null ? 'No total' : 'No subtotal to check against' });
  }

  // Line items
  const items = (v.lineItems ?? []).filter((i) => i.lineTotal !== null);
  if (items.length >= 2) {
    const sum = round2(items.reduce((s, i) => s + (i.lineTotal ?? 0), 0));
    const target = v.subtotal ?? total;
    if (target != null) {
      const tol = arithmeticTolerance(target);
      const matches = Math.abs(sum - target) <= tol || (v.discount != null && Math.abs(sum - v.discount - target) <= tol);
      checks.push({ name: 'Line items sum', result: matches ? 'pass' : 'warn', detail: `Items sum to ${sum}; ${v.subtotal != null ? 'subtotal' : 'total'} is ${round2(target)}.` });
      if (!matches) issue('items_sum_mismatch', 'info', ['lineItems'], `The ${items.length} line items read sum to ${sum}, not ${round2(target)}. Some items may not have been read.`);
    }
    const bad = (v.lineItems ?? []).filter((i) => i.arithmeticOk === false).length;
    if (bad) issue('line_item_arithmetic', 'info', ['lineItems'], `${bad} line item(s) have quantity × price ≠ line total.`);
  } else {
    checks.push({ name: 'Line items sum', result: 'skipped', detail: 'Fewer than two line items read' });
  }

  // Paid / balance
  if (total !== null && v.amountPaid != null && v.balanceDue != null) {
    const ok = Math.abs(total - v.amountPaid - v.balanceDue) <= arithmeticTolerance(total);
    checks.push({ name: 'Paid + balance = total', result: ok ? 'pass' : 'warn', detail: `${v.amountPaid} + ${v.balanceDue} vs ${total}` });
    if (!ok) issue('balance_mismatch', 'warning', ['amountPaid', 'balanceDue'], 'Amount paid plus balance due does not equal the total.');
  } else if (total !== null && v.amountPaid != null && v.amountPaid + 0.01 < total) {
    issue('partial_payment', 'info', ['amountPaid'], `Amount paid (${v.amountPaid}) is less than the total (${total}).`);
  }

  // Dates
  const checkDate = (key: 'billDate' | 'dueDate', iso: string | null | undefined) => {
    if (!iso) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !isValidDateParts(...(iso.split('-').map(Number) as [number, number, number]))) {
      issue('invalid_date', 'error', [key], 'Date is not valid.');
      return;
    }
    if (key !== 'billDate') return;
    const d = new Date(`${iso}T00:00:00Z`);
    const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
    if (d > tomorrow) issue('future_date', 'warning', [key], 'Bill date is in the future. The day and month may be swapped or misread.');
    else if (d.getUTCFullYear() < 2000) issue('very_old_date', 'warning', [key], 'Bill date is before the year 2000 — probably misread.');
    else {
      const ageYears = (today.getTime() - d.getTime()) / (365.25 * 86400000);
      if (ageYears > 3) issue('old_date', 'info', [key], `Bill is about ${Math.floor(ageYears)} years old.`);
      mark([key], 'pass');
    }
  };
  checkDate('billDate', v.billDate);
  checkDate('dueDate', v.dueDate);
  if (v.dateAmbiguous) issue('ambiguous_date', 'warning', ['billDate'], 'The date could be read as day/month or month/day. Confirm it.');
  if (v.billDate && v.dueDate && v.dueDate < v.billDate) issue('due_before_bill', 'warning', ['dueDate'], 'Due date is before the bill date.');
  checks.push({ name: 'Date checks', result: issues.some((i) => i.fields.includes('billDate') && i.severity !== 'info') ? 'warn' : v.billDate ? 'pass' : 'skipped', detail: v.billDate ?? 'No date' });

  // Currency
  if (v.currency) {
    if (!/^[A-Z]{3}$/.test(v.currency)) issue('invalid_currency', 'error', ['currency'], 'Currency must be a 3-letter ISO code.');
    else if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(v.currency)) issue('unusual_currency', 'info', ['currency'], `${v.currency} is not one of the commonly used currencies; check it.`);
    else mark(['currency'], 'pass');
  }

  const status: ValidationReport['status'] = issues.some((i) => i.severity === 'error') ? 'failed' : issues.some((i) => i.severity === 'warning') ? 'needs_review' : 'passed';
  return { report: { status, issues, checks }, fieldStatus, corroborated };
}
