/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * In-process processing queue. Each scan runs the shared AI pipeline; every
 * real stage transition is written to the database so the UI shows genuine
 * progress (no simulated progress bars). Jobs can be cancelled between stages.
 */
import crypto from 'node:crypto';
import { PipelineError, processDocument, type VlmProvider } from '@billkit/ai';
import { UserSettingsSchema, type PipelineStage } from '@billkit/shared';
import type { DB } from '../db.ts';
import { nowIso } from '../db.ts';
import type { Storage } from '../storage.ts';

export interface ScanOptions {
  rotate?: number;
  disableAutoCrop?: boolean;
  userConfirmedBill?: boolean;
  allowVlm?: boolean;
}

interface Logger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export class ProcessingQueue {
  private queue: string[] = [];
  private running = new Map<string, AbortController>();
  private idleResolvers: Array<() => void> = [];

  constructor(
    private readonly db: DB,
    private readonly storage: Storage,
    private readonly vlm: VlmProvider | null,
    private readonly concurrency: number,
    private readonly log: Logger,
  ) {}

  /** Re-queue queued scans and fail interrupted ones after a restart. */
  recover(): void {
    this.db
      .prepare(`UPDATE scans SET status='failed', error_code='interrupted', error_message='The server restarted while this bill was being processed. Please retry.', updated_at=? WHERE status='processing'`)
      .run(nowIso());
    const queued = this.db.prepare(`SELECT id FROM scans WHERE status='queued' ORDER BY created_at`).all() as Array<{ id: string }>;
    for (const q of queued) this.enqueue(q.id);
  }

  enqueue(scanId: string): void {
    if (!this.queue.includes(scanId) && !this.running.has(scanId)) this.queue.push(scanId);
    this.pump();
  }

  cancel(scanId: string): boolean {
    const idx = this.queue.indexOf(scanId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      this.db.prepare(`UPDATE scans SET status='cancelled', error_code='cancelled', error_message='Cancelled by you.', updated_at=? WHERE id=?`).run(nowIso(), scanId);
      return true;
    }
    const ac = this.running.get(scanId);
    if (ac) {
      this.db.prepare('UPDATE scans SET cancel_requested=1, updated_at=? WHERE id=?').run(nowIso(), scanId);
      ac.abort();
      return true;
    }
    return false;
  }

  get depth(): number {
    return this.queue.length + this.running.size;
  }

  /** Resolves when no job is queued or running (used by tests and graceful shutdown). */
  idle(): Promise<void> {
    if (this.depth === 0) return Promise.resolve();
    return new Promise((r) => this.idleResolvers.push(r));
  }

  private pump(): void {
    while (this.running.size < this.concurrency && this.queue.length) {
      const id = this.queue.shift()!;
      const ac = new AbortController();
      this.running.set(id, ac);
      void this.run(id, ac).finally(() => {
        this.running.delete(id);
        this.pump();
        if (this.depth === 0) this.idleResolvers.splice(0).forEach((r) => r());
      });
    }
  }

