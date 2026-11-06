/* Response shapes returned by the BillKit API. © 2026 Shaik Gouse Kareem. All rights reserved. */
import type { ExtractionResult, UserSettings } from '@billkit/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  settings: UserSettings;
}

export interface PublicConfig {
  vlmAvailable: boolean;
  vlmProvider: string | null;
  maxUploadMb: number;
  maxPages: number;
  acceptedFormats: string[];
  emailConfigured: boolean;
  registrationOpen: boolean;
  versions: Record<string, string>;
}

export interface DuplicateCandidate {
  id: string;
  score: number;
  reasons: string[];
  kind: string;
  merchantName: string;
  billDate: string;
  totalAmount: number;
  currency: string;
}

export interface ScanResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'saved' | 'discarded';
  stage: string;
  stageLabel: string;
  attempt: number;
  options: Record<string, unknown>;
  error: { code: string; message: string } | null;
  result: ExtractionResult | null;
  images: Array<{ kind: 'original' | 'corrected'; page: number }>;
  duplicates: DuplicateCandidate[];
  billId: string | null;
  vlmConfigured: boolean;
  createdAt: string;
  completedAt: string | null;
}

export type Provenance = 'ai' | 'user_confirmed' | 'user_corrected' | 'user_entered' | 'user_removed';

export interface BillSummary {
  id: string;
  merchantName: string;
  billDate: string;
  totalAmount: number;
  currency: string;
  category: string;
  subcategory: string | null;
  reviewStatus: string;
  hasImage: boolean;
  hasDuplicateWarning: boolean;
  corrected: boolean;
  createdAt: string;
}

export interface BillDetail {
  id: string;
  scanId: string | null;
  merchantName: string;
  billDate: string;
  billTime: string | null;
  totalAmount: number;
  currency: string;
  category: string;
  subcategory: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  serviceCharge: number | null;
  tip: number | null;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  merchantAddress: string | null;
  notes: string | null;
  documentClass: string | null;
  reviewStatus: string;
  validation: { status?: string; issues?: Array<{ code: string; severity: string; message: string }> };
  provenance: Record<string, Provenance>;
  duplicates: DuplicateCandidate[];
  lineItems: Array<{ description: string; quantity: number | null; unitPrice: number | null; lineTotal: number | null }>;
  images: Array<{ kind: string; page: number }>;
  ai: Pick<ExtractionResult, 'fields' | 'category' | 'classification' | 'quality' | 'meta' | 'validation'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSummary {
  totalBills: number;
  currencies: Array<{ currency: string; count: number; total: number; average: number }>;
  primaryCurrency: string | null;
  byCategory: Array<{ category: string; count: number; total: number }>;
  byMerchant: Array<{ merchant: string; count: number; total: number }>;
  monthly: Array<{ month: string; total: number; count: number }>;
  comparison: { thisMonth: number; lastMonth: number; changePct: number | null };
  unusual: Array<{ id: string; merchant: string; date: string; total: number; category: string; reason: string }>;
  budgets: Array<{ category: string; budget: number; spent: number; pct: number | null }>;
  recent: Array<{ id: string; merchant: string; date: string; total: number; currency: string; category: string }>;
  note: string | null;
}
