/* Write the OCR text BillKit produces for each image (for CER/WER evaluation in training/ocr/). */
import fs from 'node:fs';
import path from 'node:path';
import { processDocument, shutdownOcr } from '../../ai/src/index.ts';

const args = process.argv.slice(2);
const get = (k: string) => args[args.indexOf(`--${k}`) + 1];
const images = get('images');
const out = get('out') ?? 'evaluation/results/ocr_output';
if (!images || !fs.existsSync(images)) {
  console.log('Usage: npx tsx evaluation/scripts/dump-ocr.ts --images DIR [--out DIR]');
  process.exit(images ? 1 : 0);
}
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(images).filter((x) => /\.(jpe?g|png|webp|heic|pdf)$/i.test(x))) {
  const { result } = await processDocument({ files: [fs.readFileSync(path.join(images, f))], options: { userConfirmedBill: true } });
  fs.writeFileSync(path.join(out, `${path.parse(f).name}.txt`), result.ocrText);
  console.log(`${f}: ${result.ocrText.split('\n').length} lines`);
}
await shutdownOcr();
