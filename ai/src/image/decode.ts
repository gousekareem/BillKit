/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G1 — Image acquisition: format detection from magic bytes (never from the
 * file name or browser-supplied MIME type), decoding, EXIF orientation,
 * multi-page handling (PDF pages / multiple images) and metadata.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp, { type OutputInfo, type Sharp } from 'sharp';
import { PipelineError } from '../errors.ts';

export type SupportedFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'pdf';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES = 5;
export const MIN_DIMENSION = 200;
export const MAX_PIXELS = 50_000_000;

export interface PdfTextItem {
  str: string;
  /** Normalised bbox (0..1) */
  bbox: [number, number, number, number];
}

export interface DecodedPage {
  /** Upright PNG image (EXIF orientation applied). */
  png: Buffer;
  width: number;
  height: number;
  pageIndex: number;
  sourceFormat: SupportedFormat;
  /** Text layer of a born-digital PDF page, when present. */
  pdfText: PdfTextItem[] | null;
}

export interface ImageMetadata {
  format: SupportedFormat;
  bytes: number;
  exifOrientation: number | null;
  hasExif: boolean;
  /** True for typical phone-camera EXIF; screenshots usually carry none. */
  cameraMake: string | null;
  density: number | null;
}

/** Identify file type from magic bytes. Returns null for anything unsupported. */
export function detectFormat(buf: Buffer): SupportedFormat | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'heic';
  }
  return null;
}

async function readExif(buf: Buffer): Promise<Pick<ImageMetadata, 'exifOrientation' | 'hasExif' | 'cameraMake' | 'density'>> {
  try {
    const meta = await sharp(buf).metadata();
    let cameraMake: string | null = null;
    if (meta.exif) {
      // Minimal scan for the "Make" ASCII value; avoids a full EXIF parser dependency.
      const ascii = meta.exif.toString('latin1');
      const m = /(Apple|samsung|Google|OnePlus|Xiaomi|vivo|OPPO|realme|motorola|HUAWEI|Nokia|Sony|Canon|NIKON)/i.exec(ascii);
      cameraMake = m?.[1] ?? null;
    }
    return { exifOrientation: meta.orientation ?? null, hasExif: Boolean(meta.exif), cameraMake, density: meta.density ?? null };
  } catch {
    return { exifOrientation: null, hasExif: false, cameraMake: null, density: null };
  }
}

async function toUprightPng(input: Buffer, pageIndex: number, sourceFormat: SupportedFormat): Promise<DecodedPage> {
  let img: Sharp;
  try {
    img = sharp(input, { failOn: 'error', limitInputPixels: MAX_PIXELS }).rotate(); // rotate() applies EXIF orientation
  } catch {
    throw new PipelineError('corrupted_image', 'The image could not be decoded.');
  }
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await img.flatten({ background: '#ffffff' }).png().toBuffer({ resolveWithObject: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/pixel limit/i.test(msg)) throw new PipelineError('image_too_large', 'The image has too many pixels to process safely.');
    throw new PipelineError('corrupted_image', 'The image appears to be corrupted or truncated.');
  }
  const { width, height } = out.info;
  if (Math.min(width, height) < MIN_DIMENSION) {
    throw new PipelineError('image_too_small', `The image is only ${width}×${height} pixels; at least ${MIN_DIMENSION}px on the short side is needed.`);
  }
  return { png: out.data, width, height, pageIndex, sourceFormat, pdfText: null };
}

const require = createRequire(import.meta.url);

async function decodePdf(buf: Buffer): Promise<DecodedPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  let doc;
  let task;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buf),
      disableFontFace: true,
      useSystemFonts: false,
      standardFontDataUrl: path.join(pdfjsRoot, 'standard_fonts') + path.sep,
      verbosity: 0,
    });
    doc = await task.promise;
  } catch {
    throw new PipelineError('corrupted_image', 'The PDF could not be opened. It may be corrupted or password-protected.');
  }
  const pages: DecodedPage[] = [];
  const count = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2000 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, viewport: vp, canvas: canvas as any }).promise;
    const png = canvas.toBuffer('image/png');

    const text = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const it of text.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const [, , , , e, f] = it.transform as number[];
      const x = (e ?? 0) / base.width;
      const h = (it.height || 10) / base.height;
      const y = 1 - (f ?? 0) / base.height - h;
      const w = (it.width || it.str.length * 5) / base.width;
      items.push({ str: it.str, bbox: [x, y, w, h] });
    }
    const textChars = items.reduce((n, t) => n + t.str.trim().length, 0);
    pages.push({ png, width: canvas.width, height: canvas.height, pageIndex: i - 1, sourceFormat: 'pdf', pdfText: textChars >= 20 ? items : null });
  }
  await task.destroy();
  return pages;
}

export interface DecodeResult {
  pages: DecodedPage[];
  metadata: ImageMetadata[];
}

/**
 * Decode one or more uploaded files into upright page images.
 * Multiple image files are treated as pages of one document (in upload order).
 */
export async function decodeUploads(files: Buffer[]): Promise<DecodeResult> {
  if (files.length === 0) throw new PipelineError('no_file', 'No file was uploaded.');
  const pages: DecodedPage[] = [];
  const metadata: ImageMetadata[] = [];
  for (const buf of files) {
    if (buf.length > MAX_UPLOAD_BYTES) throw new PipelineError('file_too_large', `Each file must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);
    const format = detectFormat(buf);
    if (!format) throw new PipelineError('unsupported_format', 'Unsupported file type. Use JPG, PNG, WebP, HEIC or PDF.');
    if (format === 'pdf') {
      if (files.length > 1) throw new PipelineError('mixed_upload', 'Upload a PDF on its own, not together with other files.');
      const pdfPages = await decodePdf(buf);
      pages.push(...pdfPages);
      metadata.push({ format, bytes: buf.length, exifOrientation: null, hasExif: false, cameraMake: null, density: null });
      continue;
    }
    let raster = buf;
    if (format === 'heic') {
      try {
        const { default: convert } = await import('heic-convert');
        raster = Buffer.from(await convert({ buffer: buf, format: 'JPEG', quality: 0.92 }));
      } catch {
        throw new PipelineError('corrupted_image', 'The HEIC image could not be converted. Try exporting it as JPG.');
      }
    }
    const exif = await readExif(buf.length && format !== 'heic' ? buf : raster);
    metadata.push({ format, bytes: buf.length, ...exif });
    pages.push(await toUprightPng(raster, pages.length, format));
  }
  if (pages.length > MAX_PAGES) throw new PipelineError('too_many_pages', `A document can have at most ${MAX_PAGES} pages.`);
  return { pages, metadata };
}
