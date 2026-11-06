/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Versioned, strictly validated data contracts shared by the AI pipeline,
 * the backend API and the web application.
 */
import { z } from 'zod';

export const EXTRACTION_SCHEMA_VERSION = 'billkit.extraction/1.0' as const;

/* ------------------------------------------------------------------ */
/* Field-level structures                                              */
/* ------------------------------------------------------------------ */

/** Normalised bounding box: x, y, width, height as fractions (0..1) of the page image. */
export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = z.infer<typeof BBoxSchema>;

export const EvidenceSchema = z.object({
  text: z.string().max(500),
  page: z.number().int().min(0).default(0),
  bbox: BBoxSchema.nullable().default(null),
  lineIndex: z.number().int().nullable().default(null),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * How the value was obtained.
 * - extracted: found next to an explicit label or pattern in the OCR text
 * - inferred: chosen by a weaker heuristic (e.g. largest amount, first line)
 * - ambiguous: several plausible values or an ambiguous format (e.g. 04/05/2026)
 * - missing: not determinable — value is null, never guessed
 * - user_corrected / user_confirmed: set by the human reviewer
 */
export const FieldStatusSchema = z.enum([
  'extracted',
  'inferred',
  'ambiguous',
  'missing',
  'user_corrected',
  'user_confirmed',
]);
export type FieldStatus = z.infer<typeof FieldStatusSchema>;

export const FieldSourceSchema = z.enum(['ocr_rules', 'vlm', 'ocr_rules+vlm', 'statistical', 'user', 'none']);
export type FieldSource = z.infer<typeof FieldSourceSchema>;

/** What the UI shows. Derived from confidence thresholds + validation, never from colour alone. */
export const ReviewStateSchema = z.enum(['high_confidence', 'needs_review', 'missing', 'validation_warning', 'user_corrected']);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

export const ConfidenceKindSchema = z.enum(['heuristic', 'calibrated', 'none']);

export const FieldSignalsSchema = z.object({
  /** Mean Tesseract word confidence (0..1) of the evidence tokens. */
  ocrConfidence: z.number().min(0).max(1).nullable().default(null),
  /** Strength of the rule that matched (0..1); a design constant, not a probability. */
  ruleScore: z.number().min(0).max(1).nullable().default(null),
  /** Confidence the vision-language model reported about itself. Not calibrated. */
  modelReported: z.number().min(0).max(1).nullable().default(null),
  agreement: z.enum(['agree', 'disagree', 'single_source', 'n/a']).default('n/a'),
  validation: z.enum(['pass', 'warn', 'fail', 'not_checked']).default('not_checked'),
});
export type FieldSignals = z.infer<typeof FieldSignalsSchema>;

function fieldSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    status: FieldStatusSchema,
    confidence: z.number().min(0).max(1).nullable(),
    confidenceKind: ConfidenceKindSchema,
    review: ReviewStateSchema,
    source: FieldSourceSchema,
    evidence: EvidenceSchema.nullable(),
    signals: FieldSignalsSchema,
    alternatives: z
      .array(z.object({ value: valueSchema, source: FieldSourceSchema, evidence: z.string().nullable() }))
      .default([]),
    note: z.string().nullable().default(null),
  });
}

