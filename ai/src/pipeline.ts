/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G12 — Hybrid AI architecture: the single entry point used by the backend
 * and by the evaluation harness, so that evaluation measures exactly what
 * users get.
 *
 *   decode → quality → preprocess → OCR → classify (+layout) → extract (rules)
 *   → [optional VLM, only when configured and needed] → merge → categorise
 *   → validate → confidence → review-ready result
 */
import sharp from 'sharp';
import type { BillFields, ClassificationResult, DateOrder, ExtractionResult, LineItem, PipelineStage, QualityReport } from '@billkit/shared';
import { BILL_CLASSES, EXTRACTION_SCHEMA_VERSION } from '@billkit/shared';
import { categorise, CATEGORISER_VERSION, loadCategoriserModel } from './categorise.ts';
import { classifyDocument, CLASSIFIER_VERSION, imageTraits } from './classify.ts';
import { buildField, DEFAULT_REVIEW_THRESHOLD, loadCalibration } from './confidence.ts';
import { dHash, sha256 } from './duplicates.ts';
import { PipelineError, throwIfAborted } from './errors.ts';
import { EXTRACTOR_VERSION, extractFields, missing } from './extract.ts';
import { decodeUploads, type DecodedPage } from './image/decode.ts';
import { analyseLayout } from './layout.ts';
import { mergeWithVlm, type MergedExtraction } from './llm/merge.ts';
import { looksLikeInjection, PROMPT_VERSION } from './llm/prompts.ts';
import type { VlmProvider, VlmResult } from './llm/provider.ts';
import { ocrPage, pageFromPdfText, type OcrPage } from './ocr.ts';
import { preprocessPage } from './preprocess.ts';
import { assessQuality, finaliseQuality } from './quality.ts';
import { validateBill } from './validate.ts';

export const PIPELINE_VERSION = 'billkit-pipeline-1.0.0';

export interface PipelineOptions {
  dateOrder?: DateOrder;
  reviewThreshold?: number;
  /** Allow the configured vision model to be used for this document (user setting). */
  allowVlm?: boolean;
  rotate?: number;
  disableAutoCrop?: boolean;
  /** The user confirmed that an ambiguous/rejected document is a bill. */
  userConfirmedBill?: boolean;
  customCategories?: string[];
  today?: Date;
}

