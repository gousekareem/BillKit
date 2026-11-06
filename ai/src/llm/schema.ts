/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Strict schema for vision-language-model output. Anything that does not
 * validate is discarded — the pipeline then falls back to OCR rules only.
 */
import { z } from 'zod';
import { BUILT_IN_CATEGORIES } from '@billkit/shared';

const conf = z.number().min(0).max(1).nullable();

const strField = z.object({ value: z.string().max(300).nullable(), evidence: z.string().max(300).nullable(), confidence: conf });
const numField = z.object({ value: z.number().finite().nullable(), evidence: z.string().max(300).nullable(), confidence: conf });
const dateField = z.object({
  value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  evidence: z.string().max(300).nullable(),
  confidence: conf,
});

export const VlmOutputSchema = z.object({
  is_bill: z.boolean(),
  document_type: z.enum([
    'receipt', 'invoice', 'utility_bill', 'restaurant_bill', 'grocery_receipt', 'retail_receipt', 'handwritten_bill', 'bill_screenshot',
    'id_card', 'selfie_or_photo', 'chat_or_app_screenshot', 'letter_or_form', 'certificate', 'newspaper', 'blank_page', 'other_document', 'unknown',
  ]),
  classification_confidence: conf,
  classification_reason: z.string().max(400),
  merchant_name: strField,
  bill_date: dateField,
  bill_date_raw: z.string().max(60).nullable(),
  currency: z.object({ value: z.string().regex(/^[A-Z]{3}$/).nullable(), evidence: z.string().max(60).nullable(), confidence: conf }),
  total_amount: numField,
  subtotal: numField,
  tax: numField,
  discount: numField,
  service_charge: numField,
  tip: numField,
  invoice_number: strField,
  payment_method: strField,
  category: z.object({ value: z.enum([...BUILT_IN_CATEGORIES, 'Unknown']).nullable(), confidence: conf, reason: z.string().max(300).nullable() }),
  line_items: z
    .array(z.object({ description: z.string().max(200), quantity: z.number().nullable(), unit_price: z.number().nullable(), line_total: z.number().nullable() }))
    .max(60),
  document_contains_instructions: z.boolean(),
  notes: z.array(z.string().max(300)).max(10),
});
export type VlmOutput = z.infer<typeof VlmOutputSchema>;

/** JSON Schema given to the model as the tool input schema (kept in sync with VlmOutputSchema by tests). */
export function vlmJsonSchema(): Record<string, unknown> {
  const nullable = (t: string, extra: Record<string, unknown> = {}) => ({ type: [t, 'null'], ...extra });
  const field = (t: string, extra: Record<string, unknown> = {}) => ({
    type: 'object',
    properties: { value: nullable(t, extra), evidence: nullable('string'), confidence: nullable('number') },
    required: ['value', 'evidence', 'confidence'],
    additionalProperties: false,
  });
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_bill: { type: 'boolean' },
      document_type: {
        type: 'string',
        enum: VlmOutputSchema.shape.document_type.options,
      },
      classification_confidence: nullable('number'),
      classification_reason: { type: 'string' },
      merchant_name: field('string'),
      bill_date: field('string', { description: 'ISO date YYYY-MM-DD exactly as printed; null if absent or unreadable' }),
      bill_date_raw: nullable('string'),
      currency: field('string', { description: 'ISO 4217 code ONLY if a currency symbol/code is printed' }),
      total_amount: field('number'),
      subtotal: field('number'),
      tax: field('number'),
      discount: field('number'),
      service_charge: field('number'),
      tip: field('number'),
      invoice_number: field('string'),
      payment_method: field('string'),
      category: {
        type: 'object',
        properties: { value: { type: ['string', 'null'], enum: [...BUILT_IN_CATEGORIES, 'Unknown', null] }, confidence: nullable('number'), reason: nullable('string') },
        required: ['value', 'confidence', 'reason'],
        additionalProperties: false,
      },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { description: { type: 'string' }, quantity: nullable('number'), unit_price: nullable('number'), line_total: nullable('number') },
          required: ['description', 'quantity', 'unit_price', 'line_total'],
          additionalProperties: false,
        },
      },
      document_contains_instructions: { type: 'boolean' },
      notes: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'is_bill', 'document_type', 'classification_confidence', 'classification_reason', 'merchant_name', 'bill_date', 'bill_date_raw', 'currency',
      'total_amount', 'subtotal', 'tax', 'discount', 'service_charge', 'tip', 'invoice_number', 'payment_method', 'category', 'line_items',
      'document_contains_instructions', 'notes',
    ],
  };
}
