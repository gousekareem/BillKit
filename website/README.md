# BillKit website and web app

React 19 + TypeScript + Vite 8. Public pages are prerendered; `/app` is the signed-in PWA.

```bash
npm run dev -w website        # http://localhost:5173 (proxies /api to BILLKIT_API_URL, default :8787)
npm run build -w website      # dist/ with prerendered pages, sitemap.xml, robots.txt
npm run test -w website       # Vitest component tests
npm run test:e2e -w website   # Playwright (builds and starts the backend serving dist/)
```

`src/`: `pages/marketing` (home, features, how it works, technology, privacy & security, about, FAQ, contact, legal), `pages/auth`, `pages/app`, `layouts/`, `components/`, `services/`, `styles/` (design tokens), `content/` (copy and SEO metadata). `public/`: manifest, service worker, icons, brand, social image. `scripts/`: `prerender.mjs`, `generate-brand.mjs`.

Docs: `docs/website_*.md`. Diagrams W01–W14.

© 2026 Shaik Gouse Kareem. All rights reserved.
