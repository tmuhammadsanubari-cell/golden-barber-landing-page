// PublishBar + riwayat publikasi (PRD F-20). Deploy Hook TIDAK pernah dipanggil sungguhan:
// POST /api/admin/publish dan status di-mock lewat page.route (fetch dari browser). Logika server
// (kunci 60 detik, publish_logs, hook gagal) diuji di tests/integration/admin-publish.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { e2eEnabled, hydrated, loginCached } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const STATUS_URL = '**/api/admin/publish/status';
const PUBLISH_URL = '**/api/admin/publish';

const statusBody = (over: Record<string, unknown>) =>
  JSON.stringify({
    success: true,
    data: {
      has_unpublished_changes: false,
      pending_count: 0,
      last_success_at: null,
      cooldown_seconds_left: 0,
      ...over,
    },
  });

async function mockStatus(page: Page, over: Record<string, unknown>) {
  await page.route(STATUS_URL, (route) =>
    route.fulfill({ contentType: 'application/json', body: statusBody(over) }),
  );
  // Segarkan status lewat jalur yang sama dengan perubahan konten sungguhan.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('admin:content-changed')));
}

const bar = (page: Page) => page.locator('[data-publishbar]');

test.describe('PublishBar', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('tampil di setiap layar admin, bersama tautan riwayat atau perubahan', async ({ page }) => {
    for (const path of ['/admin', '/admin/cabang', '/admin/barber', '/admin/layanan', '/admin/leads']) {
      await page.goto(path);
      await expect(bar(page)).toBeVisible();
      await expect(bar(page).getByRole('status')).toContainText(
        /Semua perubahan sudah tayang|perubahan belum dipublikasikan/,
      );
    }
  });

  test('belum dipublikasikan → Publikasikan → memproses → toast sukses → terkunci', async ({
    page,
  }) => {
    await page.goto('/admin/cabang');
    await hydrated(page);

    await mockStatus(page, { has_unpublished_changes: true, pending_count: 3 });
    await expect(bar(page)).toContainText('Ada 3 perubahan belum dipublikasikan');
    const button = bar(page).getByRole('button', { name: 'Publikasikan', exact: true });
    await expect(button).toBeEnabled();

    // POST ditahan sebentar supaya state "memproses" terlihat.
    let releasePost: () => void = () => {};
    const gate = new Promise<void>((resolve) => (releasePost = resolve));
    await page.route(PUBLISH_URL, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await gate;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { status: 'triggered', created_at: new Date().toISOString(), cooldown_seconds: 60 },
        }),
      });
    });
    // Setelah publikasi: server melaporkan kunci 60 detik.
    await page.route(STATUS_URL, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: statusBody({
          has_unpublished_changes: true,
          pending_count: 3,
          cooldown_seconds_left: 60,
        }),
      }),
    );

    await button.click();
    await expect(bar(page)).toContainText('Memublikasikan 3 perubahan');
    await expect(bar(page).getByRole('button', { name: 'Memproses…' })).toBeDisabled();
    releasePost();

    await expect(page.getByText('Publikasi dipicu')).toBeVisible();
    await expect(bar(page).getByRole('button', { name: /^Tunggu \d+ dtk$/ })).toBeDisabled();
  });

  test('hook gagal → pesan "Publikasi gagal, coba lagi." dengan tombol Coba lagi', async ({
    page,
  }) => {
    await page.goto('/admin/cabang');
    await hydrated(page);
    await mockStatus(page, { has_unpublished_changes: true, pending_count: 1 });
    await expect(bar(page)).toContainText('Ada 1 perubahan belum dipublikasikan');

    let calls = 0;
    await page.route(PUBLISH_URL, (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      calls += 1;
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'PUBLISH_FAILED', message: 'Publikasi gagal, coba lagi.', details: {} },
        }),
      });
    });

    await bar(page).getByRole('button', { name: 'Publikasikan', exact: true }).click();
    await expect(page.getByText('Publikasi gagal, coba lagi.')).toBeVisible();
    // Tetap "belum dipublikasikan": tombol aktif lagi untuk mencoba ulang.
    await expect(bar(page)).toContainText('Ada 1 perubahan belum dipublikasikan');
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await expect.poll(() => calls).toBe(2);
  });

  test('sudah tayang: tampil waktu publikasi terakhir dan tombol Publikasikan ulang', async ({
    page,
  }) => {
    await page.goto('/admin/cabang');
    await hydrated(page);
    await mockStatus(page, { last_success_at: '2026-11-07T07:05:00Z' });
    await expect(bar(page)).toContainText('Semua perubahan sudah tayang');
    await expect(bar(page)).toContainText('14.05');
    await expect(bar(page).getByRole('link', { name: 'Riwayat publikasi' })).toHaveAttribute(
      'href',
      '/admin/publikasi',
    );
    await expect(bar(page).getByRole('button', { name: 'Publikasikan ulang' })).toBeEnabled();
  });

  test('tombol cukup besar untuk disentuh (≥ 44px)', async ({ page }) => {
    await page.goto('/admin/cabang');
    await hydrated(page);
    await mockStatus(page, { has_unpublished_changes: true, pending_count: 2 });
    const button = bar(page).getByRole('button', { name: 'Publikasikan', exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('halaman /admin/publikasi', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('memuat bagian perubahan dan riwayat; tautan dari PublishBar mengarah ke sini', async ({
    page,
  }) => {
    await page.goto('/admin/publikasi');
    await expect(page.getByRole('heading', { level: 1, name: 'Publikasi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Perubahan belum tayang' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible();
    await expect(page.locator('[data-history-list], [data-history-empty]')).toBeVisible();
  });
});

test('tanpa login → /admin/publikasi dan API publikasi ditolak', async ({ page }) => {
  await page.goto('/admin/publikasi');
  await expect(page).toHaveURL(/\/admin\/login/);
  const status = await page.request.get('/api/admin/publish/status');
  expect(status.status()).toBe(401);
});
