// callApi: permintaan yang mengubah data selalu membawa Content-Type, juga tanpa body (D-37).
// Tanpa header itu checkOrigin Astro menolak POST/DELETE di Vercel (403 "Cross-site ... forbidden").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callApi } from '@/lib/admin/client';

function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({ success: false, error: { code: 'X', message: 'uji', details: {} } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function headersOf(fetchMock: ReturnType<typeof mockFetch>): Record<string, string> | undefined {
  const init = fetchMock.mock.calls[0]?.[1];
  return init?.headers as Record<string, string> | undefined;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callApi header', () => {
  it.each(['POST', 'DELETE', 'PUT', 'PATCH'] as const)(
    '%s tanpa body tetap mengirim Content-Type JSON',
    async (method) => {
      const fetchMock = mockFetch();
      await callApi(method, '/api/admin/publish');
      expect(headersOf(fetchMock)).toEqual({ 'Content-Type': 'application/json' });
      const init = fetchMock.mock.calls[0]?.[1];
      expect(init?.body).toBeUndefined();
    },
  );

  it('POST dengan body mengirim JSON', async () => {
    const fetchMock = mockFetch();
    await callApi('POST', '/api/admin/faqs', { a: 1 });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(headersOf(fetchMock)).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe('{"a":1}');
  });

  it('GET tidak mengirim Content-Type', async () => {
    const fetchMock = mockFetch();
    await callApi('GET', '/api/admin/publish/status');
    expect(headersOf(fetchMock)).toBeUndefined();
  });
});
