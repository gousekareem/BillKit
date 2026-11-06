import { describe, expect, it } from 'vitest';
import { validateBill, arithmeticTolerance } from '../src/validation.ts';

const today = new Date('2026-11-06T00:00:00Z');
const base = { merchantName: 'X', billDate: '2026-10-01', currency: 'INR', totalAmount: 118 };

describe('validateBill', () => {
  it('passes standard subtotal + tax arithmetic', () => {
    const { report, corroborated } = validateBill({ ...base, subtotal: 100, tax: 18 }, { today });
    expect(report.status).toBe('passed');
    expect(corroborated).toContain('totalAmount');
  });
  it('accepts discount, service charge, tip and round-off', () => {
    const { report } = validateBill({ ...base, totalAmount: 120, subtotal: 100, tax: 9, serviceCharge: 5, tip: 10, discount: 4, roundOff: 0 }, { today });
    expect(report.status).toBe('passed');
  });
  it('accepts tax-inclusive pricing and discount already deducted', () => {
    expect(validateBill({ ...base, totalAmount: 100, subtotal: 100, tax: 15.25 }, { today }).report.status).toBe('passed');
    expect(validateBill({ ...base, totalAmount: 108, subtotal: 90, tax: 18, discount: 10 }, { today }).report.status).toBe('passed');
  });
  it('tolerates rounding up to max(1, 0.5%)', () => {
    expect(arithmeticTolerance(50)).toBe(1);
    expect(arithmeticTolerance(10000)).toBe(50);
    expect(validateBill({ ...base, totalAmount: 1275, subtotal: 1214, tax: 60.7 }, { today }).report.status).toBe('passed');
  });
  it('warns on a real mismatch and names the fields', () => {
    const { report, fieldStatus } = validateBill({ ...base, totalAmount: 150, subtotal: 100, tax: 18 }, { today });
    expect(report.status).toBe('needs_review');
    expect(report.issues.find((i) => i.code === 'total_mismatch')).toBeTruthy();
    expect(fieldStatus.totalAmount).toBe('warn');
  });
  it('flags missing required fields, future dates and negative totals', () => {
    const r = validateBill({ merchantName: null, billDate: '2027-01-01', currency: 'INR', totalAmount: -50 }, { today }).report;
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['missing_required', 'future_date', 'negative_total']));
  });
  it('fails impossible values', () => {
    expect(validateBill({ ...base, totalAmount: 100, tax: 500 }, { today }).report.status).toBe('failed');
    expect(validateBill({ ...base, currency: 'rupees' }, { today }).report.status).toBe('failed');
    expect(validateBill({ ...base, billDate: '2026-02-30' }, { today }).report.status).toBe('failed');
  });
  it('checks line items and due date ordering', () => {
    const r = validateBill({ ...base, subtotal: 100, tax: 18, dueDate: '2026-09-01', lineItems: [{ lineTotal: 40, arithmeticOk: true }, { lineTotal: 30, arithmeticOk: false }] }, { today }).report;
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['items_sum_mismatch', 'line_item_arithmetic', 'due_before_bill']));
  });
  it('checks paid + balance = total', () => {
    expect(validateBill({ ...base, amountPaid: 100, balanceDue: 18 }, { today }).report.status).toBe('passed');
    expect(validateBill({ ...base, amountPaid: 100, balanceDue: 50 }, { today }).report.issues.some((i) => i.code === 'balance_mismatch')).toBe(true);
  });
});