  private async run(scanId: string, ac: AbortController): Promise<void> {
    const scan = this.db.prepare('SELECT s.*, u.settings_json FROM scans s JOIN users u ON u.id = s.user_id WHERE s.id = ?').get(scanId) as
      | { id: string; user_id: string; file_count: number; options_json: string; settings_json: string; status: string }
      | undefined;
    if (!scan || scan.status !== 'queued') return;
    const settings = UserSettingsSchema.parse(JSON.parse(scan.settings_json || '{}'));
    const options = JSON.parse(scan.options_json) as ScanOptions;
    const setStage = this.db.prepare(`UPDATE scans SET status='processing', stage=?, updated_at=? WHERE id=?`);
    setStage.run('decoding', nowIso(), scanId);
    const originals = this.db.prepare(`SELECT rel_path FROM bill_images WHERE scan_id=? AND kind='original' ORDER BY page`).all(scanId) as Array<{ rel_path: string }>;
    const customCategories = (this.db.prepare('SELECT name FROM categories WHERE user_id=?').all(scan.user_id) as Array<{ name: string }>).map((c) => c.name);
    const started = Date.now();
    try {
      const files = await Promise.all(originals.map((o) => this.storage.read(o.rel_path)));
      const out = await processDocument({
        files,
        vlm: this.vlm,
        signal: ac.signal,
        options: {
          dateOrder: settings.ambiguousDateOrder,
          reviewThreshold: settings.reviewThreshold,
          allowVlm: options.allowVlm ?? settings.useCloudVision,
          rotate: options.rotate,
          disableAutoCrop: options.disableAutoCrop,
          userConfirmedBill: options.userConfirmedBill,
          customCategories,
        },
        onStage: (stage: PipelineStage) => {
          setStage.run(stage, nowIso(), scanId);
        },
      });
      // Store geometry-corrected pages (evidence boxes refer to these).
      this.db.prepare(`DELETE FROM bill_images WHERE scan_id=? AND kind='corrected'`).run(scanId);
      for (const [i, png] of out.correctedPages.entries()) {
        const rel = this.storage.relPath(scan.user_id, scanId, `corrected-${i}.png`);
        await this.storage.write(rel, png);
        this.db
          .prepare(`INSERT INTO bill_images (id, user_id, scan_id, kind, page, rel_path, mime, bytes, sha256, perceptual_hash, created_at) VALUES (?, ?, ?, 'corrected', ?, ?, 'image/png', ?, NULL, ?, ?)`)
          .run(crypto.randomUUID(), scan.user_id, scanId, i, rel, png.length, i === 0 ? out.perceptualHash : null, nowIso());
      }
      this.db
        .prepare(`UPDATE scans SET status='completed', stage='done', result_json=?, error_code=NULL, error_message=NULL, completed_at=?, updated_at=? WHERE id=?`)
        .run(JSON.stringify(out.result), nowIso(), nowIso(), scanId);
      this.recordMetrics(scanId, scan.user_id, 'completed', out.result, null, Date.now() - started);
      this.log.info({ scanId, ms: Date.now() - started, decision: out.result.classification.decision }, 'scan processed');
    } catch (err) {
      const cancelled = (err instanceof PipelineError && err.code === 'cancelled') || ac.signal.aborted;
      const e = err instanceof PipelineError ? err : new PipelineError('internal', 'Processing failed unexpectedly. Please try again.');
      this.db
        .prepare(`UPDATE scans SET status=?, error_code=?, error_message=?, updated_at=? WHERE id=?`)
        .run(cancelled ? 'cancelled' : 'failed', cancelled ? 'cancelled' : e.code, cancelled ? 'Cancelled by you.' : e.message, nowIso(), scanId);
      this.recordMetrics(scanId, scan.user_id, cancelled ? 'cancelled' : 'failed', null, cancelled ? 'cancelled' : e.code, Date.now() - started);
      if (!cancelled) this.log.error({ scanId, code: e.code, err: err instanceof Error ? err.message : String(err) }, 'scan failed');
    }
  }

  private recordMetrics(scanId: string, userId: string, outcome: string, result: import('@billkit/shared').ExtractionResult | null, errorCode: string | null, totalMs: number): void {
    const vlm = result?.meta.vlm ?? null;
    this.db
      .prepare(
        `INSERT INTO job_metrics (id, scan_id, user_id, outcome, decision, overall_review, error_code, total_ms, timings_json, pages, quality_score, pipeline_version, ocr_engine, classifier, vlm_used, vlm_model, vlm_error, prompt_version, input_tokens, output_tokens, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(), scanId, userId, outcome, result?.classification.decision ?? null, result?.overallReview ?? null, errorCode, totalMs,
        result ? JSON.stringify(result.meta.timingsMs) : null, result?.meta.pages ?? null, result?.quality.score ?? null, result?.meta.pipelineVersion ?? null,
        result?.meta.ocrEngine ?? null, result?.meta.classifier ?? null, vlm?.used ? 1 : 0, vlm?.model ?? null, vlm?.error ?? null, vlm?.promptVersion ?? null,
        vlm?.inputTokens ?? null, vlm?.outputTokens ?? null, vlm?.estimatedCostUsd ?? null, nowIso(),
      );
  }
}
