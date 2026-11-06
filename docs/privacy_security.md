# Privacy and security

This document describes what BillKit does. It is **not** a claim of compliance with GDPR, India's DPDP Act 2023 or any other law. A deployment operator must obtain their own legal review.

## Data flows (honest statement)

- Images are uploaded **to the BillKit server you run** and processed there (OCR runs on that server). They do not stay only on the phone.
- If the operator configures `AI_PROVIDER=anthropic` with an API key **and** the user leaves "Use cloud AI for difficult bills" on, then for scans that need it, the processed page images and OCR text are sent to Anthropic's API. The settings page and the privacy page say this. With the setting off, or no key configured, nothing is sent to any third party.
- No analytics, advertising or tracking scripts are included. Fonts are self-hosted.

## Controls implemented

| Area | Control |
|---|---|
| Passwords | Argon2id (@node-rs/argon2, m=19 MiB, t=2, p=1), 10–128 characters with at least one letter and one digit; dummy-hash timing equalisation for unknown e-mails; never logged |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie; only its SHA-256 is stored; expiry; revocation on password change/reset |
| CSRF | Custom header required on mutating requests + Origin check |
| Enumeration | Generic login errors; forgot-password always returns the same response |
| Rate limiting | Per-IP limits on auth, upload, reprocess, contact and overall API |
| Headers | Helmet: CSP (`default-src 'self'`, `script-src 'self'` — no inline scripts; inline styles allowed for chart/element sizing; `frame-ancestors 'none'`, `object-src 'none'`), HSTS in production, `nosniff`, Helmet's default referrer policy (`no-referrer`) |
| Uploads | Magic-byte detection, size/page/pixel limits, re-encoding through sharp (removes active content and EXIF metadata from processed copies), UUID file names, files outside the web root |
| Authorisation | Every scan, bill and image query is scoped by `user_id`; image endpoints check ownership; admin endpoints check role |
| Untrusted text | OCR/document text is treated as data: delimited in prompts, the model is told to ignore instructions in it, injection phrases are flagged, and model output is schema-validated. React escapes all rendering; the only `dangerouslySetInnerHTML` is the static FAQ JSON-LD built from site copy, never user data, and CSV export is guarded against formula injection |
| Secrets | Only in environment variables; `.env` is git-ignored and excluded from the ZIP; placeholder keys are treated as "not configured"; API keys never reach the browser |
| Logs | Structured; cookies, authorisation headers and bodies redacted; `job_metrics` stores no bill content |
| Retention | Unsaved scans deleted after 24 h (configurable); "keep original images" setting; delete bill; delete account |
| Admin | No default admin account or password; an admin is granted by CLI on the server |

## Known gaps (to address before a public launch)

- No common/breached-password list check.
- No multi-factor authentication or e-mail verification.
- Images are not encrypted at rest by the application (use disk encryption).
- No malware scanning of uploads (re-encoding mitigates image-borne payloads; PDFs are rendered but not stored as processed copies).
- No independent penetration test has been performed.

See also `docs/technical/17_security_architecture.md`, `docs/dataset/privacy_*.md` and `docs/legal/privacy_policy_template.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
