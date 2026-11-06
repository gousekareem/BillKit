import type { VlmOutput } from '../src/llm/schema.ts';
import type { OcrPage, OcrWord } from '../src/ocr.ts';
import { analyseLayout } from '../src/layout.ts';

/** Build a fake OCR page from text lines: one char = 12px, one line = 34px. Pass "LEFT|RIGHT" to right-align. */
export function fakePage(lines: string[], confidence = 0.95, width = 600): OcrPage {
  const words: OcrWord[] = [];
  lines.forEach((line, li) => {
    const y0 = 20 + li * 34;
    const place = (text: string, startX: number) => {
      let x = startX;
      for (const tok of text.split(/\s+/).filter(Boolean)) {
        words.push({ text: tok, confidence, bbox: { x0: x, y0, x1: x + tok.length * 12, y1: y0 + 24 } });
        x += (tok.length + 1) * 12;
      }
    };
    const [left, right] = line.split('|');
    place(left ?? '', 20);
    if (right) place(right, width - 20 - right.length * 12);
  });
  const height = 40 + lines.length * 34;
  return { pageIndex: 0, width, height, words, lines: [], text: lines.join('\n'), meanConfidence: confidence, engine: 'fake', rotation: 0, imagePng: Buffer.alloc(0) };
}

export function layoutOf(lines: string[], confidence = 0.95) {
  return analyseLayout([fakePage(lines, confidence)]);
}

export const nf = (value: number | null, evidence: string | null = null) => ({ value, evidence, confidence: value === null ? null : 0.9 });
export const sf = (value: string | null, evidence: string | null = value) => ({ value, evidence, confidence: value === null ? null : 0.9 });
export const vlmOutput = (over: Partial<VlmOutput> = {}): VlmOutput => ({
  is_bill: true, document_type: 'receipt', classification_confidence: 0.95, classification_reason: 'Printed receipt with totals',
  merchant_name: sf('SUNRISE BAKERY'), bill_date: { value: '2026-08-12', evidence: '12/08/2026', confidence: 0.9 }, bill_date_raw: '12/08/2026',
  currency: { value: null, evidence: null, confidence: null }, total_amount: nf(231.5, 'Grand Total 231.50'), subtotal: nf(230), tax: nf(11.5),
  discount: nf(10), service_charge: nf(null), tip: nf(null), invoice_number: sf(null), payment_method: sf('Cash'),
  category: { value: 'Food', confidence: 0.8, reason: 'bakery items' }, line_items: [], document_contains_instructions: false, notes: [], ...over,
});

