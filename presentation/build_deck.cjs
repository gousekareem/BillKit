// Builds presentation/BillKit_Presentation.pptx — © 2026 Shaik Gouse Kareem. All rights reserved.
// Usage: node presentation/build_deck.cjs   (needs pptxgenjs; see presentation/README.md)
const path = require('path');
const pptxgen = require('pptxgenjs');

const ROOT = path.resolve(__dirname, '..');
const A = (p) => path.join(ROOT, p);
const SKILL_THEME = process.env.PPTX_APPLY_THEME; // optional path to apply_theme.js

const THEME = {
  name: 'BillKit',
  headFontFace: 'Arial',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0B1F2A', lt1: 'FFFFFF', dk2: '115E59', lt2: 'F1F5F9',
    accent1: '0F766E', accent2: 'F59E0B', accent3: '14B8A6', accent4: '64748B',
    accent5: 'CCFBF1', accent6: 'FEF3C7', hlink: '0F766E', folHlink: '115E59',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.title = 'BillKit — Every bill, in your pocket.';
pres.author = 'Shaik Gouse Kareem';
pres.company = 'BillKit';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const FOOT = '© 2026 Shaik Gouse Kareem. All rights reserved.';

pres.defineSlideMaster({
  title: 'BK_DARK',
  background: { color: C.text1 },
  objects: [
    { image: { path: A('assets/branding/logo-horizontal-dark-bg.png'), x: 0.6, y: 0.5, w: 2.34, h: 0.5 } },
    { text: { text: FOOT, options: { x: 0.6, y: 6.9, w: 8, h: 0.3, fontSize: 10, color: C.accent5 } } },
  ],
});
pres.defineSlideMaster({
  title: 'BK_CONTENT',
  background: { color: C.background1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { image: { path: A('assets/branding/logo-horizontal-light-bg.png'), x: 11.35, y: 6.92, w: 1.41, h: 0.3 } },
    { text: { text: FOOT, options: { x: 0.6, y: 6.92, w: 6, h: 0.3, fontSize: 10, color: C.accent4 } } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.8, fontSize: 32, bold: true, color: C.text1, fontFace: THEME.headFontFace, valign: 'middle', align: 'left' }, text: '' } },
  ],
  slideNumber: { x: 10.6, y: 6.92, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4 },
});

