/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 */
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { shutdownOcr } from '@billkit/ai';

const config = loadConfig();
const app = await buildApp({ config });

// Remove unsaved scans (and their images) after the retention window.
const cleanup = setInterval(async () => {
  const cutoff = new Date(Date.now() - config.unsavedScanRetentionHours * 3600_000).toISOString();
  const stale = app.ctx.db.prepare(`SELECT id, user_id FROM scans WHERE status IN ('completed','failed','cancelled') AND bill_id IS NULL AND updated_at < ?`).all(cutoff) as Array<{ id: string; user_id: string }>;
  for (const s of stale) {
    app.ctx.db.prepare('DELETE FROM bill_images WHERE scan_id = ?').run(s.id);
    app.ctx.db.prepare('DELETE FROM scans WHERE id = ?').run(s.id);
    await app.ctx.storage.removeScanDir(s.user_id, s.id);
  }
  app.ctx.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  app.ctx.db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(new Date().toISOString());
  if (stale.length) app.log.info({ removed: stale.length }, 'removed unsaved scans past retention');
}, 3600_000);
cleanup.unref();

const shutdown = async () => {
  clearInterval(cleanup);
  await app.close();
  await shutdownOcr();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
app.log.info(`BillKit API listening on http://${config.host}:${config.port} (vision model: ${config.vlm ? config.vlm.model : 'not configured'}; email: ${config.smtp ? 'SMTP' : 'not configured'})`);
