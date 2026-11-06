/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G3 — Image preprocessing and computer vision.
 *
 * Steps (each is applied only when its own check says it helps):
 *   1. limit size (≤ 2400 px long side)            — bounded memory/latency
 *   2. document boundary detection                  — Otsu mask + largest bright component
 *   3. perspective correction (4-point homography)  — only for a confident quadrilateral
 *   4. deskew (projection-profile search ±8°)        — only when |angle| ≥ 0.5°
 *   5. illumination flattening                      — only when lighting is uneven
 *   6. greyscale, contrast stretch, mild sharpen, upscale small text
 *
 * The original upload is never modified; it is stored separately for traceability.
 */
import sharp from 'sharp';
import { homography, invert3x3, otsuThreshold, toGray, warpPerspective, type GrayImage, type Point, type Quad } from './image/raster.ts';

export const MAX_WORKING_SIDE = 2400;

export interface DocumentDetection {
  found: boolean;
  /** Corners in the coordinates of the analysed (downscaled) image */
  quad: Quad | null;
  /** Fraction of the frame covered by the document region */
  areaFraction: number;
  /** How well the quad explains the region (region area / quad area) */
  rectangularity: number;
  touchesBorderSides: number;
  /** Angle of the document's top edge in degrees (positive = clockwise) */
  edgeAngle: number | null;
  /** True when the corners are not an axis-aligned rectangle (> ~3% corner offset) */
  perspectiveDistorted: boolean;
  analysedWidth: number;
  analysedHeight: number;
}

function boxBlur(img: GrayImage, radius: number): Uint8Array {
  const { data, width, height } = img;
  const tmp = new Float32Array(width * height);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += data[y * width + Math.min(width - 1, Math.max(0, x))]!;
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = acc / (2 * radius + 1);
      const add = Math.min(width - 1, x + radius + 1);
      const sub = Math.max(0, x - radius);
      acc += data[y * width + add]! - data[y * width + sub]!;
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(height - 1, Math.max(0, y)) * width + x]!;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = Math.round(acc / (2 * radius + 1));
      const add = Math.min(height - 1, y + radius + 1);
      const sub = Math.max(0, y - radius);
      acc += tmp[add * width + x]! - tmp[sub * width + x]!;
    }
  }
  return out;
}

/** Locate the (usually brighter) paper region against the background. */
export function detectDocument(gray: GrayImage): DocumentDetection {
  const { width, height } = gray;
  const blurred = boxBlur(gray, 3);
  const t = otsuThreshold(blurred);
  const mask = new Uint8Array(width * height);
  let bright = 0;
  for (let i = 0; i < mask.length; i++) {
    if (blurred[i]! > t) {
      mask[i] = 1;
      bright++;
    }
  }
  const empty: DocumentDetection = {
    found: false, quad: null, areaFraction: 0, rectangularity: 0, touchesBorderSides: 0, edgeAngle: null,
    perspectiveDistorted: false, analysedWidth: width, analysedHeight: height,
  };
  if (bright === 0) return empty;

  // Largest 4-connected bright component (iterative flood fill).
  const labels = new Int32Array(width * height);
  let bestLabel = 0;
  let bestSize = 0;
  let label = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    label++;
    let size = 0;
    stack.push(start);
    labels[start] = label;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % width;
      const y = (p - x) / width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of neighbours) {
        if (q >= 0 && mask[q] && !labels[q]) {
          labels[q] = label;
          stack.push(q);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
  }
  // Fill holes (text) implicitly by using extreme points + area of the filled row spans.
  let tl: Point = { x: 0, y: 0 };
  let tr: Point = { x: 0, y: 0 };
  let br: Point = { x: 0, y: 0 };
  let bl: Point = { x: 0, y: 0 };
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  let filledArea = 0;
  const touch = { top: 0, bottom: 0, left: 0, right: 0 };
  for (let y = 0; y < height; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] !== bestLabel) continue;
      if (first < 0) first = x;
      last = x;
      const s = x + y;
      const d = x - y;
      if (s < minSum) { minSum = s; tl = { x, y }; }
      if (s > maxSum) { maxSum = s; br = { x, y }; }
      if (d > maxDiff) { maxDiff = d; tr = { x, y }; }
      if (d < minDiff) { minDiff = d; bl = { x, y }; }
      if (y <= 1) touch.top++;
      if (y >= height - 2) touch.bottom++;
      if (x <= 1) touch.left++;
      if (x >= width - 2) touch.right++;
    }
    if (first >= 0) filledArea += last - first + 1;
  }
  const quad: Quad = [tl, tr, br, bl];
  const quadArea = Math.abs(
    (tl.x * tr.y - tr.x * tl.y) + (tr.x * br.y - br.x * tr.y) + (br.x * bl.y - bl.x * br.y) + (bl.x * tl.y - tl.x * bl.y),
  ) / 2;
  const areaFraction = filledArea / (width * height);
  const rectangularity = quadArea > 0 ? Math.min(1, filledArea / quadArea) : 0;
  const touchesBorderSides =
    Number(touch.top > width * 0.2) + Number(touch.bottom > width * 0.2) + Number(touch.left > height * 0.2) + Number(touch.right > height * 0.2);
  const edgeAngle = (Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI;
  const diag = Math.hypot(width, height);
  const axisOffset = Math.max(Math.abs(tl.y - tr.y), Math.abs(bl.y - br.y), Math.abs(tl.x - bl.x), Math.abs(tr.x - br.x)) / diag;
  return {
    found: areaFraction >= 0.12,
    quad,
    areaFraction,
    rectangularity,
    touchesBorderSides,
    edgeAngle,
    perspectiveDistorted: axisOffset > 0.03,
    analysedWidth: width,
    analysedHeight: height,
  };
}

