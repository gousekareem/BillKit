/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * SYNTHETIC test-fixture generator.
 * These images are computer-generated, clearly fictional documents used ONLY
 * for automated tests, demos and a pipeline smoke test. They are NOT real
 * bills, must never be presented as real-world data, and are never used for
 * the HR 20-image evaluation. All merchant names below are invented.
 */
import sharp from 'sharp';
import { homography, invert3x3, warpPerspective, type Quad } from '../src/image/raster.ts';

export type Line =
  | { t: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right' }
  | { l: string; r: string; size?: number; bold?: boolean }
  | { gap: number }
  | { rule: true };

export interface ReceiptSpec {
  id: string;
  width?: number;
  font?: string;
  lines: Line[];
  truth: {
    isBill: boolean;
    merchant: string | null;
    date: string | null;
    total: number | null;
    currency: string | null;
    category: string | null;
    documentClass: string;
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderSvg(spec: ReceiptSpec): string {
  const W = spec.width ?? 620;
  const font = spec.font ?? 'DejaVu Sans Mono';
  const pad = 36;
  let y = pad;
  const parts: string[] = [];
  for (const line of spec.lines) {
    if ('gap' in line) {
      y += line.gap;
      continue;
    }
    if ('rule' in line) {
      y += 10;
      parts.push(`<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#222" stroke-dasharray="6 4" stroke-width="1.5"/>`);
      y += 14;
      continue;
    }
    const size = line.size ?? 20;
    y += size * 1.25;
    const weight = line.bold ? 700 : 400;
    if ('t' in line) {
      const align = line.align ?? 'left';
      const x = align === 'center' ? W / 2 : align === 'right' ? W - pad : pad;
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      parts.push(`<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#111">${esc(line.t)}</text>`);
    } else {
      parts.push(`<text x="${pad}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="#111">${esc(line.l)}</text>`);
      parts.push(`<text x="${W - pad}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" text-anchor="end" fill="#111">${esc(line.r)}</text>`);
    }
    y += size * 0.35;
  }
  const H = Math.ceil(y + pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fdfdfb"/>${parts.join('')}</svg>`;
}

export async function renderPng(spec: ReceiptSpec, scale = 1.6): Promise<Buffer> {
  const svg = renderSvg(spec);
  return sharp(Buffer.from(svg), { density: 72 * scale }).flatten({ background: '#fdfdfb' }).png().toBuffer();
}

/* ---------------- Degradations that mimic phone photos ---------------- */

export type Degradation = 'clean' | 'photo_on_table' | 'perspective' | 'rotated_6' | 'rotated_90' | 'blur' | 'dark' | 'shadow' | 'noisy_jpeg' | 'low_res';

async function background(w: number, h: number): Promise<Buffer> {
  // Wood-like brown background with soft vertical streaks (synthetic).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#6b4f3a"/><stop offset="0.5" stop-color="#7d5c43"/><stop offset="1" stop-color="#5e4433"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${(i * w) / 14}" y="0" width="3" height="${h}" fill="#000" opacity="0.07"/>`).join('')}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function degrade(png: Buffer, kind: Degradation): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const w = meta.width!;
  const h = meta.height!;
  switch (kind) {
    case 'clean':
      return png;
    case 'blur':
      return sharp(png).blur(2.2).png().toBuffer();
    case 'dark':
      return sharp(png).linear(0.42, 0).png().toBuffer();
    case 'low_res':
      return sharp(png).resize({ width: Math.round(w * 0.42) }).png().toBuffer();
    case 'noisy_jpeg': {
      const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let seed = 42;
      const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, data[i]! + Math.round((rand() - 0.5) * 50)));
      return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).jpeg({ quality: 45 }).toBuffer();
    }
    case 'shadow': {
      const overlay = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.45" stop-color="#000" stop-opacity="0.25"/><stop offset="0.7" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#s)"/></svg>`,
      );
      return sharp(png).composite([{ input: overlay, blend: 'over' }]).png().toBuffer();
    }
    case 'rotated_6':
      return sharp(png).rotate(6, { background: '#fdfdfb' }).png().toBuffer();
    case 'rotated_90':
      return sharp(png).rotate(90).png().toBuffer();
    case 'photo_on_table':
    case 'perspective': {
      const BW = Math.round(w * 1.5);
      const BH = Math.round(h * 1.25);
      const bg = await background(BW, BH);
      const { data: bgRaw } = await sharp(bg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data: src, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const ox = (BW - w) / 2;
      const oy = (BH - h) / 2;
      const k = kind === 'perspective' ? 0.09 : 0.02;
      const dst: Quad = [
        { x: ox + w * k, y: oy + h * 0.02 },
        { x: ox + w * (1 - k * 0.3), y: oy + h * k * 0.6 },
        { x: ox + w * (1 + k * 0.4), y: oy + h * (1 - k * 0.2) },
        { x: ox - w * k * 0.5, y: oy + h * (1 - 0.01) },
      ];
      const srcQuad: Quad = [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }];
      const H = homography(srcQuad, dst);
      const warped = warpPerspective(new Uint8Array(src), info.width, info.height, 3, invert3x3(H), BW, BH);
      // Composite: where warped pixel is untouched (exact 255,255,255 fill), keep background.
      const out = Buffer.from(bgRaw);
      const Hinv = invert3x3(H);
      for (let y = 0; y < BH; y++) {
        for (let x = 0; x < BW; x++) {
          const ww = Hinv[6]! * x + Hinv[7]! * y + Hinv[8]!;
          const sx = (Hinv[0]! * x + Hinv[1]! * y + Hinv[2]!) / ww;
          const sy = (Hinv[3]! * x + Hinv[4]! * y + Hinv[5]!) / ww;
          if (sx >= 0 && sy >= 0 && sx < w - 1 && sy < h - 1) {
            const i = (y * BW + x) * 3;
            out[i] = warped[i]!;
            out[i + 1] = warped[i + 1]!;
            out[i + 2] = warped[i + 2]!;
          }
        }
      }
      return sharp(out, { raw: { width: BW, height: BH, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
    }
  }
}

/* ---------------- Synthetic documents (all fictional) ---------------- */

export const RECEIPTS: ReceiptSpec[] = [
  {
    id: 'syn_grocery_inr',
    lines: [
      { t: 'GREENLEAF FRESH MART', size: 30, bold: true, align: 'center' },
      { t: '12, Lake View Road, Guntur 522002', size: 17, align: 'center' },
      { t: 'GSTIN: 37ABCDE1234F1Z5', size: 17, align: 'center' },
      { t: 'TAX INVOICE', size: 20, bold: true, align: 'center' },
      { rule: true },
      { l: 'Bill No: GF-20481', r: 'Date: 14/10/2026', size: 18 },
      { l: 'Cashier: 03', r: 'Time: 18:42', size: 18 },
      { rule: true },
      { l: 'Item           Qty   Rate', r: 'Amount', size: 18, bold: true },
      { l: 'Basmati Rice 5kg  1  540.00', r: '540.00', size: 18 },
      { l: 'Toor Dal 1kg      2  165.00', r: '330.00', size: 18 },
      { l: 'Milk 1L           3   62.00', r: '186.00', size: 18 },
      { l: 'Sunflower Oil 1L  1  158.00', r: '158.00', size: 18 },
      { rule: true },
      { l: 'Sub Total', r: '1214.00', size: 19 },
      { l: 'CGST 2.5%', r: '30.35', size: 19 },
      { l: 'SGST 2.5%', r: '30.35', size: 19 },
      { l: 'Round Off', r: '0.30', size: 19 },
      { l: 'GRAND TOTAL', r: 'Rs. 1,275.00', size: 24, bold: true },
      { rule: true },
      { l: 'Paid by UPI', r: '1,275.00', size: 18 },
      { t: 'Thank you! Visit again', size: 18, align: 'center' },
    ],
    truth: { isBill: true, merchant: 'GREENLEAF FRESH MART', date: '2026-10-14', total: 1275, currency: 'INR', category: 'Groceries', documentClass: 'grocery_receipt' },
  },
  {
    id: 'syn_restaurant_inr',
    lines: [
      { t: 'SPICE COURTYARD RESTAURANT', size: 28, bold: true, align: 'center' },
      { t: 'MG Road, Vijayawada', size: 17, align: 'center' },
      { t: 'Ph: 0866 2456789', size: 17, align: 'center' },
      { rule: true },
      { l: 'Table: 7   Covers: 2', r: '05-Oct-2026', size: 18 },
      { l: 'Steward: Ravi', r: '21:15', size: 18 },
      { rule: true },
      { l: 'Paneer Tikka      1', r: '320.00', size: 18 },
      { l: 'Chicken Biryani   2', r: '640.00', size: 18 },
      { l: 'Butter Naan       4', r: '200.00', size: 18 },
      { l: 'Sweet Lassi       2', r: '160.00', size: 18 },
      { rule: true },
      { l: 'Subtotal', r: '1320.00', size: 19 },
      { l: 'Service Charge 5%', r: '66.00', size: 19 },
      { l: 'CGST 2.5%', r: '33.00', size: 19 },
      { l: 'SGST 2.5%', r: '33.00', size: 19 },
      { l: 'Net Amount', r: '1452.00', size: 24, bold: true },
      { t: 'Thank you for dining with us', size: 17, align: 'center' },
    ],
    truth: { isBill: true, merchant: 'SPICE COURTYARD RESTAURANT', date: '2026-10-05', total: 1452, currency: 'INR', category: 'Food', documentClass: 'restaurant_bill' },
  },
  {
    id: 'syn_electricity_inr',
    font: 'DejaVu Sans',
    width: 760,
    lines: [
      { t: 'COASTAL POWER DISTRIBUTION LTD', size: 28, bold: true, align: 'center' },
      { t: 'Electricity Bill', size: 22, align: 'center' },
      { rule: true },
      { l: 'Consumer No: 4410023981', r: 'Bill Date: 02/10/2026', size: 18 },
      { l: 'Billing Period: Sep 2026', r: 'Due Date: 16/10/2026', size: 18 },
      { l: 'Meter No: CP-88213', r: 'Units Consumed: 214 kWh', size: 18 },
      { rule: true },
      { l: 'Energy Charges', r: '1,391.00', size: 19 },
      { l: 'Fixed Charges', r: '120.00', size: 19 },
      { l: 'Electricity Duty', r: '85.00', size: 19 },
      { l: 'Sub Total', r: '1,596.00', size: 19 },
      { l: 'Amount Payable (Rs.)', r: '1,596.00', size: 24, bold: true },
      { gap: 10 },
      { t: 'Pay before the due date to avoid surcharge.', size: 16 },
    ],
    truth: { isBill: true, merchant: 'COASTAL POWER DISTRIBUTION LTD', date: '2026-10-02', total: 1596, currency: 'INR', category: 'Utilities', documentClass: 'utility_bill' },
  },
  {
    id: 'syn_cafe_usd',
    lines: [
      { t: 'NORTHWIND COFFEE CO.', size: 28, bold: true, align: 'center' },
      { t: '88 Harbor Street, Portland', size: 17, align: 'center' },
      { rule: true },
      { l: 'Order #4471', r: 'Oct 03, 2026', size: 18 },
      { rule: true },
      { l: 'Cappuccino Large', r: '$5.20', size: 18 },
      { l: 'Blueberry Muffin', r: '$3.80', size: 18 },
      { l: 'Iced Latte', r: '$4.90', size: 18 },
      { rule: true },
      { l: 'Subtotal', r: '$13.90', size: 19 },
      { l: 'Tax 8.5%', r: '$1.18', size: 19 },
      { l: 'Tip', r: '$2.00', size: 19 },
      { l: 'TOTAL', r: '$17.08', size: 24, bold: true },
      { l: 'VISA ****1234', r: '$17.08', size: 18 },
    ],
    truth: { isBill: true, merchant: 'NORTHWIND COFFEE CO.', date: '2026-10-03', total: 17.08, currency: 'USD', category: 'Food', documentClass: 'restaurant_bill' },
  },
  {
    id: 'syn_pharmacy_inr',
    lines: [
      { t: 'CAREWELL PHARMACY', size: 30, bold: true, align: 'center' },
      { t: 'Station Road, Tenali', size: 17, align: 'center' },
      { t: 'D.L.No: AP/20B/1123', size: 16, align: 'center' },
      { rule: true },
      { l: 'Bill No: 7781', r: 'Date: 28/09/2026', size: 18 },
      { rule: true },
      { l: 'Paracetamol Tab 500mg', r: '32.00', size: 18 },
      { l: 'Cough Syrup 100ml', r: '118.00', size: 18 },
      { l: 'Vitamin C Tablets', r: '210.00', size: 18 },
      { rule: true },
      { l: 'Total', r: '360.00', size: 19 },
      { l: 'Discount', r: '36.00', size: 19 },
      { l: 'Net Payable', r: '324.00', size: 24, bold: true },
      { t: 'Get well soon', size: 17, align: 'center' },
    ],
    truth: { isBill: true, merchant: 'CAREWELL PHARMACY', date: '2026-09-28', total: 324, currency: null, category: 'Healthcare', documentClass: 'receipt' },
  },
];

export const NON_BILLS: ReceiptSpec[] = [
  {
    id: 'syn_id_card',
    font: 'DejaVu Sans',
    width: 700,
    lines: [
      { t: 'SPECIMEN — SYNTHETIC SAMPLE', size: 18, align: 'center' },
      { t: 'REPUBLIC OF EXAMPLELAND', size: 26, bold: true, align: 'center' },
      { t: 'IDENTITY CARD', size: 24, bold: true, align: 'center' },
      { gap: 20 },
      { t: 'Name: SAMPLE PERSON', size: 20 },
      { t: 'Date of Birth: 01/01/1990', size: 20 },
      { t: 'Gender: X', size: 20 },
      { t: 'Nationality: Exampleland', size: 20 },
      { t: 'ID No: 0000 0000 0000', size: 20 },
      { t: 'Valid till: 01/01/2035', size: 20 },
      { gap: 10 },
      { t: "Holder's Signature", size: 18 },
    ],
    truth: { isBill: false, merchant: null, date: null, total: null, currency: null, category: null, documentClass: 'id_card' },
  },
  {
    id: 'syn_letter',
    font: 'DejaVu Serif',
    width: 760,
    lines: [
      { t: 'Dear Hiring Committee,', size: 20 },
      { gap: 10 },
      { t: 'I am writing to express my interest in the internship', size: 19 },
      { t: 'programme announced last month. I have attached my resume', size: 19 },
      { t: 'and look forward to hearing from you at your convenience.', size: 19 },
      { gap: 10 },
      { t: 'Thank you for considering my application.', size: 19 },
      { gap: 20 },
      { t: 'Yours sincerely,', size: 19 },
      { t: 'A. Sample', size: 19 },
    ],
    truth: { isBill: false, merchant: null, date: null, total: null, currency: null, category: null, documentClass: 'letter_or_form' },
  },
];

/** A synthetic "photo": colourful gradient with a skin-toned ellipse — stands in for a selfie in tests. */
export async function syntheticPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a7bd5"/><stop offset="1" stop-color="#00d2a8"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <ellipse cx="450" cy="520" rx="230" ry="300" fill="#e0ac8a"/>
    <ellipse cx="450" cy="300" rx="250" ry="140" fill="#3b2a20"/>
    <rect x="200" y="860" width="500" height="340" rx="80" fill="#c0392b"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

export async function syntheticBlank(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 1200, channels: 3, background: '#f4f4f2' } }).png().toBuffer();
}

