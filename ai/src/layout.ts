/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G6 — Document understanding and layout analysis (rule-based).
 * Turns OCR words into visual rows, labels coarse regions (header, items
 * table, totals, footer), detects the item-table header and key–value rows,
 * and keeps a pointer from every row back to its OCR words and bounding box
 * so extracted values remain traceable to evidence.
 */
import type { BBox } from '@billkit/shared';
import { MONEY_TOKEN_RE, findDateCandidates, parseAmount } from '@billkit/shared';
import { groupWordsIntoRows, unionBox, type OcrPage, type OcrWord, type PixelBox } from './ocr.ts';

export type Region = 'header' | 'items' | 'totals' | 'footer' | 'body';

export interface Row {
  index: number;
  page: number;
  text: string;
  words: OcrWord[];
  bbox: PixelBox;
  /** Normalised bbox on its page */
  nbbox: BBox;
  confidence: number;
  /** Mean word height relative to page height (font-size proxy) */
  relHeight: number;
  /** Vertical position of the row centre on its page (0 top .. 1 bottom) */
  yNorm: number;
  region: Region;
  amounts: Array<{ value: number; raw: string; words: OcrWord[] }>;
}

export interface KeyValue {
  key: string;
  value: string;
  rowIndex: number;
}

export interface LayoutAnalysis {
  rows: Row[];
  tableHeaderRow: number | null;
  itemRows: number[];
  totalsStartRow: number | null;
  keyValues: KeyValue[];
  pages: number;
}

export const TOTALS_KEYWORDS =
  /\b(sub\s?-?total|total|grand\s?total|net\s?(amount|amt|payable|total)|amount\s?(payable|due|paid)|bill\s?amount|balance|tax|gst|cgst|sgst|igst|vat|cess|discount|round(ing)?\s?off|service\s?charge|tip|gratuity|cash|change|tendered|paid)\b/i;
const TABLE_HEADER = /\b(item|items|description|particulars|product|qty|quantity|rate|price|amount|amt|mrp|hsn)\b/gi;
const NOT_ITEM = /\b(ph(one)?|tel|mob(ile)?|gstin?|fssai|bill\s?no|invoice\s?no|order|table|date|time|cashier|steward|waiter|counter|token|consumer|meter|period|units?|card|visa|upi|a\/c|account)\b/i;
const FOOTER_HINTS = /\b(thank|visit again|have a nice|terms|conditions|e\.?\s?&\s?o\.?\s?e|goods once sold|powered by|www\.|http|customer care|feedback)\b/i;

function toNorm(b: PixelBox, page: OcrPage): BBox {
  const W = page.width || 1;
  const H = page.height || 1;
  return [b.x0 / W, b.y0 / H, (b.x1 - b.x0) / W, (b.y1 - b.y0) / H];
}

/** Find money-looking tokens in a row, keeping references to the words that produced them. */
export function findAmounts(words: OcrWord[]): Row['amounts'] {
  const out: Row['amounts'] = [];
  const original = words.map((w) => w.text).join(' ');
  // Blank out dates and clock times so their digits are not mistaken for money (same length keeps offsets).
  let text = original;
  for (const d of findDateCandidates(original)) text = text.slice(0, d.index) + ' '.repeat(d.raw.length) + text.slice(d.index + d.raw.length);
  text = text.replace(/\b\d{1,2}[:.]\d{2}(?::\d{2})?\s?(?:[ap]\.?m\.?)?(?=\s|$)/gi, (m) => (/[:]/.test(m) || /[ap]m/i.test(m) ? ' '.repeat(m.length) : m));
  // Map char offsets → word indices
  const starts: number[] = [];
  let pos = 0;
  for (const w of words) {
    starts.push(pos);
    pos += w.text.length + 1;
  }
  for (const m of text.matchAll(MONEY_TOKEN_RE)) {
    const raw = m[0].trim();
    if (!raw || !/\d/.test(raw)) continue;
    // Skip percentages, dates, times, long IDs, phone numbers.
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 2);
    const before = text.slice(Math.max(0, m.index - 1), m.index);
    if (/^\s?%/.test(after) || /^[/:]\d/.test(after) || /[/:]$/.test(before)) continue;
    const digits = raw.replace(/\D/g, '');
    const hasCurrency = /₹|rs|inr|\$|€|£/i.test(raw);
    // Phone numbers, IDs and long integers are not amounts unless a currency marker is attached.
    if (!hasCurrency && !/[.,]\d{1,2}\)?-?$/.test(raw) && digits.length >= 7) continue;
    if (/#\s*$/.test(text.slice(Math.max(0, m.index - 2), m.index + 1))) continue;
    const parsed = parseAmount(raw);
    if (!parsed) continue;
    const startIdx = starts.findLastIndex((s) => s <= m.index + (m[0].length - m[0].trimStart().length));
    const endIdx = starts.findLastIndex((s) => s < m.index + m[0].length);
    out.push({ value: parsed.value, raw, words: words.slice(Math.max(0, startIdx), Math.max(startIdx, endIdx) + 1) });
  }
  return out;
}