/** Projection-profile skew estimate on dark (text) pixels. Returns degrees; positive means text slopes downward to the right. */
export function estimateSkew(gray: GrayImage, maxAngle = 8): number | null {
  const { data, width, height } = gray;
  const t = otsuThreshold(data);
  const pts: Array<[number, number]> = [];
  const step = Math.max(1, Math.floor((width * height) / 120_000));
  for (let i = 0; i < data.length; i += step) {
    if (data[i]! < t) pts.push([i % width, Math.floor(i / width)]);
  }
  if (pts.length < 200 || pts.length > data.length * 0.6 / step) return null;
  const score = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    const sin = Math.sin(r);
    const cos = Math.cos(r);
    const bins = new Float64Array(height * 2 + 4);
    for (const [x, y] of pts) {
      const yr = Math.round(y * cos - x * sin + height * 0.5);
      if (yr >= 0 && yr < bins.length) bins[yr]!++;
    }
    let mean = 0;
    for (const v of bins) mean += v;
    mean /= bins.length;
    let variance = 0;
    for (const v of bins) variance += (v - mean) * (v - mean);
    return variance;
  };
  let best = 0;
  let bestScore = -1;
  for (let a = -maxAngle; a <= maxAngle; a += 0.5) {
    const s = score(a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  for (let a = best - 0.4; a <= best + 0.4; a += 0.1) {
    const s = score(a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return Math.round(best * 10) / 10;
}

export interface PreprocessResult {
  /** Image handed to OCR (greyscale, enhanced). */
  ocrPng: Buffer;
  /** Colour, geometry-corrected image used for display, VLM and evidence boxes. */
  correctedPng: Buffer;
  width: number;
  height: number;
  steps: string[];
  detection: DocumentDetection;
  skewDegrees: number | null;
}

export interface PreprocessOptions {
  /** Manual rotation requested by the user (degrees, multiple of 90). */
  rotate?: number;
  /** Disable automatic perspective/crop (e.g. user already cropped). */
  disableAutoCrop?: boolean;
}

export async function preprocessPage(png: Buffer, options: PreprocessOptions = {}): Promise<PreprocessResult> {
  const steps: string[] = [];
  const working = sharp(png);
  const meta = await working.metadata();
  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  if (Math.max(width, height) > MAX_WORKING_SIDE) {
    const f = MAX_WORKING_SIDE / Math.max(width, height);
    width = Math.round(width * f);
    height = Math.round(height * f);
    steps.push(`resized to ${width}×${height}`);
  }
  let current = await working.resize({ width, height, fit: 'fill' }).png().toBuffer();
  if (options.rotate && options.rotate % 360 !== 0) {
    current = await sharp(current).rotate(options.rotate).png().toBuffer();
    const m = await sharp(current).metadata();
    width = m.width ?? width;
    height = m.height ?? height;
    steps.push(`rotated ${options.rotate}° (user request)`);
  }

  const gray = await toGray(current, 600);
  const detection = detectDocument(gray);

  // Perspective correction / crop when a convincing document quadrilateral is visible against a background.
  const usableQuad =
    !options.disableAutoCrop &&
    detection.found &&
    detection.quad &&
    detection.areaFraction < 0.93 &&
    detection.rectangularity > 0.85 &&
    detection.touchesBorderSides <= 1;
  if (usableQuad && detection.quad) {
    const s = gray.scale;
    const q = detection.quad.map((p) => ({ x: p.x * s, y: p.y * s })) as Quad;
    const [tl, tr, br, bl] = q;
    const outW = Math.round((Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2);
    const outH = Math.round((Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2);
    if (outW > 150 && outH > 150) {
      const { data, info } = await sharp(current).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const dst: Quad = [{ x: 0, y: 0 }, { x: outW - 1, y: 0 }, { x: outW - 1, y: outH - 1 }, { x: 0, y: outH - 1 }];
      const h = homography(q, dst);
      const warped = warpPerspective(new Uint8Array(data), info.width, info.height, info.channels, invert3x3(h), outW, outH);
      current = await sharp(Buffer.from(warped), { raw: { width: outW, height: outH, channels: info.channels as 3 } }).png().toBuffer();
      width = outW;
      height = outH;
      steps.push(detection.perspectiveDistorted ? 'perspective corrected (4-point homography)' : 'cropped to document boundary');
    }
  }

  // Residual skew.
  const gray2 = await toGray(current, 900);
  const skew = estimateSkew(gray2);
  if (skew !== null && Math.abs(skew) >= 0.5) {
    current = await sharp(current).rotate(-skew, { background: '#ffffff' }).png().toBuffer();
    const m = await sharp(current).metadata();
    width = m.width ?? width;
    height = m.height ?? height;
    steps.push(`deskewed by ${(-skew).toFixed(1)}°`);
  }

  const correctedPng = current;

  // OCR-oriented enhancement.
  const g = await toGray(current, MAX_WORKING_SIDE);
  const blocks = blockMeans(g, 8);
  const unevenness = blocks.length ? (Math.max(...blocks) - Math.min(...blocks)) / 255 : 0;
  let pipeline = sharp(current).greyscale();
  if (unevenness > 0.35) {
    const flat = flattenIllumination(g);
    pipeline = sharp(Buffer.from(flat), { raw: { width: g.width, height: g.height, channels: 1 } });
    steps.push('illumination flattened (shadow/uneven light)');
  }
  pipeline = pipeline.normalise({ lower: 1, upper: 99 }).sharpen({ sigma: 0.8 });
  steps.push('greyscale + contrast stretch + mild sharpen');
  if (g.width < 1100) {
    const ocrWidth = Math.min(1800, g.width * 2);
    pipeline = pipeline.resize({ width: ocrWidth, kernel: 'lanczos3' });
    steps.push(`upscaled for OCR to width ${ocrWidth}`);
  }
  const ocrPng = await pipeline.png().toBuffer();
  return { ocrPng, correctedPng, width, height, steps, detection, skewDegrees: skew };
}

export function blockMeans(img: GrayImage, grid: number): number[] {
  const out: number[] = [];
  const bw = Math.floor(img.width / grid);
  const bh = Math.floor(img.height / grid);
  if (bw < 2 || bh < 2) return out;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      // Use the 80th percentile of each block: approximates paper brightness, ignoring dark text.
      const vals: number[] = [];
      for (let y = gy * bh; y < (gy + 1) * bh; y += 2) for (let x = gx * bw; x < (gx + 1) * bw; x += 2) vals.push(img.data[y * img.width + x]!);
      vals.sort((a, b) => a - b);
      out.push(vals[Math.floor(vals.length * 0.8)] ?? 0);
    }
  }
  return out;
}

/** Divide by a heavily blurred background estimate (classic shadow removal). */
export function flattenIllumination(img: GrayImage): Uint8Array {
  const radius = Math.max(8, Math.round(Math.min(img.width, img.height) / 25));
  const first = boxBlur({ ...img, data: dilate(img) }, radius);
  const bg = boxBlur({ ...img, data: first }, radius);
  const out = new Uint8Array(img.data.length);
  for (let i = 0; i < out.length; i++) {
    const b = Math.max(1, bg[i]!);
    out[i] = Math.min(255, Math.round((img.data[i]! / b) * 235));
  }
  return out;
}

/** 3×3 max filter — removes thin dark text strokes from the background estimate. */
function dilate(img: GrayImage): Uint8Array {
  const { data, width, height } = img;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx));
          const v = data[yy * width + xx]!;
          if (v > m) m = v;
        }
      }
      out[y * width + x] = m;
    }
  }
  return out;
}
