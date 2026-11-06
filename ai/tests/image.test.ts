import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { decodeUploads, detectFormat } from '../src/image/decode.ts';
import { assessQuality } from '../src/quality.ts';
import { detectDocument, estimateSkew, preprocessPage } from '../src/preprocess.ts';
import { toGray } from '../src/image/raster.ts';
import { RECEIPTS, renderPng, degrade } from '../scripts/synthetic.ts';

const minimalPdf = (text: string) => {
  const stream = `BT /F1 18 Tf 30 350 Td (${text}) Tj ET`;
  return Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${stream.length}>>stream
${stream}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`);
};

describe('G1 acquisition', () => {
  it('detects formats from magic bytes, not names', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    const jpg = await sharp(png).jpeg().toBuffer();
    expect(detectFormat(png)).toBe('png');
    expect(detectFormat(jpg)).toBe('jpeg');
    expect(detectFormat(minimalPdf('x'))).toBe('pdf');
    expect(detectFormat(Buffer.from('GIF89a-not-supported'))).toBeNull();
  });
  it('rejects unsupported, tiny and corrupted files with safe messages', async () => {
    await expect(decodeUploads([Buffer.from('hello world, not an image')])).rejects.toMatchObject({ code: 'unsupported_format' });
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(decodeUploads([tiny])).rejects.toMatchObject({ code: 'image_too_small' });
    const png = await renderPng(RECEIPTS[0]!);
    await expect(decodeUploads([png.subarray(0, 200)])).rejects.toMatchObject({ code: 'corrupted_image' });
    await expect(decodeUploads([])).rejects.toMatchObject({ code: 'no_file' });
  });
  it('applies EXIF orientation and supports multi-image documents', async () => {
    const png = await renderPng(RECEIPTS[0]!);
    const meta = await sharp(png).metadata();
    const rotatedExif = await sharp(png).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const { pages, metadata } = await decodeUploads([rotatedExif, png]);
    expect(pages).toHaveLength(2);
    expect(metadata[0]!.exifOrientation).toBe(6);
    expect(pages[0]!.width).toBe(meta.height); // rotated upright
  });
  it('uses the text layer of born-digital PDFs', async () => {
    const { pages } = await decodeUploads([minimalPdf('TOTAL 1250.00 and some more words')]);
    expect(pages[0]!.sourceFormat).toBe('pdf');
    expect(pages[0]!.pdfText?.map((t) => t.str).join(' ')).toContain('TOTAL 1250.00');
  }, 30_000); // the first pdf.js load can take several seconds on a busy machine
});

describe('G2 quality & G3 preprocessing', () => {
  it('detects blur and low resolution without rejecting', async () => {
    const png = await renderPng(RECEIPTS[1]!);
    const clean = await assessQuality({ png, width: 1, height: 1000 });
    const blurred = await degrade(png, 'blur');
    const m = await sharp(blurred).metadata();
    const q = await assessQuality({ png: blurred, width: m.width!, height: m.height! });
    expect(q.metrics.laplacianVariance).toBeLessThan(clean.metrics.laplacianVariance);
    expect(q.issues.map((i) => i.code)).toContain('blurry');
    expect(q.retakeSuggestions.join(' ')).toMatch(/blurry/i);
    const low = await assessQuality({ png, width: 400, height: 500 });
    expect(low.issues.map((i) => i.code)).toContain('low_resolution');
  });
  it('finds the document on a background and corrects perspective', async () => {
    const photo = await degrade(await renderPng(RECEIPTS[0]!), 'perspective');
    const det = detectDocument(await toGray(photo, 600));
    expect(det.found).toBe(true);
    expect(det.areaFraction).toBeGreaterThan(0.3);
    expect(det.areaFraction).toBeLessThan(0.9);
    const pre = await preprocessPage(photo);
    expect(pre.steps.join(' ')).toMatch(/perspective corrected|cropped to document/);
  });
  it('estimates skew and deskews', async () => {
    const rotated = await degrade(await renderPng(RECEIPTS[0]!), 'rotated_6');
    const skew = estimateSkew(await toGray(rotated, 900));
    expect(Math.abs(Math.abs(skew ?? 0) - 6)).toBeLessThan(1.2);
    const pre = await preprocessPage(rotated);
    expect(pre.steps.join(' ')).toMatch(/deskewed/);
  });
  it('flattens uneven lighting from shadows', async () => {
    const shadow = await degrade(await renderPng(RECEIPTS[0]!), 'shadow');
    const pre = await preprocessPage(shadow);
    expect(pre.steps.join(' ')).toMatch(/illumination flattened/);
  });
});
