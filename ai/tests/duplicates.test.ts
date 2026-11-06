import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { dHash, findDuplicates, hammingHex, sha256 } from '../src/duplicates.ts';
import { RECEIPTS, renderPng, degrade } from '../scripts/synthetic.ts';

describe('duplicate detection', () => {
  it('perceptual hash is stable under re-encoding and different across documents', async () => {
    const a = await renderPng(RECEIPTS[0]!);
    const aJpeg = await sharp(a).jpeg({ quality: 70 }).toBuffer();
    const b = await renderPng(RECEIPTS[2]!);
    const [ha, ha2, hb] = await Promise.all([dHash(a), dHash(aJpeg), dHash(b)]);
    expect(hammingHex(ha, ha2)).toBeLessThanOrEqual(4);
    expect(hammingHex(ha, hb)).toBeGreaterThan(8);
    expect(sha256(a)).not.toBe(sha256(aJpeg));
    expect(await degrade(a, 'clean')).toBe(a);
  });
  it('finds exact, perceptual, invoice and transaction duplicates without deciding for the user', () => {
    const existing = [
      { id: '1', fileSha256: 'abc', perceptualHash: 'ffff000000000000', merchantName: 'Cafe One', billDate: '2026-10-01', totalAmount: 100, invoiceNumber: 'INV-9' },
      { id: '2', fileSha256: 'zzz', perceptualHash: '0000ffff00000000', merchantName: 'CAFE ONE', billDate: '2026-10-02', totalAmount: 55, invoiceNumber: null },
    ];
    expect(findDuplicates({ fileSha256: 'abc' }, existing)[0]).toMatchObject({ id: '1', kind: 'exact_file' });
    expect(findDuplicates({ perceptualHash: 'ffff000000000001' }, existing)[0]).toMatchObject({ id: '1', kind: 'same_image' });
    expect(findDuplicates({ merchantName: 'cafe one', invoiceNumber: 'inv-9' }, existing)[0]).toMatchObject({ id: '1', kind: 'same_invoice' });
    expect(findDuplicates({ merchantName: 'Cafe One', billDate: '2026-10-02', totalAmount: 55 }, existing)[0]).toMatchObject({ id: '2', kind: 'same_transaction' });
    expect(findDuplicates({ merchantName: 'Other', billDate: '2026-10-02', totalAmount: 55 }, existing)).toHaveLength(0);
  });
});
