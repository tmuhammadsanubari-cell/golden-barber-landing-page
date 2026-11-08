// Pengguna admin (PRD F-22) dengan akun sungguhan. TIDAK ada email undangan yang terkirim: undangan
// di UI di-mock lewat page.route, dan undangan sungguhan hanya diuji ke email yang sudah terdaftar
// (ditolak server sebelum menghubungi Supabase). Akun Super Admin asli tidak diubah. Akun Editor uji
// dibuat lewat service role, satu per project, dan dihapus di akhir.
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { ORIGIN, adminEmail, e2eEnabled, hydrated, loginCached, service } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const project = () => test.info().project.name;
const isMobile = () => project() === 'mobile';
const editorEmail = (name: string) => `uji-e2e-${RUN}-${name}@example.com`;
const EDITOR_PASSWORD = `Uji-${RUN}-Aa1!x`;
const createdIds: string[] = [];

async function createEditor(address: string, fullName: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email: address,
    password: EDITOR_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  createdIds.push(data.user.id);
  const { error: profileError } = await service
    .from('admin_profiles')
    .insert({ id: data.user.id, email: address, full_name: fullName, role: 'editor', is_active: true });
  if (profileError) throw profileError;
  return data.user.id;
}

async function loginAs(page: Page, address: string) {
  const res = await page.request.post('/api/auth/login', {
    data: { email: address, password: EDITOR_PASSWORD, remember: true },
    headers: { Origin: ORIGIN },
  });
  expect(res.status()).toBe(200);
}