let n = 0;
const notes = (s, t) => s.addNotes(t);
const text = (s, t, o) => s.addText(t, { isTextBox: true, fontFace: THEME.bodyFontFace, color: C.text1, fontSize: 16, margin: 0, valign: 'top', ...o, objectName: o.objectName || `text${++n}` });
const box = (s, o) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.12, line: { color: o.lineColor || C.background2, width: 1 }, fill: { color: o.fill || C.background2 }, shadow: o.shadow ? { type: 'outer', blur: 6, offset: 2, angle: 90, opacity: 0.18, color: '0B1F2A' } : undefined, x: o.x, y: o.y, w: o.w, h: o.h, objectName: `box${++n}` });
const circleNum = (s, num, x, y, fill = C.accent1, color = C.background1) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.5, h: 0.5, fill: { color: fill }, line: { color: fill }, objectName: `dot${++n}` });
  text(s, String(num), { x, y, w: 0.5, h: 0.5, fontSize: 14, bold: true, color, align: 'center', valign: 'middle' });
};
const bullets = (s, items, o) => text(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8 } })), o);
const content = (title, section) => {
  const s = pres.addSlide({ masterName: 'BK_CONTENT', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  return s;
};
const card = (s, x, y, w, h, head, body, opt = {}) => {
  box(s, { x, y, w, h, fill: opt.fill || C.background2, shadow: opt.shadow });
  text(s, head, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.45, fontSize: 18, bold: true, color: opt.headColor || C.text2, fontFace: THEME.headFontFace });
  if (Array.isArray(body)) bullets(s, body, { x: x + 0.25, y: y + 0.75, w: w - 0.5, h: h - 0.9, fontSize: 14 });
  else text(s, body, { x: x + 0.25, y: y + 0.75, w: w - 0.5, h: h - 0.9, fontSize: 14 });
};
const pending = (s, x, y, w, label) => {
  box(s, { x, y, w, h: 0.5, fill: C.accent6, lineColor: C.accent2 });
  text(s, label, { x: x + 0.2, y, w: w - 0.4, h: 0.5, fontSize: 13, bold: true, color: '92400E', valign: 'middle' });
};

// ---------- 1. Title ----------
pres.addSection({ title: 'Introduction' });
let s = pres.addSlide({ masterName: 'BK_DARK', sectionTitle: 'Introduction' });
text(s, 'BillKit', { x: 0.6, y: 2.0, w: 8, h: 1.1, fontSize: 60, bold: true, color: C.background1, fontFace: THEME.headFontFace });
text(s, 'Every bill, in your pocket.', { x: 0.6, y: 3.1, w: 8, h: 0.6, fontSize: 26, italic: true, color: C.accent3 });
text(s, 'Evidence-aware bill scanning: detect, read, verify, and only then save', { x: 0.6, y: 3.9, w: 7.4, h: 0.9, fontSize: 18, color: C.background2 });
text(s, 'Created and developed by Shaik Gouse Kareem · November 2026', { x: 0.6, y: 5.6, w: 8, h: 0.4, fontSize: 14, color: C.accent5 });
s.addImage({ path: A('assets/screenshots/m02_scan_mobile.png'), x: 9.6, y: 0.6, w: 3.0, h: 6.1, rounding: false, objectName: 'phone' });
notes(s, 'BillKit turns a photo of a bill into a verified expense record. Its core idea: accuracy, evidence and user trust matter more than pretending AI is always right.');

// ---------- 2. Problem ----------
s = content('Paper bills are easy to lose and slow to record', 'Introduction');
const probs = [
  ['Manual entry', 'Typing merchant, date and total for every receipt is slow and error-prone.'],
  ['Messy photos', 'Real receipts are crumpled, faded, tilted, shadowed or photographed in poor light.'],
  ['Confusing numbers', 'Subtotal, tax, discount, amount paid and total all look alike to software.'],
  ['Silent AI errors', 'Scanners that auto-fill fields without showing uncertainty let mistakes slip into records.'],
];
probs.forEach(([h, b], i) => card(s, 0.6 + (i % 2) * 6.15, 1.5 + Math.floor(i / 2) * 2.55, 5.95, 2.3, h, b, { shadow: true }));
notes(s, 'The problem is not only reading text. It is knowing which number is the total, and being honest when the system is unsure.');

// ---------- 3. Solution ----------
s = content('BillKit checks its own work before you save', 'Introduction');
const steps = ['Capture or upload', 'Is it a bill?', 'Read and extract', 'Check the maths', 'Highlight doubt', 'You approve'];
steps.forEach((t, i) => {
  const x = 0.6 + i * 2.05;
  box(s, { x, y: 1.7, w: 1.85, h: 1.5, fill: i === 5 ? C.accent1 : C.background2, shadow: true });
  circleNum(s, i + 1, x + 0.68, 1.85, i === 5 ? C.background1 : C.accent1, i === 5 ? C.accent1 : C.background1);
  text(s, t, { x: x + 0.1, y: 2.45, w: 1.65, h: 0.6, fontSize: 15, bold: true, align: 'center', color: i === 5 ? C.background1 : C.text1 });
});
text(s, 'What makes it different', { x: 0.6, y: 3.7, w: 6, h: 0.45, fontSize: 20, bold: true, color: C.text2, fontFace: THEME.headFontFace });
bullets(s, [
  'Every value links to the line of the photo it came from',
  'Uncertain and missing fields are flagged with text labels, not only colour',
  'Arithmetic is verified, allowing for inclusive tax, discounts and round-off',
  'Non-bills (selfies, ID cards, chat screenshots) are politely rejected with reasons',
  'Nothing is saved until a person approves it; corrections are tracked',
], { x: 0.6, y: 4.25, w: 12, h: 2.5, fontSize: 16 });
notes(s, 'Differentiation: evidence-aware extraction, uncertainty highlighting, mathematical verification and human correction before saving.');

// ---------- 4. Architecture ----------
pres.addSection({ title: 'Architecture' });
s = content('One codebase: a PWA, an API and a shared AI pipeline', 'Architecture');
const arch = [
  ['Browser / PWA', 'React 19 · TypeScript\nCamera, review, history\nOffline copies (IndexedDB)', 0.6],
  ['Fastify API', 'Auth · CSRF · rate limits\nUploads · processing queue\nBills · analytics · export', 3.75],
  ['AI pipeline', 'Quality → preprocess → OCR\n→ classify → extract\n→ categorise → validate', 6.9],
  ['Storage', 'SQLite (users, bills,\ncorrections, metrics)\nImages on disk (UUID paths)', 10.05],
];
arch.forEach(([h, b, x]) => {
  box(s, { x, y: 1.6, w: 2.75, h: 2.6, fill: C.background2, shadow: true });
  text(s, h, { x: x + 0.2, y: 1.8, w: 2.35, h: 0.45, fontSize: 18, bold: true, color: C.text2, fontFace: THEME.headFontFace });
  text(s, b, { x: x + 0.2, y: 2.35, w: 2.35, h: 1.7, fontSize: 14 });
});
[3.4, 6.55, 9.7].forEach((x) => s.addShape(pres.shapes.RIGHT_ARROW, { x, y: 2.7, w: 0.3, h: 0.35, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: `arrow${++n}` }));
box(s, { x: 6.9, y: 4.55, w: 2.75, h: 1.2, fill: C.accent6, lineColor: C.accent2 });
text(s, 'Optional cloud vision model (Anthropic) — only for uncertain bills, only if enabled', { x: 7.05, y: 4.65, w: 2.45, h: 1.0, fontSize: 12 });
box(s, { x: 0.6, y: 4.55, w: 6.0, h: 1.2, fill: C.accent5, lineColor: C.accent5 });
text(s, 'packages/shared: zod schemas and validation used by the browser, the server and the evaluation harness, so all three run the same checks', { x: 0.8, y: 4.65, w: 5.6, h: 1.0, fontSize: 14 });
text(s, 'Full diagram: diagrams/rendered/png/D01_overall_architecture.png', { x: 0.6, y: 6.1, w: 9, h: 0.35, fontSize: 11, color: C.accent4 });
notes(s, 'The backend and the evaluation harness call the same processDocument() function, so evaluation measures exactly what users get.');

// ---------- 5. Tech stack ----------
s = content('Technology stack: private, low-cost, testable', 'Architecture');
s.addImage({ path: A('diagrams/rendered/png/D25_technology_stack.png'), x: 0.6, y: 1.4, w: 7.4, h: 5.36, objectName: 'stackImg' });
card(s, 8.4, 1.4, 4.3, 5.3, 'Key decisions', [
  'PWA, not React Native: one codebase, installable, testable here',
  'Tesseract (tesseract.js): runs on our server, Apache-2.0, no per-page fee',
  'SQLite: zero-ops; PostgreSQL path documented',
  'Argon2id + hashed sessions',
  'Cloud vision model optional and opt-in',
]);
notes(s, 'Each choice is justified in docs/architecture.md and docs/model_selection.md.');

// ---------- 6. AI pipeline ----------
pres.addSection({ title: 'AI/ML' });
s = content('Twelve stages from photo to checked record', 'AI/ML');
const stages = ['Decode', 'Quality', 'Preprocess', 'OCR', 'Classify', 'Layout', 'Extract', 'Vision model\n(optional)', 'Categorise', 'Validate', 'Confidence', 'Review'];
stages.forEach((t, i) => {
  const col = i % 6, row = Math.floor(i / 6);
  const x = 0.6 + col * 2.05, y = 1.6 + row * 1.75;
  box(s, { x, y, w: 1.85, h: 1.35, fill: i === 7 ? C.accent6 : i === 11 ? C.accent1 : C.background2, lineColor: i === 7 ? C.accent2 : undefined, shadow: true });
  text(s, String(i + 1).padStart(2, '0'), { x: x + 0.15, y: y + 0.12, w: 1, h: 0.35, fontSize: 12, bold: true, color: i === 11 ? C.accent5 : C.accent1 });
  text(s, t, { x: x + 0.15, y: y + 0.5, w: 1.6, h: 0.75, fontSize: 15, bold: true, color: i === 11 ? C.background1 : C.text1 });
});
text(s, 'Cheap path first: OCR + transparent rules handle clear bills. The vision model is called only when the classification is ambiguous or required fields are weak, and one call does both classification and extraction.', { x: 0.6, y: 5.3, w: 12.1, h: 1.0, fontSize: 16 });
notes(s, 'These stage names are the same ones the app shows while processing.');

// ---------- 7. Classification ----------
s = content('Bill or not? A transparent evidence scorer', 'AI/ML');
card(s, 0.6, 1.5, 3.9, 4.0, 'Evidence for a bill', ['Bill words: total, invoice, GSTIN, CGST/SGST', 'Rows ending in amounts', 'A date on the page']);
card(s, 4.75, 1.5, 3.9, 4.0, 'Evidence against', ['ID-card, certificate, letter and newspaper patterns', 'Chat timestamps; screenshot traits', 'Almost no text + skin tones or colour → photo']);
card(s, 8.9, 1.5, 3.8, 4.0, 'Decision', ['Score ≥ 0.5 → bill (with subtype)', 'Score ≤ 0.22 → polite rejection', 'In between → ambiguous: vision model or ask the user', 'User can always override']);
text(s, 'Not a trained CNN: there was no licensed training data, and the 20 HR images must stay a test set. A MobileNetV3 transfer-learning pipeline is ready for when data exists. Detecting a bill-like document does not prove a transaction happened.', { x: 0.6, y: 5.75, w: 12.1, h: 0.9, fontSize: 14, color: C.accent4 });
notes(s, 'Method billkit-evidence-v1. The score is a heuristic, not a probability.');

// ---------- 8. OCR ----------
s = content('OCR: Tesseract LSTM, tuned for receipts', 'AI/ML');
const ocr = [
  ['Preprocess', 'Find the page, fix perspective, deskew, flatten shadows, boost contrast'],
  ['Recognise', 'tesseract.js 7, English model from npm, PSM 4 (single column)'],
  ['Rotate if needed', 'Few solid words → retry at 90°, 180°, 270° and keep the best'],
  ['Rebuild rows', 'Group words into visual rows with boxes and confidences'],
];
ocr.forEach(([h, b], i) => {
  const y = 1.5 + i * 1.25;
  circleNum(s, i + 1, 0.6, y + 0.1);
  text(s, h, { x: 1.3, y, w: 3, h: 0.45, fontSize: 18, bold: true, color: C.text2, fontFace: THEME.headFontFace });
  text(s, b, { x: 1.3, y: y + 0.45, w: 5.6, h: 0.6, fontSize: 14 });
});
card(s, 7.4, 1.5, 5.3, 4.8, 'What we learned', [
  'Auto page segmentation dropped the right-hand amount column on receipts; single-column mode (PSM 4) fixed it',
  'Forcing 300 DPI made results worse, so it is left unset',
  'Born-digital PDFs skip OCR and use their own text layer',
  'OCR confidence describes the characters, not whether the right line was chosen',
]);
notes(s, 'Alternatives considered: Google ML Kit (native SDK only), PaddleOCR (Python runtime), cloud OCR (cost, privacy).');

// ---------- 9. Extraction ----------
s = content('Extraction: labels decide what a number means', 'AI/ML');
const rows = [['Grand total', '0.95', 'Total'], ['Net amount / payable', '0.90', 'Total'], ['Total (not sub/qty/tax)', '0.80', 'Total'], ['Sub total', '0.90', 'Subtotal'], ['CGST + SGST', 'sum', 'Tax'], ['Largest unlabelled amount', 'last resort', 'Total (inferred, flagged)']];
s.addTable([
  [{ text: 'Label on the bill', options: { bold: true, color: C.background1, fill: { color: C.accent1 } } }, { text: 'Rule score', options: { bold: true, color: C.background1, fill: { color: C.accent1 } } }, { text: 'Field', options: { bold: true, color: C.background1, fill: { color: C.accent1 } } }],
  ...rows.map((r, i) => r.map((c) => ({ text: c, options: { fill: { color: i % 2 ? C.background1 : C.background2 } } }))),
], { x: 0.6, y: 1.5, w: 6.6, colW: [3.3, 1.4, 1.9], fontSize: 14, fontFace: THEME.bodyFontFace, color: C.text1, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, rowH: 0.5, objectName: 'rulesTable' });
card(s, 7.6, 1.5, 5.1, 4.9, 'Every field carries evidence', [
  'The OCR row text and its box on the page',
  'Dates, times, phone numbers and IDs are masked before amounts are read',
  'Ambiguous dates such as 03/04/2026 are flagged unless the bill reveals the order',
  'Competing candidates become one-tap alternatives',
  'Missing means null, never a guess',
]);
notes(s, 'Twenty-one fields, including invoice number, payment method, GSTIN and line items.');

// ---------- 10. Confidence ----------
s = content('Confidence is a ranked heuristic, and labelled as one', 'AI/ML');
const sig = [['OCR confidence', 'How sure Tesseract is about the characters'], ['Rule strength', 'How strong the label rule was'], ['Model self-report', 'Recorded, never used as a probability'], ['Validation', 'Pass, warn or fail from deterministic checks']];
sig.forEach(([h, b], i) => card(s, 0.6 + i * 3.05, 1.5, 2.85, 2.0, h, b, { shadow: true }));
const states = [['High confidence', 'DCFCE7', '166534'], ['Needs review', 'FEF3C7', '92400E'], ['Missing', 'E2E8F0', '334155'], ['Validation warning', 'FFEDD5', '9A3412'], ['User corrected', 'EDE9FE', '5B21B6']];
text(s, 'Review states shown in the app (icon + text, not colour alone)', { x: 0.6, y: 3.85, w: 12, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
states.forEach(([t, bg, fg], i) => {
  box(s, { x: 0.6 + i * 2.45, y: 4.4, w: 2.25, h: 0.6, fill: bg, lineColor: bg });
  text(s, t, { x: 0.6 + i * 2.45, y: 4.4, w: 2.25, h: 0.6, fontSize: 14, bold: true, color: fg, align: 'center', valign: 'middle' });
});
text(s, 'Review threshold 0.85 by default (configurable). Calibration by histogram binning is implemented but needs a labelled real validation set, so scores stay marked "heuristic" for now.', { x: 0.6, y: 5.4, w: 12.1, h: 0.9, fontSize: 15 });
notes(s, 'The system abstains (Missing or Unknown) when evidence is insufficient.');

// ---------- 11. Validation ----------
s = content('The maths must add up, in any legitimate format', 'AI/ML');
const interp = ['subtotal + tax + service + tip − discount + round-off', 'discount already deducted from the subtotal', 'prices include tax', 'prices include tax and the discount is already deducted', 'without the round-off line'];
text(s, 'A total is accepted if any interpretation matches within max(1, 0.5 %)', { x: 0.6, y: 1.45, w: 7, h: 0.45, fontSize: 17, bold: true, color: C.text2 });
interp.forEach((t, i) => { circleNum(s, i + 1, 0.6, 2.05 + i * 0.75); text(s, t, { x: 1.3, y: 2.1 + i * 0.75, w: 6, h: 0.45, fontSize: 15 }); });
card(s, 7.9, 1.45, 4.8, 4.9, 'Other checks', [
  'Missing merchant, date or total',
  'Negative, zero or implausible totals',
  'Tax > total; discount > subtotal',
  'Line items vs subtotal; qty × price',
  'Paid + balance vs total',
  'Impossible, future or ancient dates',
  'Currency codes',
]);
notes(s, 'The same validateBill() runs live as the user edits and again on the server before saving.');

// ---------- 12. Human review ----------
s = content('The human makes the final call', 'AI/ML');
s.addImage({ path: A('assets/screenshots/05_review.png'), x: 0.6, y: 1.4, w: 7.9, h: 5.2, objectName: 'reviewShot' });
card(s, 8.8, 1.4, 3.9, 5.2, 'Review screen', [
  'Evidence box drawn on the photo',
  'Edit any field; badge turns "User corrected"',
  'Flagged fields need a tick or an edit',
  'Validation updates live',
  'Corrections saved with the AI value, versions and consent flag',
  'Nothing retrains automatically',
]);
notes(s, 'Screenshot of the running app with a synthetic, fictional sample receipt.');

// ---------- 13. Dataset ----------
pres.addSection({ title: 'Data and evaluation' });
s = content('Dataset framework: built for real phone photos', 'Data and evaluation');
[['26', 'bill condition/type folders'], ['9', 'non-bill folders'], ['70/15/15', 'grouped split, seed 20261106'], ['0', 'real images included']].forEach(([v, l], i) => {
  text(s, v, { x: 0.6 + i * 3.05, y: 1.5, w: 2.85, h: 1.0, fontSize: 40, bold: true, color: C.accent1, fontFace: THEME.headFontFace });
  text(s, l, { x: 0.6 + i * 3.05, y: 2.5, w: 2.85, h: 0.5, fontSize: 14, color: C.accent4 });
});
card(s, 0.6, 3.3, 6.0, 3.1, 'Separation and leakage control', ['Train / validation / test / HR 15 bills / HR 5 non-bills never mix', 'Photos of one bill share a group id', 'Duplicate and near-duplicate checks', 'Training code refuses to read the HR folder']);
card(s, 6.75, 3.3, 5.95, 3.1, 'Responsible collection', ['Consent records and redaction guide', 'Licences of CORD, SROIE, FUNSD, XFUND, RVL-CDIP and DocVQA documented; nothing downloaded', 'Synthetic images only for tests, always labelled']);
notes(s, 'No third-party dataset files and no real bill photographs are shipped.');

// ---------- 14. Training ----------
s = content('Train only where it is justified', 'Data and evaluation');
s.addTable([
  ['Model', 'Status', 'Note'].map((t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.accent1 } } })),
  ['Categoriser (TF-IDF + logistic regression)', 'Trained, registered', 'Synthetic seed data (324 examples); grouped CV macro-F1 0.990 vs rules 0.976 (optimistic)'],
  ['Confidence calibration', 'Code ready', 'Needs a labelled real validation set'],
  ['Bill/non-bill image classifier (MobileNetV3-Small)', 'Not trained', 'No licensed labelled images; pipeline, configs and ONNX export ready'],
  ['OCR and extraction models', 'Not trained', 'Established engine and rules; fine-tuning not justified at this size'],
].map((r, i) => (i === 0 ? r : r.map((c) => ({ text: c, options: { fill: { color: i % 2 ? C.background2 : C.background1 } } })))), { x: 0.6, y: 1.5, w: 12.1, colW: [4.0, 2.1, 6.0], fontSize: 14, fontFace: THEME.bodyFontFace, color: C.text1, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, rowH: 0.6, objectName: 'trainTable' });
text(s, 'Training is offline Python with fixed seeds; inference is TypeScript that reads only registered artefacts. A JSON registry supports rollback. See TRAINING_GUIDE.md.', { x: 0.6, y: 5.3, w: 12.1, h: 0.9, fontSize: 15 });
notes(s, 'The 25-item training record for each model is in TRAINING_GUIDE.md.');

