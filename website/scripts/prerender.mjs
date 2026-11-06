// Prerenders public routes into dist/<route>/index.html with per-page <title>, description,
// canonical URL, Open Graph tags and JSON-LD; writes sitemap.xml and robots.txt.
// © 2026 Shaik Gouse Kareem. All rights reserved.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const site = (process.env.SITE_URL ?? 'https://YOUR_DOMAIN').replace(/\/$/, '');
const { render, PAGES } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href);
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let count = 0;
for (const p of PAGES.filter((x) => x.public)) {
  const html = render(p.path);
  const head = [
    `<link rel="canonical" href="${site}${p.path === '/' ? '/' : p.path}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="BillKit" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${site}${p.path}" />`,
    `<meta property="og:image" content="${site}/social/og-image.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    p.path === '/'
      ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'BillKit', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', description: p.description, author: { '@type': 'Person', name: 'Shaik Gouse Kareem' } })}</script>`
      : '',
  ].join('\n    ');
  const out = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${esc(p.description)}" />`)
    .replace('<!--head-meta-->', head)
    .replace('<!--app-html-->', html);
  const file = p.path === '/' ? path.join(dist, 'index.html') : path.join(dist, p.path, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  count++;
}
// The authenticated app shell (/app) is not prerendered with content.
fs.mkdirSync(path.join(dist, 'app'), { recursive: true });
fs.writeFileSync(path.join(dist, 'app', 'index.html'), template.replace('<!--head-meta-->', '<meta name="robots" content="noindex" />').replace('<!--app-html-->', ''));

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.filter((p) => p.public).map((p) => `  <url><loc>${site}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api\nSitemap: ${site}/sitemap.xml\n`);
fs.rmSync(path.join(root, 'dist-ssr'), { recursive: true, force: true });
console.log(`Prerendered ${count} public pages; sitemap.xml and robots.txt written for ${site}.`);
