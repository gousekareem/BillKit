/* Dashboard — built only from the user's saved bills. © 2026 Shaik Gouse Kareem. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Camera, CheckCircle2, Clock, Receipt, TrendingDown, TrendingUp, Upload, XCircle } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../services/auth';
import type { AnalyticsSummary } from '../../services/types';
import { BarList, MonthlyBars } from '../../components/Charts';
import { EmptyState, LoadingBlock } from '../../components/Empty';
import { greeting, money, relativeTime, date } from '../../utils/format';
import { useTitle } from '../../hooks/usePageMeta';

interface ScanRow { id: string; status: string; stage: string; error_code: string | null; created_at: string; bill_id: string | null }

export default function Dashboard() {
  useTitle('Dashboard');
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<(AnalyticsSummary & { __cache?: { fromCache: boolean; cachedAt?: string } }) | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<AnalyticsSummary>('/api/analytics/summary', { offlineKey: 'analytics:all' }).then(setData).catch((e: ApiError) => setError(e.message));
    api.get<{ scans: ScanRow[] }>('/api/scans').then((r) => setScans(r.scans)).catch(() => undefined);
  }, []);
  const cur = data?.primaryCurrency ?? user?.settings.defaultCurrency ?? 'INR';
  const fmt = user?.settings.dateFormat ?? 'DMY';

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{greeting()}, {user?.name.split(' ')[0]}</h1>
          <p>Every bill, in your pocket.</p>
        </div>
        <div className="row">
          <Link className="btn btn-primary btn-lg" to="/app/scan"><Camera size={18} aria-hidden /> Scan a bill</Link>
          <Link className="btn btn-lg" to="/app/scan"><Upload size={18} aria-hidden /> Upload</Link>
        </div>
      </div>
      {data?.__cache?.fromCache && <div className="alert alert-warning" style={{ marginBottom: 16 }}>Offline — showing figures saved on this device {data.__cache.cachedAt ? relativeTime(data.__cache.cachedAt) : ''}.</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {!data && !error && <LoadingBlock />}
      {data && data.totalBills === 0 && (
        <EmptyState title="No bills yet" action={<Link className="btn btn-primary btn-lg" to="/app/scan"><Camera size={18} aria-hidden /> Scan your first bill</Link>}>
          Your dashboard fills in as you save verified bills. Nothing here is estimated or sample data.
        </EmptyState>
      )}
      {data && data.totalBills > 0 && (
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <div className="grid grid-4">
            <div className="card kpi"><span className="kpi-label">Saved bills</span><span className="kpi-value">{data.totalBills}</span><span className="kpi-note">verified by you</span></div>
            <div className="card kpi"><span className="kpi-label">Total recorded ({cur})</span><span className="kpi-value">{money(data.currencies.find((c) => c.currency === cur)?.total ?? 0, cur)}</span><span className="kpi-note">{data.note ?? 'all time'}</span></div>
            <div className="card kpi"><span className="kpi-label">This month</span><span className="kpi-value">{money(data.comparison.thisMonth, cur)}</span>
              <span className="kpi-note">{data.comparison.changePct === null ? 'no bills last month to compare' : <>{data.comparison.changePct >= 0 ? <TrendingUp size={12} style={{ display: 'inline' }} aria-hidden /> : <TrendingDown size={12} style={{ display: 'inline' }} aria-hidden />} {Math.abs(data.comparison.changePct)}% vs last month</>}</span></div>
            <div className="card kpi"><span className="kpi-label">Average bill</span><span className="kpi-value">{money(data.currencies.find((c) => c.currency === cur)?.average ?? 0, cur)}</span><span className="kpi-note">in {cur}</span></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
            <section className="card"><div className="card-header"><h2>Monthly spending</h2><Link to="/app/analytics" className="small">Analytics</Link></div><MonthlyBars data={data.monthly} currency={cur} /></section>
            <section className="card"><div className="card-header"><h2>By category</h2><Link to="/app/categories" className="small">Categories</Link></div>
              <BarList rows={data.byCategory.map((c) => ({ label: c.category, value: c.total, count: c.count }))} currency={cur} onSelect={(c) => nav(`/app/bills?category=${encodeURIComponent(c)}`)} />
            </section>
          </div>
          <div className="grid grid-2">
            <section className="card"><div className="card-header"><h2>Recent bills</h2><Link to="/app/bills" className="small">All bills</Link></div>
              <div className="bill-list">
                {data.recent.map((b) => (
                  <Link key={b.id} to={`/app/bills/${b.id}`} className="bill-item" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                    <span className="bill-thumb" style={{ width: 40, height: 40 }}><Receipt size={18} aria-hidden /></span>
                    <span><strong>{b.merchant}</strong><br /><span className="subtle">{date(b.date, fmt)} · {b.category}</span></span>
                    <span className="amount">{money(b.total, b.currency)}</span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="card"><div className="card-header"><h2>Recent activity</h2></div>
              {scans.length === 0 ? <p className="muted">No recent scans.</p> : (
                <ul className="stack small" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {scans.slice(0, 6).map((s) => (
                    <li key={s.id} className="row between">
                      <span className="row">
                        {s.status === 'saved' ? <CheckCircle2 size={16} color="var(--status-high-fg)" aria-hidden /> : s.status === 'failed' || s.status === 'cancelled' ? <XCircle size={16} color="var(--status-error-fg)" aria-hidden /> : <Clock size={16} aria-hidden />}
                        <Link to={s.status === 'saved' && s.bill_id ? `/app/bills/${s.bill_id}` : `/app/scan/${s.id}`}>
                          {s.status === 'saved' ? 'Bill saved' : s.status === 'completed' ? 'Waiting for your review' : s.status === 'failed' ? 'Processing failed' : s.status === 'cancelled' ? 'Cancelled' : 'Processing'}
                        </Link>
                      </span>
                      <span className="subtle">{relativeTime(s.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.unusual.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 'var(--space-4)' }}>
                  <TrendingUp aria-hidden /><p><strong>{data.unusual.length} unusual expense(s)</strong> compared with your own history. <Link to="/app/analytics">View</Link></p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
