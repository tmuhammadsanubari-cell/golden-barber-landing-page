import { expect, test } from '@playwright/test';

test.describe('halaman cabang (F-13)', () => {
  test('Dago: judul, JSON-LD HairSalon, pricelist dan layanan statis', async ({ page }) => {
    await page.goto('/cabang/dago/');
    await expect(page).toHaveTitle('Golden Barber Dago — Barbershop di Jl. Ir. H. Juanda');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dago');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/cabang\/dago\/$/,
    );

    const ld = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent())!,
    );
    expect(ld['@type']).toBe('HairSalon');
    expect(ld.name).toBe('Golden Barber Dago');

    const table = page.locator('#harga [role="table"]:visible').first();
    await expect(table).toHaveAttribute('aria-label', 'Pricelist Dago');
    await expect(table.locator('[role="row"]')).toHaveCount(10); // header + 9 barber
    await expect(page.getByText('Semua layanan tersedia di Dago')).toBeVisible();
  });

  test('tautan WhatsApp memakai konteks dan cabang yang benar', async ({ page }) => {
    await page.goto('/cabang/dago/');
    const link = page.locator('#harga a[aria-label="Booking Prayoga via WhatsApp"]:visible');
    await expect(link).toHaveAttribute('data-wa-context', 'barber');
    await expect(link).toHaveAttribute('data-branch', 'dago');
  });

  test('Citra Raya: pricelist kosong, alamat belum lengkap', async ({ page }) => {
    await page.goto('/cabang/citra-raya/');
    await expect(page.getByText('Pricelist cabang ini segera hadir')).toBeVisible();
    await expect(page.getByText('Alamat lengkap: tanyakan via WhatsApp').first()).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).not.toContainText(
      'priceRange',
    );
  });

  test('peta tanpa embed: tombol Google Maps, tanpa iframe', async ({ page }) => {
    await page.goto('/cabang/dago/');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Buka di Google Maps' }).first()).toBeVisible();
  });

  test('cabang lain di wilayah sama, tanpa cabang ini', async ({ page }) => {
    await page.goto('/cabang/dago/');
    const section = page.locator('section[aria-labelledby="lain-h"]');
    await expect(section.locator('article')).toHaveCount(6);
    await expect(section.getByRole('link', { name: 'Lihat Cabang' }).first()).toHaveAttribute(
      'href',
      /^\/cabang\//,
    );
    await expect(section.locator('a[href="/cabang/dago"]')).toHaveCount(0);
  });

  test('tanpa JS island: halaman cabang tidak memuat React', async ({ page }) => {
    await page.goto('/cabang/dago/');
    await expect(page.locator('astro-island')).toHaveCount(0);
  });

  test('tidak ada overflow horizontal', async ({ page }) => {
    await page.goto('/cabang/pasgar-tki-2/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);
  });
});

test('404: halaman brand, noindex, tautan ke daftar cabang', async ({ page }) => {
  const response = await page.goto('/halaman-ngawur');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Halaman tidak ditemukan');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('link', { name: 'Lihat Semua Cabang' })).toHaveAttribute(
    'href',
    '/#cabang',
  );
});

test('kebijakan privasi dapat dibuka dari footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Kebijakan Privasi' }).click();
  await expect(page).toHaveURL(/\/kebijakan-privasi\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kebijakan Privasi');
});

test('beranda: Detail Cabang menuju halaman cabang & JSON-LD Organization + FAQ', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Detail cabang Dago' })).toHaveAttribute(
    'href',
    '/cabang/dago',
  );
  const types = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent!)['@type']));
  expect(types).toEqual(['Organization', 'FAQPage']);
});
