/* Contact form: real API submission, validation, honest delivery status, spam protection. © 2026 Shaik Gouse Kareem. */
import { useRef, useState, type FormEvent } from 'react';
import { ContactSchema } from '@billkit/shared';
import { TextAreaField, TextField, fieldErrors } from '../../components/Form';
import { api, ApiError } from '../../services/api';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function Contact() {
  usePageMeta('/contact');
  const opened = useRef(Date.now());
  const [values, setValues] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'done' | 'error'; message?: string }>({ kind: 'idle' });
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...values, elapsedMs: Date.now() - opened.current };
    const parsed = ContactSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      return;
    }
    setErrors({});
    setState({ kind: 'sending' });
    try {
      const r = await api.post<{ delivery: 'stored' | 'emailed' | 'email_failed' }>('/api/contact', payload);
      setState({
        kind: 'done',
        message:
          r.delivery === 'emailed'
            ? 'Thank you — your message was delivered by email.'
            : 'Thank you — your message was received and stored on this BillKit server. Email forwarding is not configured on this deployment, so replies depend on the operator checking stored messages.',
      });
      setValues({ name: '', email: '', subject: '', message: '', website: '' });
    } catch (err) {
      const a = err as ApiError;
      setErrors(fieldErrors(a.fields));
      setState({ kind: 'error', message: a.message });
    }
  };

  return (
    <>
      <section className="page-hero"><div className="container"><h1>Contact</h1><p>Questions, feedback or bug reports about BillKit.</p></div></section>
      <section className="section">
        <div className="container grid grid-2">
          <form className="card stack" onSubmit={submit} noValidate aria-describedby="contact-status">
            <TextField label="Name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} required />
            <TextField label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} required />
            <TextField label="Subject" value={values.subject} onChange={set('subject')} error={errors.subject} required />
            <TextAreaField label="Message" value={values.message} onChange={set('message')} error={errors.message} required rows={6} />
            <div className="sr-only" aria-hidden>
              <label htmlFor="website">Leave this field empty</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
            </div>
            <div id="contact-status" role="status" aria-live="polite">
              {state.kind === 'done' && <div className="alert alert-success">{state.message}</div>}
              {state.kind === 'error' && <div className="alert alert-error">{state.message}</div>}
            </div>
            <button className="btn btn-primary" disabled={state.kind === 'sending'}>{state.kind === 'sending' ? 'Sending…' : 'Send message'}</button>
          </form>
          <div className="prose">
            <h2 style={{ marginTop: 0 }}>How messages are handled</h2>
            <p>Messages are sent to the BillKit server’s contact endpoint and stored there. If the operator has configured outgoing email, a copy is forwarded to the operator’s inbox. BillKit does not publish a contact email address on this page.</p>
            <p>Please do not include bill images or financial details in your message.</p>
          </div>
        </div>
      </section>
    </>
  );
}
