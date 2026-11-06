# Website testing

| Layer | Tool | What | Result (last run) |
|---|---|---|---|
| Component | Vitest + Testing Library (jsdom) | Review badges, labelled form fields, password toggle, API field-error mapping, modal dialog, accessible charts, money formatting, client file validation, the API client (CSRF header, typed errors, network failures, offline fallback), the review screen (uncertain/missing highlighting with text labels and evidence, approval blocked until flagged fields are confirmed, live arithmetic validation) | 20 / 20 passed |
| End-to-end | Playwright 1.65 with system Chrome | Journeys A–F, public pages, contact form, 404 | 9 / 9 passed |
| Responsive | Playwright, Pixel 7 profile | Marketing menu, no horizontal overflow, app bottom navigation | 2 / 2 passed |
| Accessibility | @axe-core/playwright, WCAG 2.0–2.2 A/AA tags | 15 pages; fails on serious/critical issues | passed |
| Screenshots | `E2E_SCREENSHOTS=1` | Writes `assets/screenshots/` | captured |

Journeys:
- **A** Home → Get started → Register → Dashboard (empty state).
- **B** Upload a synthetic bill → real processing → review → correct a field → save → appears in history.
- **C** Upload a synthetic selfie → polite rejection with reasons → nothing saved.
- **D** History → search → open → edit → save (correction recorded).
- **E** Dashboard → Analytics → category filter.
- **F** Settings → export CSV/JSON → delete account → signed out.

## Browser compatibility

| Browser | Status |
|---|---|
| Chrome / Chromium (desktop) | **Tested** automatically (Chrome for Testing 153) |
| Chrome on Android (emulated Pixel 7 viewport and touch) | **Tested** in emulation only, not on a real device |
| Edge (Chromium) | Expected to work (same engine); not tested |
| Firefox | Not tested |
| Safari macOS / iOS | Not tested. HEIC photos from iPhones are converted on the server; camera access on iOS needs HTTPS |

Run: `npm run test -w website`, then `CHROME_PATH=/path/to/chrome npm run test:e2e` (the config builds nothing itself: run `npm run build` first).

© 2026 Shaik Gouse Kareem. All rights reserved.
