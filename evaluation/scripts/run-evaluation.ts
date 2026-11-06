/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G15/G16 — Evaluation harness. Runs the SAME pipeline the app uses on a
 * labelled image set and records, for every image: expected vs predicted
 * classification, merchant, date, total, category, confidence/uncertainty
 * status, an evidence-based failure reason and processing time.
 *
 * Usage:
 *   npm run eval:hr                    # dataset/hr_assignment (15 bills + 5 non-bills)
 *   npm run eval:smoke                 # evaluation/synthetic_smoke (SYNTHETIC, pipeline check only)
 *   npx tsx evaluation/scripts/run-evaluation.ts --images DIR --gt FILE.csv --out DIR [--allow-vlm] [--date-order DMY|MDY]
 *
 * Never fabricates results: if images are missing, it writes a PENDING report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVlmProvider, processDocument, shutdownOcr, vlmConfigFromEnv } from '../../ai/src/index.ts';
import { amountsEqual, findDateCandidates, merchantsMatch, normaliseDate, parseAmount, type ExtractionResult } from '../../packages/shared/src/index.ts';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const set = arg('set') ?? 'custom';
const presets: Record<string, { images: string[]; gt: string; out: string; label: string }> = {
  hr: {
    images: [path.join(repo, 'dataset/hr_assignment/15_real_bill_images'), path.join(repo, 'dataset/hr_assignment/05_non_bill_images')],
    gt: path.join(repo, 'dataset/hr_assignment/ground_truth.csv'),
    out: path.join(repo, 'evaluation/results/hr_assignment'),
    label: 'HR assignment — 15 real bills + 5 non-bills',
  },
  'synthetic-smoke': {
    images: [path.join(repo, 'evaluation/synthetic_smoke/images')],
    gt: path.join(repo, 'evaluation/synthetic_smoke/ground_truth.csv'),
    out: path.join(repo, 'evaluation/results/synthetic_smoke'),
    label: 'SYNTHETIC smoke test — computer-generated fictional documents (NOT real-world accuracy)',
  },
};
const preset = presets[set] ?? { images: [arg('images') ?? ''], gt: arg('gt') ?? '', out: arg('out') ?? path.join(repo, 'evaluation/results/custom'), label: `Custom set (${arg('images')})` };
const allowVlm = args.includes('--allow-vlm');
const dateOrder = (arg('date-order') ?? 'DMY') as 'DMY' | 'MDY';

/* ---------------- CSV helpers ---------------- */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some((x) => x.trim() !== '')) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); if (cur.some((x) => x.trim() !== '')) rows.push(cur); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.filter((r) => !r[0]?.startsWith('#')).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const esc = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* ---------------- Metrics ---------------- */
export function wilson(k: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const r3 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);
const pctile = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]!;
};

interface Row {
  image_id: string; file_name: string; expected_class: string; predicted_class: string; classification_correct: boolean;
  expected_merchant: string; extracted_merchant: string; merchant_correct: boolean | null;
  expected_date: string; extracted_date: string; date_correct: boolean | null;
  expected_total: string; extracted_total: string; total_correct: boolean | null;
  expected_category: string; predicted_category: string; category_correct: boolean | null;
  all_required_correct: boolean | null; uncertainty_status: string; quality_score: number | null; failure_reason: string; processing_ms: number;
  vlm_used: boolean; vlm_error: string; cost_usd: number | null;
  field_confidence: Record<string, { confidence: number | null; review: string; correct: boolean | null }>;
}