/** Synthetic chat screenshot (PNG, phone aspect ratio, no EXIF). */
export async function syntheticChatScreenshot(): Promise<Buffer> {
  const bubbles = [
    ['Hey, are we still meeting today?', 'left', '10:02 AM'],
    ['Yes! See you at 5', 'right', '10:04 AM'],
    ['Great, I will bring the notes', 'left', '10:05 AM'],
    ['Perfect. Reply when you leave', 'right', '10:07 AM'],
    ['Leaving now', 'left', '4:31 PM'],
  ];
  const rows = bubbles
    .map(([text, side, time], i) => {
      const y = 260 + i * 210;
      const x = side === 'left' ? 60 : 380;
      return `<rect x="${x}" y="${y}" width="640" height="150" rx="36" fill="${side === 'left' ? '#ffffff' : '#d9fdd3'}"/>
        <text x="${x + 36}" y="${y + 70}" font-family="DejaVu Sans" font-size="38" fill="#111">${esc(text!)}</text>
        <text x="${x + 600}" y="${y + 125}" font-family="DejaVu Sans" font-size="28" text-anchor="end" fill="#555">${time}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="2400"><rect width="100%" height="100%" fill="#efe7dd"/>
    <rect width="100%" height="200" fill="#075e54"/><text x="60" y="130" font-family="DejaVu Sans" font-size="48" fill="#fff">Sample Friend</text>
    <text x="60" y="180" font-family="DejaVu Sans" font-size="30" fill="#cfe">online</text>${rows}
    <text x="540" y="2300" font-family="DejaVu Sans" font-size="34" text-anchor="middle" fill="#666">Type a message</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
