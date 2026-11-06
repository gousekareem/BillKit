/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Image storage on the server's local disk. Paths are built exclusively from
 * server-generated UUIDs (never from client file names), so path traversal is
 * not possible. Files are served only through authenticated, ownership-checked
 * routes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class Storage {
  constructor(private readonly root: string) {}

  relPath(userId: string, scanId: string, name: string): string {
    if (!UUID.test(userId) || !UUID.test(scanId) || !/^[a-z0-9-]+\.(png|jpg|webp|heic|pdf)$/.test(name)) throw new Error('Invalid storage path');
    return path.join(userId, scanId, name);
  }

  abs(rel: string): string {
    const full = path.resolve(this.root, rel);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Path escapes storage root');
    return full;
  }

  async write(rel: string, data: Buffer): Promise<void> {
    const full = this.abs(rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data, { mode: 0o600 });
  }

  async read(rel: string): Promise<Buffer> {
    return fs.readFile(this.abs(rel));
  }

  async remove(rel: string): Promise<void> {
    await fs.rm(this.abs(rel), { force: true });
  }

  async removeScanDir(userId: string, scanId: string): Promise<void> {
    if (!UUID.test(userId) || !UUID.test(scanId)) return;
    await fs.rm(this.abs(path.join(userId, scanId, 'x')).replace(/[/\\]x$/, ''), { recursive: true, force: true });
  }

  async removeUserDir(userId: string): Promise<void> {
    if (!UUID.test(userId)) return;
    await fs.rm(path.resolve(this.root, userId), { recursive: true, force: true });
  }
}