export interface PipelineInput {
  files: Buffer[];
  options?: PipelineOptions;
  vlm?: VlmProvider | null;
  onStage?: (stage: PipelineStage) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface PipelineOutput {
  result: ExtractionResult;
  /** Geometry-corrected page images (PNG) aligned with evidence bounding boxes. */
  correctedPages: Buffer[];
  fileSha256: string[];
  perceptualHash: string | null;
  vlmError: { code: string; message: string } | null;
}

export async function processDocument(input: PipelineInput): Promise<PipelineOutput> {
  const opts = input.options ?? {};
  const dateOrder = opts.dateOrder ?? 'DMY';
  const threshold = opts.reviewThreshold ?? DEFAULT_REVIEW_THRESHOLD;
  const timings: Record<string, number> = {};
  const t0 = Date.now();
  let last = t0;
  const stage = async (s: PipelineStage) => {
    throwIfAborted(input.signal);
    await input.onStage?.(s);
  };
  const lap = (name: string) => {
    const now = Date.now();
    timings[name] = now - last;
    last = now;
  };

  // G1 — acquisition
  await stage('decoding');
  const fileSha256 = input.files.map(sha256);
  const decoded = await decodeUploads(input.files);
  lap('decoding');

  // G2 — quality (on the upright originals; worst page wins)
  await stage('quality');
  let quality: QualityReport | null = null;
  for (const p of decoded.pages) {
    const q = await assessQuality({ png: p.png, width: p.width, height: p.height });
    if (!quality || q.score < quality.score) quality = q;
  }
  lap('quality');

  // G3 — preprocessing
  await stage('preprocessing');
  const preprocessed: Array<{ page: DecodedPage; ocrPng: Buffer; correctedPng: Buffer; steps: string[] }> = [];
  const steps: string[] = [];
  for (const page of decoded.pages) {
    throwIfAborted(input.signal);
    if (page.pdfText) {
      preprocessed.push({ page, ocrPng: page.png, correctedPng: page.png, steps: ['PDF text layer used (no OCR needed)'] });
      continue;
    }
    const pre = await preprocessPage(page.png, { rotate: opts.rotate, disableAutoCrop: opts.disableAutoCrop || page.sourceFormat === 'pdf' });
    preprocessed.push({ page, ocrPng: pre.ocrPng, correctedPng: pre.correctedPng, steps: pre.steps });
  }
  preprocessed.forEach((p, i) => steps.push(...p.steps.map((s) => (preprocessed.length > 1 ? `page ${i + 1}: ${s}` : s))));
  lap('preprocessing');

  // G5 — OCR
  await stage('ocr');
  const ocrPages: OcrPage[] = [];
  const correctedPages: Buffer[] = [];
  for (const p of preprocessed) {
    throwIfAborted(input.signal);
    let o: OcrPage;
    if (p.page.pdfText) o = await pageFromPdfText(p.page.pdfText, p.page.png, p.page.pageIndex);
    else o = await ocrPage(p.ocrPng, p.page.pageIndex, input.signal);
    ocrPages.push(o);
    const display = o.rotation ? await sharp(p.correctedPng).rotate(o.rotation).png().toBuffer() : p.correctedPng;
    correctedPages.push(display);
    if (o.rotation) steps.push(`rotated ${o.rotation}° to read text`);
  }
  const allWords = ocrPages.flatMap((o) => o.words);
  const meanOcr = allWords.length ? allWords.reduce((s, w) => s + w.confidence, 0) / allWords.length : null;
  quality = finaliseQuality(quality!, meanOcr, allWords.length, ocrPages[0]?.rotation ?? 0);
  lap('ocr');

  // G6 + G4 — layout and classification
  await stage('classification');
  const layout = analyseLayout(ocrPages);
  const firstPage = decoded.pages[0]!;
  const traits = await imageTraits(firstPage.png, firstPage.width, firstPage.height, decoded.metadata[0]);
  let classification: ClassificationResult = classifyDocument({ layout, meanOcrConfidence: meanOcr, traits });
  if (decoded.pages[0]?.pdfText && classification.decision !== 'bill' && classification.billScore >= 0.35) {
    classification = { ...classification, decision: 'ambiguous' };
  }
  lap('classification');
  await stage('layout');
  lap('layout');

  const ocrText = layout.rows.map((r) => r.text).join('\n');
  const perceptualHash = correctedPages[0] ? await dHash(correctedPages[0]) : null;

  const vlmMeta: ExtractionResult['meta']['vlm'] = input.vlm
    ? { provider: input.vlm.name, model: input.vlm.config.model, promptVersion: PROMPT_VERSION, used: false, error: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null }
    : null;

  const baseMeta = (): ExtractionResult['meta'] => ({
    pipelineVersion: PIPELINE_VERSION,
    ocrEngine: [...new Set(ocrPages.map((o) => o.engine))].join(', '),
    ocrLanguages: (process.env.OCR_LANGS ?? 'eng').split('+'),
    classifier: CLASSIFIER_VERSION,
    extractor: `${EXTRACTOR_VERSION}; ${CATEGORISER_VERSION}${loadCategoriserModel() ? ` + ${loadCategoriserModel()!.version}` : ''}`,
    vlm: vlmMeta,
    calibration: { applied: false, version: null },
    timingsMs: timings,
    pages: decoded.pages.length,
    preprocessing: steps,
  });

  // Clear non-bill → polite rejection without spending a model call.
  if (classification.decision === 'not_bill' && !opts.userConfirmedBill) {
    await stage('done');
    timings.total = Date.now() - t0;
    return {
      result: emptyResult(classification, quality, baseMeta(), ocrText, 'rejected_not_bill'),
      correctedPages,
      fileSha256,
      perceptualHash,
      vlmError: null,
    };
  }

  // G7 — rule-based extraction
  await stage('extraction');
  const rules = extractFields(layout, { dateOrder });
  lap('extraction');

  // G11/G12 — optional vision model. Used when allowed AND (mode=always OR the cheap path is uncertain).
  let vlmResult: VlmResult | null = null;
  let vlmError: PipelineOutput['vlmError'] = null;
  const requiredWeak =
    rules.merchantName.value === null || rules.billDate.value === null || rules.totalAmount.value === null ||
    rules.totalAmount.status !== 'extracted' || rules.billDate.status === 'ambiguous';
  const wantVlm = Boolean(input.vlm && opts.allowVlm && (input.vlm.config.mode === 'always' || classification.decision === 'ambiguous' || requiredWeak));
  if (wantVlm && input.vlm) {
    await stage('vlm');
    try {
      vlmResult = await input.vlm.extract(correctedPages[0]!, ocrText, { dateOrderHint: dateOrder, signal: input.signal });
      vlmMeta!.used = true;
      vlmMeta!.model = vlmResult.model;
      vlmMeta!.inputTokens = vlmResult.inputTokens;
      vlmMeta!.outputTokens = vlmResult.outputTokens;
      vlmMeta!.estimatedCostUsd = vlmResult.estimatedCostUsd;
    } catch (err) {
      if (err instanceof PipelineError && err.code === 'cancelled') throw err;
      const e = err instanceof PipelineError ? err : new PipelineError('llm_unavailable', 'Vision model call failed.');
      vlmError = { code: e.code, message: e.message };
      vlmMeta!.error = `${e.code}: ${e.message}`;
    }
    lap('vlm');
  }
  const vlm = vlmResult?.output ?? null;

  // The vision model can settle an ambiguous classification (never overrides a user confirmation).
  if (vlm && classification.decision === 'ambiguous' && !opts.userConfirmedBill) {
    const vc = vlm.classification_confidence ?? 0;
    if (vc >= 0.6) {
      classification = {
        ...classification,
        decision: vlm.is_bill ? 'bill' : 'not_bill',
        documentClass: vlm.document_type,
        method: `${CLASSIFIER_VERSION} + ${vlmMeta?.model ?? 'vlm'}`,
        explanation: `Resolved by the vision model: ${vlm.classification_reason}`,
        evidence: [...classification.evidence, `Vision model: ${vlm.classification_reason}`],
      };
    }
    if (classification.decision === 'not_bill') {
      await stage('done');
      timings.total = Date.now() - t0;
      return { result: emptyResult(classification, quality, baseMeta(), ocrText, 'rejected_not_bill'), correctedPages, fileSha256, perceptualHash, vlmError };
    }
  }
  if (opts.userConfirmedBill && classification.decision !== 'bill') {
    classification = { ...classification, decision: 'bill', documentClass: BILL_CLASSES.includes(classification.documentClass) ? classification.documentClass : 'receipt', explanation: 'You confirmed that this document is a bill.' };
  }

  const merged: MergedExtraction = mergeWithVlm(rules, vlm, layout);

  // G8 — categorisation
  await stage('categorisation');
  const category = categorise({
    layout,
    merchantName: merged.merchantName.raw.value,
    vlmCategory: vlm ? { category: vlm.category.value === 'Unknown' ? null : vlm.category.value, confidence: vlm.category.confidence } : null,
    customCategories: opts.customCategories,
  });
  lap('categorisation');

  // Line items: OCR rows first; fall back to model items (flagged, no OCR evidence).
  let lineItems: LineItem[] = rules.lineItems;
  if (!lineItems.length && vlm?.line_items.length) {
    lineItems = vlm.line_items.map((li) => ({
      description: li.description, quantity: li.quantity, unitPrice: li.unit_price, lineTotal: li.line_total, confidence: null, evidence: null,
      arithmeticOk: li.quantity !== null && li.unit_price !== null && li.line_total !== null ? Math.abs(li.quantity * li.unit_price - li.line_total) <= Math.max(0.05, li.line_total * 0.01) : null,
    }));
  }

  // G10 — validation
  await stage('validation');
  const val = (k: keyof MergedExtraction) => merged[k].raw.value as never;
  const { report: validation, fieldStatus, corroborated } = validateBill(
    {
      merchantName: val('merchantName'), billDate: val('billDate'), dueDate: val('dueDate'), currency: val('currency'), totalAmount: val('totalAmount'),
      subtotal: val('subtotal'), tax: val('tax'), discount: val('discount'), serviceCharge: val('serviceCharge'), tip: val('tip'), roundOff: val('roundOff'),
      amountPaid: val('amountPaid'), balanceDue: val('balanceDue'), lineItems, dateAmbiguous: merged.billDate.raw.status === 'ambiguous',
    },
    { today: opts.today },
  );
  if (looksLikeInjection(ocrText) || vlm?.document_contains_instructions) {
    validation.issues.push({
      code: 'document_contains_instructions',
      severity: 'warning',
      fields: [],
      message: 'The document contains text that looks like instructions to an AI system. It was treated as plain data and ignored. Check the values carefully.',
    });
    if (validation.status === 'passed') validation.status = 'needs_review';
  }
  if (vlmError) validation.issues.push({ code: 'vlm_unavailable', severity: 'info', fields: [], message: `Vision-model cross-check was skipped (${vlmError.message}). Results come from OCR rules only.` });
  lap('validation');

  // G9 — confidence
  await stage('confidence');
  const calibration = loadCalibration();
  const fields = {} as Record<keyof BillFields, BillFields[keyof BillFields]>;
  for (const key of Object.keys(merged) as Array<keyof MergedExtraction>) {
    const m = merged[key];
    fields[key] = buildField(m.raw as never, {
      fieldName: key,
      threshold,
      validation: fieldStatus[key],
      source: m.source,
      agreement: m.agreement,
      modelReported: m.modelReported,
      verifiedInOcr: m.verifiedInOcr,
      corroborated: corroborated.includes(key),
      alternativesSource: m.agreement === 'disagree' ? (m.source === 'vlm' ? 'ocr_rules' : 'vlm') : undefined,
      calibration,
    }) as never;
  }
  // Category review state uses the same threshold policy.
  if (category.value) category.review = (category.confidence ?? 0) >= threshold ? 'high_confidence' : 'needs_review';
  lap('confidence');

  const requiredKeys = ['merchantName', 'billDate', 'totalAmount'] as const;
  const allRequiredHigh = requiredKeys.every((k) => fields[k].review === 'high_confidence');
  const overallReview: ExtractionResult['overallReview'] =
    allWords.length < 3 && quality.verdict !== 'good'
      ? 'needs_better_image'
      : classification.decision === 'ambiguous' || !allRequiredHigh || validation.status !== 'passed' || category.review !== 'high_confidence'
        ? 'needs_review'
        : 'ready_for_approval';

  await stage('done');
  timings.total = Date.now() - t0;
  const meta = baseMeta();
  meta.calibration = { applied: Boolean(calibration), version: calibration?.version ?? null };
  return {
    result: {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      isBill: classification.decision !== 'not_bill',
      classification,
      quality,
      fields: fields as BillFields,
      category,
      lineItems,
      validation,
      overallReview,
      meta,
      ocrText,
    },
    correctedPages,
    fileSha256,
    perceptualHash,
    vlmError,
  };
}

function emptyResult(
  classification: ClassificationResult,
  quality: QualityReport,
  meta: ExtractionResult['meta'],
  ocrText: string,
  overallReview: ExtractionResult['overallReview'],
): ExtractionResult {
  const empty = () => buildField(missing<string>(), { fieldName: '', threshold: 1, source: 'none' });
  const keys: Array<keyof BillFields> = [
    'merchantName', 'merchantAddress', 'merchantPhone', 'taxId', 'billDate', 'billTime', 'dueDate', 'currency', 'totalAmount', 'subtotal', 'tax',
    'discount', 'serviceCharge', 'tip', 'roundOff', 'amountPaid', 'balanceDue', 'invoiceNumber', 'receiptNumber', 'paymentMethod', 'transactionReference',
  ];
  return {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    isBill: false,
    classification,
    quality,
    fields: Object.fromEntries(keys.map((k) => [k, empty()])) as unknown as BillFields,
    category: { value: null, subcategory: null, confidence: null, confidenceKind: 'none', review: 'missing', status: 'unknown', reasons: [], source: 'none', scores: {} },
    lineItems: [],
    validation: { status: 'passed', issues: [], checks: [] },
    overallReview,
    meta,
    ocrText,
  };
}
