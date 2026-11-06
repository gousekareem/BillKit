/* Bill history (search, filters, sort, pagination, export) and bill detail (view, edit, delete, export).
 * © 2026 Shaik Gouse Kareem. All rights reserved. */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowLeft, Camera, Download, FileJson, Pencil, PencilLine, Receipt, Save, Trash2, X } from 'lucide-react';
import { BUILT_IN_CATEGORIES, FIELD_LABELS, SUPPORTED_CURRENCIES, ReviewedFieldsSchema } from '@billkit/shared';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../services/auth';
import { useToast } from '../../services/toast';
import type { BillDetail as BillDetailT, BillSummary, Provenance } from '../../services/types';
import { Dialog } from '../../components/Dialog';
import { EmptyState, LoadingBlock } from '../../components/Empty';
import { SelectField, TextField, fieldErrors } from '../../components/Form';
import { date, money, relativeTime } from '../../utils/format';
import { useTitle } from '../../hooks/usePageMeta';

interface ListResponse { total: number; page: number; pageSize: number; merchants: string[]; bills: BillSummary[]; __cache?: { fromCache: boolean; cachedAt?: string } }

export function useCategories() {
  const [cats, setCats] = useState<string[]>([...BUILT_IN_CATEGORIES]);
  useEffect(() => {
    api.get<{ categories: Array<{ name: string }> }>('/api/categories', { offlineKey: 'categories' }).then((r) => setCats(r.categories.map((c) => c.name))).catch(() => undefined);
  }, []);
  return cats;
}

