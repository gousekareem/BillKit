/* Sign in, register, forgot password, reset password — real authentication. © 2026 Shaik Gouse Kareem. */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { ForgotPasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema } from '@billkit/shared';
import { PasswordField, TextField, fieldErrors } from '../../components/Form';
import { Wordmark } from '../../components/Logo';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../services/auth';
import { usePageMeta, useTitle } from '../../hooks/usePageMeta';

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" style={{ textDecoration: 'none' }}><Wordmark /></Link>
        <div>
          <h2 style={{ color: '#fff', fontSize: 'var(--text-3xl)' }}>Every bill, in your pocket.</h2>
          <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
            {['Evidence for every extracted value', 'Uncertain fields highlighted, never hidden', 'Arithmetic checked before you save', 'You approve every bill'].map((t) => (
              <li key={t} className="row"><CheckCircle2 size={18} aria-hidden /> {t}</li>
            ))}
          </ul>
        </div>
        <p className="small">© 2026 Shaik Gouse Kareem. All rights reserved.</p>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-card">
          <div className="hide-lg" style={{ marginBottom: 'var(--space-6)' }}><Link to="/" style={{ textDecoration: 'none' }} aria-label="BillKit home"><Wordmark size={28} /></Link></div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

const safeNext = (n: string | null) => (n && n.startsWith('/app') && !n.startsWith('//') ? n : '/app');

export function Login() {
  usePageMeta('/login');
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [v, setV] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = LoginSchema.safeParse(v);
    if (!p.success) return setErrors(fieldErrors(p.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
    setErrors({});
    setBusy(true);
    setFormError(null);
    try {
      await login(p.data.email, v.password);
      nav(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Welcome back" subtitle={<>New to BillKit? <Link to="/register">Create an account</Link></>}>
      <form className="stack" onSubmit={submit} noValidate>
        {formError && <div className="alert alert-error" role="alert">{formError}</div>}
        <TextField label="Email" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} required />
        <PasswordField label="Password" autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} error={errors.password} required />
        <div className="row between"><Link to="/forgot-password" className="small">Forgot password?</Link></div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  usePageMeta('/register');
  const { register, user, config } = useAuth();
  const nav = useNavigate();
  const [v, setV] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = RegisterSchema.safeParse(v);
    const errs = p.success ? {} : fieldErrors(p.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    if (v.password !== v.confirm) errs.confirm = 'Passwords do not match';
    if (!agree) errs.agree = 'Please accept the terms to continue';
    setErrors(errs);
    if (Object.keys(errs).length || !p.success) return;
    setBusy(true);
    setFormError(null);
    try {
      await register(p.data.name, p.data.email, v.password);
      nav('/app', { replace: true });
    } catch (err) {
      const a = err as ApiError;
      setErrors(fieldErrors(a.fields));
      setFormError(a.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Create your account" subtitle={<>Already have one? <Link to="/login">Sign in</Link></>}>
      {config && !config.registrationOpen && <div className="alert alert-warning">Registration is closed on this server.</div>}
      <form className="stack" onSubmit={submit} noValidate>
        {formError && <div className="alert alert-error" role="alert">{formError}</div>}
        <TextField label="Name" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} required />
        <TextField label="Email" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} required />
        <PasswordField label="Password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} error={errors.password} required />
        <PasswordField label="Confirm password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} error={errors.confirm} required />
        <label className="checkbox">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={errors.agree ? true : undefined} aria-describedby={errors.agree ? 'agree-e' : undefined} />
          <span>I agree to the <Link to="/legal/terms">terms of use</Link> and have read the <Link to="/legal/privacy">privacy policy</Link> (drafts).</span>
        </label>
        {errors.agree && <span id="agree-e" className="error-text" role="alert">{errors.agree}</span>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  useTitle('Reset your password');
  const { config } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | string>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = ForgotPasswordSchema.safeParse({ email });
    if (!p.success) return setError(p.error.issues[0]!.message);
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ emailDelivery: 'smtp' | 'not_configured' }>('/api/auth/forgot-password', { email });
      setDone(
        r.emailDelivery === 'smtp'
          ? 'If an account exists for that email, a reset link is on its way. It expires in 30 minutes.'
          : 'Request received. Note: outgoing email is not configured on this BillKit server, so no email can be sent. Ask the server operator for help (in development the link is printed in the server console).',
      );
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we’ll send a reset link.">
      {config && !config.emailConfigured && <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)' }}>Password-reset emails require the server operator to configure SMTP.</div>}
      {done ? (
        <div className="alert alert-success" role="status">{done}</div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p style={{ marginTop: 'var(--space-6)' }}><Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPassword() {
  useTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = ResetPasswordSchema.safeParse({ token, password: pw });
    if (!p.success) return setError(p.error.issues[0]!.message);
    try {
      await api.post('/api/auth/reset-password', { token, password: pw });
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    }
  };
  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <div className="alert alert-success" role="status">Your password was changed and other sessions were signed out. <Link to="/login">Sign in</Link></div>
      ) : !token ? (
        <div className="alert alert-error">This page needs the link from your reset email.</div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <PasswordField label="New password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." value={pw} onChange={(e) => setPw(e.target.value)} error={error} required />
          <button className="btn btn-primary btn-block">Save new password</button>
        </form>
      )}
    </AuthShell>
  );
}