export const StringFieldSchema = fieldSchema(z.string().max(300));
export const NumberFieldSchema = fieldSchema(z.number());
/** ISO date yyyy-mm-dd */
export const DateFieldSchema = fieldSchema(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
export type StringField = z.infer<typeof StringFieldSchema>;
export type NumberField = z.infer<typeof NumberFieldSchema>;
export type DateField = z.infer<typeof DateFieldSchema>;
export type AnyField = StringField | NumberField | DateField;

export const LineItemSchema = z.object({
  description: z.string().max(300),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  lineTotal: z.number().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  evidence: EvidenceSchema.nullable(),
  arithmeticOk: z.boolean().nullable(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

/* ------------------------------------------------------------------ */
/* Quality, classification, validation                                 */
/* ------------------------------------------------------------------ */

export const QualityIssueCodeSchema = z.enum([
  'blurry',
  'too_dark',
  'overexposed',
  'glare',
  'uneven_lighting',
  'low_resolution',
  'skewed',
  'rotated',
  'perspective',
  'possibly_cropped',
  'low_text_readability',
  'tiny_image',
]);
export type QualityIssueCode = z.infer<typeof QualityIssueCodeSchema>;

export const QualityReportSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(['good', 'acceptable', 'poor', 'unusable']),
  metrics: z.object({
    width: z.number(),
    height: z.number(),
    megapixels: z.number(),
    laplacianVariance: z.number(),
    meanLuminance: z.number(),
    overexposedFraction: z.number(),
    underexposedFraction: z.number(),
    glareFraction: z.number(),
    lightingUnevenness: z.number(),
    skewDegrees: z.number().nullable(),
    documentAreaFraction: z.number().nullable(),
    touchesBorderSides: z.number().nullable(),
    meanOcrConfidence: z.number().nullable(),
  }),
  issues: z.array(z.object({ code: QualityIssueCodeSchema, severity: z.enum(['info', 'warning', 'error']), message: z.string() })),
  retakeSuggestions: z.array(z.string()),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

export const DocumentClassSchema = z.enum([
  'receipt',
  'invoice',
  'utility_bill',
  'restaurant_bill',
  'grocery_receipt',
  'retail_receipt',
  'handwritten_bill',
  'bill_screenshot',
  'id_card',
  'selfie_or_photo',
  'chat_or_app_screenshot',
  'letter_or_form',
  'certificate',
  'newspaper',
  'blank_page',
  'other_document',
  'unknown',
]);
export type DocumentClass = z.infer<typeof DocumentClassSchema>;

export const BILL_CLASSES: readonly DocumentClass[] = [
  'receipt',
  'invoice',
  'utility_bill',
  'restaurant_bill',
  'grocery_receipt',
  'retail_receipt',
  'handwritten_bill',
  'bill_screenshot',
];

export const ClassificationDecisionSchema = z.enum(['bill', 'not_bill', 'ambiguous']);
export type ClassificationDecision = z.infer<typeof ClassificationDecisionSchema>;

export const ClassificationResultSchema = z.object({
  decision: ClassificationDecisionSchema,
  documentClass: DocumentClassSchema,
  /** Heuristic evidence score for "bill" (0..1). Not a calibrated probability unless confidenceKind = calibrated. */
  billScore: z.number().min(0).max(1),
  confidenceKind: ConfidenceKindSchema,
  evidence: z.array(z.string()),
  counterEvidence: z.array(z.string()),
  method: z.string(),
  explanation: z.string(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export const ValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  fields: z.array(z.string()),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationReportSchema = z.object({
  status: z.enum(['passed', 'needs_review', 'failed']),
  issues: z.array(ValidationIssueSchema),
  checks: z.array(z.object({ name: z.string(), result: z.enum(['pass', 'warn', 'fail', 'skipped']), detail: z.string() })),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export const CategorySuggestionSchema = z.object({
  value: z.string().nullable(),
  subcategory: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  confidenceKind: ConfidenceKindSchema,
  review: ReviewStateSchema,
  status: z.enum(['suggested', 'unknown', 'user_corrected', 'user_confirmed']),
  reasons: z.array(z.string()),
  source: z.enum(['rules', 'statistical', 'vlm', 'combined', 'user', 'none']),
  scores: z.record(z.string(), z.number()),
});
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;

/* ------------------------------------------------------------------ */
/* Full extraction result                                              */
/* ------------------------------------------------------------------ */

export const BillFieldsSchema = z.object({
  merchantName: StringFieldSchema,
  merchantAddress: StringFieldSchema,
  merchantPhone: StringFieldSchema,
  taxId: StringFieldSchema,
  billDate: DateFieldSchema,
  billTime: StringFieldSchema,
  dueDate: DateFieldSchema,
  currency: StringFieldSchema,
  totalAmount: NumberFieldSchema,
  subtotal: NumberFieldSchema,
  tax: NumberFieldSchema,
  discount: NumberFieldSchema,
  serviceCharge: NumberFieldSchema,
  tip: NumberFieldSchema,
  roundOff: NumberFieldSchema,
  amountPaid: NumberFieldSchema,
  balanceDue: NumberFieldSchema,
  invoiceNumber: StringFieldSchema,
  receiptNumber: StringFieldSchema,
  paymentMethod: StringFieldSchema,
  transactionReference: StringFieldSchema,
});
export type BillFields = z.infer<typeof BillFieldsSchema>;
export type BillFieldKey = keyof BillFields;

export const NUMERIC_FIELDS = [
  'totalAmount',
  'subtotal',
  'tax',
  'discount',
  'serviceCharge',
  'tip',
  'roundOff',
  'amountPaid',
  'balanceDue',
] as const satisfies readonly BillFieldKey[];
export const DATE_FIELDS = ['billDate', 'dueDate'] as const satisfies readonly BillFieldKey[];
export const REQUIRED_FIELDS = ['merchantName', 'billDate', 'totalAmount'] as const satisfies readonly BillFieldKey[];

export const FIELD_LABELS: Record<BillFieldKey, string> = {
  merchantName: 'Merchant',
  merchantAddress: 'Merchant address',
  merchantPhone: 'Merchant phone',
  taxId: 'Tax ID (e.g. GSTIN)',
  billDate: 'Bill date',
  billTime: 'Bill time',
  dueDate: 'Due date',
  currency: 'Currency',
  totalAmount: 'Total amount',
  subtotal: 'Subtotal',
  tax: 'Tax',
  discount: 'Discount',
  serviceCharge: 'Service charge',
  tip: 'Tip',
  roundOff: 'Round-off',
  amountPaid: 'Amount paid',
  balanceDue: 'Balance due',
  invoiceNumber: 'Invoice number',
  receiptNumber: 'Receipt / bill number',
  paymentMethod: 'Payment method',
  transactionReference: 'Transaction reference',
};

export const ProcessingMetaSchema = z.object({
  pipelineVersion: z.string(),
  ocrEngine: z.string(),
  ocrLanguages: z.array(z.string()),
  classifier: z.string(),
  extractor: z.string(),
  vlm: z
    .object({
      provider: z.string(),
      model: z.string(),
      promptVersion: z.string(),
      used: z.boolean(),
      error: z.string().nullable(),
      inputTokens: z.number().nullable(),
      outputTokens: z.number().nullable(),
      estimatedCostUsd: z.number().nullable(),
    })
    .nullable(),
  calibration: z.object({ applied: z.boolean(), version: z.string().nullable() }),
  timingsMs: z.record(z.string(), z.number()),
  pages: z.number().int(),
  preprocessing: z.array(z.string()),
});
export type ProcessingMeta = z.infer<typeof ProcessingMetaSchema>;

export const ExtractionResultSchema = z.object({
  schemaVersion: z.literal(EXTRACTION_SCHEMA_VERSION),
  isBill: z.boolean(),
  classification: ClassificationResultSchema,
  quality: QualityReportSchema,
  fields: BillFieldsSchema,
  category: CategorySuggestionSchema,
  lineItems: z.array(LineItemSchema),
  validation: ValidationReportSchema,
  overallReview: z.enum(['ready_for_approval', 'needs_review', 'rejected_not_bill', 'needs_better_image']),
  meta: ProcessingMetaSchema,
  ocrText: z.string(),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/* ------------------------------------------------------------------ */
/* Processing job lifecycle                                            */
/* ------------------------------------------------------------------ */

export const PIPELINE_STAGES = [
  'uploaded',
  'decoding',
  'quality',
  'preprocessing',
  'ocr',
  'classification',
  'layout',
  'extraction',
  'vlm',
  'categorisation',
  'validation',
  'confidence',
  'done',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  uploaded: 'Image received',
  decoding: 'Reading the file',
  quality: 'Checking image quality',
  preprocessing: 'Straightening and enhancing',
  ocr: 'Extracting text (OCR)',
  classification: 'Identifying document type',
  layout: 'Understanding document layout',
  extraction: 'Extracting bill details',
  vlm: 'Cross-checking with vision model',
  categorisation: 'Suggesting a category',
  validation: 'Verifying amounts and dates',
  confidence: 'Assessing confidence',
  done: 'Ready for review',
};

export const ScanStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled', 'saved', 'discarded']);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

/* ------------------------------------------------------------------ */
/* API payloads                                                        */
/* ------------------------------------------------------------------ */

export const PasswordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), 'Include at least one letter and one number');

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: PasswordSchema,
});
export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(128),
});
export const ForgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address') });
export const ResetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: PasswordSchema });
export const ChangePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: PasswordSchema });

export const UserSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  dateFormat: z.enum(['DMY', 'MDY', 'YMD']).default('DMY'),
  /** When OCR finds an ambiguous numeric date, interpret it with this order. */
  ambiguousDateOrder: z.enum(['DMY', 'MDY']).default('DMY'),
  useCloudVision: z.boolean().default(false),
  reviewThreshold: z.number().min(0.5).max(0.99).default(0.85),
  approvalPolicy: z.enum(['always_review', 'allow_quick_approve_when_all_high']).default('always_review'),
  keepOriginalImages: z.boolean().default(true),
  allowCorrectionsForImprovement: z.boolean().default(false),
  budgets: z.record(z.string(), z.number().nonnegative()).default({}),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address').max(254),
  subject: z.string().trim().min(3, 'Subject is too short').max(150),
  message: z.string().trim().min(10, 'Message is too short').max(5000),
  /** Honeypot — must stay empty. */
  website: z.string().max(0).optional().default(''),
  /** Milliseconds the form was open before submission (bot heuristic). */
  elapsedMs: z.number().int().nonnegative(),
});

