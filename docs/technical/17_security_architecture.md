# 17. Security architecture

The threat model is a multi-user web app holding personal financial documents. The controls table is in [`docs/privacy_security.md`](../privacy_security.md); this page explains how the controls fit together.

**Layers (outside → inside)**
1. **Transport.** HTTPS at the reverse proxy; HSTS and secure cookies in production.
2. **HTTP hardening.** Helmet CSP (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), `nosniff`, no referrer, `Cache-Control: no-store` on API responses.
3. **Abuse limits.** Per-IP rate limits on `/api` (stricter on auth, upload, reprocess, contact), multipart limits (5 files, 15 MB each), a pixel limit (50 MP) in sharp, and a honeypot on the contact form.
4. **Authentication.** Argon2id; a 256-bit session token in an HttpOnly cookie, stored only as SHA-256; timing equalisation for unknown e-mails; generic errors; sessions revoked on password change/reset; reset tokens single-use, 30 minutes, hashed.
5. **Request integrity.** Mutating requests need the custom header `X-BillKit-CSRF` (which a cross-site form cannot send) **and** an allowed `Origin`.
6. **Authorisation.** Every query is scoped by `user_id`. Image routes check ownership. Admin routes check the role. There is no default admin account.
7. **Input handling.** zod schemas on every body, query and parameter; magic-byte file detection; re-encoding; UUID-only storage paths; parameterised SQL everywhere (no string-built values); LIKE wildcards escaped; CSV formula guard.
8. **AI-specific.** Document text is untrusted: it is delimited in the prompt, the model is told to ignore instructions inside it, injection-like phrases are flagged, the output is validated against a strict schema, and the model cannot call tools other than returning data. The API key never leaves the server.
9. **Output.** React escaping and no HTML from user data. Errors do not leak stack traces (`500` returns a request id only).
10. **Operations.** Secrets only in the environment; redacted logs; dependency audit (`npm audit`: 0 known vulnerabilities at build time).

**Tested.** `backend/tests/auth.test.ts` and `flow.test.ts` cover registration/login/logout, Argon2id storage, input validation without enumeration, CSRF and foreign-origin rejection, single-use expiring reset tokens with session revocation, account deletion, cross-user isolation of scans and images, upload type checks, honest contact handling with a bot honeypot, and admin-only metrics without bill content. Rate limiting and CSV formula escaping are implemented but not covered by a dedicated test.

© 2026 Shaik Gouse Kareem. All rights reserved.