export function Bills() {
  useTitle('Bill history');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(params.get('q') ?? '');
  const cats = useCategories();
  const fmt = user?.settings.dateFormat ?? 'DMY';
  const query = params.toString();
  useEffect(() => {
    setData(null);
    setError(null);
    api.get<ListResponse>(`/api/bills?${query}`, { offlineKey: `bills?${query}` }).then(setData).catch((e: ApiError) => setError(e.message));
  }, [query]);
  useEffect(() => setQ(params.get('q') ?? ''), [params]);
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k !== 'page') p.delete('page');
    setParams(p);
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setParam('q', q.trim());
  };
  const page = Number(params.get('page') ?? 1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const exportQuery = useMemo(() => { const p = new URLSearchParams(params); p.delete('page'); p.delete('pageSize'); return p.toString(); }, [params]);
  const hasFilters = ['q', 'category', 'merchant', 'from', 'to', 'currency'].some((k) => params.get(k));

  return (
    <>
      <div className="page-title">
        <div><h1>Bill history</h1><p>{data ? `${data.total} verified bill${data.total === 1 ? '' : 's'}` : 'Your verified bills'}</p></div>
        <div className="row">
          <a className="btn" href={`/api/bills/export.csv?${exportQuery}`} download><Download size={16} aria-hidden /> Export CSV</a>
          <Link className="btn btn-primary" to="/app/scan"><Camera size={16} aria-hidden /> Scan</Link>
        </div>
      </div>
      <form className="card card-tight filters" onSubmit={onSearch} role="search" aria-label="Filter bills" style={{ marginBottom: 'var(--space-4)' }}>
        <TextField label="Search" placeholder="Merchant, category, invoice no, notes" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (params.get('q') ?? '') && setParam('q', q.trim())} />
        <SelectField label="Category" value={params.get('category') ?? ''} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
        <SelectField label="Merchant" value={params.get('merchant') ?? ''} onChange={(e) => setParam('merchant', e.target.value)}>
          <option value="">All</option>
          {(data?.merchants ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
        </SelectField>
        <TextField label="From" type="date" value={params.get('from') ?? ''} onChange={(e) => setParam('from', e.target.value)} />
        <TextField label="To" type="date" value={params.get('to') ?? ''} onChange={(e) => setParam('to', e.target.value)} />
        <SelectField label="Sort" value={`${params.get('sort') ?? 'date'}:${params.get('order') ?? 'desc'}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); const p = new URLSearchParams(params); p.set('sort', s!); p.set('order', o!); setParams(p); }}>
          <option value="date:desc">Newest date</option>
          <option value="date:asc">Oldest date</option>
          <option value="amount:desc">Highest amount</option>
          <option value="amount:asc">Lowest amount</option>
          <option value="merchant:asc">Merchant A–Z</option>
          <option value="created:desc">Recently added</option>
        </SelectField>
      </form>
      {hasFilters && <p className="small"><button className="btn btn-ghost btn-sm" onClick={() => setParams(new URLSearchParams())}><X size={14} aria-hidden /> Clear filters</button></p>}
      {data?.__cache?.fromCache && <div className="alert alert-warning" style={{ marginBottom: 12 }}>Offline — showing the copy saved on this device {data.__cache.cachedAt ? relativeTime(data.__cache.cachedAt) : ''}.</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {!data && !error && <LoadingBlock />}
      {data && data.total === 0 && (hasFilters ? <EmptyState title="No bills match these filters">Try a different search or clear the filters.</EmptyState> : <EmptyState title="No saved bills yet" action={<Link to="/app/scan" className="btn btn-primary"><Camera size={16} aria-hidden /> Scan a bill</Link>}>Bills appear here after you review and approve them.</EmptyState>)}
      {data && data.total > 0 && (
        <>
          <div className="bill-list" aria-live="polite">
            {data.bills.map((b) => (
              <Link key={b.id} to={`/app/bills/${b.id}`} className="bill-item">
                <span className="bill-thumb">{b.hasImage ? <img src={`/api/bills/${b.id}/image/corrected/0`} alt="" loading="lazy" /> : <Receipt aria-hidden />}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.merchantName}</strong>
                  <span className="row" style={{ gap: 6, marginTop: 2 }}>
                    <span className="subtle">{date(b.billDate, fmt)}</span>
                    <span className="badge">{b.category}</span>
                    <span className="badge badge-high" title="Approved by you">Verified</span>
                    {b.corrected && <span className="badge badge-user"><PencilLine aria-hidden /> Corrected</span>}
                    {b.hasDuplicateWarning && <span className="badge badge-warning"><AlertTriangle aria-hidden /> Possible duplicate</span>}
                  </span>
                </span>
                <span className="amount">{money(b.totalAmount, b.currency)}</span>
              </Link>
            ))}
          </div>
          {pages > 1 && (
            <nav className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-5)' }} aria-label="Pagination">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Previous</button>
              <span className="small">Page {page} of {pages}</span>
              <button className="btn btn-sm" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>Next</button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

const PROV_LABEL: Record<Provenance, { label: string; cls: string }> = {
  ai: { label: 'AI, approved', cls: 'badge-info' },
  user_confirmed: { label: 'You confirmed', cls: 'badge-user' },
  user_corrected: { label: 'You corrected', cls: 'badge-user' },
  user_entered: { label: 'You entered', cls: 'badge-user' },
  user_removed: { label: 'You removed', cls: 'badge-user' },
};

export function BillDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const cats = useCategories();
  const [bill, setBill] = useState<(BillDetailT & { __c?: boolean }) | null>(null);
  const [cache, setCache] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  useTitle(bill ? bill.merchantName : 'Bill');
  const fmt = user?.settings.dateFormat ?? 'DMY';

  useEffect(() => {
    api.get<{ bill: BillDetailT }>(`/api/bills/${id}`, { offlineKey: `bill:${id}` }).then((r) => {
      setBill(r.bill);
      setCache(r.__cache?.fromCache ? r.__cache.cachedAt ?? '' : null);
    }).catch((e: ApiError) => setError(e.message));
  }, [id]);

  const startEdit = () => {
    if (!bill) return;
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    setForm({
      merchantName: bill.merchantName, billDate: bill.billDate, totalAmount: s(bill.totalAmount), currency: bill.currency, category: bill.category, subcategory: s(bill.subcategory),
      billTime: s(bill.billTime), subtotal: s(bill.subtotal), tax: s(bill.tax), discount: s(bill.discount), serviceCharge: s(bill.serviceCharge), tip: s(bill.tip),
      invoiceNumber: s(bill.invoiceNumber), paymentMethod: s(bill.paymentMethod), merchantAddress: s(bill.merchantAddress), notes: s(bill.notes),
    });
    setErrors({});
    setEditing(true);
  };
  const n = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : Number(v));
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    const fields = {
      merchantName: form.merchantName, billDate: form.billDate, totalAmount: n(form.totalAmount), currency: form.currency, category: form.category, subcategory: form.subcategory || null,
      billTime: form.billTime || null, subtotal: n(form.subtotal), tax: n(form.tax), discount: n(form.discount), serviceCharge: n(form.serviceCharge), tip: n(form.tip),
      invoiceNumber: form.invoiceNumber || null, paymentMethod: form.paymentMethod || null, merchantAddress: form.merchantAddress || null, notes: form.notes || null,
    };
    const p = ReviewedFieldsSchema.safeParse(fields);
    if (!p.success) return setErrors(fieldErrors(p.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
    try {
      const r = await api.put<{ bill: BillDetailT }>(`/api/bills/${id}`, { fields: p.data });
      setBill(r.bill);
      setEditing(false);
      toast('success', 'Changes saved. Your edits are recorded as corrections.');
    } catch (err) {
      const a = err as ApiError;
      setErrors(fieldErrors(a.fields));
      toast('error', a.message);
    }
  };
  const remove = async () => {
    try {
      await api.del(`/api/bills/${id}`);
      toast('success', 'Bill and its images deleted.');
      nav('/app/bills');
    } catch (e) {
      toast('error', (e as ApiError).message);
    }
  };
  const downloadJson = () => {
    if (!bill) return;
    const blob = new Blob([JSON.stringify({ ...bill, ai: undefined }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `billkit-bill-${bill.billDate}-${bill.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <div className="alert alert-error" role="alert">{error} <Link to="/app/bills">Back to history</Link></div>;
  if (!bill) return <LoadingBlock />;
  const prov = (k: string) => bill.provenance[k];
  const rows: Array<[string, string, string | null]> = [
    ['merchantName', 'Merchant', bill.merchantName],
    ['billDate', 'Date', date(bill.billDate, fmt) + (bill.billTime ? ` ${bill.billTime}` : '')],
    ['totalAmount', 'Total', money(bill.totalAmount, bill.currency)],
    ['category', 'Category', bill.category + (bill.subcategory ? ` › ${bill.subcategory}` : '')],
    ['subtotal', FIELD_LABELS.subtotal, bill.subtotal === null ? null : money(bill.subtotal, bill.currency)],
    ['tax', FIELD_LABELS.tax, bill.tax === null ? null : money(bill.tax, bill.currency)],
    ['discount', FIELD_LABELS.discount, bill.discount === null ? null : money(bill.discount, bill.currency)],
    ['serviceCharge', FIELD_LABELS.serviceCharge, bill.serviceCharge === null ? null : money(bill.serviceCharge, bill.currency)],
    ['tip', FIELD_LABELS.tip, bill.tip === null ? null : money(bill.tip, bill.currency)],
    ['invoiceNumber', 'Invoice / bill no.', bill.invoiceNumber],
    ['paymentMethod', FIELD_LABELS.paymentMethod, bill.paymentMethod],
    ['merchantAddress', FIELD_LABELS.merchantAddress, bill.merchantAddress],
    ['notes', 'Notes', bill.notes],
  ];
  const hasImage = bill.images.some((i) => i.kind === 'corrected');

  return (
    <>
      <p><Link to="/app/bills" className="small"><ArrowLeft size={14} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden /> Bill history</Link></p>
      <div className="page-title">
        <div><h1>{bill.merchantName}</h1><p>{date(bill.billDate, fmt)} · {money(bill.totalAmount, bill.currency)} · <span className="badge badge-high">Verified</span></p></div>
        <div className="row">
          {!editing && <button className="btn" onClick={startEdit} disabled={cache !== null}><Pencil size={16} aria-hidden /> Edit</button>}
          <button className="btn" onClick={downloadJson}><FileJson size={16} aria-hidden /> Export</button>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={cache !== null}><Trash2 size={16} aria-hidden /> Delete</button>
        </div>
      </div>
      {cache !== null && <div className="alert alert-warning" style={{ marginBottom: 12 }}>Offline copy — editing and deleting need a connection.</div>}
      {bill.duplicates.length > 0 && <div className="alert alert-warning" style={{ marginBottom: 12 }}><AlertTriangle aria-hidden /><p>Saved despite a possible duplicate: {bill.duplicates.map((d) => <Link key={d.id} to={`/app/bills/${d.id}`}>{d.merchantName} ({d.billDate})</Link>)}</p></div>}
      <div className="review-grid">
        <section className="viewer card card-tight" aria-label="Bill image">
          {hasImage ? <img src={`/api/bills/${bill.id}/image/corrected/0`} alt={`Bill from ${bill.merchantName}`} style={{ borderRadius: 8 }} /> : <p className="subtle center" style={{ padding: 40 }}>No image stored for this bill.</p>}
          {bill.images.some((i) => i.kind === 'original') && <p className="subtle" style={{ marginTop: 8 }}><a href={`/api/bills/${bill.id}/image/original/0`} target="_blank" rel="noreferrer">Open original upload</a></p>}
        </section>
        <div className="stack">
          {editing ? (
            <form className="card stack" onSubmit={saveEdit} noValidate>
              <h2 style={{ fontSize: 'var(--text-lg)' }}>Edit bill</h2>
              <TextField label="Merchant" value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} error={errors.merchantName} />
              <div className="grid grid-2">
                <TextField label="Date" type="date" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })} error={errors.billDate} />
                <TextField label="Time" type="time" value={form.billTime} onChange={(e) => setForm({ ...form, billTime: e.target.value })} />
                <TextField label="Total" inputMode="decimal" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} error={errors.totalAmount} />
                <SelectField label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{[...new Set([form.currency, ...SUPPORTED_CURRENCIES])].map((c) => <option key={c}>{c}</option>)}</SelectField>
                <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</SelectField>
                <TextField label="Subcategory" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
                {(['subtotal', 'tax', 'discount', 'serviceCharge', 'tip'] as const).map((k) => <TextField key={k} label={FIELD_LABELS[k]} inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} error={errors[k]} />)}
                <TextField label="Invoice / bill no." value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
                <TextField label="Payment method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} />
              </div>
              <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <div className="row"><button className="btn btn-primary"><Save size={16} aria-hidden /> Save changes</button><button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button></div>
            </form>
          ) : (
            <section className="card">
              <h2 style={{ fontSize: 'var(--text-lg)' }}>Details</h2>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {rows.filter(([, , v]) => v !== null && v !== '').map(([k, label, v]) => (
                      <tr key={k}>
                        <th scope="row" style={{ width: '36%', textTransform: 'none', fontSize: 'var(--text-sm)' }}>{label}</th>
                        <td>{v}</td>
                        <td style={{ width: 1 }}>{prov(k) && <span className={`badge ${PROV_LABEL[prov(k)!].cls}`}>{PROV_LABEL[prov(k)!].label}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {bill.lineItems.length > 0 && (
            <section className="card">
              <h2 style={{ fontSize: 'var(--text-lg)' }}>Line items</h2>
              <div className="table-wrap"><table><thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th></tr></thead>
                <tbody>{bill.lineItems.map((li, i) => <tr key={i}><td>{li.description}</td><td className="num">{li.quantity ?? '—'}</td><td className="num">{li.unitPrice ?? '—'}</td><td className="num">{li.lineTotal ?? '—'}</td></tr>)}</tbody></table></div>
            </section>
          )}
          <section className="card">
            <h2 style={{ fontSize: 'var(--text-lg)' }}>Validation & processing</h2>
            <p className="small"><strong>Checks on the approved values:</strong> {bill.validation.status ?? '—'}{bill.validation.issues?.length ? ` — ${bill.validation.issues.map((i) => i.message).join(' ')}` : ''}</p>
            {bill.ai && (
              <ul className="small" style={{ paddingLeft: '1rem' }}>
                <li>AI proposal: {bill.ai.fields.merchantName.value ?? '—'} · {bill.ai.fields.billDate.value ?? '—'} · {bill.ai.fields.totalAmount.value ?? '—'} · {bill.ai.category.value ?? 'Unknown'}</li>
                <li>Document type: {bill.ai.classification.documentClass.replace(/_/g, ' ')} ({bill.ai.classification.method})</li>
                <li>Image quality: {bill.ai.quality.score}/100</li>
                <li>Pipeline: {bill.ai.meta.pipelineVersion}; OCR: {bill.ai.meta.ocrEngine}; vision model: {bill.ai.meta.vlm?.used ? bill.ai.meta.vlm.model : 'not used'}</li>
                <li>Processing time: {bill.ai.meta.timingsMs.total ?? '—'} ms</li>
              </ul>
            )}
            <p className="subtle">Saved {new Date(bill.createdAt).toLocaleString()} · last updated {new Date(bill.updatedAt).toLocaleString()}</p>
          </section>
        </div>
      </div>
      <Dialog open={confirmDelete} title="Delete this bill?" onClose={() => setConfirmDelete(false)} actions={<><button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="btn btn-danger" onClick={remove}><Trash2 size={16} aria-hidden /> Delete permanently</button></>}>
        <p>The bill, its stored images, line items and correction records will be permanently deleted.</p>
      </Dialog>
    </>
  );
}
