/* Analytics, categories, settings and admin operations pages. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, Download, FileJson, FolderPlus, Info, LogOut, Moon, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { BUILT_IN_CATEGORIES, SUPPORTED_CURRENCIES, type UserSettings } from '@billkit/shared';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../services/auth';
import { useToast } from '../../services/toast';
import { applyTheme } from '../../services/theme';
import type { AnalyticsSummary } from '../../services/types';
import { BarList, MonthlyBars } from '../../components/Charts';
import { Dialog } from '../../components/Dialog';
import { EmptyState, LoadingBlock } from '../../components/Empty';
import { PasswordField, SelectField, TextField } from '../../components/Form';
import { date, money } from '../../utils/format';
import { useTitle } from '../../hooks/usePageMeta';
import { useCategories } from './Bills';

/* ---------------- Analytics ---------------- */

function rangeFor(preset: string): { from?: string; to?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'this_month') return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))) };
  if (preset === 'last_3') return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))) };
  if (preset === 'this_year') return { from: `${now.getUTCFullYear()}-01-01` };
  return {};
}

export function Analytics() {
  useTitle('Analytics');
  const { user } = useAuth();
  const nav = useNavigate();
  const cats = useCategories();
  const [preset, setPreset] = useState('all');
  const [category, setCategory] = useState('');
  const [currency, setCurrency] = useState('');
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams();
    const r = rangeFor(preset);
    if (r.from) p.set('from', r.from);
    if (category) p.set('category', category);
    if (currency) p.set('currency', currency);
    setData(null);
    api.get<AnalyticsSummary>(`/api/analytics/summary?${p}`, { offlineKey: `analytics:${p}` }).then(setData).catch((e: ApiError) => setError(e.message));
  }, [preset, category, currency]);
  const cur = data?.primaryCurrency ?? user!.settings.defaultCurrency;
  const fmt = user!.settings.dateFormat;
  return (
    <>
      <div className="page-title"><div><h1>Expense analytics</h1><p>Computed only from bills you verified. No predictions.</p></div></div>
      <div className="card card-tight row" style={{ marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div className="row" role="group" aria-label="Date range">
          {[['all', 'All time'], ['this_month', 'This month'], ['last_3', 'Last 3 months'], ['this_year', 'This year']].map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={preset === k} onClick={() => setPreset(k!)}>{l}</button>
          ))}
        </div>
        <div style={{ minWidth: 180 }}><SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</SelectField></div>
        {data && data.currencies.length > 1 && (
          <div style={{ minWidth: 140 }}><SelectField label="Currency" value={currency || cur} onChange={(e) => setCurrency(e.target.value)}>{data.currencies.map((c) => <option key={c.currency}>{c.currency}</option>)}</SelectField></div>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <LoadingBlock />}
      {data && data.totalBills === 0 && <EmptyState title="Nothing to analyse yet" action={<Link className="btn btn-primary" to="/app/scan">Scan a bill</Link>}>Analytics appear once you save bills{category || preset !== 'all' ? ' matching these filters' : ''}. BillKit never shows invented figures.</EmptyState>}
      {data && data.totalBills > 0 && (
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          {data.note && <div className="alert alert-info"><Info aria-hidden /><p>{data.note}</p></div>}
          <div className="grid grid-4">
            <div className="card kpi"><span className="kpi-label">Spent ({cur})</span><span className="kpi-value">{money(data.currencies.find((c) => c.currency === cur)?.total ?? 0, cur)}</span></div>
            <div className="card kpi"><span className="kpi-label">Bills</span><span className="kpi-value">{data.totalBills}</span></div>
            <div className="card kpi"><span className="kpi-label">Average bill</span><span className="kpi-value">{money(data.currencies.find((c) => c.currency === cur)?.average ?? 0, cur)}</span></div>
            <div className="card kpi"><span className="kpi-label">This month vs last</span><span className="kpi-value">{data.comparison.changePct === null ? '—' : `${data.comparison.changePct > 0 ? '+' : ''}${data.comparison.changePct}%`}</span><span className="kpi-note">{money(data.comparison.thisMonth, cur)} vs {money(data.comparison.lastMonth, cur)}</span></div>
          </div>
          <section className="card"><div className="card-header"><h2>Spending over the last 12 months ({cur})</h2></div><MonthlyBars data={data.monthly} currency={cur} /></section>
          <div className="grid grid-2">
            <section className="card"><div className="card-header"><h2>By category</h2></div><BarList rows={data.byCategory.map((c) => ({ label: c.category, value: c.total, count: c.count }))} currency={cur} onSelect={(c) => setCategory(c)} /></section>
            <section className="card"><div className="card-header"><h2>Top merchants</h2></div><BarList rows={data.byMerchant.map((m) => ({ label: m.merchant, value: m.total, count: m.count }))} currency={cur} onSelect={(m) => nav(`/app/bills?merchant=${encodeURIComponent(m)}`)} /></section>
          </div>
          <div className="grid grid-2">
            <section className="card">
              <div className="card-header"><h2>Unusual expenses</h2></div>
              <p className="subtle">Rule: a bill more than 3 standard deviations above your other bills in the same category (needs at least 5 of them). This is a statistical flag, not a judgement.</p>
              {data.unusual.length === 0 ? <p className="muted">None flagged.</p> : <ul>{data.unusual.map((u) => <li key={u.id}><Link to={`/app/bills/${u.id}`}>{u.merchant} · {date(u.date, fmt)} · {money(u.total, cur)}</Link> — {u.reason}</li>)}</ul>}
            </section>
            <section className="card">
              <div className="card-header"><h2>Budgets this month</h2><Link to="/app/settings#budgets" className="small">Edit budgets</Link></div>
              {data.budgets.length === 0 ? <p className="muted">No budgets set. Add monthly category budgets in Settings.</p> : (
                <div className="stack">{data.budgets.map((b) => (
                  <div key={b.category}>
                    <div className="row between small"><span>{b.category}</span><span>{money(b.spent, cur)} of {money(b.budget, cur)}</span></div>
                    <div className={`progress${(b.pct ?? 0) > 100 ? ' over' : ''}`} role="progressbar" aria-valuenow={Math.round(b.pct ?? 0)} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.category} budget used`}><span style={{ width: `${Math.min(100, b.pct ?? 0)}%` }} /></div>
                  </div>
                ))}</div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Categories ---------------- */

interface CategoryRow { id: string | null; name: string; builtIn: boolean; subcategories: string[]; count: number; totals: Array<{ currency: string; total: number }> }

export function Categories() {
  useTitle('Categories');
  const toast = useToast();
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);
  const load = () => api.get<{ categories: CategoryRow[] }>('/api/categories').then((r) => setRows(r.categories)).catch((e: ApiError) => setError(e.message));
  useEffect(() => void load(), []);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/categories', { name: name.trim() });
      setName('');
      setError(null);
      toast('success', 'Category added.');
      void load();
    } catch (err) {
      const a = err as ApiError;
      setError(a.fields?.[0]?.message ?? a.message);
    }
  };
  const remove = async () => {
    if (!toDelete?.id) return;
    const r = await api.del<{ billsMovedToOther: number }>(`/api/categories/${toDelete.id}`);
    toast('success', `Category deleted${r.billsMovedToOther ? `; ${r.billsMovedToOther} bill(s) moved to Other` : ''}.`);
    setToDelete(null);
    void load();
  };
  return (
    <>
      <div className="page-title"><div><h1>Categories</h1><p>Food, Groceries and Utilities plus ten more built-in categories — and your own.</p></div></div>
      <form className="card card-tight row" onSubmit={add} style={{ marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 220 }}><TextField label="New custom category" value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="e.g. Pets" maxLength={40} /></div>
        <button className="btn btn-primary"><FolderPlus size={16} aria-hidden /> Add</button>
      </form>
      {!rows ? <LoadingBlock /> : (
        <div className="grid grid-3">
          {rows.map((c) => (
            <article key={c.name} className="card card-tight">
              <div className="row between"><h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>{c.name}</h2>{c.builtIn ? <span className="badge">Built-in</span> : <span className="badge badge-user">Custom</span>}</div>
              <p className="small muted" style={{ margin: '6px 0' }}>{c.count} bill{c.count === 1 ? '' : 's'}{c.totals.length ? ' · ' + c.totals.map((t) => money(t.total, t.currency)).join(' · ') : ''}</p>
              {c.subcategories.length > 0 && <p className="subtle">{c.subcategories.join(' · ')}</p>}
              <div className="row">
                <Link className="btn btn-sm" to={`/app/bills?category=${encodeURIComponent(c.name)}`}>View bills</Link>
                {!c.builtIn && <button className="btn btn-sm btn-danger" onClick={() => setToDelete(c)}><Trash2 size={14} aria-hidden /> Delete</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog open={Boolean(toDelete)} title={`Delete “${toDelete?.name}”?`} onClose={() => setToDelete(null)} actions={<><button className="btn" onClick={() => setToDelete(null)}>Cancel</button><button className="btn btn-danger" onClick={remove}>Delete</button></>}>
        <p>Bills in this category will be moved to “Other”. Bills are not deleted.</p>
      </Dialog>
    </>
  );
}

/* ---------------- Settings ---------------- */

export function Settings() {
  useTitle('Settings');
  const { user, config, refresh, logout, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [s, setS] = useState<UserSettings>(user!.settings);
  const [name, setName] = useState(user!.name);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [del, setDel] = useState({ open: false, password: '', error: '' });
  const [budgetCat, setBudgetCat] = useState<string>('Food');
  const [budgetAmt, setBudgetAmt] = useState('');
  const [corr, setCorr] = useState<{ savedBills: number; billsWithReviewCorrections: number; byField: Array<{ field: string; phase: string; n: number }> } | null>(null);
  const cats = useCategories();
  useEffect(() => void api.get<typeof corr>('/api/corrections/summary').then(setCorr).catch(() => undefined), []);

  const saveSettings = async (patch: Partial<UserSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    try {
      const r = await api.put<{ settings: UserSettings }>('/api/settings', patch);
      setS(r.settings);
      if (patch.theme) applyTheme(patch.theme);
      setUser({ ...user!, settings: r.settings });
      toast('success', 'Settings saved.');
    } catch (e) {
      setS(s);
      toast('error', (e as ApiError).message);
    }
  };
  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/api/auth/profile', { name });
      await refresh();
      toast('success', 'Profile updated.');
    } catch (err) {
      toast('error', (err as ApiError).message);
    }
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '' });
      setPwError(null);
      toast('success', 'Password changed. Other devices were signed out.');
    } catch (err) {
      const a = err as ApiError;
      setPwError(a.fields?.[0]?.message ?? a.message);
    }
  };
  const deleteAccount = async () => {
    try {
      await api.del('/api/auth/account', { password: del.password });
      nav('/', { replace: true });
      await logout();
    } catch (err) {
      setDel((d) => ({ ...d, error: (err as ApiError).message }));
    }
  };

  return (
    <>
      <div className="page-title"><div><h1>Settings</h1><p>Every setting here changes how BillKit behaves.</p></div></div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="s-profile">
          <h2 id="s-profile" style={{ fontSize: 'var(--text-lg)' }}>Profile</h2>
          <form className="stack" onSubmit={saveName}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <TextField label="Email" value={user!.email} disabled hint="Email changes are not supported in this version." />
            <button className="btn"><Save size={16} aria-hidden /> Save profile</button>
          </form>
        </section>

        <section className="card stack" aria-labelledby="s-pref">
          <h2 id="s-pref" style={{ fontSize: 'var(--text-lg)' }}>Preferences</h2>
          <SelectField label={<><Moon size={14} style={{ display: 'inline' }} aria-hidden /> Theme</>} value={s.theme} onChange={(e) => void saveSettings({ theme: e.target.value as UserSettings['theme'] })}>
            <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
          </SelectField>
          <SelectField label="Default currency" hint="Suggested when a bill doesn’t print its currency (always shown as ‘not printed’)." value={s.defaultCurrency} onChange={(e) => void saveSettings({ defaultCurrency: e.target.value })}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Date display format" value={s.dateFormat} onChange={(e) => void saveSettings({ dateFormat: e.target.value as UserSettings['dateFormat'] })}>
            <option value="DMY">DD/MM/YYYY</option><option value="MDY">MM/DD/YYYY</option><option value="YMD">YYYY-MM-DD</option>
          </SelectField>
          <SelectField label="Read ambiguous dates (e.g. 04/05/2026) as" hint="Used only when nothing else on the bill reveals the order; such dates are always flagged for review." value={s.ambiguousDateOrder} onChange={(e) => void saveSettings({ ambiguousDateOrder: e.target.value as UserSettings['ambiguousDateOrder'] })}>
            <option value="DMY">Day / month (4 May)</option><option value="MDY">Month / day (April 5)</option>
          </SelectField>
          <p className="subtle">Language: the interface is in English. OCR reads English by default; other OCR languages can be enabled by the server operator.</p>
        </section>

        <section className="card stack" aria-labelledby="s-ai">
          <h2 id="s-ai" style={{ fontSize: 'var(--text-lg)' }}>AI processing</h2>
          <div className="field">
            <label htmlFor="thr">Review threshold: {Math.round(s.reviewThreshold * 100)}%</label>
            <input id="thr" type="range" min={0.5} max={0.99} step={0.01} value={s.reviewThreshold} onChange={(e) => setS({ ...s, reviewThreshold: Number(e.target.value) })} onMouseUp={() => void saveSettings({ reviewThreshold: s.reviewThreshold })} onKeyUp={() => void saveSettings({ reviewThreshold: s.reviewThreshold })} onTouchEnd={() => void saveSettings({ reviewThreshold: s.reviewThreshold })} aria-describedby="thr-h" />
            <span id="thr-h" className="hint">Fields with a heuristic score below this are marked “Needs review”. Higher = more fields to check. Applies to new scans.</span>
          </div>
          <SelectField label="Approval policy" value={s.approvalPolicy} onChange={(e) => void saveSettings({ approvalPolicy: e.target.value as UserSettings['approvalPolicy'] })} hint="Either way, nothing is saved until you press Approve & save.">
            <option value="always_review">Require me to confirm every flagged key field</option>
            <option value="allow_quick_approve_when_all_high">Allow approving without confirming flagged fields</option>
          </SelectField>
          <label className="checkbox">
            <input type="checkbox" checked={s.useCloudVision} disabled={!config?.vlmAvailable} onChange={(e) => void saveSettings({ useCloudVision: e.target.checked })} />
            <span><strong>Use cloud vision to cross-check uncertain bills</strong><br /><span className="subtle">{config?.vlmAvailable ? 'When enabled, a downscaled image of an uncertain bill and its OCR text are sent to the AI provider configured on this server (Anthropic). Your name and email are not sent.' : 'Not available: the server operator has not configured a vision model.'}</span></span>
          </label>
        </section>

        <section className="card stack" aria-labelledby="s-privacy">
          <h2 id="s-privacy" style={{ fontSize: 'var(--text-lg)' }}>Privacy</h2>
          <label className="checkbox"><input type="checkbox" checked={s.keepOriginalImages} onChange={(e) => void saveSettings({ keepOriginalImages: e.target.checked })} /><span><strong>Keep original images after saving</strong><br /><span className="subtle">When off, only the corrected page image is kept for future bills.</span></span></label>
          <label className="checkbox"><input type="checkbox" checked={s.allowCorrectionsForImprovement} onChange={(e) => void saveSettings({ allowCorrectionsForImprovement: e.target.checked })} /><span><strong>Allow my corrections to be used to improve BillKit</strong><br /><span className="subtle">Off by default. Corrections are only used after human review and are never treated as verified labels automatically.</span></span></label>
          {corr && <p className="subtle">You have saved {corr.savedBills} bill(s); {corr.billsWithReviewCorrections} needed corrections during review.{corr.byField.length ? ` Most corrected: ${corr.byField.slice(0, 3).map((f) => `${f.field} (${f.n})`).join(', ')}.` : ''}</p>}
          <Link to="/privacy-security" className="small">How BillKit handles your data</Link>
        </section>

        <section className="card stack" aria-labelledby="budgets" id="budgets">
          <h2 style={{ fontSize: 'var(--text-lg)' }} id="budgets-h">Monthly budgets</h2>
          {Object.keys(s.budgets).length === 0 && <p className="muted small">No budgets yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {Object.entries(s.budgets).map(([c, v]) => (
              <li key={c} className="row between"><span>{c}: {money(v, s.defaultCurrency)}</span><button className="btn btn-sm btn-ghost" onClick={() => { const b = { ...s.budgets }; delete b[c]; void saveSettings({ budgets: b }); }} aria-label={`Remove ${c} budget`}><Trash2 size={14} /></button></li>
            ))}
          </ul>
          <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); const v = Number(budgetAmt); if (!(v > 0)) return toast('error', 'Enter a positive amount.'); void saveSettings({ budgets: { ...s.budgets, [budgetCat]: v } }); setBudgetAmt(''); }}>
            <div style={{ flex: 1, minWidth: 140 }}><SelectField label="Category" value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)}>{(cats.length ? cats : [...BUILT_IN_CATEGORIES]).map((c) => <option key={c}>{c}</option>)}</SelectField></div>
            <div style={{ flex: 1, minWidth: 120 }}><TextField label={`Amount (${s.defaultCurrency})`} inputMode="decimal" value={budgetAmt} onChange={(e) => setBudgetAmt(e.target.value)} /></div>
            <button className="btn"><Plus size={16} aria-hidden /> Set</button>
          </form>
        </section>

        <section className="card stack" aria-labelledby="s-data">
          <h2 id="s-data" style={{ fontSize: 'var(--text-lg)' }}>Data</h2>
          <p className="small muted">Download all your verified bills. Images are not included.</p>
          <div className="row">
            <a className="btn" href="/api/bills/export.csv" download><Download size={16} aria-hidden /> Export CSV</a>
            <a className="btn" href="/api/bills/export.json" download><FileJson size={16} aria-hidden /> Export JSON backup</a>
          </div>
        </section>

        <section className="card stack" aria-labelledby="s-account">
          <h2 id="s-account" style={{ fontSize: 'var(--text-lg)' }}>Account</h2>
          <form className="stack" onSubmit={changePw}>
            <PasswordField label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <PasswordField label="New password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwError} />
            <button className="btn">Change password</button>
          </form>
          <hr />
          <div className="row">
            <button className="btn" onClick={() => { nav('/', { replace: true }); void logout(); }}><LogOut size={16} aria-hidden /> Sign out</button>
            <button className="btn btn-danger" onClick={() => setDel({ open: true, password: '', error: '' })}><ShieldAlert size={16} aria-hidden /> Delete account</button>
          </div>
        </section>
      </div>
      <Dialog open={del.open} title="Delete your account?" onClose={() => setDel({ ...del, open: false })} actions={<><button className="btn" onClick={() => setDel({ ...del, open: false })}>Cancel</button><button className="btn btn-danger" onClick={deleteAccount} disabled={!del.password}>Delete everything</button></>}>
        <div className="alert alert-error"><AlertTriangle aria-hidden /><p>This permanently deletes your account, all bills, images, corrections, categories and settings. This cannot be undone.</p></div>
        <div style={{ marginTop: 'var(--space-4)' }}><PasswordField label="Enter your password to confirm" autoComplete="current-password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value, error: '' })} error={del.error || null} /></div>
      </Dialog>
    </>
  );
}

/* ---------------- Admin operations (no bill content) ---------------- */

export function Admin() {
  useTitle('Operations');
  const { user } = useAuth();
  const [m, setM] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<Record<string, unknown>>('/api/admin/metrics').then(setM).catch((e: ApiError) => setError(e.message));
  }, []);
  if (user?.role !== 'admin') return <div className="alert alert-error">Administrators only.</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!m) return <LoadingBlock />;
  const list = (rows: unknown) => (Array.isArray(rows) && rows.length ? <ul className="small">{rows.map((r, i) => <li key={i}><code>{JSON.stringify(r)}</code></li>)}</ul> : <p className="muted small">None.</p>);
  const lat = m.latencyMs as { average: number | null; max: number | null; completedJobs: number };
  const vlm = m.vlm as { configured: boolean; model: string | null; usage: unknown[] };
  return (
    <>
      <div className="page-title"><div><h1>Operations</h1><p>Last {String(m.windowDays)} days. Operational metrics only — no bill content is shown to administrators.</p></div></div>
      <div className="grid grid-4">
        <div className="card kpi"><span className="kpi-label">Users</span><span className="kpi-value">{String(m.users)}</span></div>
        <div className="card kpi"><span className="kpi-label">Queue depth</span><span className="kpi-value">{String(m.queueDepth)}</span></div>
        <div className="card kpi"><span className="kpi-label">Avg processing</span><span className="kpi-value">{lat.average === null ? '—' : `${(lat.average / 1000).toFixed(1)} s`}</span><span className="kpi-note">{lat.completedJobs} completed jobs</span></div>
        <div className="card kpi"><span className="kpi-label">Vision model</span><span className="kpi-value" style={{ fontSize: 'var(--text-lg)' }}>{vlm.configured ? vlm.model : 'Not configured'}</span></div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 'var(--space-5)' }}>
        <section className="card"><h2 style={{ fontSize: 'var(--text-lg)' }}>Outcomes</h2>{list(m.outcomes)}<h3 style={{ fontSize: 'var(--text-base)' }}>Decisions</h3>{list(m.decisions)}</section>
        <section className="card"><h2 style={{ fontSize: 'var(--text-lg)' }}>Errors</h2>{list(m.errors)}</section>
        <section className="card"><h2 style={{ fontSize: 'var(--text-lg)' }}>Average stage time (ms)</h2>{list(Object.entries(m.stageAverageMs as Record<string, number>).map(([k, v]) => ({ [k]: v })))}</section>
        <section className="card"><h2 style={{ fontSize: 'var(--text-lg)' }}>Vision model usage & cost</h2>{list(vlm.usage)}<p className="subtle">Cost is estimated only when AI_PRICE_* environment variables are set.</p></section>
        <section className="card"><h2 style={{ fontSize: 'var(--text-lg)' }}>Model / pipeline versions</h2>{list(m.versions)}{list([m.models])}</section>
        <section className="card"><h2 style={{ fontSize: 'var(--text-lg)' }}>Corrections by field</h2>{list(m.corrections)}</section>
      </div>
    </>
  );
}
