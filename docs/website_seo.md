# SEO

- **Prerendered HTML** for all 14 public pages, so crawlers do not need JavaScript.
- Per-page `<title>`, meta description, canonical URL, Open Graph and Twitter card tags (`src/content/seo.ts` → `usePageMeta` at runtime and the prerenderer at build time).
- **JSON-LD**: `SoftwareApplication` on the home page; `FAQPage` on the FAQ page (built from the same copy that is displayed).
- `sitemap.xml` and `robots.txt` are generated at build time from `SITE_URL`. App, auth and API paths are disallowed.
- Social preview image 1200×630 (`public/social/og-image.png`), favicon (SVG + PNG), apple-touch icon, web manifest.
- Semantic HTML, descriptive link text and fast, small pages (no third-party scripts).
- Set `SITE_URL=https://your-domain` when building for production; otherwise canonical URLs use the placeholder `https://YOUR_DOMAIN`.

Not done: search-console verification and any real ranking measurement (the site is not deployed).

© 2026 Shaik Gouse Kareem. All rights reserved.
