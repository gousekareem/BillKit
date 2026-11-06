/* BillKit public pages: features, how it works, technology, privacy, about, FAQ, legal, 404. © 2026 Shaik Gouse Kareem. */
import { Link, useParams } from 'react-router';
import type { ReactNode } from 'react';
import { ArrowRight, Calculator, Camera, Check, Cpu, Database, FileSearch, FolderKanban, Gauge, History, Layers, Lock, ScanLine, ShieldCheck, Sparkles, Tags, UserCheck, X } from 'lucide-react';
import { FAQ, FEATURES, LEGAL } from '../../content/copy';
import { usePageMeta } from '../../hooks/usePageMeta';

function PageHero({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="page-hero">
      <div className="container">
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
    </section>
  );
}

const FEATURE_ICONS: Record<string, typeof Camera> = {
  scan: ScanLine, camera: Camera, upload: Layers, detect: ShieldCheck, ocr: FileSearch, extract: Sparkles, merchant: Tags, date: History, total: Calculator,
  category: FolderKanban, confidence: Gauge, highlight: FileSearch, math: Calculator, correct: UserCheck, history: History, search: FileSearch, analytics: Gauge,
  duplicates: Layers, export: Database, offline: Cpu, privacy: Lock,
};

export function Features() {
  usePageMeta('/features');
  return (
    <>
      <PageHero title="Features">Everything listed here is implemented in this version of BillKit — with its limitations stated plainly.</PageHero>
      <section className="section">
        <div className="container grid grid-3">
          {FEATURES.map((f) => {
            const I = FEATURE_ICONS[f.id] ?? Sparkles;
            return (
              <article className="feature-card" key={f.id} id={f.id}>
                <div className="feature-icon"><I aria-hidden /></div>
                <h2 style={{ fontSize: 'var(--text-lg)' }}>{f.title}</h2>
                <p>{f.what}</p>
                <dl>
                  <dt>Why it helps</dt><dd>{f.why}</dd>
                  <dt>How to use it</dt><dd>{f.how}</dd>
                  <dt>Limitations</dt><dd>{f.limits}</dd>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export const PIPELINE_STEPS: Array<[string, string, string]> = [
  ['Capture or upload a bill', 'Camera, gallery, drag-and-drop, HEIC or PDF. File type is verified from the file contents, not its name.', 'decoding'],
  ['Check image quality', 'Sharpness (Laplacian variance), brightness, glare, uneven lighting, resolution, tilt and cropping are measured. You get retake tips, but processing continues.', 'quality'],
  ['Straighten and enhance', 'The paper is found against the background, perspective and tilt are corrected, shadows are flattened, and contrast is improved for OCR. The original is kept.', 'preprocessing'],
  ['Read the text (OCR)', 'Tesseract reads words with positions and confidence. Upside-down or sideways pages are rotated automatically. PDFs with a text layer skip OCR.', 'ocr'],
  ['Identify whether it is a bill', 'Bill vocabulary, money lines and dates are weighed against signs of ID cards, chats, letters or photos. Non-bills are politely rejected; unclear cases ask you.', 'classification'],
  ['Understand the document', 'Words are grouped into rows; header, item table, totals and footer regions are identified.', 'layout'],
  ['Extract the details', 'Merchant, date, total, subtotal, tax, discount and more are taken from labelled lines, each linked to its source text. Nothing is guessed.', 'extraction'],
  ['Cross-check (optional)', 'If enabled by the operator and by you, a vision-language model reads the bill too. Agreements raise confidence; disagreements are shown to you.', 'vlm'],
  ['Suggest the category', 'Merchant names, item words and context suggest a category with reasons — or “Unknown” when evidence is weak.', 'categorisation'],
  ['Validate the numbers', 'Subtotal + tax + charges − discount ± round-off is checked against the total; dates, currency and line items are sanity-checked.', 'validation'],
  ['Assess confidence and review', 'Each field is labelled High confidence, Needs review, Missing or Validation warning. You correct and confirm.', 'confidence'],
  ['Approve, save and find it later', 'Only approved values are saved. The bill appears in history, search and analytics.', 'done'],
];

export function HowItWorks() {
  usePageMeta('/how-it-works');
  return (
    <>
      <PageHero title="How BillKit works">These are the same stages the BillKit server reports while it processes your bill — the progress you see in the app is real.</PageHero>
      <section className="section">
        <div className="container">
          <ol className="steps">
            {PIPELINE_STEPS.map(([t, d, stage]) => (
              <li key={t}>
                <h2 style={{ fontSize: 'var(--text-base)' }}>{t}</h2>
                <p>{d}</p>
                <p className="subtle" style={{ marginTop: 6 }}>Server stage: <code>{stage}</code></p>
              </li>
            ))}
          </ol>
          <figure className="card" style={{ marginTop: 'var(--space-10)' }}>
            <figcaption><h2 style={{ fontSize: 'var(--text-xl)' }}>The decision path</h2></figcaption>
            <div className="row" style={{ gap: 8, fontSize: 'var(--text-sm)' }} aria-label="Image → Quality → Preprocess → OCR → Bill? → Extract → Validate → Review → Save">
              {['Image', 'Quality check', 'Preprocess', 'OCR', 'Bill?', 'Extract', 'Validate', 'Your review', 'Save'].map((s, i, a) => (
                <span key={s} className="row" style={{ gap: 8 }}>
                  <span className={`badge ${s === 'Bill?' ? 'badge-review' : s === 'Your review' ? 'badge-user' : 'badge-info'}`}>{s}</span>
                  {i < a.length - 1 && <ArrowRight size={14} aria-hidden />}
                </span>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 'var(--space-4)' }}>Not a bill → polite rejection (you can override). Unsure → you confirm. Low confidence or failed arithmetic → highlighted for review. Vision-model errors → OCR results are used and you are told.</p>
          </figure>
        </div>
      </section>
    </>
  );
}

export function Technology() {
  usePageMeta('/technology');
  const rows: Array<[string, string, string]> = [
    ['Image quality & preprocessing', 'BillKit code (sharp + custom computer-vision routines)', 'Runs on the BillKit server'],
    ['OCR', 'Tesseract 5 LSTM via tesseract.js (open source, Apache-2.0)', 'Runs on the BillKit server'],
    ['Bill / non-bill classification', 'BillKit evidence scorer (rule-based, transparent)', 'Runs on the BillKit server'],
    ['Layout analysis & extraction', 'BillKit rules with evidence links', 'Runs on the BillKit server'],
    ['Category suggestion', 'BillKit keyword rules (+ optional TF-IDF model trained by the project)', 'Runs on the BillKit server'],
    ['Vision-language cross-check', 'Third-party model (Anthropic Claude) — optional', 'Cloud API, only if configured and enabled'],
    ['Validation', 'BillKit arithmetic and consistency rules', 'Server and in your browser'],
    ['Approval', 'You', 'Your device'],
  ];
  return (
    <>
      <PageHero title="AI & technology">A hybrid of computer vision, OCR, transparent rules, optional vision-language models and — most importantly — human approval.</PageHero>
      <section className="section">
        <div className="container prose">
          <h2>Who does what</h2>
          <div className="table-wrap" style={{ maxWidth: '100%' }}>
            <table>
              <thead><tr><th>Step</th><th>Technology</th><th>Where it runs</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="subtle">Not every component is a trained model. The classifier and extractor are rule-based by design: they are explainable and work without training data. A training framework for a learned image classifier is included in the project but has not been trained, because no suitably licensed, labelled dataset was available.</p>

          <h2>Six terms, clearly separated</h2>
          <h3>OCR</h3><p>Optical character recognition turns pixels into text and tells us where each word is and how sure the engine was about it.</p>
          <h3>Classification</h3><p>Decides what kind of document this is. BillKit weighs bill vocabulary, money lines and dates against signs of ID cards, chats, letters and photos, and lists the evidence for its decision.</p>
          <h3>AI extraction</h3><p>Finds the specific values — merchant, date, total — in the OCR text, keeping total, subtotal, tax, discount, amount paid and balance due strictly apart.</p>
          <h3>Confidence</h3><p>A heuristic score combining OCR confidence, how strong the matching rule was, agreement between methods and validation. It decides what to highlight. It becomes a calibrated estimate only after measurement on a labelled validation set.</p>
          <h3>Validation</h3><p>Deterministic checks: does the arithmetic add up, is the date plausible, is the currency valid? Validation can contradict a confident-looking value.</p>
          <h3>Human approval</h3><p>You review, correct and approve. Nothing is saved without it.</p>

          <h2>Computer vision & preprocessing</h2>
          <p>BillKit measures blur with the variance of the Laplacian, finds the paper with Otsu thresholding and the largest bright region, corrects perspective with a four-point homography, estimates tilt with a projection-profile search, and removes shadows by dividing by a blurred background estimate. Each step runs only when its own check says it helps.</p>

          <h2>Vision-language models</h2>
          <p>When configured, a vision-language model reads the corrected image with strict instructions: report only what is printed, never guess, keep amounts separate, and treat document text as untrusted data — never as instructions. Its output must pass a strict schema or it is discarded. Values it reports that the OCR cannot find are flagged as unverified.</p>

          <h2>Model evaluation & dataset quality</h2>
          <p>The project contains an evaluation harness that measures classification accuracy, precision, recall, F1, a confusion matrix, field accuracy for merchant, date, total and category, latency and cost on labelled images. The required evaluation on 15 real bills and 5 non-bills is pending the real images; results will be published only once measured. Diversity of layouts, lighting and languages matters more than raw image count.</p>

          <h2>Privacy considerations</h2>
          <p>OCR runs locally on the server. Cloud vision is opt-in and disclosed. Logs contain no bill content. See <Link to="/privacy-security">Privacy & security</Link>.</p>
        </div>
      </section>
    </>
  );
}

export function PrivacySecurity() {
  usePageMeta('/privacy-security');
  const Item = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <li className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>{ok ? <Check size={18} color="var(--status-high-fg)" aria-label="Yes" /> : <X size={18} color="var(--status-error-fg)" aria-label="No" />}<span>{children}</span></li>
  );
  return (
    <>
      <PageHero title="Privacy & security">How BillKit handles your bills — described exactly as implemented.</PageHero>
      <section className="section">
        <div className="container grid grid-2">
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Where processing happens</h2>
            <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
              <Item ok>Image checks, preprocessing, OCR, classification, extraction and validation run on the BillKit server.</Item>
              <Item ok>Cloud vision is off unless the server operator configures an API key <em>and</em> you enable it in Settings.</Item>
              <Item ok>When cloud vision is used, the downscaled bill image and its OCR text are sent to the provider (Anthropic). Your name and email are not.</Item>
              <Item ok={false}>BillKit does not claim that data never leaves your device: uploads go to your BillKit server.</Item>
            </ul>
          </div>
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>What is stored, and where</h2>
            <ul className="stack">
              <li>Account: name, email, Argon2id password hash.</li>
              <li>Bills: approved values, line items, notes, the AI’s proposal (for traceability), your corrections.</li>
              <li>Images: on the server’s disk, served only to you. Optionally discard originals after saving.</li>
              <li>Unsaved scans: deleted automatically after 24 hours by default.</li>
              <li>On your device: a copy of bills you viewed (IndexedDB), cleared on sign-out.</li>
            </ul>
          </div>
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>How it is protected</h2>
            <ul className="stack">
              <li>Passwords hashed with Argon2id; never stored or logged in plain text.</li>
              <li>Sessions are random 256-bit tokens in HttpOnly, SameSite cookies; only hashes are stored.</li>
              <li>CSRF protection, rate limiting, strict input validation, parameterised SQL.</li>
              <li>Uploads verified by content (magic bytes), size-limited and stored under random names.</li>
              <li>AI provider keys live only in server environment variables — never in the browser.</li>
              <li>Security headers (CSP, frame blocking) and privacy-aware logs without bill content.</li>
            </ul>
          </div>
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Your controls</h2>
            <ul className="stack">
              <li>Delete any bill and its images.</li>
              <li>Turn cloud vision on or off.</li>
              <li>Choose whether original photos are kept.</li>
              <li>Opt in or out of sharing corrections for improvement (off by default).</li>
              <li>Export everything as CSV/JSON. Delete your account instantly.</li>
            </ul>
          </div>
        </div>
        <div className="container prose" style={{ marginTop: 'var(--space-10)' }}>
          <h2>Honest limitations</h2>
          <ul>
            <li>HTTPS must be provided by the deployment (reverse proxy or host). BillKit sets Secure cookies in production.</li>
            <li>Data at rest is protected by the server’s file permissions and disk encryption, if the operator enables it — BillKit does not add its own database encryption.</li>
            <li>BillKit has not undergone an external security audit and makes no compliance claims (for example GDPR or DPDP).</li>
          </ul>
          <p>Read the draft <Link to="/legal/privacy">privacy policy</Link> and <Link to="/legal/data-deletion">data deletion instructions</Link>.</p>
        </div>
      </section>
    </>
  );
}

export function About() {
  usePageMeta('/about');
  return (
    <>
      <PageHero title="About BillKit">Every bill, in your pocket.</PageHero>
      <section className="section">
        <div className="container prose">
          <h2>The problem</h2>
          <p>Paper receipts fade, get lost and are tedious to type into spreadsheets. Many scanning apps hide uncertainty and save whatever the AI guessed — so mistakes quietly enter your records.</p>
          <h2>Our mission</h2>
          <p>Make financial paperwork effortless without sacrificing correctness. BillKit turns bills into structured, searchable records and shows you exactly how sure it is about each value.</p>
          <h2>Product philosophy</h2>
          <p>Intelligent technology should make financial information easier to understand, not make decisions without the user’s knowledge. That is why BillKit is built around evidence-aware extraction, uncertainty highlighting, mathematical verification and human correction before saving.</p>
          <h2>Technology overview</h2>
          <p>A TypeScript web app (installable as a PWA), a Fastify API with SQLite, an on-server OCR and extraction pipeline, and an optional vision-language model. See <Link to="/technology">AI & technology</Link>.</p>
          <h2>Who made it</h2>
          <p>Created and developed by <strong>Shaik Gouse Kareem</strong>.</p>
          <p className="subtle">© 2026 Shaik Gouse Kareem. All rights reserved. The BillKit name and logo are used as an ownership notice; no trademark registration is claimed.</p>
        </div>
      </section>
    </>
  );
}

export function Faq() {
  usePageMeta('/faq');
  return (
    <>
      <PageHero title="Frequently asked questions">Answers that match what BillKit actually does.</PageHero>
      <section className="section">
        <div className="container prose">
          {FAQ.map((f) => (
            <details className="faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <script
        type="application/ld+json"
        // Static, developer-authored FAQ structured data (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }}
      />
    </>
  );
}

export function Legal() {
  const { slug } = useParams();
  const doc = LEGAL.find((d) => d.slug === slug);
  usePageMeta(`/legal/${slug}`);
  if (!doc) return <NotFound />;
  return (
    <>
      <PageHero title={doc.title}>Last updated {doc.updated}</PageHero>
      <section className="section">
        <div className="container prose">
          <div className="draft-banner" role="note"><strong>Draft.</strong> This document reflects the current implementation and requires appropriate legal review before commercial deployment.</div>
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
            </section>
          ))}
          <p className="subtle">© 2026 Shaik Gouse Kareem. All rights reserved.</p>
        </div>
      </section>
    </>
  );
}

export function NotFound() {
  return (
    <section className="section">
      <div className="container center">
        <h1>Page not found</h1>
        <p className="muted">The page you were looking for does not exist.</p>
        <Link to="/" className="btn btn-primary">Go to the home page</Link>
      </div>
    </section>
  );
}
