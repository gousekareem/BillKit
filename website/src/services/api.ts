/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Typed API client. Same-origin cookies carry the session; the custom
 * X-BillKit-CSRF header is required by the backend for state-changing calls.
 * No secret or AI key ever reaches the browser.
 */
import { offlineCache } from './offline';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly fields?: Array<{ path: string; message: string }>,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.code === 'network';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  signal?: AbortSignal;
  /** Cache successful GET responses in IndexedDB and serve them when offline. */
  offlineKey?: string;
}

export interface CachedMeta {
  fromCache: boolean;
  cachedAt?: string;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown; fields?: Array<{ path: string; message: string }> } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, body.error?.code ?? `http_${res.status}`, body.error?.message ?? `Request failed (${res.status}).`, body.error?.details, body.error?.fields);
}

export async function request<T>(method: Method, url: string, body?: unknown, opts: RequestOptions = {}): Promise<T & { __cache?: CachedMeta }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      signal: opts.signal,
      headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'X-BillKit-CSRF': '1' } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    if (method === 'GET' && opts.offlineKey) {
      const cached = await offlineCache.get<T>(opts.offlineKey);
      if (cached) return { ...cached.value, __cache: { fromCache: true, cachedAt: cached.savedAt } };
    }
    throw new ApiError(0, 'network', 'You appear to be offline or the BillKit server is unreachable.');
  }
  if (!res.ok) throw await parseError(res);
  const data = (res.status === 204 ? {} : await res.json()) as T;
  if (method === 'GET' && opts.offlineKey) void offlineCache.set(opts.offlineKey, data);
  return data as T & { __cache?: CachedMeta };
}

export const api = {
  get: <T>(url: string, opts?: RequestOptions) => request<T>('GET', url, undefined, opts),
  post: <T>(url: string, body: unknown = {}, opts?: RequestOptions) => request<T>('POST', url, body, opts),
  put: <T>(url: string, body: unknown = {}, opts?: RequestOptions) => request<T>('PUT', url, body, opts),
  del: <T>(url: string, body?: unknown, opts?: RequestOptions) => request<T>('DELETE', url, body, opts),
};

export interface UploadHandle {
  promise: Promise<{ id: string }>;
  abort: () => void;
}

/** Multipart upload with real progress events and cancellation (XMLHttpRequest supports upload progress). */
export function uploadScan(files: Blob[], options: Record<string, unknown>, onProgress: (fraction: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ id: string }>((resolve, reject) => {
    const form = new FormData();
    form.append('options', JSON.stringify(options));
    files.forEach((f, i) => form.append('files', f, (f as File).name ?? `page-${i + 1}`));
    xhr.open('POST', '/api/scans');
    xhr.setRequestHeader('X-BillKit-CSRF', '1');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as { id: string });
      else {
        const b = (xhr.response ?? {}) as { error?: { code?: string; message?: string } };
        reject(new ApiError(xhr.status, b.error?.code ?? `http_${xhr.status}`, b.error?.message ?? 'Upload failed.'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Upload failed — check your connection.'));
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Upload cancelled.'));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
