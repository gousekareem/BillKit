/* Authenticated web-app shell: sidebar (desktop), bottom navigation (mobile). © 2026 Shaik Gouse Kareem. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BarChart3, Camera, FolderKanban, Gauge, LayoutDashboard, LogOut, Receipt, Search, Settings, ShieldCheck } from 'lucide-react';
import { LogoMark, Wordmark } from '../components/Logo';
import { useAuth } from '../services/auth';
import { applyTheme } from '../services/theme';
import { LoadingBlock } from '../components/Empty';

export function AppLayout() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    if (user) applyTheme(user.settings.theme);
  }, [user]);
  useEffect(() => {
    document.getElementById('app-main')?.focus({ preventScroll: true });
  }, [loc.pathname]);

  if (loading) return <div className="container" style={{ paddingTop: 80 }}><LoadingBlock label="Loading your account…" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    nav(`/app/bills?q=${encodeURIComponent(q.trim())}`);
  };
  const items = [
    { to: '/app', label: 'Dashboard', Icon: LayoutDashboard, end: true },
    { to: '/app/scan', label: 'Scan a bill', Icon: Camera },
    { to: '/app/bills', label: 'Bill history', Icon: Receipt },
    { to: '/app/analytics', label: 'Analytics', Icon: BarChart3 },
    { to: '/app/categories', label: 'Categories', Icon: FolderKanban },
    { to: '/app/settings', label: 'Settings', Icon: Settings },
    ...(user.role === 'admin' ? [{ to: '/app/admin', label: 'Operations', Icon: Gauge }] : []),
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-main">Skip to content</a>
      <aside className="sidebar" aria-label="App navigation">
        <Link to="/app" style={{ textDecoration: 'none' }} aria-label="BillKit dashboard"><Wordmark /></Link>
        <nav>
          {items.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer stack">
          <div className="small sidebar-user"><strong>{user.name}</strong><br /><span className="subtle">{user.email}</span></div>
          <button className="btn btn-sm btn-block" onClick={() => { nav('/', { replace: true }); void logout(); }}><LogOut size={16} /> Sign out</button>
          <div><ShieldCheck size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> <Link to="/privacy-security">Privacy</Link> · <Link to="/">Website</Link></div>
          <div>© 2026 Shaik Gouse Kareem</div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Link to="/app" className="mobile-brand" aria-label="BillKit dashboard"><LogoMark size={30} /></Link>
          <form className="search" role="search" onSubmit={onSearch}>
            <label htmlFor="global-search" className="sr-only">Search bills</label>
            <div className="input-wrap">
              <input id="global-search" className="input" placeholder="Search merchant, category, invoice no…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn-ghost btn-sm btn-icon input-action" aria-label="Search"><Search size={18} /></button>
            </div>
          </form>
          <div style={{ marginLeft: 'auto' }} className="row">
            <Link to="/app/scan" className="btn btn-primary btn-sm"><Camera size={16} aria-hidden /> <span>Scan</span></Link>
          </div>
        </header>
        {!online && <div className="offline-banner" role="status">You are offline. Saved bills you viewed recently are still available; scanning needs a connection.</div>}
        <main className="app-content" id="app-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="App navigation (mobile)">
        <NavLink to="/app" end className={({ isActive }) => (isActive ? 'active' : '')}><LayoutDashboard aria-hidden />Home</NavLink>
        <NavLink to="/app/bills" className={({ isActive }) => (isActive ? 'active' : '')}><Receipt aria-hidden />Bills</NavLink>
        <NavLink to="/app/scan" className={({ isActive }) => `scan-fab ${isActive ? 'active' : ''}`}><Camera aria-hidden />Scan</NavLink>
        <NavLink to="/app/analytics" className={({ isActive }) => (isActive ? 'active' : '')}><BarChart3 aria-hidden />Insights</NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => (isActive ? 'active' : '')}><Settings aria-hidden />Settings</NavLink>
      </nav>
    </div>
  );
}