/** Evidence-based failure analysis (G16): only reasons supported by observable processing evidence. */
function failureReasons(r: ExtractionResult | null, row: Omit<Row, 'failure_reason'>, error: string | null): string {
  if (error) return `Processing error: ${error}`;
  if (!r) return '';
  const reasons: string[] = [];
  const quality = r.quality.issues.filter((i) => i.severity !== 'info').map((i) => i.code.replace(/_/g, ' '));
  const amountsInOcr = (v: number) => r.ocrText.split('\n').some((line) => (line.match(/[\d.,]+/g) ?? []).some((t) => amountsEqual(parseAmount(t)?.value ?? NaN, v)));
  if (!row.classification_correct) reasons.push(`Incorrect classification (${row.predicted_class}; evidence: ${[...r.classification.counterEvidence, ...r.classification.evidence].slice(0, 2).join('; ') || 'none'})`);
  if (row.merchant_correct === false) {
    const seen = r.ocrText.toLowerCase().includes(row.expected_merchant.toLowerCase().slice(0, Math.min(8, row.expected_merchant.length)));
    reasons.push(row.extracted_merchant ? (seen ? 'Merchant recognition failure (name present in OCR text, another line chosen)' : 'OCR confusion on merchant name (expected name not found in OCR text)') : 'Missing field: merchant');
  }
  if (row.date_correct === false) {
    if (r.fields.billDate.status === 'ambiguous') reasons.push('Date-format ambiguity');
    else if (!row.extracted_date) reasons.push('Missing field: date');
    else reasons.push(findDateCandidates(r.ocrText).some((d) => d.iso === row.expected_date) ? 'Wrong date chosen (correct date present in OCR text)' : 'OCR confusion on date');
  }
  if (row.total_correct === false) {
    const exp = Number(row.expected_total);
    if (!row.extracted_total) reasons.push('Missing field: total');
    else reasons.push(amountsInOcr(exp) ? 'Amount confusion (correct total read by OCR, different line chosen)' : 'OCR confusion on total (expected amount not in OCR text)');
  }
  if (row.category_correct === false) reasons.push(row.predicted_category ? 'Category ambiguity' : 'Missing field: category (abstained)');
  if (r.validation.issues.some((i) => i.code === 'total_mismatch')) reasons.push('Arithmetic inconsistency flagged');
  if (reasons.length && quality.length) reasons.push(`Image conditions: ${quality.join(', ')}`);
  return reasons.join(' | ');
}

