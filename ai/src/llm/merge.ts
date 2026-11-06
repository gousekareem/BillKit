/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G12 — Evidence-aware merge of OCR-rule extraction with vision-model output.
 * Agreement raises confidence; disagreement is surfaced to the user with both
 * candidates; a model-only value is checked against the OCR text so that
 * values the OCR never saw are flagged as unverified.
 */
import type { FieldSignals, FieldSource } from '@billkit/shared';
import { amountsEqual, findDateCandidates, merchantsMatch, normaliseMerchant, stringSimilarity } from '@billkit/shared';
import type { LayoutAnalysis } from '../layout.ts';
import type { RawExtraction, RawField } from '../extract.ts';
import type { VlmOutput } from './schema.ts';

export interface MergedField<T> {
  raw: RawField<T>;
  source: FieldSource;
  agreement: FieldSignals['agreement'];
  modelReported: number | null;
  verifiedInOcr: boolean | null;
}

type Kind = 'string' | 'merchant' | 'number' | 'date' | 'code';

function same(kind: Kind, a: unknown, b: unknown): boolean {
  if (a === null || b === null) return false;
  if (kind === 'number') return amountsEqual(a as number, b as number);
  if (kind === 'merchant') return merchantsMatch(a as string, b as string);
  if (kind === 'date' || kind === 'code') return String(a).toUpperCase() === String(b).toUpperCase();
  return normaliseMerchant(a as string) === normaliseMerchant(b as string) || stringSimilarity(String(a).toLowerCase(), String(b).toLowerCase()) > 0.85;
}

export function verifyInOcr(kind: Kind, value: unknown, layout: LayoutAnalysis): { ok: boolean; rowIndex: number | null } {
  if (value === null || value === undefined) return { ok: false, rowIndex: null };
  for (const row of layout.rows) {
    if (kind === 'number' && row.amounts.some((a) => amountsEqual(Math.abs(a.value), Math.abs(value as number)))) return { ok: true, rowIndex: row.index };
    if (kind === 'date' && (findDateCandidates(row.text, 'DMY').some((d) => d.iso === value) || findDateCandidates(row.text, 'MDY').some((d) => d.iso === value))) return { ok: true, rowIndex: row.index };
    if ((kind === 'merchant' || kind === 'string') && typeof value === 'string') {
      const v = normaliseMerchant(value);
      const r = normaliseMerchant(row.text);
      if (v.length >= 3 && (r.includes(v) || stringSimilarity(v, r) > 0.8)) return { ok: true, rowIndex: row.index };
    }
    if (kind === 'code' && typeof value === 'string' && row.text.toUpperCase().includes(value.toUpperCase())) return { ok: true, rowIndex: row.index };
  }
  return { ok: false, rowIndex: null };
}

