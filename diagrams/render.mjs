// Re-render all Mermaid diagrams to SVG and PNG (and per-diagram PDF via PNG).
// Usage: npm run diagrams:render   (CHROME_PATH=/path/to/chrome optional)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const cfg = path.join(os.tmpdir(), 'billkit-puppeteer.json');
fs.writeFileSync(cfg, JSON.stringify({ executablePath: chrome, args: ['--no-sandbox'] }));
for (const f of fs.readdirSync(path.join(here, 'source')).filter((x) => x.endsWith('.mmd'))) {
  const b = f.replace(/\.mmd$/, '');
  for (const [ext, extra] of [['svg', []], ['png', ['-s', '2']]]) {
    execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli@12.2.0', '-q', '-p', cfg, '-b', 'white', ...extra, '-i', path.join(here, 'source', f), '-o', path.join(here, 'rendered', ext, `${b}.${ext}`)], { stdio: 'inherit', env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' } });
  }
  console.log('rendered', b);
}