export function analyseLayout(pages: OcrPage[]): LayoutAnalysis {
  const rows: Row[] = [];
  for (const page of pages) {
    const grouped = groupWordsIntoRows(page.words);
    for (const words of grouped) {
      const bbox = unionBox(words.map((w) => w.bbox));
      const heights = words.map((w) => w.bbox.y1 - w.bbox.y0);
      rows.push({
        index: rows.length,
        page: page.pageIndex,
        text: words.map((w) => w.text).join(' '),
        words,
        bbox,
        nbbox: toNorm(bbox, page),
        confidence: words.reduce((s, w) => s + w.confidence, 0) / words.length,
        relHeight: heights.reduce((a, b) => a + b, 0) / heights.length / (page.height || 1),
        yNorm: (bbox.y0 + bbox.y1) / 2 / (page.height || 1),
        region: 'body',
        amounts: findAmounts(words),
      });
    }
  }

  // Table header: a row with ≥ 2 distinct table keywords.
  let tableHeaderRow: number | null = null;
  for (const r of rows) {
    const hits = new Set((r.text.match(TABLE_HEADER) ?? []).map((h) => h.toLowerCase()));
    if (hits.size >= 2) {
      tableHeaderRow = r.index;
      break;
    }
  }

  // Totals start: first totals-keyword row with an amount, in the lower 75% of the document, after the table header.
  let totalsStartRow: number | null = null;
  const lastPage = pages.length ? pages[pages.length - 1]!.pageIndex : 0;
  for (const r of rows) {
    if (tableHeaderRow !== null && r.index <= tableHeaderRow) continue;
    if (r.page !== lastPage && pages.length > 1) continue;
    if (r.yNorm < 0.2) continue;
    if (/\b(sub\s?-?total|total|grand\s?total|net\s?(amount|payable)|amount\s?payable|bill\s?amount)\b/i.test(r.text) && r.amounts.length) {
      totalsStartRow = r.index;
      break;
    }
  }

  const headerEnd = tableHeaderRow ?? rows.find((r) => r.amounts.length && r.yNorm > 0.15 && !TOTALS_KEYWORDS.test(r.text))?.index ?? Math.ceil(rows.length * 0.25);
  const itemRows: number[] = [];
  let footerStart: number | null = null;
  for (const r of rows) {
    if (r.index < headerEnd || (tableHeaderRow !== null && r.index === tableHeaderRow)) {
      r.region = 'header';
    } else if (totalsStartRow !== null && r.index >= totalsStartRow) {
      if (footerStart === null && r.index > totalsStartRow + 1 && FOOTER_HINTS.test(r.text)) footerStart = r.index;
      r.region = footerStart !== null && r.index >= footerStart ? 'footer' : 'totals';
    } else {
      r.region = 'items';
      if (r.amounts.length && /[a-z]{2,}/i.test(r.text) && !TOTALS_KEYWORDS.test(r.text) && !NOT_ITEM.test(r.text)) itemRows.push(r.index);
    }
    if (r.region !== 'header' && FOOTER_HINTS.test(r.text) && r.yNorm > 0.7) r.region = 'footer';
  }

  const keyValues: KeyValue[] = [];
  for (const r of rows) {
    const m = /^([A-Za-z][A-Za-z .#/&()-]{1,40}?)\s*[:\-–]\s*(.+)$/.exec(r.text);
    if (m) keyValues.push({ key: m[1]!.trim(), value: m[2]!.trim(), rowIndex: r.index });
  }

  return { rows, tableHeaderRow, itemRows, totalsStartRow, keyValues, pages: pages.length };
}
