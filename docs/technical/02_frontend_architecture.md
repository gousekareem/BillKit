# 2. Frontend architecture

- **One SPA** (`website/`) with two layouts: `MarketingLayout` (public pages, header and footer) and `AppLayout` (signed-in shell with sidebar/bottom navigation). Routes are in `src/App.tsx`; `AppLayout` redirects signed-out users to `/login?next=…`.
- **Prerendering.** `scripts/prerender.mjs` renders the 14 public pages to static HTML at build time (`entry-server.tsx`), with per-page title, description, canonical, Open Graph and JSON-LD, plus `sitemap.xml` and `robots.txt`. Search engines get real HTML; the app then hydrates.
- **Services.** `api.ts` is a typed fetch wrapper: it adds the CSRF header, parses error bodies into a typed `ApiError` (status, code, field errors). `auth.tsx` is a context holding the current user. `toast.tsx` provides accessible live-region notifications. `theme.ts` handles system, light and dark themes. `offline.ts` is an IndexedDB copy of viewed bills, per user, cleared on sign-out.
- **Key pages.** `Scan.tsx` (camera via `getUserMedia` with a file-input fallback, multi-page tray, rotate/crop in canvas, upload progress and cancel), `ScanDetail.tsx` (processing stages, rejection, review form with evidence boxes and live validation from `@billkit/shared`), `Bills.tsx` (history: search, filters, sort, pagination, detail/edit/delete/export), `Dashboard.tsx`, and `Other.tsx` (analytics, categories, settings, admin).
- **Design system.** CSS custom properties in `styles/tokens.css` (colour, type scale, spacing, radii, shadows, light/dark themes), with components built on them. There is no CSS framework, so the bundle stays small and every style is visible. The Inter variable font is self-hosted.
- **PWA.** `manifest.webmanifest`, icons, and `sw.js` (app shell cache; API responses are never cached by the service worker).
- **Accessibility.** Semantic landmarks, a skip link, labelled controls, visible focus, `aria-live` progress, and status badges that pair colour with icon and text. Checked with axe-core in e2e tests.

Diagrams: W01–W14 (site map, page flows, components).

© 2026 Shaik Gouse Kareem. All rights reserved.
