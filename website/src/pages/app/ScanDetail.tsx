/* Processing status (real backend stages), polite rejection, and the review → correct → approve screen.
 * © 2026 Shaik Gouse Kareem. All rights reserved. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Ban, Check, CheckCircle2, ChevronDown, Circle, Info, Loader2, RotateCw, Save, ScanLine, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  BUILT_IN_CATEGORIES, FIELD_LABELS, PIPELINE_STAGES, STAGE_LABELS, SUPPORTED_CURRENCIES, validateBill,
  type AnyField, type BillFieldKey, type ExtractionResult, type PipelineStage, type ReviewedFields,
} from '@billkit/shared';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../services/auth';
import { useToast } from '../../services/toast';
import type { DuplicateCandidate, ScanResponse } from '../../services/types';
import { ReviewBadge, type BadgeState } from '../../components/ReviewBadge';
import { Dialog } from '../../components/Dialog';
import { LoadingBlock } from '../../components/Empty';
import { money, pct } from '../../utils/format';
import { useTitle } from '../../hooks/usePageMeta';

export default function ScanDetail() {
  const { id } = useParams();
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useTitle(scan?.status === 'completed' ? 'Review bill' : 'Processing bill');

  const load = useCallback(async () => {
    try {
      const s = await api.get<ScanResponse>(`/api/scans/${id}`);
      setScan(s);
      setError(null);
      if (s.status === 'queued' || s.status === 'processing') timer.current = setTimeout(load, 700);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      if (err.isNetwork) timer.current = setTimeout(load, 3000);
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const reprocess = async (opts: Record<string, unknown>) => {
    await api.post(`/api/scans/${id}/reprocess`, opts);
    if (timer.current) clearTimeout(timer.current);
    setScan((s) => (s ? { ...s, status: 'queued', stage: 'uploaded' } : s));
    timer.current = setTimeout(load, 300);
  };

  if (error && !scan) return <div className="alert alert-error" role="alert">{error} <Link to="/app/scan">Upload a bill</Link></div>;
  if (!scan) return <LoadingBlock label="Loading scan…" />;
  if (scan.status === 'queued' || scan.status === 'processing') return <Processing scan={scan} onCancelled={load} />;
  if (scan.status === 'saved') return <div className="card"><h1>Already saved</h1><p>This bill has been saved.</p><Link className="btn btn-primary" to={`/app/bills/${scan.billId}`}>Open bill</Link></div>;
  if (scan.status === 'failed' || scan.status === 'cancelled') return <Failed scan={scan} onRetry={() => reprocess({})} />;
  if (scan.result && !scan.result.isBill) return <Rejected scan={scan} onOverride={() => reprocess({ userConfirmedBill: true })} />;
  return <Review scan={scan} onReprocess={reprocess} />;
}

/* ------------------------------------------------------------------ */

function Processing({ scan, onCancelled }: { scan: ScanResponse; onCancelled: () => void }) {
  const toast = useToast();
  const stages: PipelineStage[] = PIPELINE_STAGES.filter((s) => s !== "uploaded");
  const currentIdx = stages.indexOf(scan.stage as PipelineStage);
  const cancel = async () => {
    try {
      await api.post(`/api/scans/${scan.id}/cancel`);
      toast('info', 'Processing cancelled.');
      onCancelled();
    } catch (e) {
      toast('error', (e as ApiError).message);
    }
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>Processing your bill</h1>
        <p className="muted">These are the real stages reported by the BillKit server.{scan.attempt > 1 ? ` Attempt ${scan.attempt}.` : ''}</p>
        <ol className="stage-list" aria-live="polite">
          {scan.status === 'queued' && <li className="current"><Loader2 size={18} className="spin" aria-hidden /> Waiting in the processing queue</li>}
          {stages.map((s, i) => {
            const done = scan.status === 'processing' && i < currentIdx;
            const current = scan.status === 'processing' && i === currentIdx;
            return (
              <li key={s} className={done ? 'done' : current ? 'current' : ''} aria-current={current ? 'step' : undefined}>
                {done ? <CheckCircle2 size={18} aria-label="done" /> : current ? <span className="spinner" aria-label="in progress" /> : <Circle size={18} aria-label="pending" />}
                {STAGE_LABELS[s]}
                {s === 'vlm' && !done && !current && <span className="subtle">(only if enabled and needed)</span>}
              </li>
            );
          })}
        </ol>
        <button className="btn" style={{ marginTop: 'var(--space-4)' }} onClick={cancel}>Cancel processing</button>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Uploaded image</h2>
        <img src={`/api/scans/${scan.id}/images/original/0`} alt="Uploaded bill" style={{ maxHeight: 420, margin: '0 auto', borderRadius: 8 }} onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      </div>
    </div>
  );
}

