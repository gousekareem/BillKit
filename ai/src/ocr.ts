/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G5 — OCR using Tesseract (tesseract.js 7, LSTM engine, WebAssembly).
 * Chosen because it runs fully on our own server (no per-page fees, no image
 * leaves the deployment for OCR), is Apache-2.0 licensed, provides word
 * bounding boxes and word confidences, and the English model ships as an npm
 * package so installs are reproducible and offline-capable.
 *
 * Page segmentation defaults to PSM 4 (single column of variable-sized text):
 * on receipts it keeps a label and its right-aligned amount on one line, which
 * PSM 3 (auto) often splits into separate blocks or drops. Override with OCR_PSM.
 *
 * Born-digital PDFs bypass OCR: their embedded text layer is used directly.
 */
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createScheduler, createWorker, OEM, PSM, type Scheduler } from 'tesseract.js';
import type { PdfTextItem } from './image/decode.ts';
import { PipelineError, throwIfAborted } from './errors.ts';

export interface PixelBox { x0: number; y0: number; x1: number; y1: number }

export interface OcrWord {
  text: string;
  bbox: PixelBox;
  /** 0..1 */
  confidence: number;
}

export interface OcrLine {
  text: string;
  bbox: PixelBox;
  confidence: number;
  words: OcrWord[];
  block: number;
}

export interface OcrPage {
  pageIndex: number;
  width: number;
  height: number;
  words: OcrWord[];
  lines: OcrLine[];
  text: string;
  meanConfidence: number | null;
  engine: string;
  /** Clockwise rotation applied before OCR succeeded (0/90/180/270). */
  rotation: number;
  /** The image the coordinates refer to (after any rotation). */
  imagePng: Buffer;
}

const require = createRequire(import.meta.url);

function resolveLanguages(): { langs: string; langPath: string; gzip: boolean } {
  const configured = (process.env.OCR_LANGS ?? 'eng').trim() || 'eng';
  if (process.env.OCR_LANG_PATH) return { langs: configured, langPath: process.env.OCR_LANG_PATH, gzip: process.env.OCR_LANG_GZIP !== 'false' };
  // Default: English model bundled via the @tesseract.js-data/eng npm package (no network needed).
  const eng = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };
  if (configured !== 'eng') {
    console.warn(`[ocr] OCR_LANGS=${configured} requested but OCR_LANG_PATH is not set; falling back to bundled English model.`);
  }
  return { langs: 'eng', langPath: eng.langPath, gzip: eng.gzip };
}

let schedulerPromise: Promise<{ scheduler: Scheduler; langs: string }> | null = null;

async function getScheduler(): Promise<{ scheduler: Scheduler; langs: string }> {
  if (!schedulerPromise) {
    schedulerPromise = (async () => {
      const { langs, langPath, gzip } = resolveLanguages();
      const scheduler = createScheduler();
      const count = Math.max(1, Math.min(4, Number(process.env.OCR_WORKERS || 1)));
      for (let i = 0; i < count; i++) {
        const worker = await createWorker(langs.split('+'), OEM.LSTM_ONLY, { langPath, gzip, cacheMethod: 'none' });
        await worker.setParameters({ tessedit_pageseg_mode: ((process.env.OCR_PSM || undefined) as PSM | undefined) ?? PSM.SINGLE_COLUMN, preserve_interword_spaces: '1', debug_file: '/dev/null' });
        scheduler.addWorker(worker);
      }
      return { scheduler, langs };
    })().catch((err) => {
      schedulerPromise = null;
      throw err;
    });
  }
  return schedulerPromise;
}

export async function getOcrLanguages(): Promise<string[]> {
  return (await getScheduler()).langs.split('+');
}

export async function shutdownOcr(): Promise<void> {
  if (!schedulerPromise) return;
  const { scheduler } = await schedulerPromise;
  await scheduler.terminate();
  schedulerPromise = null;
}

interface TessWord { text: string; confidence: number; bbox: PixelBox }
interface TessLine { text: string; confidence: number; bbox: PixelBox; words: TessWord[] }
interface TessBlock { paragraphs: Array<{ lines: TessLine[] }> }

async function recognise(png: Buffer): Promise<{ lines: OcrLine[]; words: OcrWord[] }> {
  const { scheduler } = await getScheduler();
  const result = await scheduler.addJob('recognize', png, {}, { blocks: true, text: true });
  const blocks = (result.data.blocks ?? []) as unknown as TessBlock[];
  const lines: OcrLine[] = [];
  const words: OcrWord[] = [];
  blocks.forEach((block, bi) => {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const lw = line.words
          .filter((w) => w.text.trim().length > 0)
          .map((w) => ({ text: w.text.trim(), bbox: w.bbox, confidence: Math.max(0, Math.min(1, w.confidence / 100)) }));
        if (!lw.length) continue;
        words.push(...lw);
        lines.push({ text: lw.map((w) => w.text).join(' '), bbox: line.bbox, confidence: line.confidence / 100, words: lw, block: bi });
      }
    }
  });
  return { lines, words };
}