/** Values the reviewer submits when approving a bill. */
export const ReviewedFieldsSchema = z.object({
  merchantName: z.string().trim().min(1, 'Merchant is required').max(200),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date'),
  totalAmount: z.number({ error: 'Enter the total amount' }).finite(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
  category: z.string().trim().min(1, 'Choose a category').max(60),
  subcategory: z.string().trim().max(60).nullable().default(null),
  billTime: z.string().max(20).nullable().default(null),
  subtotal: z.number().finite().nullable().default(null),
  tax: z.number().finite().nullable().default(null),
  discount: z.number().finite().nullable().default(null),
  serviceCharge: z.number().finite().nullable().default(null),
  tip: z.number().finite().nullable().default(null),
  invoiceNumber: z.string().max(100).nullable().default(null),
  paymentMethod: z.string().max(60).nullable().default(null),
  merchantAddress: z.string().max(300).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
});
export type ReviewedFields = z.infer<typeof ReviewedFieldsSchema>;

export const SaveBillSchema = z.object({
  scanId: z.string().uuid(),
  fields: ReviewedFieldsSchema,
  /** Field keys the user explicitly confirmed without changing. */
  confirmedFields: z.array(z.string()).default([]),
  acknowledgeWarnings: z.boolean().default(false),
  acknowledgeDuplicate: z.boolean().default(false),
});

export const UpdateBillSchema = z.object({ fields: ReviewedFieldsSchema });