function Failed({ scan, onRetry }: { scan: ScanResponse; onRetry: () => void }) {
  const nav = useNavigate();
  const discard = async () => {
    await api.del(`/api/scans/${scan.id}`);
    nav('/app/scan');
  };
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>{scan.status === 'cancelled' ? 'Processing cancelled' : 'Processing failed'}</h1>
      <div className={`alert ${scan.status === 'cancelled' ? 'alert-info' : 'alert-error'}`} role="alert"><AlertTriangle aria-hidden /> <p>{scan.error?.message ?? 'Something went wrong.'}</p></div>
      <p className="muted" style={{ marginTop: 'var(--space-4)' }}>Nothing was saved. You can try again, upload a different image, or discard this upload.</p>
      <div className="row">
        <button className="btn btn-primary" onClick={onRetry}><RotateCw size={16} aria-hidden /> Try again</button>
        <Link className="btn" to="/app/scan">Upload a different image</Link>
        <button className="btn btn-ghost" onClick={discard}><Trash2 size={16} aria-hidden /> Discard</button>
      </div>
    </div>
  );
}

function Rejected({ scan, onOverride }: { scan: ScanResponse; onOverride: () => void }) {
  const nav = useNavigate();
  const c = scan.result!.classification;
  const discard = async () => {
    await api.del(`/api/scans/${scan.id}`);
    nav('/app/scan');
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <span className="badge badge-missing" style={{ marginBottom: 'var(--space-3)' }}><Ban aria-hidden /> Not processed as an expense</span>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>This doesn’t look like a bill</h1>
        <p>{c.explanation}</p>
        {(c.counterEvidence.length > 0 || c.evidence.length > 0) && (
          <div className="surface-2 small">
            <strong>What BillKit observed</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '1.1rem' }}>
              {[...c.counterEvidence, ...c.evidence].map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}
        <p className="subtle" style={{ marginTop: 'var(--space-4)' }}>Nothing was saved. Bill detection checks the type of document only; it does not judge whether any document is genuine.</p>
        <div className="row" style={{ marginTop: 'var(--space-4)' }}>
          <Link className="btn btn-primary" to="/app/scan">Upload a different image</Link>
          <button className="btn" onClick={onOverride}>It is a bill — process anyway</button>
          <button className="btn btn-ghost" onClick={discard}><Trash2 size={16} aria-hidden /> Discard</button>
        </div>
      </div>
      <div className="card"><img src={`/api/scans/${scan.id}/images/corrected/0`} alt="The uploaded image" style={{ maxHeight: 480, margin: '0 auto', borderRadius: 8 }} /></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

type Kind = 'text' | 'date' | 'money' | 'currency' | 'category' | 'time';
interface FieldDef { key: keyof ReviewedFields; label: string; kind: Kind; required?: boolean; ai?: BillFieldKey | 'receiptNumber' }

const MAIN: FieldDef[] = [
  { key: 'merchantName', label: 'Merchant', kind: 'text', required: true, ai: 'merchantName' },
  { key: 'billDate', label: 'Bill date', kind: 'date', required: true, ai: 'billDate' },
  { key: 'totalAmount', label: 'Total amount', kind: 'money', required: true, ai: 'totalAmount' },
  { key: 'currency', label: 'Currency', kind: 'currency', required: true, ai: 'currency' },
  { key: 'category', label: 'Category', kind: 'category', required: true },
];
const MORE: FieldDef[] = [
  { key: 'subtotal', label: FIELD_LABELS.subtotal, kind: 'money', ai: 'subtotal' },
  { key: 'tax', label: FIELD_LABELS.tax, kind: 'money', ai: 'tax' },
  { key: 'discount', label: FIELD_LABELS.discount, kind: 'money', ai: 'discount' },
  { key: 'serviceCharge', label: FIELD_LABELS.serviceCharge, kind: 'money', ai: 'serviceCharge' },
  { key: 'tip', label: FIELD_LABELS.tip, kind: 'money', ai: 'tip' },
  { key: 'invoiceNumber', label: 'Invoice / bill number', kind: 'text', ai: 'invoiceNumber' },
  { key: 'paymentMethod', label: FIELD_LABELS.paymentMethod, kind: 'text', ai: 'paymentMethod' },
  { key: 'billTime', label: FIELD_LABELS.billTime, kind: 'time', ai: 'billTime' },
  { key: 'merchantAddress', label: FIELD_LABELS.merchantAddress, kind: 'text', ai: 'merchantAddress' },
];
const ALL = [...MAIN, ...MORE];

function aiFieldOf(result: ExtractionResult, def: FieldDef): AnyField | null {
  if (!def.ai) return null;
  if (def.key === 'invoiceNumber') return result.fields.invoiceNumber.value !== null ? result.fields.invoiceNumber : result.fields.receiptNumber;
  return result.fields[def.ai as BillFieldKey];
}

function aiValueString(result: ExtractionResult, def: FieldDef): string {
  if (def.key === 'category') return result.category.value ?? '';
  const f = aiFieldOf(result, def);
  return f?.value === null || f?.value === undefined ? '' : String(f.value);
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(/,/g, '')));

function Review({ scan, onReprocess }: { scan: ScanResponse; onReprocess: (o: Record<string, unknown>) => Promise<void> }) {
  const result = scan.result!;
  const { user, config } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const settings = user!.settings;
  const [customCats, setCustomCats] = useState<string[]>([]);
  const initial = useMemo(() => {
    const v: Record<string, string> = {};
    for (const d of ALL) v[d.key] = aiValueString(result, d);
    if (!v.currency) v.currency = settings.defaultCurrency;
    v.subcategory = result.category.subcategory ?? '';
    v.notes = '';
    return v;
  }, [result, settings.defaultCurrency]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [aiChanged, setAiChanged] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string>('totalAmount');
  const [billConfirmed, setBillConfirmed] = useState(result.classification.decision === 'bill');
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<null | { kind: 'warnings'; issues: Array<{ message: string }> } | { kind: 'duplicate'; duplicates: DuplicateCandidate[] } | { kind: 'discard' }>(null);
  const [ack, setAck] = useState({ warnings: false, duplicate: false });
  const lastResult = useRef(result);

  useEffect(() => {
    api.get<{ categories: Array<{ name: string; builtIn: boolean }> }>('/api/categories').then((r) => setCustomCats(r.categories.filter((c) => !c.builtIn).map((c) => c.name))).catch(() => undefined);
  }, []);

  // After a reprocess, never overwrite the user's edits; tell them when the AI now suggests something else.
  useEffect(() => {
    if (lastResult.current === result) return;
    lastResult.current = result;
    const diffs: Record<string, string> = {};
    setValues((prev) => {
      const next = { ...prev };
      for (const d of ALL) {
        const ai = aiValueString(result, d);
        if (edited.has(d.key)) {
          if (ai && ai !== prev[d.key]) diffs[d.key] = ai;
        } else next[d.key] = ai || (d.key === 'currency' ? settings.defaultCurrency : '');
      }
      return next;
    });
    setAiChanged(diffs);
  }, [result, edited, settings.defaultCurrency]);

  const setField = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setEdited((s) => new Set(s).add(k));
  };

  const parsed: ReviewedFields = {
    merchantName: values.merchantName!.trim(),
    billDate: values.billDate!,
    totalAmount: numOrNull(values.totalAmount!) as number,
    currency: values.currency!.toUpperCase(),
    category: values.category!,
    subcategory: values.subcategory || null,
    billTime: values.billTime || null,
    subtotal: numOrNull(values.subtotal!),
    tax: numOrNull(values.tax!),
    discount: numOrNull(values.discount!),
    serviceCharge: numOrNull(values.serviceCharge!),
    tip: numOrNull(values.tip!),
    invoiceNumber: values.invoiceNumber || null,
    paymentMethod: values.paymentMethod || null,
    merchantAddress: values.merchantAddress || null,
    notes: values.notes || null,
  };
  // Live validation with the same rules the server applies.
  const live = validateBill({
    merchantName: parsed.merchantName || null, billDate: parsed.billDate || null, currency: parsed.currency || null,
    totalAmount: Number.isFinite(parsed.totalAmount) ? parsed.totalAmount : null, subtotal: parsed.subtotal, tax: parsed.tax, discount: parsed.discount,
    serviceCharge: parsed.serviceCharge, tip: parsed.tip, roundOff: result.fields.roundOff.value, lineItems: result.lineItems,
    dateAmbiguous: result.fields.billDate.status === 'ambiguous' && !edited.has('billDate') && !confirmed.has('billDate'),
  });

  const stateOf = (d: FieldDef): BadgeState => {
    const aiStr = aiValueString(result, d);
    if (edited.has(d.key) && values[d.key] !== aiStr) return 'user_corrected';
    if (confirmed.has(d.key)) return 'user_confirmed';
    const aiF = aiFieldOf(result, d);
    if (aiF?.status === 'ambiguous' && !edited.has(d.key)) return 'needs_review';
    if ((live.fieldStatus[d.key] === 'warn' || live.fieldStatus[d.key] === 'fail') && values[d.key]) return 'validation_warning';
    if (d.key === 'category') return result.category.value ? result.category.review : 'missing';
    if (d.key === 'currency' && !result.fields.currency.value) return 'missing';
    const f = aiFieldOf(result, d);
    return f ? f.review : 'missing';
  };
  const needsAttention = MAIN.filter((d) => ['needs_review', 'missing', 'validation_warning'].includes(stateOf(d)));
  const requiredMissing = MAIN.filter((d) => !values[d.key]?.trim());
  const policyBlocks = settings.approvalPolicy === 'always_review' ? needsAttention.filter((d) => stateOf(d) !== 'validation_warning') : [];
  const canSave = requiredMissing.length === 0 && policyBlocks.length === 0 && billConfirmed && !saving && Number.isFinite(parsed.totalAmount);

  const save = async (acknowledge = ack) => {
    setSaving(true);
    try {
      const r = await api.post<{ bill: { id: string } }>('/api/bills', {
        scanId: scan.id,
        fields: parsed,
        confirmedFields: [...confirmed],
        acknowledgeWarnings: acknowledge.warnings,
        acknowledgeDuplicate: acknowledge.duplicate,
      });
      toast('success', 'Bill saved to your history.');
      nav(`/app/bills/${r.bill.id}`);
    } catch (e) {
      const err = e as ApiError;
      const details = err.details as { issues?: Array<{ message: string }>; duplicates?: DuplicateCandidate[] } | undefined;
      if (err.code === 'validation_warnings') setDialog({ kind: 'warnings', issues: details?.issues ?? [] });
      else if (err.code === 'possible_duplicate') setDialog({ kind: 'duplicate', duplicates: details?.duplicates ?? [] });
      else toast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeDef = ALL.find((d) => d.key === active);
  const activeEvidence = activeDef ? aiFieldOf(result, activeDef)?.evidence ?? null : null;
  const discard = async () => {
    await api.del(`/api/scans/${scan.id}`);
    toast('info', 'Scan discarded.');
    nav('/app/scan');
  };
  const vlmUsed = result.meta.vlm?.used;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Review bill</h1>
          <p>Check the highlighted fields, correct anything that’s wrong, then approve.</p>
        </div>
        <div className="row">
          <span className="badge badge-info"><ScanLine aria-hidden /> {result.classification.documentClass.replace(/_/g, ' ')}</span>
          <span className={`badge ${result.overallReview === 'ready_for_approval' ? 'badge-high' : 'badge-review'}`}>{result.overallReview === 'ready_for_approval' ? 'Ready for approval' : 'Needs your review'}</span>
        </div>
      </div>

      {result.classification.decision === 'ambiguous' && (
        <div className="alert alert-warning" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertTriangle aria-hidden />
          <div>
            <p><strong>Is this a bill?</strong> {result.classification.explanation}</p>
            <label className="checkbox"><input type="checkbox" checked={billConfirmed} onChange={(e) => setBillConfirmed(e.target.checked)} /> Yes, this is a bill or receipt</label>
          </div>
        </div>
      )}
      {scan.duplicates.length > 0 && (
        <div className="alert alert-warning" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertTriangle aria-hidden />
          <div>
            <p><strong>Possible duplicate.</strong> This may already be in your history:</p>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {scan.duplicates.slice(0, 3).map((d) => (
                <li key={d.id}><Link to={`/app/bills/${d.id}`}>{d.merchantName} · {d.billDate} · {money(d.totalAmount, d.currency)}</Link> — {d.reasons.join('; ')}</li>
              ))}
            </ul>
            <p className="small" style={{ marginTop: 6 }}>Repeated purchases are real, so BillKit never deletes anything — you decide when saving.</p>
          </div>
        </div>
      )}
      {Object.keys(aiChanged).length > 0 && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)' }}><Info aria-hidden /><p>Reprocessing produced different suggestions for fields you edited. Your values were kept; the new suggestions are shown under those fields.</p></div>
      )}

      <div className="review-grid">
        <Viewer scan={scan} evidence={activeEvidence} />

        <div className="stack">
          <section className="card card-tight stack" aria-labelledby="key-fields">
            <h2 id="key-fields" style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Key details</h2>
            {MAIN.map((d) => (
              <FieldRow
                key={d.key}
                def={d}
                result={result}
                value={values[d.key] ?? ''}
                state={stateOf(d)}
                onChange={(v) => setField(d.key, v)}
                onFocus={() => setActive(d.key)}
                confirmed={confirmed.has(d.key)}
                onConfirm={(c) => setConfirmed((s) => { const n = new Set(s); if (c) n.add(d.key); else n.delete(d.key); return n; })}
                aiChanged={aiChanged[d.key]}
                customCategories={customCats}
                defaultCurrency={settings.defaultCurrency}
                subcategory={values.subcategory ?? ''}
                onSubcategory={(v) => setField('subcategory', v)}
              />
            ))}
          </section>

          <section className="card card-tight">
            <button className="btn btn-ghost btn-block" style={{ justifyContent: 'space-between' }} aria-expanded={showMore} onClick={() => setShowMore((s) => !s)}>
              <span>More details (subtotal, tax, discount, invoice no…)</span> <ChevronDown size={18} style={{ transform: showMore ? 'rotate(180deg)' : undefined }} aria-hidden />
            </button>
            {showMore && (
              <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
                {MORE.map((d) => (
                  <FieldRow key={d.key} def={d} result={result} value={values[d.key] ?? ''} state={stateOf(d)} onChange={(v) => setField(d.key, v)} onFocus={() => setActive(d.key)} aiChanged={aiChanged[d.key]} />
                ))}
                <div className="field">
                  <label htmlFor="notes">Notes (optional)</label>
                  <textarea id="notes" className="textarea" value={values.notes} onChange={(e) => setValues((s) => ({ ...s, notes: e.target.value }))} maxLength={1000} />
                </div>
              </div>
            )}
          </section>

          <ValidationPanel live={live.report} />

          {result.lineItems.length > 0 && (
            <section className="card card-tight">
              <h2 style={{ fontSize: 'var(--text-lg)' }}>Line items ({result.lineItems.length})</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th><th>Check</th></tr></thead>
                  <tbody>
                    {result.lineItems.map((li, i) => (
                      <tr key={i}>
                        <td>{li.description}</td>
                        <td className="num">{li.quantity ?? '—'}</td>
                        <td className="num">{li.unitPrice ?? '—'}</td>
                        <td className="num">{li.lineTotal ?? '—'}</td>
                        <td>{li.arithmeticOk === true ? <span className="badge badge-high"><Check aria-hidden /> qty×price</span> : li.arithmeticOk === false ? <span className="badge badge-warning"><AlertTriangle aria-hidden /> mismatch</span> : <span className="subtle">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="subtle" style={{ marginTop: 6 }}>Line items are shown for reference and saved as read; edit totals above if needed.</p>
            </section>
          )}

          <details className="card card-tight">
            <summary>Image quality & processing details</summary>
            <div className="stack small" style={{ marginTop: 'var(--space-3)' }}>
              <div><strong>Quality score:</strong> {result.quality.score}/100 ({result.quality.verdict})</div>
              {result.quality.retakeSuggestions.length > 0 && <ul style={{ margin: 0, paddingLeft: '1rem' }}>{result.quality.retakeSuggestions.map((s) => <li key={s}>{s}</li>)}</ul>}
              <div><strong>Classification:</strong> {result.classification.decision} · {result.classification.documentClass} · evidence score {pct(result.classification.billScore)} ({result.classification.confidenceKind}) — {result.classification.method}</div>
              <div><strong>Preprocessing:</strong> {result.meta.preprocessing.join('; ') || 'none'}</div>
              <div><strong>OCR:</strong> {result.meta.ocrEngine}</div>
              <div><strong>Extractor:</strong> {result.meta.extractor}</div>
              <div><strong>Vision model:</strong> {result.meta.vlm ? (vlmUsed ? `${result.meta.vlm.model} (prompt ${result.meta.vlm.promptVersion})` : result.meta.vlm.error ? `failed — ${result.meta.vlm.error}` : 'not needed / not allowed for this bill') : 'not configured'}</div>
              <div><strong>Confidence:</strong> {result.meta.calibration.applied ? `calibrated (${result.meta.calibration.version})` : 'heuristic scores — not calibrated probabilities'}</div>
              <div><strong>Timings:</strong> {Object.entries(result.meta.timingsMs).map(([k, v]) => `${k} ${v} ms`).join(' · ')}</div>
            </div>
          </details>

          <div className="sticky-actions">
            {policyBlocks.length > 0 && (
              <p className="small" style={{ marginRight: 'auto', alignSelf: 'center', color: 'var(--status-review-fg)' }} role="status">
                Confirm or correct: {policyBlocks.map((d) => d.label).join(', ')}
              </p>
            )}
            <div className="row">
              <ReprocessMenu onReprocess={onReprocess} vlmAvailable={Boolean(config?.vlmAvailable && settings.useCloudVision)} vlmUsed={Boolean(vlmUsed)} />
              <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'discard' })}><Trash2 size={16} aria-hidden /> Discard</button>
              <button className="btn btn-primary btn-lg" disabled={!canSave} onClick={() => save()} aria-disabled={!canSave}>
                {saving ? <span className="spinner" aria-hidden /> : <Save size={18} aria-hidden />} Approve &amp; save
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={dialog?.kind === 'warnings'}
        title="Save with validation warnings?"
        onClose={() => setDialog(null)}
        actions={<><button className="btn" onClick={() => setDialog(null)}>Go back and fix</button><button className="btn btn-primary" onClick={() => { const a = { ...ack, warnings: true }; setAck(a); setDialog(null); void save(a); }}>Save anyway</button></>}
      >
        <p>These checks did not pass for the values you are approving:</p>
        <ul>{dialog?.kind === 'warnings' && dialog.issues.map((i) => <li key={i.message}>{i.message}</li>)}</ul>
      </Dialog>
      <Dialog
        open={dialog?.kind === 'duplicate'}
        title="This bill may already be saved"
        onClose={() => setDialog(null)}
        actions={<><button className="btn" onClick={() => setDialog(null)}>Don’t save</button><button className="btn btn-primary" onClick={() => { const a = { ...ack, duplicate: true }; setAck(a); setDialog(null); void save(a); }}>Save both</button></>}
      >
        <ul>{dialog?.kind === 'duplicate' && dialog.duplicates.map((d) => <li key={d.id}><Link to={`/app/bills/${d.id}`}>{d.merchantName} · {d.billDate} · {money(d.totalAmount, d.currency)}</Link> — {d.reasons.join('; ')}</li>)}</ul>
      </Dialog>
      <Dialog
        open={dialog?.kind === 'discard'}
        title="Discard this scan?"
        onClose={() => setDialog(null)}
        actions={<><button className="btn" onClick={() => setDialog(null)}>Keep reviewing</button><button className="btn btn-danger" onClick={discard}>Discard</button></>}
      >
        <p>The uploaded image and extracted data will be deleted. This can’t be undone.</p>
      </Dialog>
    </>
  );
}

function ReprocessMenu({ onReprocess, vlmAvailable, vlmUsed }: { onReprocess: (o: Record<string, unknown>) => Promise<void>; vlmAvailable: boolean; vlmUsed: boolean }) {
  const [open, setOpen] = useState(false);
  const run = (o: Record<string, unknown>) => {
    setOpen(false);
    void onReprocess(o);
  };
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((s) => !s)}><RotateCw size={16} aria-hidden /> Reprocess</button>
      {open && (
        <div role="menu" className="card card-tight" style={{ position: 'absolute', bottom: '110%', right: 0, width: 280, zIndex: 20, display: 'grid', gap: 4 }}>
          <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => run({ rotate: 90 })}>Rotate 90° and re-read</button>
          <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => run({ rotate: 180 })}>Rotate 180° and re-read</button>
          <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => run({ disableAutoCrop: true })}>Re-read without auto-crop</button>
          {vlmAvailable && !vlmUsed && <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => run({ allowVlm: true })}><Sparkles size={14} aria-hidden /> Cross-check with cloud vision</button>}
          <p className="subtle" style={{ margin: '4px 8px' }}>Your edits are kept after reprocessing.</p>
        </div>
      )}
    </div>
  );
}

