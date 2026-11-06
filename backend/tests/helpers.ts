import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

export async function makeApp(overrides: Record<string, unknown> = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billkit-test-'));
  const config = loadConfig({ APP_ENV: 'test', DATA_DIR: dataDir, PUBLIC_ORIGIN: 'http://localhost:5173' }, overrides);
  const app = await buildApp({ config, logger: false, vlm: null });
  return { app, dataDir };
}

export function multipart(files: Array<{ name: string; data: Buffer; filename?: string; type?: string }>, fields: Record<string, string> = {}) {
  const boundary = `----billkit${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const f of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename ?? 'bill.png'}"\r\nContent-Type: ${f.type ?? 'image/png'}\r\n\r\n`));
    chunks.push(f.data, Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

/** A tiny client that keeps the session cookie and sends the CSRF header like the web app does. */
export class Client {
  cookie = '';
  constructor(private app: FastifyInstance) {}
  async req(method: string, url: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<LightMyRequestResponse> {
    const isBuffer = Buffer.isBuffer(body);
    const res = await this.app.inject({
      method: method as 'GET',
      url,
      payload: body === undefined ? undefined : isBuffer ? (body as Buffer) : JSON.stringify(body),
      headers: {
        ...(body !== undefined && !isBuffer ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'x-billkit-csrf': '1' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...extraHeaders,
      },
    });
    const set = res.headers['set-cookie'];
    const first = Array.isArray(set) ? set[0] : set;
    if (first) this.cookie = first.split(';')[0]!.includes('=;') || /Expires=Thu, 01 Jan 1970/.test(first) ? '' : first.split(';')[0]!;
    return res;
  }
  get = (url: string) => this.req('GET', url);
  post = (url: string, body?: unknown) => this.req('POST', url, body ?? {});
  put = (url: string, body?: unknown) => this.req('PUT', url, body ?? {});
  del = (url: string, body?: unknown) => this.req('DELETE', url, body);
  async upload(files: Buffer[], options?: object) {
    const mp = multipart(files.map((data) => ({ name: 'files', data })), options ? { options: JSON.stringify(options) } : {});
    return this.req('POST', '/api/scans', mp.payload, mp.headers);
  }
  async waitForScan(id: string, timeoutMs = 60_000) {
    const start = Date.now();
    for (;;) {
      const r = await this.get(`/api/scans/${id}`);
      const j = r.json();
      if (!['queued', 'processing'].includes(j.status)) return j;
      if (Date.now() - start > timeoutMs) throw new Error('scan timeout');
      await new Promise((res) => setTimeout(res, 150));
    }
  }
}
