/* Public website layout. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { Wordmark } from '../components/Logo';
import { useAuth } from '../services/auth';

const NAV = [
  ['/features', 'Features'],
  ['/how-it-works', 'How it works'],
  ['/technology', 'AI & technology'],
  ['/privacy-security', 'Privacy'],
  ['/faq', 'FAQ'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
] as const;

export function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container">
          <Link to="/" aria-label="BillKit home" style={{ textDecoration: 'none' }}><Wordmark /></Link>
          <nav className={`site-nav${open ? ' open' : ''}`} aria-label="Main" id="site-nav">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to}>{label}</NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <Link className="btn btn-primary btn-sm" to="/app">Open dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-ghost btn-sm hide-sm" to="/login">Sign in</Link>
                <Link className="btn btn-primary btn-sm" to="/register">Get started</Link>
              </>
            )}
            <button className="btn btn-ghost btn-icon menu-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Wordmark />
            <p style={{ marginTop: 'var(--space-4)', maxWidth: '22rem' }}>Every bill, in your pocket. Evidence-aware extraction, uncertainty highlighting and human approval before anything is saved.</p>
          </div>
          <div>
            <h2>Product</h2>
            <ul>
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/how-it-works">How it works</Link></li>
              <li><Link to="/technology">AI &amp; technology</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/privacy-security">Privacy &amp; security</Link></li>
            </ul>
          </div>
          <div>
            <h2>Legal (drafts)</h2>
            <ul>
              <li><Link to="/legal/privacy">Privacy policy</Link></li>
              <li><Link to="/legal/terms">Terms of use</Link></li>
              <li><Link to="/legal/data-handling">Data handling</Link></li>
              <li><Link to="/legal/ai-limitations">AI limitations</Link></li>
              <li><Link to="/legal/cookies">Cookies</Link></li>
              <li><Link to="/legal/data-deletion">Data deletion</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Shaik Gouse Kareem. All rights reserved.</span>
          <span>BillKit is an independent project. It is not affiliated with any merchant or expense-software company.</span>
        </div>
      </div>
    </footer>
  );
}
