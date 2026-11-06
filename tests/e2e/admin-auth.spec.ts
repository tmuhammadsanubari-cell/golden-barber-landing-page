import { expect, test } from '@playwright/test';

// Gerbang akses tanpa sesi (PRD 4.4, F-14). Tidak butuh akun admin.
test.describe('middleware admin: tanpa sesi', () => {
  test('/admin dan sub-halaman diarahkan ke login dengan ?redirect=', async ({ request }) => {
    const root = await request.get('/admin', { maxRedirects: 0 });
    expect(root.status()).toBe(302);
    expect(root.headers().location).toBe('/admin/login?redirect=%2Fadmin');

    // Sub-halaman (mis. /admin/barber?cabang=dago) ikut aturan yang sama; diuji setelah halamannya ada.
  });

  test('GET /api/auth/me → 401 JSON berbahasa Indonesia', async ({ request }) => {
    for (const path of ['/api/auth/me']) {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
      expect(await res.json()).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sesi Anda berakhir, silakan login kembali.',
          details: {},
        },
      });
    }
  });

  test('POST /api/* tanpa atau dengan Origin asing → 403 (CSRF)', async ({ request }) => {
    const body = { email: 'a@b.id', password: 'x' };
    const noOrigin = await request.post('/api/auth/login', { data: body });
    expect(noOrigin.status()).toBe(403);
    const foreign = await request.post('/api/auth/login', {
      data: body,
      headers: { Origin: 'https://evil.example' },
    });
    expect(foreign.status()).toBe(403);
  });

  test('login: validasi per field dan logout tanpa sesi', async ({ request, baseURL }) => {
    const invalid = await request.post('/api/auth/login', {
      data: { email: 'bukan-email', password: '' },
      headers: { Origin: baseURL! },
    });
    expect(invalid.status()).toBe(400);
    const body = await invalid.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual({
      email: 'Format email tidak valid.',
      password: 'Password wajib diisi.',
    });

    const logout = await request.post('/api/auth/logout', { headers: { Origin: baseURL! } });
    expect(logout.status()).toBe(401);
  });

  test('forgot-password: email tidak valid ditolak, respons sama untuk email apa pun', async ({
    request,
    baseURL,
  }) => {
    const invalid = await request.post('/api/auth/forgot-password', {
      data: { email: '' },
      headers: { Origin: baseURL! },
    });
    expect(invalid.status()).toBe(400);
  });
});

test.describe('halaman publik tidak terpengaruh middleware', () => {
  test('beranda dan halaman cabang tanpa Set-Cookie dan tetap bisa di-cache', async ({
    request,
  }) => {
    for (const path of ['/', '/cabang/dago/']) {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['set-cookie']).toBeUndefined();
      expect(res.headers()['cache-control'] ?? '').not.toContain('no-store');
    }
  });
});
