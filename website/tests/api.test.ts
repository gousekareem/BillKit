import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/services/api';
import { offlineCache } from '../src/services/offline';

afterEach(() => vi.restoreAllMocks());

describe('api client', () => {
  it('sends the CSRF header on state-changing requests only', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"ok":true}', { status: 200 }));
    await api.post('/api/x', { a: 1 });
    await api.get('/api/y');
    const post = f.mock.calls[0]![1]!.headers as Record<string, string>;
    const get = f.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(post['X-BillKit-CSRF']).toBe('1');
    expect(get['X-BillKit-CSRF']).toBeUndefined();
    expect(f.mock.calls[0]![1]!.credentials).toBe('same-origin');
  });
  it('turns API errors into typed ApiError with field details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'invalid_input', message: 'Some fields are invalid.', fields: [{ path: 'email', message: 'Bad' }] } }), { status: 400 }));
    await expect(api.post('/api/auth/register', {})).rejects.toMatchObject({ status: 400, code: 'invalid_input', fields: [{ path: 'email', message: 'Bad' }] });
  });
  it('reports network failures distinctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.get('/api/bills').catch((e: ApiError) => e);
    expect((err as ApiError).isNetwork).toBe(true);
  });
  it('serves an offline copy for cached GETs when the network fails', async () => {
    vi.spyOn(offlineCache, 'get').mockResolvedValue({ value: { total: 3 }, savedAt: '2026-11-01T00:00:00Z' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const r = await api.get<{ total: number }>('/api/bills', { offlineKey: 'bills' });
    expect(r.total).toBe(3);
    expect(r.__cache?.fromCache).toBe(true);
  });
});