/* ---------------- Main ---------------- */
async function main() {
  fs.mkdirSync(preset.out, { recursive: true });
  const gtExists = fs.existsSync(preset.gt);
  const GT_KEYS = ['image_id', 'file_name', 'expected_class', 'expected_document_type', 'expected_merchant', 'expected_date', 'expected_total', 'expected_currency', 'expected_category'] as const;
  type GtRow = Record<(typeof GT_KEYS)[number], string>;
  const gt: GtRow[] = (gtExists ? parseCsv(fs.readFileSync(preset.gt, 'utf8')) : []).map((r) => Object.fromEntries(GT_KEYS.map((k) => [k, r[k] ?? ''])) as GtRow);
  const findImage = (name: string) => preset.images.map((d) => path.join(d, name)).find((p) => fs.existsSync(p));
  const available = gt.filter((g) => g.file_name && findImage(g.file_name));
  if (!available.length) {
    const msg = `# Evaluation status: PENDING\n\nSet: ${preset.label}\n\nNo labelled images were found (${gtExists ? `${gt.length} ground-truth rows, 0 matching image files` : 'ground-truth file missing'}).\n\nAdd the images and fill \`${path.relative(repo, preset.gt)}\`, then re-run. No metrics were computed and none are reported.\n`;
    fs.writeFileSync(path.join(preset.out, 'report.md'), msg);
    fs.writeFileSync(path.join(preset.out, 'metrics.json'), JSON.stringify({ status: 'pending', set, reason: 'no labelled images found', generatedAt: new Date().toISOString() }, null, 2));
    console.log(msg);
    return;
  }
  const vlm = allowVlm ? createVlmProvider(vlmConfigFromEnv()) : null;
  if (allowVlm && !vlm) console.warn('--allow-vlm given but no VLM is configured (AI_PROVIDER / AI_PROVIDER_API_KEY); running OCR-only.');

  const rows: Row[] = [];
  for (const g of available) {
    const file = findImage(g.file_name)!;
    const started = Date.now();
    let result: ExtractionResult | null = null;
    let error: string | null = null;
    try {
      result = (await processDocument({ files: [fs.readFileSync(file)], vlm, options: { dateOrder, allowVlm: Boolean(vlm) } })).result;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const ms = Date.now() - started;
    const isBill = g.expected_class === 'bill';
    const predicted = !result ? 'error' : result.classification.decision === 'bill' ? 'bill' : result.classification.decision === 'not_bill' ? 'non_bill' : 'ambiguous';
    const f = result?.fields;
    const expDate = normaliseDate(g.expected_date, dateOrder) ?? '';
    const cmp = (enabled: boolean, ok: boolean) => (enabled ? ok : null);
    const merchant_correct = cmp(isBill && Boolean(g.expected_merchant), merchantsMatch(g.expected_merchant, f?.merchantName.value));
    const date_correct = cmp(isBill && Boolean(expDate), f?.billDate.value === expDate);
    const expTotal = g.expected_total ? parseAmount(g.expected_total)?.value ?? null : null;
    const total_correct = cmp(isBill && expTotal !== null, amountsEqual(expTotal, f?.totalAmount.value ?? null));
    const category_correct = cmp(isBill && Boolean(g.expected_category), (result?.category.value ?? '').toLowerCase() === g.expected_category.toLowerCase());
    const all_required_correct = isBill ? merchant_correct === true && date_correct === true && total_correct === true : null;
    const fc: Row['field_confidence'] = {};
    if (f && isBill) {
      fc.merchantName = { confidence: f.merchantName.confidence, review: f.merchantName.review, correct: merchant_correct };
      fc.billDate = { confidence: f.billDate.confidence, review: f.billDate.review, correct: date_correct };
      fc.totalAmount = { confidence: f.totalAmount.confidence, review: f.totalAmount.review, correct: total_correct };
      fc.category = { confidence: result!.category.confidence, review: result!.category.review, correct: category_correct };
    }
    const base = {
      image_id: g.image_id, file_name: g.file_name, expected_class: g.expected_class, predicted_class: predicted, classification_correct: (isBill ? 'bill' : 'non_bill') === predicted,
      expected_merchant: g.expected_merchant, extracted_merchant: f?.merchantName.value ?? '', merchant_correct,
      expected_date: expDate, extracted_date: f?.billDate.value ?? '', date_correct,
      expected_total: expTotal === null ? '' : String(expTotal), extracted_total: f?.totalAmount.value?.toString() ?? '', total_correct,
      expected_category: g.expected_category, predicted_category: result?.category.value ?? '', category_correct, all_required_correct,
      uncertainty_status: result ? `${result.overallReview}; merchant=${f!.merchantName.review}, date=${f!.billDate.review}, total=${f!.totalAmount.review}` : 'error',
      quality_score: result?.quality.score ?? null, processing_ms: ms, vlm_used: Boolean(result?.meta.vlm?.used), vlm_error: result?.meta.vlm?.error ?? '',
      cost_usd: result?.meta.vlm?.estimatedCostUsd ?? null, field_confidence: fc,
    };
    rows.push({ ...base, failure_reason: failureReasons(result, base, error) });
    console.log(`${g.image_id}\t${predicted}\t${base.classification_correct ? '✓' : '✗'} cls  M:${fmtB(merchant_correct)} D:${fmtB(date_correct)} T:${fmtB(total_correct)} C:${fmtB(category_correct)}  ${ms} ms`);
  }
  await shutdownOcr();

  // Classification metrics (positive class = bill). "ambiguous"/"error" count as a negative prediction for bills and as wrong for both.
  const tp = rows.filter((r) => r.expected_class === 'bill' && r.predicted_class === 'bill').length;
  const fp = rows.filter((r) => r.expected_class !== 'bill' && r.predicted_class === 'bill').length;
  const fn = rows.filter((r) => r.expected_class === 'bill' && r.predicted_class !== 'bill').length;
  const tn = rows.filter((r) => r.expected_class !== 'bill' && r.predicted_class === 'non_bill').length;
  const correct = rows.filter((r) => r.classification_correct).length;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
  const confusion: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    confusion[r.expected_class] ??= { bill: 0, non_bill: 0, ambiguous: 0, error: 0 };
    confusion[r.expected_class]![r.predicted_class] = (confusion[r.expected_class]![r.predicted_class] ?? 0) + 1;
  }
  const fieldAcc = (k: keyof Row) => {
    const xs = rows.map((r) => r[k]).filter((v): v is boolean => typeof v === 'boolean');
    const k2 = xs.filter(Boolean).length;
    return { correct: k2, evaluated: xs.length, accuracy: xs.length ? r3(k2 / xs.length) : null, ci95: wilson(k2, xs.length)?.map((x) => r3(x)) ?? null };
  };
  const latencies = rows.map((r) => r.processing_ms);
  // Review behaviour (safety): were wrong values flagged, and how often were correct values flagged unnecessarily?
  const reviewBehaviour = (() => {
    let wrongFlagged = 0, wrongAccepted = 0, correctFlagged = 0, correctAccepted = 0;
    for (const r of rows) {
      for (const v of Object.values(r.field_confidence)) {
        if (v.correct === null) continue;
        const flagged = v.review !== 'high_confidence';
        if (v.correct) {
          if (flagged) correctFlagged++;
          else correctAccepted++;
        } else if (flagged) wrongFlagged++;
        else wrongAccepted++;
      }
    }
    const wrong = wrongFlagged + wrongAccepted, right = correctFlagged + correctAccepted;
    return {
      wrongValues: wrong, wrongFlagged, wrongAcceptedSilently: wrongAccepted, wrongFlaggedRate: wrong ? r3(wrongFlagged / wrong) : null,
      correctValues: right, correctFlagged, unnecessaryReviewRate: right ? r3(correctFlagged / right) : null,
    };
  })();
  const metrics = {
    status: 'measured',
    set,
    label: preset.label,
    generatedAt: new Date().toISOString(),
    images: rows.length,
    bills: rows.filter((r) => r.expected_class === 'bill').length,
    nonBills: rows.filter((r) => r.expected_class !== 'bill').length,
    vlm: vlm ? vlm.config.model : null,
    dateOrder,
    classification: {
      accuracy: r3(correct / rows.length), ci95: wilson(correct, rows.length)?.map((x) => r3(x)), precision: r3(precision), recall: r3(recall), f1: r3(f1),
      tp, fp, fn, tn, ambiguous: rows.filter((r) => r.predicted_class === 'ambiguous').length, confusion,
    },
    fields: { merchant: fieldAcc('merchant_correct'), date: fieldAcc('date_correct'), total: fieldAcc('total_correct'), category: fieldAcc('category_correct'), allRequired: fieldAcc('all_required_correct') },
    latencyMs: { mean: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length), median: pctile(latencies, 0.5), p95: pctile(latencies, 0.95), max: Math.max(...latencies) },
    reviewBehaviour,
    vlmCalls: rows.filter((r) => r.vlm_used).length,
    apiFailures: rows.filter((r) => r.vlm_error).length,
    estimatedCostUsd: rows.some((r) => r.cost_usd !== null) ? r3(rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0)) : null,
    definitions: {
      classificationAccuracy: '(correct bill/non-bill decisions) / images; ambiguous counts as incorrect',
      precision: 'TP / (TP + FP), positive class = bill', recall: 'TP / (TP + FN)', f1: '2PR / (P + R)',
      merchant: 'normalised match: case/punctuation/legal-suffix insensitive, containment (≥4 chars) or similarity ≥ 0.85',
      date: 'exact ISO date after normalising the ground truth', total: 'absolute difference ≤ 0.01', category: 'case-insensitive exact match; abstaining (Unknown) counts as incorrect',
      allRequired: 'merchant, date and total all correct for a bill', ci95: 'Wilson score interval',
      reviewBehaviour: 'a value is "flagged" when its review state is anything other than high_confidence',
    },
  };

  const cols: Array<keyof Row> = ['image_id', 'file_name', 'expected_class', 'predicted_class', 'classification_correct', 'expected_merchant', 'extracted_merchant', 'merchant_correct', 'expected_date', 'extracted_date', 'date_correct', 'expected_total', 'extracted_total', 'total_correct', 'expected_category', 'predicted_category', 'category_correct', 'all_required_correct', 'uncertainty_status', 'quality_score', 'failure_reason', 'processing_ms', 'vlm_used', 'vlm_error', 'cost_usd'];
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(preset.out, 'predictions.csv'), csv);
  fs.writeFileSync(path.join(preset.out, 'results.json'), JSON.stringify({ metrics, rows }, null, 2));
  fs.writeFileSync(path.join(preset.out, 'metrics.json'), JSON.stringify(metrics, null, 2));
  const report = renderReport(metrics, rows);
  fs.writeFileSync(path.join(preset.out, 'report.md'), report);
  if (set === 'hr') {
    fs.writeFileSync(path.join(repo, 'dataset/hr_assignment/predictions.csv'), csv);
    fs.writeFileSync(path.join(repo, 'dataset/hr_assignment/final_evaluation_report.md'), report);
  }
  console.log(`\nWrote ${path.relative(repo, preset.out)}/{predictions.csv,results.json,metrics.json,report.md}`);
}