function FieldRow(props: {
  def: FieldDef;
  result: ExtractionResult;
  value: string;
  state: BadgeState;
  onChange: (v: string) => void;
  onFocus: () => void;
  confirmed?: boolean;
  onConfirm?: (c: boolean) => void;
  aiChanged?: string;
  customCategories?: string[];
  defaultCurrency?: string;
  subcategory?: string;
  onSubcategory?: (v: string) => void;
}) {
  const { def, result, value, state } = props;
  const id = `f-${def.key}`;
  const ai = aiFieldOf(result, def);
  const cat = def.key === 'category' ? result.category : null;
  const cls = state === 'needs_review' ? 'flagged' : state === 'missing' ? 'missing' : state === 'validation_warning' ? 'warn' : state.startsWith('user') ? 'user' : '';
  const needsConfirm = props.onConfirm && ['needs_review', 'missing', 'validation_warning', 'user_confirmed'].includes(state) && value.trim() !== '';
  const describedBy = `${id}-meta`;
  let input;
  if (def.kind === 'category') {
    input = (
      <select id={id} className="select" value={value} onChange={(e) => props.onChange(e.target.value)} onFocus={props.onFocus} aria-describedby={describedBy} required>
        <option value="">Choose a category…</option>
        {BUILT_IN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        {(props.customCategories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  } else if (def.kind === 'currency') {
    input = (
      <select id={id} className="select" value={value} onChange={(e) => props.onChange(e.target.value)} onFocus={props.onFocus} aria-describedby={describedBy}>
        {[...new Set([value, ...SUPPORTED_CURRENCIES])].filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  } else {
    input = (
      <input
        id={id}
        className="input"
        type={def.kind === 'date' ? 'date' : def.kind === 'time' ? 'time' : 'text'}
        inputMode={def.kind === 'money' ? 'decimal' : undefined}
        value={value}
        onChange={(e) => props.onChange(def.kind === 'money' ? e.target.value.replace(/[^\d.,-]/g, '') : e.target.value)}
        onFocus={props.onFocus}
        aria-describedby={describedBy}
        aria-invalid={state === 'validation_warning' ? true : undefined}
        required={def.required}
      />
    );
  }
  return (
    <div className={`field-row ${cls}`}>
      <div className="field-head">
        <label htmlFor={id} className="label">{def.label}{def.required && <span aria-hidden> *</span>}</label>
        <ReviewBadge state={state} />
      </div>
      {input}
      <div id={describedBy} className="evidence">
        {cat ? (
          cat.value ? <>Suggested: <strong>{cat.value}</strong>{cat.subcategory ? ` › ${cat.subcategory}` : ''} {cat.confidence !== null && <>· score {pct(cat.confidence)} (heuristic)</>}. {cat.reasons.slice(0, 3).join('; ')}</> : <>{cat.reasons[0] ?? 'No category evidence found.'}</>
        ) : def.key === 'currency' && !result.fields.currency.value ? (
          <>No currency symbol is printed on the bill — pre-filled with your default ({props.defaultCurrency}). Confirm it.</>
        ) : ai?.evidence?.text ? (
          <>Read from <q>{ai.evidence.text}</q>{ai.confidence !== null && <> · score {pct(ai.confidence)} ({ai.confidenceKind === 'calibrated' ? 'calibrated' : 'heuristic, not a probability'})</>}{ai.source !== 'ocr_rules' && ai.source !== 'none' && <> · source: {ai.source === 'vlm' ? 'vision model' : 'OCR + vision model agree'}</>}</>
        ) : ai && ai.status === 'missing' ? (
          <>Not found on the bill. Nothing was guessed.</>
        ) : null}
        {ai?.note && <div style={{ marginTop: 2 }}>{ai.note}</div>}
      </div>
      {ai && ai.alternatives.length > 0 && (
        <div className="alt">
          {ai.alternatives.slice(0, 3).map((a) => (
            <button type="button" key={String(a.value)} className="chip" onClick={() => props.onChange(String(a.value))}>
              Use {String(a.value)} <span className="subtle">({a.source === 'vlm' ? 'vision model' : 'alternative reading'})</span>
            </button>
          ))}
        </div>
      )}
      {props.aiChanged && (
        <div className="alt"><button type="button" className="chip" onClick={() => props.onChange(props.aiChanged!)}>AI now suggests {props.aiChanged} — use it</button></div>
      )}
      {def.key === 'category' && value && props.onSubcategory && (
        <input className="input" style={{ marginTop: 8 }} placeholder="Subcategory (optional)" aria-label="Subcategory" value={props.subcategory} onChange={(e) => props.onSubcategory!(e.target.value)} maxLength={60} />
      )}
      {needsConfirm && (
        <label className="checkbox" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={props.confirmed} onChange={(e) => props.onConfirm!(e.target.checked)} />
          I checked this value against the bill
        </label>
      )}
    </div>
  );
}

function ValidationPanel({ live }: { live: ReturnType<typeof validateBill>['report'] }) {
  const issues = live.issues.filter((i) => i.code !== 'missing_required');
  return (
    <section className="card card-tight" aria-labelledby="val-h" aria-live="polite">
      <div className="card-header" style={{ marginBottom: 8 }}>
        <h2 id="val-h">Checks</h2>
        <span className={`badge ${live.status === 'passed' ? 'badge-high' : live.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
          {live.status === 'passed' ? <><CheckCircle2 aria-hidden /> All checks passed</> : live.status === 'failed' ? <><AlertTriangle aria-hidden /> Invalid values</> : <><AlertTriangle aria-hidden /> Needs attention</>}
        </span>
      </div>
      <ul className="stack small" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {live.checks.filter((c) => c.result !== 'skipped').map((c) => (
          <li key={c.name} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            {c.result === 'pass' ? <CheckCircle2 size={16} color="var(--status-high-fg)" aria-label="passed" /> : <AlertTriangle size={16} color="var(--status-warning-fg)" aria-label="warning" />}
            <span><strong>{c.name}:</strong> {c.detail}</span>
          </li>
        ))}
        {issues.map((i) => (
          <li key={i.code + i.message} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            {i.severity === 'info' ? <Info size={16} aria-label="info" /> : <AlertTriangle size={16} color={i.severity === 'error' ? 'var(--status-error-fg)' : 'var(--status-warning-fg)'} aria-label={i.severity} />}
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Viewer({ scan, evidence }: { scan: ScanResponse; evidence: { page: number; bbox: [number, number, number, number] | null; text: string } | null }) {
  const pages = scan.images.filter((i) => i.kind === 'corrected').map((i) => i.page);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [original, setOriginal] = useState(false);
  const [originalFailed, setOriginalFailed] = useState(false);
  useEffect(() => {
    if (evidence && evidence.page !== page) setPage(evidence.page);
  }, [evidence]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = !original && evidence?.bbox && evidence.page === page ? evidence.bbox : null;
  return (
    <section className="viewer" aria-label="Bill image">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" role="group" aria-label="Image view">
          <button className="chip" aria-pressed={!original} onClick={() => setOriginal(false)}>Corrected</button>
          <button className="chip" aria-pressed={original} onClick={() => setOriginal(true)}>Original</button>
          {pages.length > 1 && pages.map((p) => <button key={p} className="chip" aria-pressed={page === p} onClick={() => setPage(p)}>Page {p + 1}</button>)}
        </div>
        <div className="row">
          <button className="btn btn-sm btn-icon" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out" disabled={zoom <= 1}><ZoomOut size={16} /></button>
          <button className="btn btn-sm btn-icon" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Zoom in" disabled={zoom >= 3}><ZoomIn size={16} /></button>
        </div>
      </div>
      <div className="viewer-frame">
        <div className="viewer-inner" style={{ width: `${zoom * 100}%` }}>
          {original && originalFailed ? (
            <p className="center subtle" style={{ padding: 40 }}>The original file format (for example HEIC or PDF) can’t be previewed in this browser. The corrected image shows what was processed.</p>
          ) : (
            <img
              src={`/api/scans/${scan.id}/images/${original ? 'original' : 'corrected'}/${original ? Math.min(page, scan.images.filter((i) => i.kind === 'original').length - 1) : page}`}
              alt={original ? 'Original uploaded image' : 'Processed bill image (straightened and enhanced)'}
              onError={() => original && setOriginalFailed(true)}
            />
          )}
          {box && <div className="evidence-box" style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%` }} aria-hidden />}
        </div>
      </div>
      <p className="subtle" style={{ marginTop: 6 }}>{box ? <>Highlighted: where the selected field was read.</> : <>Select a field to see where it was read on the bill.</>}</p>
    </section>
  );
}
