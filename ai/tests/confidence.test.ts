import { describe, expect, it } from 'vitest';
import { applyCalibration, buildField, heuristicScore, reviewStateFor, type CalibrationTable } from '../src/confidence.ts';
import { missing, type RawField } from '../src/extract.ts';

const raw = (over: Partial<RawField<number>> = {}): RawField<number> => ({
  value: 100, status: 'extracted', ruleScore: 0.9, ocrConfidence: 0.95, evidence: { text: 'TOTAL 100', page: 0, bbox: null, lineIndex: 3 }, alternatives: [], note: null, ...over,
});

describe('confidence', () => {
  it('missing fields have no confidence and review=missing', () => {
    const f = buildField(missing<number>(), { fieldName: 'totalAmount', threshold: 0.85, source: 'ocr_rules' });
    expect(f).toMatchObject({ value: null, confidence: null, review: 'missing', confidenceKind: 'none' });
  });
  it('strong labelled OCR values are high confidence; weak ones need review', () => {
    expect(buildField(raw(), { fieldName: 'totalAmount', threshold: 0.85, source: 'ocr_rules', validation: 'pass', corroborated: true }).review).toBe('high_confidence');
    expect(buildField(raw({ ocrConfidence: 0.4 }), { fieldName: 'totalAmount', threshold: 0.85, source: 'ocr_rules' }).review).toBe('needs_review');
    expect(buildField(raw({ status: 'inferred', ruleScore: 0.4 }), { fieldName: 'totalAmount', threshold: 0.85, source: 'ocr_rules' }).review).toBe('needs_review');
  });
  it('validation warnings override confidence', () => {
    expect(buildField(raw(), { fieldName: 'totalAmount', threshold: 0.85, source: 'ocr_rules', validation: 'warn' }).review).toBe('validation_warning');
  });
  it('agreement raises and disagreement lowers the score; unverified model-only values are capped', () => {
    const args = { ruleScore: 0.8, ocrConfidence: 0.9, status: 'extracted' as const, verifiedInOcr: null, validation: undefined, modelReported: null };
    const single = heuristicScore({ ...args, agreement: 'n/a' });
    expect(heuristicScore({ ...args, agreement: 'agree' })).toBeGreaterThan(single);
    expect(heuristicScore({ ...args, agreement: 'disagree' })).toBeLessThan(single);
    expect(heuristicScore({ ...args, ruleScore: null, modelReported: 0.99, agreement: 'single_source', verifiedInOcr: false })).toBeLessThanOrEqual(0.45);
  });
  it('a model self-reported 0.99 is never used as the confidence itself', () => {
    const f = buildField(raw({ ruleScore: null, ocrConfidence: null }), { fieldName: 'totalAmount', threshold: 0.85, source: 'vlm', agreement: 'single_source', verifiedInOcr: false, modelReported: 0.99 });
    expect(f.confidence).toBeLessThan(0.5);
    expect(f.signals.modelReported).toBe(0.99);
    expect(f.confidenceKind).toBe('heuristic');
  });
  it('applies calibration only for bins with enough labelled data', () => {
    const table: CalibrationTable = { format: 'billkit-calibration/1', version: 't', method: 'histogram-binning', createdFrom: 'test', fields: { totalAmount: { bins: [{ lo: 0, hi: 0.5, accuracy: 0.3, n: 50 }, { lo: 0.5, hi: 1, accuracy: 0.9, n: 3 }] } } };
    expect(applyCalibration(table, 'totalAmount', 0.2)).toBe(0.3);
    expect(applyCalibration(table, 'totalAmount', 0.8)).toBeNull();
    expect(applyCalibration(table, 'merchantName', 0.8)).toBeNull();
    const f = buildField(raw({ ruleScore: 0.3, ocrConfidence: 0.5 }), { fieldName: 'totalAmount', threshold: 0.85, source: 'ocr_rules', calibration: table });
    expect(f.confidenceKind).toBe('calibrated');
  });
  it('review state respects the configurable threshold', () => {
    expect(reviewStateFor(0.8, 'extracted', undefined, 0.75)).toBe('high_confidence');
    expect(reviewStateFor(0.8, 'extracted', undefined, 0.9)).toBe('needs_review');
  });
});