// ---------- 15. Evaluation ----------
s = content('Evaluation: what is measured, and how', 'Data and evaluation');
card(s, 0.6, 1.5, 6.0, 4.9, 'Per image (20 images)', ['Expected vs predicted class, merchant, date, total, category', 'Correct / incorrect per field', 'Uncertainty status and failure reason', 'Processing time, vision calls, cost']);
card(s, 6.75, 1.5, 5.95, 4.9, 'Rules and metrics', ['Merchant: normalised, contained or ≥ 0.85 similar', 'Date: ISO equal · Total: within 0.01', 'Accuracy, precision, recall, F1, confusion matrix', 'Wilson 95 % intervals (15/15 still ≈ 80 % lower bound)', 'Were wrong values flagged for review?']);
notes(s, 'npm run eval:hr writes predictions.csv, results.json, metrics.json and report.md.');

// ---------- 16. Results ----------
s = content('Results: the real 20-image evaluation is pending', 'Data and evaluation');
pending(s, 0.6, 1.45, 12.1, 'HR set (15 real bills + 5 non-bills): PENDING. The images have not been supplied yet, so there are no real-world accuracy figures.');
text(s, 'Pipeline check on 15 synthetic, computer-generated images (NOT real-world accuracy)', { x: 0.6, y: 2.25, w: 12, h: 0.45, fontSize: 16, bold: true, color: C.text2 });
[['15 / 15', 'classifications correct'], ['10 / 10', 'merchant, date and total correct'], ['1.65 s', 'mean time per image'], ['0', 'wrong values; 4 of 40 correct ones flagged']].forEach(([v, l], i) => {
  box(s, { x: 0.6 + i * 3.05, y: 2.85, w: 2.85, h: 2.0, fill: C.background2, shadow: true });
  text(s, v, { x: 0.8 + i * 3.05, y: 3.0, w: 2.5, h: 0.9, fontSize: 36, bold: true, color: C.accent1, fontFace: THEME.headFontFace });
  text(s, l, { x: 0.8 + i * 3.05, y: 3.9, w: 2.5, h: 0.8, fontSize: 14 });
});
text(s, 'Tests: 136 unit/integration, 11 end-to-end (incl. accessibility), 10 Python — all passing on 6 Nov 2026.', { x: 0.6, y: 5.3, w: 12.1, h: 0.5, fontSize: 15 });
notes(s, 'Synthetic images are much cleaner and more uniform than real phone photos. Replace this slide with the HR results after running npm run eval:hr.');

