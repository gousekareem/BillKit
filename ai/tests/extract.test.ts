import { describe, expect, it } from 'vitest';
import { extractFields } from '../src/extract.ts';
import { findAmounts } from '../src/layout.ts';
import { layoutOf, fakePage } from './helpers.ts';

const receipt = [
  'SUNRISE BAKERY',
  'Main Road, Guntur',
  'Ph: 9876543210',
  'Bill No: 1182|Date: 12/08/2026',
  'Item Qty Rate|Amount',
  'Veg Puff 2 x 25.00|50.00',
  'Plum Cake 1 x 180.00|180.00',
  'Sub Total|230.00',
  'CGST 2.5%|5.75',
  'SGST 2.5%|5.75',
  'Discount|10.00',
  'Grand Total|231.50',
  'Cash Tendered|300.00',
  'Change|68.50',
  'Thank you visit again',
];

describe('extractFields', () => {
  const r = extractFields(layoutOf(receipt), { dateOrder: 'DMY' });

  it('extracts merchant from the header', () => {
    expect(r.merchantName.value).toBe('SUNRISE BAKERY');
    expect(r.merchantName.evidence?.lineIndex).toBe(0);
  });
  it('keeps total, subtotal, tax, discount and amount paid separate', () => {
    expect(r.totalAmount.value).toBe(231.5);
    expect(r.subtotal.value).toBe(230);
    expect(r.tax.value).toBe(11.5);
    expect(r.discount.value).toBe(10);
    expect(r.amountPaid.value).toBe(300);
    expect(r.totalAmount.evidence?.text).toMatch(/Grand Total/);
  });
  it('parses an unambiguous date and receipt number, never the phone as money', () => {
    expect(r.billDate.value).toBe('2026-08-12');
    expect(r.billDate.status).toBe('ambiguous'); // 12/08 could be Aug 12 or Dec 8 — and no other date disambiguates
    expect(r.receiptNumber.value).toBe('1182');
    expect(r.merchantPhone.value).toBe('9876543210');
  });
  it('extracts line items with quantity × price arithmetic', () => {
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0]).toMatchObject({ description: 'Veg Puff', quantity: 2, unitPrice: 25, lineTotal: 50, arithmeticOk: true });
  });
  it('returns missing — not a guess — when a field is absent', () => {
    expect(r.tip.value).toBeNull();
    expect(r.tip.value).toBeNull();
    expect(r.invoiceNumber.value).toBeNull();
  });
});

describe('date disambiguation and labels', () => {
  it('uses other unambiguous dates on the same bill to resolve day/month order', () => {
    const r = extractFields(layoutOf(['CITY WATER BOARD', 'Bill Date: 03/04/2026', 'Due Date: 25/04/2026', 'Amount Payable|500.00']), { dateOrder: 'MDY' });
    expect(r.billDate.value).toBe('2026-04-03');
    expect(r.billDate.status).toBe('extracted');
    expect(r.dueDate.value).toBe('2026-04-25');
  });
  it('flags ambiguity and offers the alternative reading', () => {
    const r = extractFields(layoutOf(['SHOP ONE', 'Date: 04/05/2026', 'TOTAL|90.00']), { dateOrder: 'DMY' });
    expect(r.billDate.value).toBe('2026-05-04');
    expect(r.billDate.status).toBe('ambiguous');
    expect(r.billDate.alternatives[0]?.value).toBe('2026-04-05');
  });
  it('ignores expiry / birth dates', () => {
    const r = extractFields(layoutOf(['PHARMA PLUS', 'Exp Date: 12/2028 Mfg 01/01/2025', 'Invoice Date: 19/09/2026', 'Total|20.00']), { dateOrder: 'DMY' });
    expect(r.billDate.value).toBe('2026-09-19');
  });
});

describe('identifiers', () => {
  it('does not read "TAX INVOICE" as an invoice number but reads labelled ones', () => {
    expect(extractFields(layoutOf(['SHOP', 'TAX INVOICE', 'Total|10.00']), { dateOrder: 'DMY' }).invoiceNumber.value).toBeNull();
    expect(extractFields(layoutOf(['SHOP', 'Invoice No: INV-2026/0042', 'Total|10.00']), { dateOrder: 'DMY' }).invoiceNumber.value).toBe('INV-2026/0042');
  });
});

describe('currency', () => {
  it('is missing when nothing indicates it', () => {
    const r = extractFields(layoutOf(['SHOP', 'Total|10.00']), { dateOrder: 'DMY' });
    expect(r.currency.value).toBeNull();
    expect(r.currency.status).toBe('missing');
  });
  it('is marked inferred when only implied by GST terms', () => {
    const r = extractFields(layoutOf(receipt), { dateOrder: 'DMY' });
    expect(r.currency.value).toBe('INR');
    expect(r.currency.status).toBe('inferred');
  });
});

describe('total heuristics', () => {
  it('does not treat "Total Qty" or "Total Savings" as the total', () => {
    const r = extractFields(layoutOf(['MART', 'Milk|60.00', 'Total Qty|3', 'Total Savings|12.00', 'Net Amount|148.00']), { dateOrder: 'DMY' });
    expect(r.totalAmount.value).toBe(148);
  });
  it('marks an unlabelled largest amount as inferred with a note', () => {
    const r = extractFields(layoutOf(['CORNER STORE', 'Soap|40.00', 'Bread|35.00', 'xx|', '|75.00']), { dateOrder: 'DMY' });
    expect(r.totalAmount.value).toBe(75);
    expect(r.totalAmount.status).toBe('inferred');
    expect(r.totalAmount.note).toMatch(/largest amount/);
  });
  it('reads an amount printed on the line after its label', () => {
    const r = extractFields(layoutOf(['MART', 'Date: 20/10/2026', 'Item A|10.00', 'Item B|20.00', 'GRAND TOTAL', '₹ 30.00']), { dateOrder: 'DMY' });
    expect(r.totalAmount.value).toBe(30);
    expect(r.currency.value).toBe('INR');
  });
  it('reports tax-inclusive notes instead of inventing tax', () => {
    const r = extractFields(layoutOf(['MART', 'Item|100.00', 'Total|100.00', 'Prices inclusive of all taxes']), { dateOrder: 'DMY' });
    expect(r.tax.value).toBeNull();
    expect(r.tax.note).toMatch(/included/);
  });
});

describe('findAmounts', () => {
  it('skips dates, times, percentages and phone numbers', () => {
    const page = fakePage(['Date 12/08/2026 Time 10:45 CGST 9% Ph 9876543210 Total 1,234.50']);
    const values = findAmounts(page.words).map((a) => a.value);
    expect(values).toEqual([1234.5]);
  });
  it('keeps currency-prefixed integers', () => {
    expect(findAmounts(fakePage(['Pay Rs. 1250']).words).map((a) => a.value)).toContain(1250);
  });
});
