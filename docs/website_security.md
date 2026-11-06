# Website security

The server-side controls are in `privacy_security.md` and `technical/17_security_architecture.md`. The browser-side ones are:

- **CSP** from the backend: `script-src 'self'` (no inline or third-party scripts; JSON-LD blocks are data, not executed), `style-src 'self' 'unsafe-inline'` (inline style attributes for sizing), `frame-ancestors 'none'` (no clickjacking), `object-src 'none'`, `connect-src 'self'`, `img-src 'self' data: blob:` (for previews).
- **Session cookie** is HttpOnly, so JavaScript cannot read it. Nothing secret is kept in localStorage (only the theme), and offline data is kept per user in IndexedDB and cleared on sign-out.
- **XSS**: React escapes all text, and OCR text is rendered as text, never as HTML.
- **CSRF**: custom header plus Origin check (see the API docs).
- **Open redirects**: the `?next=` parameter after login only accepts same-site paths that start with `/app`.
- **File handling in the browser**: only accepted types can be chosen, and object URLs are revoked after use.
- **No third parties**: no analytics, ads, CDNs or external fonts.

© 2026 Shaik Gouse Kareem. All rights reserved.