// ---------- 17. Failure cases ----------
s = content('Expected failure cases, to be confirmed on real bills', 'Data and evaluation');
pending(s, 0.6, 1.45, 12.1, 'These are anticipated failure modes, not measured results. The HR run will show which actually occur.');
const fails = [['Wrong total line', 'Several totals with unusual labels'], ['Faded thermal paper', 'Digits misread (8→3), decimals lost'], ['Merchant from a slogan', 'Or a name that appears only in a logo'], ['Ambiguous dates', 'Day/month order; two-digit years'], ['Bill-like non-bills', 'Order confirmations, price lists'], ['Mixed-store categories', 'Groceries vs shopping']];
fails.forEach(([h, b], i) => card(s, 0.6 + (i % 3) * 4.08, 2.2 + Math.floor(i / 3) * 2.15, 3.88, 1.95, h, b, { shadow: true }));
notes(s, 'Failure reasons in the evaluation report come from evidence: for example, was the expected total present in the OCR text?');

// ---------- 18. Privacy & security ----------
pres.addSection({ title: 'Closing' });
s = content('Privacy and security, stated honestly', 'Closing');
card(s, 0.6, 1.5, 6.0, 4.9, 'Implemented', ['Argon2id; hashed HttpOnly sessions; CSRF header + Origin check', 'Rate limits; strict CSP; magic-byte upload checks', 'Every query scoped to the user', 'Receipt text treated as untrusted in prompts', 'Delete bills or the whole account; unsaved scans expire', 'No analytics or third-party scripts']);
card(s, 6.75, 1.5, 5.95, 4.9, 'Honest limits', ['Images are processed on the server, and by Anthropic only if cloud vision is enabled', 'No MFA or e-mail verification yet', 'No encryption at rest by the app', 'No penetration test', 'No compliance claimed (GDPR, DPDP); legal pages are drafts']);
notes(s, 'Details in docs/privacy_security.md.');