function mergeOne<T>(
  kind: Kind,
  rule: RawField<T>,
  vlm: { value: T | null; evidence: string | null; confidence: number | null } | null,
  layout: LayoutAnalysis,
): MergedField<T> {
  if (!vlm) return { raw: rule, source: rule.value === null ? 'none' : 'ocr_rules', agreement: 'n/a', modelReported: null, verifiedInOcr: null };
  const modelReported = vlm.confidence;
  if (rule.value === null && vlm.value === null) return { raw: rule, source: 'none', agreement: 'n/a', modelReported, verifiedInOcr: null };
  if (rule.value !== null && vlm.value === null) {
    return { raw: rule, source: 'ocr_rules', agreement: 'single_source', modelReported: null, verifiedInOcr: true };
  }
  if (rule.value === null && vlm.value !== null) {
    const check = verifyInOcr(kind, vlm.value, layout);
    const row = check.rowIndex !== null ? layout.rows[check.rowIndex] : undefined;
    return {
      raw: {
        value: vlm.value,
        status: 'extracted',
        ruleScore: null,
        ocrConfidence: row?.confidence ?? null,
        evidence: { text: (vlm.evidence ?? row?.text ?? '').slice(0, 500), page: row?.page ?? 0, bbox: row?.nbbox ?? null, lineIndex: row?.index ?? null },
        alternatives: [],
        note: check.ok ? 'Read by the vision model; the value also appears in the OCR text.' : 'Read by the vision model only; OCR could not confirm it. Please verify.',
      },
      source: 'vlm',
      agreement: 'single_source',
      modelReported,
      verifiedInOcr: check.ok,
    };
  }
  // Both present
  if (same(kind, rule.value, vlm.value)) {
    return {
      raw: { ...rule, status: rule.status === 'inferred' ? 'extracted' : rule.status, note: rule.note },
      source: 'ocr_rules+vlm',
      agreement: 'agree',
      modelReported,
      verifiedInOcr: true,
    };
  }
  const vlmCheck = verifyInOcr(kind, vlm.value, layout);
  const preferVlm = (rule.status === 'inferred' || rule.status === 'ambiguous') && vlmCheck.ok;
  if (preferVlm) {
    const row = vlmCheck.rowIndex !== null ? layout.rows[vlmCheck.rowIndex] : undefined;
    return {
      raw: {
        value: vlm.value as T,
        status: 'extracted',
        ruleScore: null,
        ocrConfidence: row?.confidence ?? null,
        evidence: { text: (vlm.evidence ?? row?.text ?? '').slice(0, 500), page: row?.page ?? 0, bbox: row?.nbbox ?? null, lineIndex: row?.index ?? null },
        alternatives: [{ value: rule.value as T, evidence: rule.evidence?.text ?? null }],
        note: 'OCR rules and the vision model disagreed; the vision-model reading is confirmed by the OCR text. Please verify.',
      },
      source: 'vlm',
      agreement: 'disagree',
      modelReported,
      verifiedInOcr: true,
    };
  }
  return {
    raw: {
      ...rule,
      alternatives: [{ value: vlm.value as T, evidence: vlm.evidence }, ...rule.alternatives],
      note: `OCR rules read ${String(rule.value)}, the vision model read ${String(vlm.value)}. Please check the image.`,
    },
    source: 'ocr_rules',
    agreement: 'disagree',
    modelReported,
    verifiedInOcr: true,
  };
}

export type MergedExtraction = { [K in Exclude<keyof RawExtraction, 'lineItems'>]: MergedField<RawExtraction[K] extends RawField<infer T> ? T : never> };

export function mergeWithVlm(rules: RawExtraction, vlm: VlmOutput | null, layout: LayoutAnalysis): MergedExtraction {
  const v = vlm && vlm.is_bill ? vlm : null;
  const none = <T>(r: RawField<T>) => mergeOne<T>('string', r, null, layout);
  return {
    merchantName: mergeOne('merchant', rules.merchantName, v ? v.merchant_name : null, layout),
    merchantAddress: none(rules.merchantAddress),
    merchantPhone: none(rules.merchantPhone),
    taxId: none(rules.taxId),
    billDate: mergeOne('date', rules.billDate, v ? v.bill_date : null, layout),
    billTime: none(rules.billTime),
    dueDate: none(rules.dueDate),
    currency: mergeOne('code', rules.currency, v ? v.currency : null, layout),
    totalAmount: mergeOne('number', rules.totalAmount, v ? v.total_amount : null, layout),
    subtotal: mergeOne('number', rules.subtotal, v ? v.subtotal : null, layout),
    tax: mergeOne('number', rules.tax, v ? v.tax : null, layout),
    discount: mergeOne('number', rules.discount, v ? { ...v.discount, value: v.discount.value === null ? null : Math.abs(v.discount.value) } : null, layout),
    serviceCharge: mergeOne('number', rules.serviceCharge, v ? v.service_charge : null, layout),
    tip: mergeOne('number', rules.tip, v ? v.tip : null, layout),
    roundOff: none(rules.roundOff),
    amountPaid: none(rules.amountPaid),
    balanceDue: none(rules.balanceDue),
    invoiceNumber: mergeOne('code', rules.invoiceNumber, v ? v.invoice_number : null, layout),
    receiptNumber: none(rules.receiptNumber),
    paymentMethod: mergeOne('string', rules.paymentMethod, v ? v.payment_method : null, layout),
    transactionReference: none(rules.transactionReference),
  };
}
