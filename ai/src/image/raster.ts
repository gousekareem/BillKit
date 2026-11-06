/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Small, dependency-free raster helpers operating on 8-bit greyscale buffers.
 */
import sharp from 'sharp';

export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
  /** Factor from this image back to the source image coordinates. */
  scale: number;
}

export async function toGray(png: Buffer, maxSide: number): Promise<GrayImage> {
  const meta = await sharp(png).metadata();
  const w0 = meta.width ?? 1;
  const h0 = meta.height ?? 1;
  const factor = Math.min(1, maxSide / Math.max(w0, h0));
  const { data, info } = await sharp(png)
    .resize({ width: Math.max(1, Math.round(w0 * factor)), height: Math.max(1, Math.round(h0 * factor)), fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height, scale: 1 / factor };
}

export async function toRgb(png: Buffer, maxSide: number): Promise<{ data: Uint8Array; width: number; height: number }> {
  const meta = await sharp(png).metadata();
  const factor = Math.min(1, maxSide / Math.max(meta.width ?? 1, meta.height ?? 1));
  const { data, info } = await sharp(png)
    .resize({ width: Math.max(1, Math.round((meta.width ?? 1) * factor)) })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

/** Variance of the 4-neighbour Laplacian — a standard focus/blur measure. */
export function laplacianVariance(img: GrayImage): number {
  const { data, width, height } = img;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - width]! - data[i + width]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Otsu threshold for an 8-bit histogram. */
export function otsuThreshold(data: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of data) hist[v]!++;
  const total = data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point]; // tl, tr, br, bl

/**
 * Solve the 3×3 homography mapping `src` quad → `dst` quad (8 unknowns,
 * Gaussian elimination with partial pivoting).
 */
export function homography(src: Quad, dst: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) pivot = r;
    [A[col], A[pivot]] = [A[pivot]!, A[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    const p = A[col]![col]!;
    if (Math.abs(p) < 1e-12) throw new Error('Degenerate homography');
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r]![col]! / p;
      for (let c = col; c < n; c++) A[r]![c]! -= f * A[col]![c]!;
      b[r]! -= f * b[col]!;
    }
  }
  const h = b.map((v, i) => v / A[i]![i]!);
  return [...h, 1];
}

/** Warp an RGBA/RGB/gray buffer with inverse homography `hInv` (dst → src), bilinear sampling. */
export function warpPerspective(
  src: Uint8Array,
  sw: number,
  sh: number,
  channels: number,
  hInv: number[],
  dw: number,
  dh: number,
): Uint8Array {
  const out = new Uint8Array(dw * dh * channels).fill(255);
  const [a, b, c, d, e, f, g, h, i] = hInv as [number, number, number, number, number, number, number, number, number];
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const w = g * x + h * y + i;
      const sx = (a * x + b * y + c) / w;
      const sy = (d * x + e * y + f) / w;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let ch = 0; ch < channels; ch++) {
        const p00 = src[(y0 * sw + x0) * channels + ch]!;
        const p10 = src[(y0 * sw + x0 + 1) * channels + ch]!;
        const p01 = src[((y0 + 1) * sw + x0) * channels + ch]!;
        const p11 = src[((y0 + 1) * sw + x0 + 1) * channels + ch]!;
        out[(y * dw + x) * channels + ch] = Math.round(
          p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy,
        );
      }
    }
  }
  return out;
}

export function invert3x3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('Singular matrix');
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}