function quickScore(words: OcrWord[]): number {
  return words.reduce((s, w) => s + (w.confidence > 0.7 && w.text.length >= 3 && /[a-z0-9]{3}/i.test(w.text) ? w.confidence : 0), 0);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** OCR one page. Tries 90/180/270° rotations when the upright read is poor (G1/G3 orientation normalisation). */
export async function ocrPage(png: Buffer, pageIndex: number, signal?: AbortSignal): Promise<OcrPage> {
  throwIfAborted(signal);
  let current = png;
  let rotation = 0;
  let res: { lines: OcrLine[]; words: OcrWord[] };
  try {
    res = await recognise(current);
  } catch (err) {
    throw new PipelineError('ocr_failed', 'Text recognition failed for this image.', { cause: err, retryable: true });
  }
  const upright = mean(res.words.map((w) => w.confidence)) ?? 0;
  const solidWords = res.words.filter((w) => w.confidence > 0.7 && w.text.length >= 3 && /[a-z0-9]{3}/i.test(w.text)).length;
  if (res.words.length < 8 || upright < 0.55 || solidWords < Math.max(6, res.words.length * 0.35)) {
    let best = { rot: 0, score: quickScore(res.words), res, img: png };
    for (const rot of [90, 180, 270]) {
      throwIfAborted(signal);
      const rotated = await sharp(png).rotate(rot).png().toBuffer();
      const trial = await recognise(rotated);
      const s = quickScore(trial.words);
      if (s > best.score * 1.5 && s > 3) best = { rot, score: s, res: trial, img: rotated };
    }
    rotation = best.rot;
    res = best.res;
    current = best.img;
  }
  const meta = await sharp(current).metadata();
  return {
    pageIndex,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    words: res.words,
    lines: res.lines,
    text: res.lines.map((l) => l.text).join('\n'),
    meanConfidence: mean(res.words.map((w) => w.confidence)),
    engine: 'tesseract.js 7 (Tesseract 5 LSTM)',
    rotation,
    imagePng: current,
  };
}

/** Build an OCR-like page from a born-digital PDF text layer (confidence 1.0, exact text). */
export async function pageFromPdfText(items: PdfTextItem[], png: Buffer, pageIndex: number): Promise<OcrPage> {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 1;
  const H = meta.height ?? 1;
  const words: OcrWord[] = [];
  for (const it of items) {
    const [x, y, w, h] = it.bbox;
    const tokens = it.str.split(/\s+/).filter(Boolean);
    const totalChars = it.str.length || 1;
    let offset = 0;
    for (const tok of tokens) {
      const start = it.str.indexOf(tok, offset);
      offset = start + tok.length;
      const x0 = (x + (w * start) / totalChars) * W;
      const x1 = (x + (w * (start + tok.length)) / totalChars) * W;
      words.push({ text: tok, confidence: 1, bbox: { x0, y0: y * H, x1, y1: (y + h) * H } });
    }
  }
  const lines = groupWordsIntoRows(words).map((row, i) => ({
    text: row.map((w) => w.text).join(' '),
    bbox: unionBox(row.map((w) => w.bbox)),
    confidence: 1,
    words: row,
    block: i,
  }));
  return {
    pageIndex, width: W, height: H, words, lines, text: lines.map((l) => l.text).join('\n'), meanConfidence: words.length ? 1 : null,
    engine: 'pdf-text-layer', rotation: 0, imagePng: png,
  };
}

export function unionBox(boxes: PixelBox[]): PixelBox {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

/**
 * Re-group words into visual rows by vertical overlap, independent of Tesseract's
 * block segmentation. Receipts often put a label and its amount in different
 * "columns" that OCR treats as separate blocks; rows put them back together.
 */
export function groupWordsIntoRows(words: OcrWord[]): OcrWord[][] {
  const sorted = [...words].sort((a, b) => (a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2);
  const rows: { words: OcrWord[]; y0: number; y1: number }[] = [];
  for (const w of sorted) {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    const h = w.bbox.y1 - w.bbox.y0;
    const row = rows.find((r) => {
      const rh = r.y1 - r.y0;
      return cy >= r.y0 - Math.min(h, rh) * 0.15 && cy <= r.y1 + Math.min(h, rh) * 0.15 && Math.abs(cy - (r.y0 + r.y1) / 2) < Math.max(h, rh) * 0.6;
    });
    if (row) {
      row.words.push(w);
      row.y0 = Math.min(row.y0, w.bbox.y0);
      row.y1 = Math.max(row.y1, w.bbox.y1);
    } else {
      rows.push({ words: [w], y0: w.bbox.y0, y1: w.bbox.y1 });
    }
  }
  return rows
    .sort((a, b) => a.y0 - b.y0)
    .map((r) => r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}