const profile = async (id: string) => {
  const { data, error } = await service.from('admin_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

test.afterAll(async () => {
  if (!e2eEnabled) return;
  for (const id of createdIds) await service.auth.admin.deleteUser(id);
  await service.from('admin_profiles').delete().like('email', `uji-e2e-${RUN}-%`);
});

// ---------------------------------------------------------------------------------------------
// Editor tidak punya akses (DoD M3)
// ---------------------------------------------------------------------------------------------

test.describe('Editor: tanpa akses ke pengguna admin', () => {
  let id = '';
  let address = '';

  test.beforeAll(async () => {
    address = editorEmail(`editor-${project()}`);
    id = await createEditor(address, `UJI-E2E Editor ${project()}`);
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, address);
  });

  test('/admin/pengguna → 403; API pengguna → 403; menu Pengguna tidak ada', async ({ page }) => {
    const res = await page.goto('/admin/pengguna');
    expect(res!.status()).toBe(403);
    await expect(page.getByRole('heading', { name: '403 — Akses ditolak' })).toBeVisible();

    expect((await page.request.get('/api/admin/users')).status()).toBe(403);
    const invite = await page.request.post('/api/admin/users/invite', {
      data: { email: editorEmail('x'), full_name: 'Tidak Boleh', role: 'editor' },
      headers: { Origin: ORIGIN },
    });
    expect(invite.status()).toBe(403);
    expect((await invite.json()).error.code).toBe('FORBIDDEN');
    const patch = await page.request.patch(`/api/admin/users/${id}`, {
      data: { role: 'super_admin' },
      headers: { Origin: ORIGIN },
    });
    expect(patch.status()).toBe(403);
    expect((await profile(id))!.role).toBe('editor');

    await page.goto('/admin/cabang');
    await expect(page.getByRole('heading', { level: 1, name: 'Cabang' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menu admin' }).getByRole('link', { name: 'Pengguna' })).toHaveCount(0);
  });

  test('Editor dinonaktifkan: request berikutnya langsung ditolak', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect((await page.request.get('/api/admin/branches')).status()).toBe(200);

    await service.from('admin_profiles').update({ is_active: false }).eq('id', id);
    try {
      expect((await page.request.get('/api/admin/branches')).status()).toBe(403);
      const res = await page.goto('/admin');
      expect(res!.status()).toBe(403);
    } finally {
      await service.from('admin_profiles').update({ is_active: true }).eq('id', id);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Super Admin
// ---------------------------------------------------------------------------------------------

test.describe('Super Admin: daftar dan undangan', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
    await page.goto('/admin/pengguna');
    await hydrated(page);
  });

  test('judul, ringkasan, akun sendiri bertanda "Anda" dengan kontrol nonaktif', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Pengguna Admin' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pengguna', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-count-summary]')).toContainText(/\d+ admin · \d+ aktif · \d+ Super Admin aktif/);
    const own = page.locator(`[data-email="${adminEmail!.toLowerCase()}"]`);
    await expect(own).toBeVisible();
    await expect(own.getByText('Anda', { exact: true })).toBeVisible();
    await expect(own.getByRole('combobox')).toBeDisabled();
    await expect(own.getByRole('switch')).toBeDisabled();
  });

  test('tap target ≥ 44px dan tanpa scroll horizontal', async ({ page }) => {
    const row = page.locator('[data-user-id]').first();
    expect((await row.getByRole('combobox').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await row.getByRole('switch').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole('button', { name: 'Undang Admin' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('undang: validasi per field; permintaan memakai email huruf kecil; baris baru muncul (di-mock)', async ({
    page,
  }) => {
    let body: Record<string, unknown> | null = null;
    await page.route('**/api/admin/users/invite', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: '11111111-1111-4111-8111-111111111111',
            email: (body as { email: string }).email,
            full_name: (body as { full_name: string }).full_name,
            role: 'editor',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.getByRole('button', { name: 'Undang Admin' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Kirim Undangan' }).click();
    await expect(dialog.getByText('Nama lengkap wajib diisi.')).toBeVisible();
    await expect(dialog.getByText('Email wajib diisi.')).toBeVisible();
    await dialog.getByLabel('Email').fill('bukan-email');
    await dialog.getByLabel('Nama lengkap').fill('Staf Uji');
    await dialog.getByRole('button', { name: 'Kirim Undangan' }).click();
    await expect(dialog.getByText('Format email tidak valid.')).toBeVisible();
    expect(body).toBeNull();

    await dialog.getByLabel('Email').fill('Staf.Uji@Contoh.COM');
    await dialog.getByRole('button', { name: 'Kirim Undangan' }).click();
    await expect(dialog).toBeHidden();
    expect(body).toEqual({ email: 'staf.uji@contoh.com', full_name: 'Staf Uji', role: 'editor' });
    await expect(page.getByText('Undangan dikirim ke staf.uji@contoh.com')).toBeVisible();
    await expect(page.locator('[data-email="staf.uji@contoh.com"]')).toBeVisible();
  });

  test('undang email yang sudah terdaftar ditolak server (tanpa mengirim email)', async ({ page }) => {
    await page.getByRole('button', { name: 'Undang Admin' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nama lengkap').fill('Nama Lain');
    await dialog.getByLabel('Email').fill(adminEmail!);
    await dialog.getByRole('button', { name: 'Kirim Undangan' }).click();
    await expect(dialog.getByText('Email sudah terdaftar.')).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Batal' }).click();
  });

  test('Super Admin terakhir tidak bisa dinonaktifkan atau diturunkan lewat API (409)', async ({ page }) => {
    const { data } = await service.from('admin_profiles').select('id, role, is_active');
    const actives = (data ?? []).filter((row) => row.role === 'super_admin' && row.is_active);
    // Pengaman: bila ada Super Admin aktif lain, permintaan ini akan benar-benar mengubah akun asli.
    test.skip(actives.length !== 1, 'Lebih dari satu Super Admin aktif');
    const own = actives[0]!.id;
    for (const patch of [{ is_active: false }, { role: 'editor' }]) {
      const res = await page.request.patch(`/api/admin/users/${own}`, {
        data: patch,
        headers: { Origin: ORIGIN },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).error.message).toContain('minimal satu Super Admin aktif');
    }
    expect(await profile(own)).toMatchObject({ role: 'super_admin', is_active: true });
  });

  test('API: body kosong, field asing, peran salah, dan id sembarang ditolak', async ({ page }) => {
    const headers = { Origin: ORIGIN };
    const id = '00000000-0000-4000-8000-000000000000';
    expect((await page.request.patch(`/api/admin/users/${id}`, { data: {}, headers })).status()).toBe(400);
    expect((await page.request.patch(`/api/admin/users/${id}`, { data: { email: 'x@y.com' }, headers })).status()).toBe(400);
    expect((await page.request.patch(`/api/admin/users/${id}`, { data: { role: 'owner' }, headers })).status()).toBe(400);
    expect((await page.request.patch(`/api/admin/users/${id}`, { data: { is_active: false }, headers })).status()).toBe(404);
    expect((await page.request.patch('/api/admin/users/bukan-uuid', { data: { is_active: false }, headers })).status()).toBe(404);
    expect((await page.request.post('/api/admin/users/invite', { data: {}, headers })).status()).toBe(400);
  });
});

test.describe.serial('Super Admin: ubah peran dan akses akun Editor (desktop)', () => {
  let id = '';
  let address = '';

  test.beforeAll(async () => {
    if (isMobile()) return;
    address = editorEmail('kelola');
    id = await createEditor(address, 'UJI-E2E Kelola');
  });

  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(), 'Data bersama: hanya desktop');
    await loginCached(page);
    await page.goto('/admin/pengguna');
    await hydrated(page);
  });

  const row = (page: Page) => page.locator(`[data-user-id="${id}"]`);

  test('ubah peran: tersimpan di database; kembali ke Editor', async ({ page }) => {
    await row(page).getByRole('combobox').selectOption('super_admin');
    await expect.poll(async () => (await profile(id))!.role).toBe('super_admin');
    await expect(page.getByText(/menjadi Super Admin/)).toBeVisible();
    await row(page).getByRole('combobox').selectOption('editor');
    await expect.poll(async () => (await profile(id))!.role).toBe('editor');
  });

  test('nonaktifkan: konfirmasi, Editor kehilangan akses; aktifkan kembali memulihkan', async ({ page, browser }) => {
    // Sesi Editor yang sedang berjalan di konteks lain.
    const editorContext = await browser.newContext({ baseURL: ORIGIN });
    const editorPage = await editorContext.newPage();
    await loginAs(editorPage, address);
    expect((await editorPage.request.get('/api/admin/branches')).status()).toBe(200);

    await row(page).getByRole('switch').click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toContainText('langsung tidak bisa masuk');
    await dialog.getByRole('button', { name: 'Nonaktifkan' }).click();
    await expect.poll(async () => (await profile(id))!.is_active).toBe(false);
    await expect(row(page).getByText('Nonaktif', { exact: true }).first()).toBeVisible();

    // Request berikutnya dari sesi Editor ditolak tanpa login ulang.
    expect((await editorPage.request.get('/api/admin/branches')).status()).toBe(403);

    // Aktifkan kembali (tanpa dialog): Editor bisa masuk lagi.
    await row(page).getByRole('switch').click();
    await expect.poll(async () => (await profile(id))!.is_active).toBe(true);
    const fresh = await browser.newContext({ baseURL: ORIGIN });
    const freshPage = await fresh.newPage();
    await loginAs(freshPage, address);
    expect((await freshPage.request.get('/api/admin/branches')).status()).toBe(200);
    await editorContext.close();
    await fresh.close();
  });

  test('batal menonaktifkan tidak mengubah apa pun', async ({ page }) => {
    await row(page).getByRole('switch').click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await dialog.getByRole('button', { name: 'Batal' }).click();
    expect((await profile(id))!.is_active).toBe(true);
    await expect(row(page).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

// ---------------------------------------------------------------------------------------------
// Tautan undangan (token di fragmen URL)
// ---------------------------------------------------------------------------------------------

test.describe('Tautan undangan membawa token di fragmen URL', () => {
  test('token valid: sesi dibuat dan form password muncul; token palsu: "Tautan tidak berlaku"', async ({
    page,
  }) => {
    test.skip(isMobile(), 'Memakai satu akun uji; cukup di desktop');
    const address = editorEmail('undangan');
    await createEditor(address, 'UJI-E2E Undangan');
    const client = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: address, password: EDITOR_PASSWORD });
    expect(error).toBeNull();

    await page.goto(
      `/admin/reset-password#access_token=${data.session!.access_token}&refresh_token=${data.session!.refresh_token}&type=invite`,
    );
    await expect(page.getByRole('heading', { name: 'Atur password baru' })).toBeVisible({ timeout: 20_000 });
    // Token tidak tertinggal di URL.
    expect(page.url()).not.toContain('access_token');

    const fresh = await page.context().browser()!.newContext({ baseURL: ORIGIN });
    const other = await fresh.newPage();
    await other.goto('/admin/reset-password#access_token=palsu-palsu-palsu-palsu-palsu&refresh_token=palsu');
    await expect(other.getByRole('heading', { name: 'Tautan tidak berlaku' })).toBeVisible({ timeout: 20_000 });
    expect(other.url()).not.toContain('access_token');
    await fresh.close();
  });

  test('set-session: body tidak valid ditolak', async ({ page }) => {
    const res = await page.request.post('/api/auth/set-session', {
      data: { access_token: 'x' },
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBe(400);
    const bad = await page.request.post('/api/auth/set-session', {
      data: { access_token: 'palsu-palsu-palsu-palsu-palsu', refresh_token: 'palsu' },
      headers: { Origin: ORIGIN },
    });
    expect(bad.status()).toBe(401);
  });
});

test('tanpa login → /admin/pengguna diarahkan ke login; API pengguna ditolak', async ({ page }) => {
  await page.goto('/admin/pengguna');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get('/api/admin/users')).status()).toBe(401);
});
