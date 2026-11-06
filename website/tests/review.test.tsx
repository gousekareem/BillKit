/* Human-in-the-loop behaviour of the review screen, with a mocked API. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { UserSettingsSchema } from '@billkit/shared';
import ScanDetail from '../src/pages/app/ScanDetail';
import { AuthProvider } from '../src/services/auth';
import { ToastProvider } from '../src/services/toast';

const field = (value: unknown, review: string, extra: Record<string, unknown> = {}) => ({
  value, status: value === null ? 'missing' : 'extracted', confidence: value === null ? null : 0.9, confidenceKind: value === null ? 'none' : 'heuristic', review,
  source: value === null ? 'none' : 'ocr_rules', evidence: value === null ? null : { text: `line with ${value}`, page: 0, bbox: [0.1, 0.1, 0.5, 0.05], lineIndex: 1 },
  signals: { ocrConfidence: 0.9, ruleScore: 0.9, modelReported: null, agreement: 'n/a', validation: 'not_checked' }, alternatives: [], note: null, ...extra,
});
const keys = ['merchantAddress', 'merchantPhone', 'taxId', 'billTime', 'dueDate', 'subtotal', 'tax', 'discount', 'serviceCharge', 'tip', 'roundOff', 'amountPaid', 'balanceDue', 'invoiceNumber', 'receiptNumber', 'paymentMethod', 'transactionReference'];
const result = {
  schemaVersion: 'billkit.extraction/1.0', isBill: true, overallReview: 'needs_review', ocrText: '',
  classification: { decision: 'bill', documentClass: 'receipt', billScore: 0.9, confidenceKind: 'heuristic', evidence: [], counterEvidence: [], method: 'm', explanation: 'x' },
  quality: { score: 90, verdict: 'good', metrics: {}, issues: [], retakeSuggestions: [] },
  fields: {
    merchantName: field('CORNER CAFE', 'high_confidence'),
    billDate: field('2026-05-04', 'needs_review', { status: 'ambiguous', alternatives: [{ value: '2026-04-05', source: 'ocr_rules', evidence: '04/05/2026' }] }),
    totalAmount: field(250, 'high_confidence'),
    currency: field(null, 'missing'),
    ...Object.fromEntries(keys.map((k) => [k, field(null, 'missing')])),
  },
  category: { value: 'Food', subcategory: 'Cafe', confidence: 0.9, confidenceKind: 'heuristic', review: 'high_confidence', status: 'suggested', reasons: ['Merchant mentions “cafe”'], source: 'rules', scores: {} },
  lineItems: [], validation: { status: 'passed', issues: [], checks: [] },
  meta: { pipelineVersion: 'p', ocrEngine: 'o', ocrLanguages: ['eng'], classifier: 'c', extractor: 'e', vlm: null, calibration: { applied: false, version: null }, timingsMs: {}, pages: 1, preprocessing: [] },
};
const scan = { id: '11111111-1111-4111-8111-111111111111', status: 'completed', stage: 'done', stageLabel: 'Ready', attempt: 1, options: {}, error: null, result, images: [{ kind: 'corrected', page: 0 }], duplicates: [], billId: null, vlmConfigured: false, createdAt: '', completedAt: '' };
const user = { id: 'u', email: 'u@example.com', name: 'U', role: 'user', createdAt: '', settings: UserSettingsSchema.parse({}) };

let posts: Array<{ url: string; body: any }> = [];
beforeEach(() => {
  posts = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ bill: { id: 'b1' } }), { status: 201 });
    }
    if (url.includes('/api/auth/me')) return new Response(JSON.stringify({ user }));
    if (url.includes('/api/config/public')) return new Response(JSON.stringify({ vlmAvailable: false, maxUploadMb: 15, maxPages: 5, emailConfigured: false, registrationOpen: true, versions: {} }));
    if (url.includes('/api/categories')) return new Response(JSON.stringify({ categories: [] }));
    return new Response(JSON.stringify(scan));
  });
});
afterEach(() => vi.restoreAllMocks());

const renderReview = () =>
  render(
    <MemoryRouter initialEntries={[`/app/scan/${scan.id}`]}>
      <AuthProvider><ToastProvider><Routes><Route path="/app/scan/:id" element={<ScanDetail />} /><Route path="/app/bills/:id" element={<p>Saved bill page</p>} /></Routes></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );

describe('review screen (human in the loop)', () => {
  it('highlights uncertain and missing fields with text labels and evidence', async () => {
    renderReview();
    expect(await screen.findByRole('heading', { name: 'Review bill' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Merchant/)).toHaveValue('CORNER CAFE');
    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
    expect(screen.getByText(/No currency symbol is printed/)).toBeInTheDocument();
    expect(screen.getByText(/line with CORNER CAFE/)).toBeInTheDocument();
  });

  it('blocks approval until flagged fields are confirmed, then saves corrections and confirmations', async () => {
    renderReview();
    const save = await screen.findByRole('button', { name: /Approve & save/ });
    expect(save).toBeDisabled();
    expect(screen.getByText(/Confirm or correct: Bill date, Currency/)).toBeInTheDocument();
    // Use the alternative reading for the ambiguous date (counts as a correction)
    await userEvent.click(screen.getByRole('button', { name: /Use 2026-04-05/ }));
    // Confirm the currency pre-filled from the user's default
    const boxes = screen.getAllByLabelText('I checked this value against the bill');
    await userEvent.click(boxes[boxes.length - 1]!);
    // Correct the merchant
    const merchant = screen.getByLabelText(/^Merchant/);
    await userEvent.clear(merchant);
    await userEvent.type(merchant, 'Corner Cafe');
    expect(screen.getAllByText('You corrected').length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    expect(await screen.findByText('Saved bill page')).toBeInTheDocument();
    const body = posts.find((p) => p.url === '/api/bills')!.body;
    expect(body.fields).toMatchObject({ merchantName: 'Corner Cafe', billDate: '2026-04-05', totalAmount: 250, currency: 'INR', category: 'Food' });
    expect(body.confirmedFields).toContain('currency');
  });

  it('shows live arithmetic validation as the user edits', async () => {
    renderReview();
    await screen.findByRole('heading', { name: 'Review bill' });
    await userEvent.click(screen.getByRole('button', { name: /More details/ }));
    await userEvent.type(screen.getByLabelText('Subtotal'), '100');
    expect(await screen.findByText(/Subtotal 100 = 100, but the total reads 250/)).toBeInTheDocument();
  });
});