// ---------- 19. Future ----------
s = content('What comes next', 'Closing');
const fut = ['Run the HR evaluation and analyse every failure', 'Collect a consented, redacted set of ~300 Indian receipts', 'Fit calibration so scores mean what they say', 'Add PaddleOCR as a second engine and compare', 'Train the image classifier and compare it with the rules', 'Indian-language OCR; on-device OCR in the browser', 'MFA, e-mail verification and encryption at rest'];
fut.forEach((t, i) => { circleNum(s, i + 1, 0.6 + (i >= 4 ? 6.2 : 0), 1.6 + (i % 4) * 1.15); text(s, t, { x: 1.3 + (i >= 4 ? 6.2 : 0), y: 1.65 + (i % 4) * 1.15, w: 5.2, h: 0.8, fontSize: 16 }); });
notes(s, 'Priorities are ordered by what improves trust in the numbers first.');

// ---------- 20. Close ----------
s = pres.addSlide({ masterName: 'BK_DARK', sectionTitle: 'Closing' });
text(s, 'Every bill, in your pocket.', { x: 0.6, y: 2.3, w: 12, h: 1.0, fontSize: 44, bold: true, color: C.background1, fontFace: THEME.headFontFace });
text(s, 'Evidence-aware extraction · uncertainty highlighting · mathematical verification · human approval', { x: 0.6, y: 3.4, w: 12, h: 0.6, fontSize: 18, color: C.accent3 });
text(s, 'Thank you. Questions?', { x: 0.6, y: 4.6, w: 12, h: 0.6, fontSize: 24, color: C.background2 });
text(s, 'Shaik Gouse Kareem', { x: 0.6, y: 5.4, w: 12, h: 0.5, fontSize: 16, color: C.accent5 });
notes(s, 'Close by restating the principle: accuracy, evidence, transparency and user trust over pretending AI is always correct.');

(async () => {
  const out = path.join(__dirname, 'BillKit_Presentation.pptx');
  await pres.writeFile({ fileName: out });
  if (SKILL_THEME) {
    const { applyTheme } = require(SKILL_THEME);
    await applyTheme(out, THEME);
  }
  console.log('wrote', out);
})();
