/* BillKit home page. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { Link } from 'react-router';
import { ArrowRight, Calculator, Camera, FileSearch, History, Lock, ScanLine, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { ReviewBadge } from '../../components/ReviewBadge';
import { usePageMeta } from '../../hooks/usePageMeta';
import { FAQ } from '../../content/copy';

/** A product preview assembled from the same badge components and styles the review screen uses. */
export function ProductPreview() {
  return (
    <div className="mock-device" aria-label="Preview of the BillKit review screen" role="img">
      <div className="row between" style={{ marginBottom: 12 }}>
        <strong>Review bill</strong>
        <span className="badge badge-info"><ScanLine aria-hidden /> Receipt detected</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.15fr', gap: 12 }}>
        <div className="mock-receipt" aria-hidden>
          <div style={{ fontWeight: 700, textAlign: 'center' }} className="hl">GREENLEAF MART</div>
          <div style={{ textAlign: 'center', fontSize: 10 }}>Lake View Rd</div>
          <div style={{ marginTop: 8 }}>Date: <span className="hl" style={{ outlineColor: '#b45309' }}>04/05/26</span></div>
          <div>Rice 5kg ....... 540.00</div>
          <div>Toor Dal ....... 330.00</div>
          <div>Milk ........... 186.00</div>
          <div style={{ marginTop: 6 }}>Sub Total ...... 1056.00</div>
          <div>GST 5% .......... 52.80</div>
          <div style={{ fontWeight: 700 }} className="hl">TOTAL ...... 1,108.80</div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {[
            ['Merchant', 'Greenleaf Mart', 'high_confidence'],
            ['Date', '04 May 2026?', 'needs_review'],
            ['Total', '₹1,108.80', 'high_confidence'],
            ['Category', 'Groceries', 'user_corrected'],
          ].map(([l, v, s]) => (
            <div key={l} className="field-row" style={{ padding: '8px 10px' }}>
              <div className="small subtle">{l}</div>
              <div className="row between" style={{ gap: 6 }}>
                <strong className="small">{v}</strong>
                <ReviewBadge state={s as 'high_confidence'} compact />
              </div>
            </div>
          ))}
          <div className="alert alert-success" style={{ padding: 8, fontSize: 12 }}><Calculator size={16} aria-hidden /> 1056.00 + 52.80 = 1,108.80 ✓</div>
        </div>
      </div>
      <p className="subtle center" style={{ margin: '10px 0 0' }}>Illustrative preview built from BillKit’s own UI components.</p>
    </div>
  );
}

export default function Home() {
  usePageMeta('/');
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow"><Sparkles size={16} aria-hidden /> Evidence-aware bill intelligence</span>
            <h1>Every bill, in your pocket.</h1>
            <p className="lead">Turn paper bills and receipts into organised digital records. BillKit uses intelligent document processing to extract, verify and organise your expenses while keeping you in control.</p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg">Get started <ArrowRight size={18} aria-hidden /></Link>
              <Link to="/features" className="btn btn-lg">Explore features</Link>
            </div>
            <p className="hero-note">No made-up values: anything BillKit can’t read stays empty and is flagged for you.</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>From paper to organised records — with you in the loop</h2>
            <p>Your bills deserve more than a photo gallery. Scan, understand, verify and organise them with BillKit.</p>
          </div>
          <div className="grid grid-3">
            {[
              [Camera, 'Capture any way you like', 'Camera, gallery, drag-and-drop, HEIC or PDF. Rotate and crop before uploading.'],
              [ScanLine, 'Bill or not a bill?', 'Selfies, ID cards and chats are politely rejected with an explanation — not silently processed.'],
              [FileSearch, 'Every value has evidence', 'See the exact line of text each field came from, highlighted on the image.'],
              [ShieldCheck, 'Uncertainty, made visible', 'High confidence, Needs review, Missing and Validation warning — labelled with icons and text.'],
              [Calculator, 'Arithmetic checked', 'Subtotal, tax, discounts, service charges, tips and round-off are reconciled with the total.'],
              [UserCheck, 'You approve before saving', 'Correct anything. Your corrections are recorded and never overwritten by the AI.'],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Camera;
              return (
                <article className="feature-card" key={t as string}>
                  <div className="feature-icon"><I aria-hidden /></div>
                  <h3>{t as string}</h3>
                  <p>{d as string}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>How BillKit works</h2>
            <p>The same pipeline runs on the server for every bill.</p>
          </div>
          <ol className="steps">
            <li><h3>Capture</h3><p>Photograph or upload the bill.</p></li>
            <li><h3>Check & straighten</h3><p>Quality is measured; perspective, tilt and shadows are corrected.</p></li>
            <li><h3>Read & understand</h3><p>OCR reads the text; BillKit confirms it is a bill and finds the key fields.</p></li>
            <li><h3>Verify & approve</h3><p>Confidence and arithmetic are checked; you review, correct and save.</p></li>
          </ol>
          <p style={{ marginTop: 'var(--space-6)' }}><Link to="/how-it-works">See all twelve steps <ArrowRight size={14} style={{ display: 'inline' }} aria-hidden /></Link></p>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2" style={{ alignItems: 'center' }}>
          <div>
            <h2>Built for trust, not hype</h2>
            <p className="muted">Accuracy, evidence and transparency matter more than pretending AI is always right. BillKit never invents a missing value, never treats a model’s self-reported confidence as a probability, and never saves a bill you haven’t approved.</p>
            <ul className="stack" style={{ paddingLeft: '1.1rem' }}>
              <li>OCR runs on the BillKit server — no per-page OCR service.</li>
              <li>Cloud vision is optional, off by default, and disclosed before use.</li>
              <li>Delete a bill, its images, or your whole account at any time.</li>
            </ul>
            <Link to="/privacy-security" className="btn"><Lock size={16} aria-hidden /> Privacy & security details</Link>
          </div>
          <div className="card">
            <h3><History size={20} style={{ display: 'inline', verticalAlign: '-3px' }} aria-hidden /> Spending you can actually search</h3>
            <p className="muted">Bill history with search and filters, monthly trends, category and merchant totals, budgets, unusual-expense flags, duplicate warnings and CSV/JSON export — all computed from bills you verified.</p>
            <Link to="/features">All features</Link>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head"><h2>Questions, answered honestly</h2></div>
          {FAQ.slice(0, 4).map((f) => (
            <details className="faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
          <p style={{ marginTop: 'var(--space-6)' }}><Link to="/faq">Read the full FAQ</Link></p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>Start organising your bills with BillKit.</h2>
            <p>You stay in control. Review uncertain information, correct mistakes and approve your bill before saving.</p>
            <Link to="/register" className="btn btn-primary btn-lg">Create your account</Link>
          </div>
        </div>
      </section>
    </>
  );
}
