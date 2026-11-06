/* Form primitives with labels, hints and errors wired to aria attributes. © 2026 Shaik Gouse Kareem. */
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Base { label: ReactNode; hint?: ReactNode; error?: string | null }

export function TextField({ label, hint, error, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <input id={fid} className="input" aria-invalid={error ? true : undefined} aria-describedby={[hint ? `${fid}-h` : '', error ? `${fid}-e` : ''].filter(Boolean).join(' ') || undefined} {...rest} />
      {hint && <span id={`${fid}-h`} className="hint">{hint}</span>}
      {error && <span id={`${fid}-e`} className="error-text" role="alert">{error}</span>}
    </div>
  );
}

export function PasswordField({ label, hint, error, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <div className="input-wrap">
        <input id={fid} className="input" type={show ? 'text' : 'password'} aria-invalid={error ? true : undefined} aria-describedby={[hint ? `${fid}-h` : '', error ? `${fid}-e` : ''].filter(Boolean).join(' ') || undefined} {...rest} />
        <button type="button" className="btn btn-ghost btn-sm btn-icon input-action" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <span id={`${fid}-h`} className="hint">{hint}</span>}
      {error && <span id={`${fid}-e`} className="error-text" role="alert">{error}</span>}
    </div>
  );
}

export function SelectField({ label, hint, error, id, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <select id={fid} className="select" aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-e` : hint ? `${fid}-h` : undefined} {...rest}>
        {children}
      </select>
      {hint && <span id={`${fid}-h`} className="hint">{hint}</span>}
      {error && <span id={`${fid}-e`} className="error-text" role="alert">{error}</span>}
    </div>
  );
}

export function TextAreaField({ label, hint, error, id, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <textarea id={fid} className="textarea" aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-e` : hint ? `${fid}-h` : undefined} {...rest} />
      {hint && <span id={`${fid}-h`} className="hint">{hint}</span>}
      {error && <span id={`${fid}-e`} className="error-text" role="alert">{error}</span>}
    </div>
  );
}

/** Map zod-style issues from the API to a field → message record. */
export function fieldErrors(fields?: Array<{ path: string; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields ?? []) out[f.path.split('.').pop() ?? f.path] ??= f.message;
  return out;
}