const fmtB = (b: boolean | null) => (b === null ? '–' : b ? '✓' : '✗');

function renderReport(m: any, rows: Row[]): string {
  const f = m.fields;
  const pc = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
  const ci = (c: number[] | null) => (c ? ` (95% CI ${pc(c[0]!)}–${pc(c[1]!)})` : '');
  const fails = rows.filter((r) => r.failure_reason);
  return `# BillKit evaluation report

**Set:** ${m.label}
**Generated:** ${m.generatedAt} · **Images:** ${m.images} (${m.bills} bills, ${m.nonBills} non-bills) · **Vision model:** ${m.vlm ?? 'not used (OCR + rules only)'} · **Ambiguous-date order:** ${m.dateOrder}

${m.set === 'synthetic-smoke' ? '> **Important:** these images are computer-generated, fictional documents used to check that the pipeline and this harness work end to end. They are far cleaner and more uniform than real phone photos. **These numbers are not an estimate of real-world accuracy.**\n' : ''}
> With ${m.images} images, every percentage below has a wide confidence interval and must not be generalised to all receipts.

## Bill / non-bill classification

| Metric | Value |
|---|---|
| Accuracy | ${pc(m.classification.accuracy)}${ci(m.classification.ci95)} |
| Precision (bill) | ${pc(m.classification.precision)} |
| Recall (bill) | ${pc(m.classification.recall)} |
| F1 (bill) | ${pc(m.classification.f1)} |
| Ambiguous decisions | ${m.classification.ambiguous} |

**Confusion matrix** (rows = expected, columns = predicted)

| expected \\ predicted | bill | non_bill | ambiguous | error |
|---|---|---|---|---|
${Object.entries(m.classification.confusion as Record<string, Record<string, number>>).map(([k, v]) => `| ${k} | ${v.bill ?? 0} | ${v.non_bill ?? 0} | ${v.ambiguous ?? 0} | ${v.error ?? 0} |`).join('\n')}

## Field extraction (bills only)

| Field | Correct / evaluated | Accuracy |
|---|---|---|
| Merchant | ${f.merchant.correct} / ${f.merchant.evaluated} | ${pc(f.merchant.accuracy)}${ci(f.merchant.ci95)} |
| Date | ${f.date.correct} / ${f.date.evaluated} | ${pc(f.date.accuracy)}${ci(f.date.ci95)} |
| Total | ${f.total.correct} / ${f.total.evaluated} | ${pc(f.total.accuracy)}${ci(f.total.ci95)} |
| Category | ${f.category.correct} / ${f.category.evaluated} | ${pc(f.category.accuracy)}${ci(f.category.ci95)} |
| All required (merchant + date + total) | ${f.allRequired.correct} / ${f.allRequired.evaluated} | ${pc(f.allRequired.accuracy)} |

## Review behaviour (merchant, date, total, category)

| | Count |
|---|---|
| Wrong values | ${m.reviewBehaviour.wrongValues} — flagged for review: ${m.reviewBehaviour.wrongFlagged}, accepted silently (high confidence): ${m.reviewBehaviour.wrongAcceptedSilently} |
| Correct values | ${m.reviewBehaviour.correctValues} — flagged anyway: ${m.reviewBehaviour.correctFlagged} (${pc(m.reviewBehaviour.unnecessaryReviewRate)}) |

## Performance

Latency per image: mean ${m.latencyMs.mean} ms · median ${m.latencyMs.median} ms · p95 ${m.latencyMs.p95} ms · max ${m.latencyMs.max} ms. Vision-model calls: ${m.vlmCalls}; API failures: ${m.apiFailures}; estimated cost: ${m.estimatedCostUsd === null ? 'n/a' : `$${m.estimatedCostUsd}`}.

## Per-image results

| ID | Expected | Predicted | Merchant | Date | Total | Category | Status | ms |
|---|---|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.image_id} | ${r.expected_class} | ${r.predicted_class} ${r.classification_correct ? '✓' : '✗'} | ${fmtB(r.merchant_correct)} ${r.extracted_merchant} | ${fmtB(r.date_correct)} ${r.extracted_date} | ${fmtB(r.total_correct)} ${r.extracted_total} | ${fmtB(r.category_correct)} ${r.predicted_category} | ${r.uncertainty_status.split(';')[0]} | ${r.processing_ms} |`).join('\n')}

## Failure analysis

${fails.length ? fails.map((r) => `- **${r.image_id}** (${r.file_name}): ${r.failure_reason}`).join('\n') : 'No failures on this set.'}

Reasons are derived only from processing evidence (OCR text, field status, validation issues, measured image-quality issues).

## Method

${Object.entries(m.definitions as Record<string, string>).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

© 2026 Shaik Gouse Kareem. All rights reserved.
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
