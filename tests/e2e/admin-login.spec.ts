import { expect, test, type Page } from '@playwright/test';

// Island React dengan client:load baru interaktif setelah hidrasi selesai.
const waitHydrated = (page: Page) =>
  page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);

test.describe('halaman login admin', () => {
  test('tanpa sesi: /admin → login, form tampil, tidak diindeks', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Masuk ke Panel Admin');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });

  test('validasi sisi klien: pesan per field berbahasa Indonesia', async ({ page }) => {
    await page.goto('/admin/login');
    await waitHydrated(page);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByText('Email wajib diisi.')).toBeVisible();
    await expect(page.getByText('Password wajib diisi.')).toBeVisible();
    await page.getByLabel('Email').fill('bukan-email');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByText('Format email tidak valid.')).toBeVisible();
  });

  test('tampilkan/sembunyikan password', async ({ page }) => {
    await page.goto('/admin/login');
    await waitHydrated(page);
    const password = page.locator('#lg-pw');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Tampilkan password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Sembunyikan password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('lupa password: form, validasi, lalu konfirmasi netral', async ({ page }) => {
    await page.goto('/admin/login');
    await waitHydrated(page);
    await page.getByRole('button', { name: 'Lupa password?' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lupa password');
    await page.getByRole('button', { name: 'Kirim tautan reset' }).click();
    await expect(page.getByText('Email wajib diisi.')).toBeVisible();
    await page.getByRole('button', { name: 'Kembali', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Masuk ke Panel Admin');
  });

  test('reset-password tanpa sesi: tautan tidak berlaku', async ({ page }) => {
    await page.goto('/admin/reset-password');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tautan tidak berlaku');
    await expect(page.getByRole('link', { name: 'Ke halaman masuk' })).toHaveAttribute(
      'href',
      '/admin/login',
    );
  });

  test('tap target ≥ 44px dan tanpa scroll horizontal', async ({ page }) => {
    await page.goto('/admin/login');
    await waitHydrated(page);
    for (const locator of [
      page.getByRole('button', { name: 'Masuk', exact: true }),
      page.getByRole('button', { name: 'Lupa password?' }),
      page.getByRole('button', { name: 'Tampilkan password' }),
      page.locator('input[type="checkbox"]').locator('xpath=ancestor::label'),
    ]) {
      const box = await locator.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);
  });
});

// Alur dengan akun sungguhan. Lewati bila E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tidak diset.
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('login sungguhan', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD belum diset');

  test('login → dashboard → keluar → /admin kembali ke login', async ({ page }) => {
    await page.goto('/admin/login?redirect=/admin');
    await waitHydrated(page);
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: /Keluar/ }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin$/);
  });

  test('password salah: pesan generik', async ({ page }) => {
    await page.goto('/admin/login');
    await waitHydrated(page);
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill('password-yang-salah-123');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Email atau password salah.');
  });
});
