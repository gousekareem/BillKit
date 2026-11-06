// BillKit — Every bill, in your pocket. © 2026 Shaik Gouse Kareem. All rights reserved.
// Generates the original BillKit brand assets (SVG sources + PNG renders).
// Run: node website/scripts/generate-brand.mjs   (uses sharp + locally installed Inter font for PNG text)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..', 'public');
const brandDir = path.join(pub, 'brand');
const assetsDir = path.resolve(here, '..', '..', 'assets', 'branding');
for (const d of [brandDir, path.join(pub, 'icons'), path.join(pub, 'social'), assetsDir]) fs.mkdirSync(d, { recursive: true });

const C = { teal: '#0F766E', tealDark: '#0B4F4A', pocket: '#134E4A', mint: '#99F6E4', ink: '#0B1F2A', amber: '#F59E0B', paper: '#FFFFFF' };

/** The mark: a receipt tucked into a stitched pocket, with a verification tick. */
const markInner = (s = 1) => `
  <path d="M21 9h22a3 3 0 0 1 3 3v30H18V12a3 3 0 0 1 3-3z" fill="${C.paper}"/>
  <rect x="23.5" y="15" width="17" height="3.2" rx="1.6" fill="${C.mint}"/>
  <rect x="23.5" y="21.5" width="12" height="3.2" rx="1.6" fill="${C.mint}"/>
  <rect x="23.5" y="28" width="17" height="3.2" rx="1.6" fill="${C.teal}" opacity="0.55"/>
  <path d="M11 33h42v12c0 6.1-4.9 11-11 11H22c-6.1 0-11-4.9-11-11V33z" fill="${C.pocket}"/>
  <path d="M15 37.5h34" stroke="${C.mint}" stroke-width="${1.6 * s}" stroke-dasharray="3 2.6" stroke-linecap="round" opacity="0.8"/>
  <circle cx="45" cy="46" r="7.5" fill="${C.amber}"/>
  <path d="M41.6 46.2l2.4 2.4 4.6-4.9" fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;

const icon = (size = 64, radius = 15) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="BillKit">
  <rect width="64" height="64" rx="${radius}" fill="${C.teal}"/>${markInner()}</svg>`;

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${C.teal}"/><g transform="translate(9.6 9.6) scale(0.7)">${markInner()}</g></svg>`;

const wordmark = (textColor, w = 300) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${(w * 64) / 300}" viewBox="0 0 300 64" role="img" aria-label="BillKit">
  <rect width="64" height="64" rx="15" fill="${C.teal}"/>${markInner()}
  <text x="80" y="44" font-family="Inter, 'Inter Variable', 'Segoe UI', system-ui, sans-serif" font-size="38" font-weight="800" letter-spacing="-1" fill="${textColor}">Bill<tspan fill="${textColor === C.ink ? C.teal : C.mint}">Kit</tspan></text></svg>`;

const stacked = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300" role="img" aria-label="BillKit — Every bill, in your pocket.">
  <g transform="translate(162 20) scale(1.5)"><rect width="64" height="64" rx="15" fill="${C.teal}"/>${markInner()}</g>
  <text x="210" y="190" text-anchor="middle" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="56" font-weight="800" letter-spacing="-1.5" fill="${C.ink}">Bill<tspan fill="${C.teal}">Kit</tspan></text>
  <text x="210" y="232" text-anchor="middle" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="22" font-weight="500" fill="#475569">Every bill, in your pocket.</text></svg>`;

const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0FDFA"/><stop offset="1" stop-color="#CCFBF1"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(80 92) scale(1.4)"><rect width="64" height="64" rx="15" fill="${C.teal}"/>${markInner()}</g>
  <text x="200" y="160" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="800" letter-spacing="-2" fill="${C.ink}">Bill<tspan fill="${C.teal}">Kit</tspan></text>
  <text x="80" y="300" font-family="Inter, system-ui, sans-serif" font-size="58" font-weight="800" letter-spacing="-1.5" fill="${C.ink}">Every bill, in your pocket.</text>
  <text x="80" y="362" font-family="Inter, system-ui, sans-serif" font-size="28" fill="#334155">Scan, understand, verify and organise your bills.</text>
  <text x="80" y="402" font-family="Inter, system-ui, sans-serif" font-size="28" fill="#334155">You review uncertain values before saving.</text>
  <g transform="translate(820 110)">
    <rect width="300" height="400" rx="18" fill="#fff" stroke="#99F6E4" stroke-width="3"/>
    <text x="24" y="52" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="${C.ink}">Review</text>
    ${[['Merchant', 'High confidence', '#15803D', '#DCFCE7'], ['Date', 'Needs review', '#B45309', '#FEF3C7'], ['Total', 'High confidence', '#15803D', '#DCFCE7'], ['Category', 'You corrected', '#6D28D9', '#EDE9FE']]
      .map(([l, b, fg, bgc], i) => `<text x="24" y="${100 + i * 72}" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#64748B">${l}</text>
      <rect x="24" y="${110 + i * 72}" width="150" height="14" rx="7" fill="#E2E8F0"/>
      <rect x="182" y="${104 + i * 72}" width="98" height="24" rx="12" fill="${bgc}"/><text x="231" y="${121 + i * 72}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700" fill="${fg}">${b}</text>`)
      .join('')}
  </g>
  <text x="80" y="560" font-family="Inter, system-ui, sans-serif" font-size="20" fill="#64748B">© 2026 Shaik Gouse Kareem. All rights reserved.</text></svg>`;

const files = {
  'logo-icon.svg': icon(),
  'logo-horizontal-light-bg.svg': wordmark(C.ink),
  'logo-horizontal-dark-bg.svg': wordmark('#FFFFFF'),
  'logo-main-stacked.svg': stacked,
  'app-icon-maskable.svg': maskable,
  'social-preview.svg': social,
};
for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(brandDir, name), svg);
  fs.writeFileSync(path.join(assetsDir, name), svg);
}
fs.writeFileSync(path.join(pub, 'favicon.svg'), icon());

const png = (svg, out, size, opts = {}) => sharp(Buffer.from(svg), { density: 384 }).resize(size.w ?? size, size.h ?? size, opts).png({ compressionLevel: 9 }).toFile(out);
await png(icon(), path.join(pub, 'favicon-32.png'), 32);
await png(icon(), path.join(pub, 'favicon-16.png'), 16);
await png(icon(180, 0), path.join(pub, 'apple-touch-icon.png'), 180);
await png(icon(), path.join(pub, 'icons', 'icon-192.png'), 192);
await png(icon(), path.join(pub, 'icons', 'icon-512.png'), 512);
await png(maskable, path.join(pub, 'icons', 'icon-maskable-512.png'), 512);
await png(social, path.join(pub, 'social', 'og-image.png'), { w: 1200, h: 630 });
await png(wordmark(C.ink, 600), path.join(assetsDir, 'logo-horizontal-light-bg.png'), { w: 600, h: 128 });
await png(wordmark('#FFFFFF', 600), path.join(assetsDir, 'logo-horizontal-dark-bg.png'), { w: 600, h: 128 });
await png(stacked, path.join(assetsDir, 'logo-main-stacked.png'), { w: 840, h: 600 });
await png(icon(), path.join(assetsDir, 'app-icon-1024.png'), 1024);
fs.copyFileSync(path.join(pub, 'social', 'og-image.png'), path.join(assetsDir, 'social-preview-1200x630.png'));
console.log('Brand assets generated.');
