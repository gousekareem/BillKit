/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G21 — Duplicate detection. BillKit only WARNS; it never deletes or blocks a
 * bill, because legitimately repeated purchases (same café, same amount, same
 * day) are common. The user decides.
 */
import crypto from 'node:crypto';
import sharp from 'sharp';
import { amountsEqual, merchantsMatch } from '@billkit/shared';

export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 64-bit difference hash (dHash) of a 9×8 greyscale thumbnail, as 16 hex chars. */
export async function dHash(png: Buffer): Promise<string> {
  const { data } = await sharp(png).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (data[y * 9 + x]! > data[y * 9 + x + 1]! ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export function hammingHex(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

export interface DuplicateSubject {
  id?: string;
  fileSha256?: string | null;
  perceptualHash?: string | null;
  merchantName?: string | null;
  billDate?: string | null;
  totalAmount?: number | null;
  invoiceNumber?: string | null;
}

export interface DuplicateMatch {
  id: string;
  score: number;
  reasons: string[];
  kind: 'exact_file' | 'same_image' | 'same_invoice' | 'same_transaction';
}

export const PERCEPTUAL_HASH_MAX_DISTANCE = 6;

export function findDuplicates(subject: DuplicateSubject, existing: Array<DuplicateSubject & { id: string }>): DuplicateMatch[] {
  const out: DuplicateMatch[] = [];
  for (const e of existing) {
    if (subject.id && e.id === subject.id) continue;
    const reasons: string[] = [];
    let kind: DuplicateMatch['kind'] | null = null;
    let score = 0;
    if (subject.fileSha256 && e.fileSha256 && subject.fileSha256 === e.fileSha256) {
      reasons.push('Identical image file was uploaded before');
      kind = 'exact_file';
      score = 1;
    } else if (subject.perceptualHash && e.perceptualHash) {
      const d = hammingHex(subject.perceptualHash, e.perceptualHash);
      if (d <= PERCEPTUAL_HASH_MAX_DISTANCE) {
        reasons.push(`Visually near-identical image (perceptual hash distance ${d}/64)`);
        kind = 'same_image';
        score = Math.max(score, 1 - d / 64);
      }
    }
    const sameMerchant = merchantsMatch(subject.merchantName, e.merchantName);
    if (subject.invoiceNumber && e.invoiceNumber && subject.invoiceNumber.toLowerCase() === e.invoiceNumber.toLowerCase() && sameMerchant) {
      reasons.push(`Same merchant and invoice number (${subject.invoiceNumber})`);
      kind ??= 'same_invoice';
      score = Math.max(score, 0.95);
    }
    if (sameMerchant && subject.billDate && subject.billDate === e.billDate && amountsEqual(subject.totalAmount, e.totalAmount)) {
      reasons.push('Same merchant, date and total');
      kind ??= 'same_transaction';
      score = Math.max(score, 0.8);
    }
    if (kind) out.push({ id: e.id, score: Math.round(score * 100) / 100, reasons, kind });
  }
  return out.sort((a, b) => b.score - a.score);
}
