import { expect, test, type Page } from '@playwright/test';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

const waText = async (page: Page, selector: string) => {
  const href = await page.locator(selector).first().getAttribute('href');
  return decodeURIComponent(href!.split('?text=')[1]!);
};

const pricelist = (page: Page) => page.locator('#harga');
const waitHydrated = (page: Page) =>
  expect(page.locator('#harga astro-island').first()).not.toHaveAttribute('ssr', '');

async function pickBranch(page: Page, slug: string, name: string) {
  await pricelist(page).scrollIntoViewIfNeeded();
  await waitHydrated(page);
  if (isMobile(page)) {
    await page.selectOption('#pricelist-cabang', slug);
  } else {
    await pricelist(page)
      .getByRole('button', { name: new RegExp(`^${name} `) })
      .click();
  }
}

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('tanpa scroll horizontal', async ({ page }) => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('statistik hero menghitung 11 cabang aktif', async ({ page }) => {
    await expect(page.locator('#top dd').first()).toHaveText('11');
  });

  test('link WA umum memakai template site-settings', async ({ page }) => {
    const link = page.locator('a[aria-label="Booking via WhatsApp"]');
    await expect(link).toHaveAttribute('data-wa-context', 'general');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    expect(await waText(page, 'a[aria-label="Booking via WhatsApp"]')).toBe(
      'Halo Golden Barber, saya mau booking potong rambut. Cabang yang tersedia di dekat saya apa saja ya?',
    );
  });

  test('tab wilayah: default Bandung Raya, pindah ke Jabodetabek', async ({ page }) => {
    const panel = page.locator('#cabang [role="tabpanel"]:visible');
    await expect(panel.locator('article')).toHaveCount(7);
    await page.getByRole('tab', { name: 'Jabodetabek (4)' }).click();
    await expect(panel.locator('article')).toHaveCount(4);
    await expect(panel.getByText('Alamat lengkap: tanyakan via WhatsApp')).toBeVisible();
  });

  test('link WA cabang Dago', async ({ page }) => {
    expect(await waText(page, 'a[aria-label="Booking WA cabang Dago"]')).toBe(
      'Halo Golden Barber Dago, saya mau booking potong rambut. Apakah ada slot hari ini?',
    );
  });

  test('barber Aditia Dipatiukur: harga coret & pesan WA', async ({ page }) => {
    await pricelist(page).scrollIntoViewIfNeeded();
    await waitHydrated(page);
    const link = page.locator('#harga a[aria-label="Booking Aditia via WhatsApp"]:visible');
    await expect(link).toHaveAttribute('data-branch', 'dipatiukur');
    expect(await waText(page, '#harga a[aria-label="Booking Aditia via WhatsApp"]:visible')).toBe(
      'Halo Golden Barber Dipatiukur, saya mau booking Haircut Reguler dengan barber Aditia (130K). Kapan slot yang tersedia?',
    );
    await expect(pricelist(page).locator('s:visible').first()).toContainText('150K');
    await expect(
      pricelist(page).getByLabel('Rp130.000').locator('visible=true').first(),
    ).toBeVisible();
  });

  test('pilih cabang: tabel berubah, URL & layanan ikut', async ({ page }) => {
    await pickBranch(page, 'dago', 'Dago');
    await expect(page).toHaveURL(/\?cabang=dago#harga$/);
    await expect(page.locator('#harga [role="table"]:visible').first()).toHaveAttribute(
      'aria-label',
      /Dago/,
    );
    await expect(page.locator('#harga [data-branch="dago"]:visible').first()).toBeVisible();

    await page.locator('#layanan').scrollIntoViewIfNeeded();
    await expect(page.locator('#layanan a[data-branch="dago"]').first()).toBeVisible();
  });

  test('Citra Raya: state kosong + pesan pricelist', async ({ page }) => {
    await pickBranch(page, 'citra-raya', 'Citra Raya');
    await expect(pricelist(page).getByText('Pricelist cabang ini segera hadir')).toBeVisible();
    const link = pricelist(page).getByRole('link', { name: 'Tanya Harga via WhatsApp' });
    await expect(link).toHaveAttribute('data-wa-context', 'branch');
    const href = await link.getAttribute('href');
    expect(decodeURIComponent(href!.split('?text=')[1]!)).toBe(
      'Halo Golden Barber Citra Raya, boleh minta info pricelist dan alamat lengkap cabang ini?',
    );
    await page.locator('#layanan').scrollIntoViewIfNeeded();
    await expect(page.getByText('Layanan cabang ini segera hadir')).toBeVisible();
  });

  test('status layanan: Graha Raya Segera Hadir tanpa tombol tanya, unavailable hilang', async ({
    page,
  }) => {
    await pickBranch(page, 'graha-raya', 'Graha Raya');
    const layanan = page.locator('#layanan');
    await layanan.scrollIntoViewIfNeeded();
    const peek = layanan.locator('.it', { hasText: 'Peek A Boo' });
    await expect(peek.getByText('Segera Hadir')).toBeVisible();
    await expect(peek.getByRole('link')).toHaveCount(0);
    await expect(layanan.getByText('Cornrow')).toHaveCount(0);
    await expect(layanan.locator('.it', { hasText: 'Trim' }).getByRole('link')).toHaveCount(1);
  });

  test('tombol Lihat Harga memilih cabang', async ({ page }) => {
    await page.getByRole('link', { name: 'Lihat harga cabang Dago' }).click();
    await expect(page).toHaveURL(/\?cabang=dago#harga$/);
    await waitHydrated(page);
    await expect(page.locator('#harga [role="table"]:visible').first()).toHaveAttribute(
      'aria-label',
      /Dago/,
    );
  });

  test('galeri: lightbox tutup dengan Esc, panah pindah foto', async ({ page }) => {
    await page.getByRole('button', { name: 'Perbesar foto French Crop' }).click();
    const dialog = page.locator('#lightbox');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#lightbox-title')).toHaveText('French Crop');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('#lightbox-title')).toHaveText('Two Block');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('FAQ: hanya aktif, JSON-LD cocok', async ({ page }) => {
    await expect(page.locator('#faq details')).toHaveCount(6);
    const firstAnswer = page.getByText('Semua cabang buka setiap hari pukul 08.00–23.00 WIB.');
    await expect(firstAnswer).toBeVisible();
    await page.locator('#faq summary').first().click();
    await expect(firstAnswer).toBeHidden();
    const faqPages = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => JSON.parse(node.textContent!))
          .filter((ld) => ld['@type'] === 'FAQPage'),
      );
    expect(faqPages).toHaveLength(1);
    expect(faqPages[0].mainEntity).toHaveLength(6);
  });

  test('form Academy: error per field, lalu sukses + lanjut WA', async ({ page }) => {
    const academy = page.locator('#academy');
    await academy.scrollIntoViewIfNeeded();
    await expect(academy.locator('astro-island')).not.toHaveAttribute('ssr', '');
    await academy.getByRole('button', { name: 'Kirim Minat' }).click();
    await expect(academy.getByText('Nama minimal 2 karakter.')).toBeVisible();
    await expect(academy.getByText('Centang persetujuan untuk melanjutkan.')).toBeVisible();

    await academy.getByLabel('Nama lengkap').fill('Budi Santoso');
    await academy.getByLabel('Nomor WhatsApp').fill('0812-3456-7890');
    await academy.getByLabel('Kota domisili').fill('Bandung');
    await academy.getByLabel(/Saya setuju/).check();
    await academy.getByRole('button', { name: 'Kirim Minat' }).click();

    await expect(academy.getByText('Terima kasih, minatmu sudah kami terima!')).toBeVisible();
    const link = academy.getByRole('link', { name: 'Lanjutkan via WhatsApp' });
    await expect(link).toHaveAttribute('data-wa-context', 'academy');
    const href = await link.getAttribute('href');
    expect(decodeURIComponent(href!)).toContain('saya Budi Santoso baru saja mengisi form minat');
  });

  test('form Kemitraan: sukses + lanjut WA', async ({ page }) => {
    const section = page.locator('#kemitraan');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('astro-island')).not.toHaveAttribute('ssr', '');
    await section.getByLabel('Nama', { exact: true }).fill('Ani');
    await section.getByLabel('Nomor WhatsApp').fill('081234567890');
    await section.getByLabel('Kota rencana lokasi').fill('Bogor');
    await section.getByLabel(/Saya setuju/).check();
    await section.getByRole('button', { name: 'Kirim Minat Kemitraan' }).click();
    const link = section.getByRole('link', { name: 'Lanjutkan via WhatsApp' });
    await expect(link).toHaveAttribute('data-wa-context', 'partnership');
  });
});

test('tautan langsung ?cabang= membuka cabang tersebut', async ({ page }) => {
  await page.goto('/?cabang=karawaci#harga');
  await waitHydrated(page);
  await expect(page.locator('#harga [role="table"]:visible').first()).toHaveAttribute(
    'aria-label',
    /Karawaci/,
  );
});

test('?cabang= tak dikenal jatuh ke Dipatiukur', async ({ page }) => {
  await page.goto('/?cabang=ngawur#harga');
  await waitHydrated(page);
  await expect(page.locator('#harga [role="table"]:visible').first()).toHaveAttribute(
    'aria-label',
    /Dipatiukur/,
  );
});

test('drawer mobile: buka, Esc, klik menu menutup', async ({ page }) => {
  test.skip(!isMobile(page), 'hanya mobile');
  await page.goto('/');
  const drawer = page.locator('#drawer');
  await page.getByRole('button', { name: 'Buka menu' }).click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Buka menu' }).click();
  await drawer.getByRole('link', { name: 'Galeri' }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/#galeri$/);
});

test('360px: tombol melayang ada label & tanpa scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.locator('a[aria-label="Booking via WhatsApp"]')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
