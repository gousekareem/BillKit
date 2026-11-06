import { describe, expect, it } from 'vitest';
import {
  parseAmount, findDateCandidates, normaliseDate, normaliseMerchant, merchantsMatch, detectCurrency, parseTime, amountsEqual,
} from '../src/index.ts';

describe('parseAmount', () => {
  it.each([
    ['1,250.00', 1250],
    ['₹1,25,000.50', 125000.5],
    ['Rs. 450/-', 450],
    ['1.234,56', 1234.56],
    ['12,50', 12.5],
    ['$ 19.99', 19.99],
    ['1250', 1250],
    ['125O.00', 1250],
    ['1.250.00', 1250],
  ])('parses %s', (raw, expected) => {
    expect(parseAmount(raw)?.value).toBeCloseTo(expected, 2);
  });
  it('detects negatives / refunds', () => {
    expect(parseAmount('(12.00)')?.value).toBe(-12);
    expect(parseAmount('-45.50')?.value).toBe(-45.5);
    expect(parseAmount('45.50-')?.negative).toBe(true);
  });
  it('rejects non-amounts', () => {
    expect(parseAmount('TOTAL')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc12')).toBeNull();
  });
  it('compares with tolerance', () => {
    expect(amountsEqual(10.004, 10)).toBe(true);
    expect(amountsEqual(10.2, 10)).toBe(false);
    expect(amountsEqual(null, 10)).toBe(false);
  });
});

describe('dates', () => {
  it('parses unambiguous numeric DMY', () => {
    const [c] = findDateCandidates('Date: 20/10/2026');
    expect(c?.iso).toBe('2026-10-20');
    expect(c?.ambiguous).toBe(false);
  });
  it('flags ambiguous dates and respects order', () => {
    expect(findDateCandidates('04/05/2026', 'DMY')[0]).toMatchObject({ iso: '2026-05-04', ambiguous: true });
    expect(findDateCandidates('04/05/2026', 'MDY')[0]).toMatchObject({ iso: '2026-04-05', ambiguous: true });
  });
  it('parses month names, ISO and two-digit years', () => {
    expect(normaliseDate('05 Jan 2026')).toBe('2026-01-05');
    expect(normaliseDate('05-JAN-26')).toBe('2026-01-05');
    expect(normaliseDate('January 5, 2026')).toBe('2026-01-05');
    expect(normaliseDate('2026-01-05')).toBe('2026-01-05');
    expect(normaliseDate('2026/1/5')).toBe('2026-01-05');
    expect(normaliseDate('31.12.25')).toBe('2025-12-31');
  });
  it('rejects impossible dates', () => {
    expect(findDateCandidates('31/02/2026')).toHaveLength(0);
    expect(normaliseDate('not a date')).toBeNull();
  });
  it('parses times', () => {
    expect(parseTime('Time 07:45 PM')).toBe('19:45');
    expect(parseTime('12:05 am')).toBe('00:05');
    expect(parseTime('no time')).toBeNull();
  });
});

describe('merchant normalisation', () => {
  it('ignores case, punctuation and legal suffixes', () => {
    expect(normaliseMerchant('SPAR Hypermarket Pvt. Ltd.')).toBe('spar hypermarket');
    expect(merchantsMatch('Cafe Coffee Day', 'CAFE COFFEE DAY')).toBe(true);
    expect(merchantsMatch('Cafe Coffee Day', 'CAFE C0FFEE DAY')).toBe(true);
    expect(merchantsMatch('Reliance Fresh', 'More Supermarket')).toBe(false);
    expect(merchantsMatch('', 'x')).toBe(false);
  });
});

describe('currency detection', () => {
  it('detects explicit currencies and abstains otherwise', () => {
    expect(detectCurrency('Total ₹ 120')?.code).toBe('INR');
    expect(detectCurrency('CGST 9%')?.code).toBe('INR');
    expect(detectCurrency('TOTAL EUR 12,00')?.code).toBe('EUR');
    expect(detectCurrency('Amount $5.00')?.code).toBe('USD');
    expect(detectCurrency('TOTAL 120.00')).toBeNull();
  });
});
