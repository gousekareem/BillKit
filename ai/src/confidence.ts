/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G9 — Confidence and uncertainty management.
 *
 * Four different signals are kept separate (see FieldSignals):
 *   1. OCR confidence      — Tesseract's word confidence for the evidence tokens
 *   2. Model-reported      — what the vision-language model says about itself
 *   3. Validation result   — deterministic rule outcome (pass / warn / fail)
 *   4. Calibrated score    — ONLY when a calibration table built from a labelled
 *                            validation set is registered (ai/models/registry.json)
 *
 * Without calibration the combined number is a heuristic ranking score
 * (confidenceKind = "heuristic") used to decide what to highlight. It is never
 * presented as a probability of being correct.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AnyField, FieldSignals, FieldSource, ReviewState } from '@billkit/shared';
import { modelsDir } from './categorise.ts';
import type { RawField } from './extract.ts';

export const DEFAULT_REVIEW_THRESHOLD = 0.85;

export interface CalibrationTable {
  format: 'billkit-calibration/1';
  version: string;
  method: 'histogram-binning';
  fields: Record<string, { bins: Array<{ lo: number; hi: number; accuracy: number; n: number }> }>;
  createdFrom: string;
}

let cachedCalibration: CalibrationTable | null | undefined;

export function loadCalibration(): CalibrationTable | null {
  if (cachedCalibration !== undefined) return cachedCalibration;
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(modelsDir(), 'registry.json'), 'utf8')) as { active?: { calibration?: string } };
    const file = registry.active?.calibration;
    cachedCalibration = file ? (JSON.parse(fs.readFileSync(path.join(modelsDir(), file), 'utf8')) as CalibrationTable) : null;
  } catch {
    cachedCalibration = null;
  }
  return cachedCalibration;
}

export function resetCalibrationCache(): void {
  cachedCalibration = undefined;
}

/** Map a heuristic score to the empirical accuracy of its bin (only bins with ≥ 10 labelled examples are trusted). */
export function applyCalibration(table: CalibrationTable | null, field: string, score: number): number | null {
  const bins = table?.fields[field]?.bins;
  if (!bins) return null;
  const bin = bins.find((b) => score >= b.lo && (score < b.hi || (b.hi >= 1 && score <= 1)));
  return bin && bin.n >= 10 ? bin.accuracy : null;
}

export interface BuildFieldOptions<T> {
  fieldName: string;
  threshold: number;
  validation?: 'pass' | 'warn' | 'fail';
  source: FieldSource;
  agreement?: FieldSignals['agreement'];
  modelReported?: number | null;
  /** For VLM-only values: whether the value text was found in the OCR output. */
  verifiedInOcr?: boolean | null;
  corroborated?: boolean;
  alternativesSource?: FieldSource;
  calibration?: CalibrationTable | null;
  transform?: (v: T) => T;
}

/** Combine signals into a heuristic score in [0, 1]. Documented in docs/technical/10_confidence.md. */
export function heuristicScore(input: {
  ruleScore: number | null;
  ocrConfidence: number | null;
  status: RawField<unknown>['status'];
  agreement: FieldSignals['agreement'];
  verifiedInOcr: boolean | null;
  validation: 'pass' | 'warn' | 'fail' | undefined;
  modelReported: number | null;
  /** The value is independently confirmed by arithmetic with other fields. */
  corroborated?: boolean;
}): number {
  const rule = input.ruleScore ?? (input.modelReported !== null ? 0.6 : 0.5);
  const ocr = input.ocrConfidence ?? 0.8;
  let s = rule * (0.55 + 0.45 * ocr);
  if (input.agreement === 'agree') s = 1 - (1 - s) * 0.4;
  if (input.agreement === 'disagree') s *= 0.6;
  if (input.agreement === 'single_source' && input.verifiedInOcr === false) s = Math.min(s, 0.45);
  if (input.agreement === 'single_source' && input.verifiedInOcr === true) s = Math.min(s, 0.75);
  if (input.status === 'ambiguous') s = Math.min(s, 0.6);
  if (input.status === 'inferred') s = Math.min(s, 0.6);
  if (input.validation === 'warn') s = Math.min(s, 0.7);
  if (input.validation === 'fail') s = Math.min(s, 0.4);
  if (input.validation === 'pass' && input.status === 'extracted' && input.agreement !== 'disagree') s = Math.min(1, s + 0.05);
  if (input.corroborated && input.status === 'extracted' && input.agreement !== 'disagree') s = 1 - (1 - s) * 0.5;
  return Math.round(Math.max(0, Math.min(1, s)) * 100) / 100;
}

export function reviewStateFor(score: number | null, status: string, validation: 'pass' | 'warn' | 'fail' | undefined, threshold: number): ReviewState {
  if (status === 'missing' || score === null) return 'missing';
  if (status === 'user_corrected') return 'user_corrected';
  if (validation === 'warn' || validation === 'fail') return 'validation_warning';
  if (status === 'ambiguous' || status === 'inferred') return 'needs_review';
  return score >= threshold ? 'high_confidence' : 'needs_review';
}

export function buildField<T extends string | number>(raw: RawField<T>, opts: BuildFieldOptions<T>): AnyField {
  if (raw.value === null || raw.status === 'missing') {
    return {
      value: null, status: 'missing', confidence: null, confidenceKind: 'none', review: 'missing', source: 'none',
      evidence: raw.evidence ?? null,
      signals: { ocrConfidence: null, ruleScore: null, modelReported: opts.modelReported ?? null, agreement: 'n/a', validation: 'not_checked' },
      alternatives: raw.alternatives.map((a) => ({ value: a.value, source: opts.alternativesSource ?? opts.source, evidence: a.evidence })),
      note: raw.note,
    } as AnyField;
  }
  const agreement = opts.agreement ?? 'n/a';
  const score = heuristicScore({
    ruleScore: raw.ruleScore,
    ocrConfidence: raw.ocrConfidence,
    status: raw.status,
    agreement,
    verifiedInOcr: opts.verifiedInOcr ?? null,
    validation: opts.validation,
    modelReported: opts.modelReported ?? null,
    corroborated: opts.corroborated,
  });
  const calibrated = applyCalibration(opts.calibration ?? null, opts.fieldName, score);
  const confidence = calibrated ?? score;
  return {
    value: opts.transform ? opts.transform(raw.value) : raw.value,
    status: raw.status,
    confidence,
    confidenceKind: calibrated !== null ? 'calibrated' : 'heuristic',
    review: reviewStateFor(confidence, agreement === 'disagree' ? 'ambiguous' : raw.status, opts.validation, opts.threshold),
    source: opts.source,
    evidence: raw.evidence,
    signals: {
      ocrConfidence: raw.ocrConfidence === null ? null : Math.round(raw.ocrConfidence * 100) / 100,
      ruleScore: raw.ruleScore,
      modelReported: opts.modelReported ?? null,
      agreement,
      validation: opts.validation ?? 'not_checked',
    },
    alternatives: raw.alternatives.map((a) => ({ value: a.value, source: opts.alternativesSource ?? opts.source, evidence: a.evidence })),
    note: raw.note,
  } as AnyField;
}
