# Security Architecture

**Diagrams:** D16, D21, W14 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

**Authentication**: Argon2id (m = 19 MiB, t = 2, p = 1); 256-bit random session tokens stored only in an HttpOnly, SameSite=Lax cookie (Secure in production), with their sha256 in the database; sessions revoked on password reset or change; account enumeration avoided. **Request protection**: required `X-BillKit-CSRF` header plus an Origin allow-list on writes; rate limits on the API (stricter on auth, uploads and contact); zod validation; parameterised SQL; LIKE wildcards escaped; CSV formula injection neutralised. **Uploads**: type from magic bytes, size/page limits, pixel limit, UUID storage paths, files mode 0600, owner-checked image routes. **Headers**: CSP (self only, no framing), Helmet defaults, `Cache-Control: no-store` on API JSON. **Secrets**: API and SMTP keys only in server environment variables. **Logs**: cookies and auth headers redacted; bodies and OCR text never logged. **AI**: document text is treated as untrusted; injection-like text is flagged. **Limitations**: no external audit, no app-level encryption at rest, HTTPS must be provided by the host.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
