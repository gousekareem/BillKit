/* Client-side image helpers (rotate, crop, camera frame) using canvas. © 2026 Shaik Gouse Kareem. */
export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

export function isHeic(f: File) {
  return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}
export function isPdf(f: File) {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}
export function canEdit(f: File) {
  return !isHeic(f) && !isPdf(f);
}

export function validateFile(f: File, maxMb: number): string | null {
  const okType = ACCEPTED.includes(f.type) || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(f.name);
  if (!okType) return `${f.name}: unsupported type. Use JPG, PNG, WebP, HEIC or PDF.`;
  if (f.size > maxMb * 1024 * 1024) return `${f.name} is larger than ${maxMb} MB.`;
  if (f.size === 0) return `${f.name} is empty.`;
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image in the browser.'));
    img.src = src;
  });
}

async function toFile(canvas: HTMLCanvasElement, name: string, type = 'image/jpeg'): Promise<File> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.92));
  if (!blob) throw new Error('Could not process the image.');
  return new File([blob], name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg'), { type });
}

export async function rotateFile(file: File, degrees: 90 | -90 | 180): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const swap = Math.abs(degrees) === 90;
    const c = document.createElement('canvas');
    c.width = swap ? img.naturalHeight : img.naturalWidth;
    c.height = swap ? img.naturalWidth : img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    return toFile(c, file.name, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Crop with a normalised rectangle (0..1). */
export async function cropFile(file: File, r: { x: number; y: number; w: number; h: number }): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sx = Math.round(r.x * img.naturalWidth);
    const sy = Math.round(r.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(r.w * img.naturalWidth));
    const sh = Math.max(1, Math.round(r.h * img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return toFile(c, file.name, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureFrame(video: HTMLVideoElement): Promise<File> {
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d')!.drawImage(video, 0, 0);
  return toFile(c, `camera-${Date.now()}.jpg`);
}
