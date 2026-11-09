// Navigasi keyboard di halaman publik (NFR-004: semua kontrol bisa diakses keyboard; M4 bagian 1).
// Pelengkap uji manual di perangkat: tes ini memakai keyboard saja, tanpa klik mouse.
import { expect, test, type Page } from '@playwright/test';

const isMobile = () => test.info().project.name === 'mobile';

// Toolbar dev Astro hanya ada di `astro dev` dan ikut urutan Tab; sembunyikan agar tes menilai situs.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar{display:none!important}';
      document.head.append(style);
    });
  });
});

/** Island React (client:visible) baru hidrasi setelah terlihat: gulir dulu, lalu tunggu. */
async function hydrateSection(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await expect(page.locator(`${selector} astro-island`).first()).not.toHaveAttribute('ssr', '');
}

interface FocusStop {
  label: string;
  visible: boolean;
  ring: boolean;
}

/** Tekan Tab berulang dan catat setiap elemen yang menerima fokus. */
async function tabThrough(page: Page, max: number): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(
          el.getAttribute('aria-label') ??
          el.textContent ??
          ''
        )
          .trim()
          .slice(0, 40)}"`,
        // Elemen di luar layar (mis. honeypot) atau sr-only 1px tidak boleh menerima fokus.
        visible:
          rect.width > 1 &&
          rect.height > 1 &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          style.visibility !== 'hidden' &&
          el.closest('[hidden], [aria-hidden="true"]') === null,
        ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
      };
    });
    if (!stop) break; // fokus keluar dari dokumen: urutan Tab selesai
    stops.push(stop);
  }
  return stops;
}

test.describe('navigasi keyboard: beranda', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
  });

  test('Tab menyusuri halaman: setiap fokus terlihat dan bercincin fokus, tanpa jebakan', async ({
    page,
  }) => {
    const stops = await tabThrough(page, 250);
    expect(stops.length).toBeGreaterThan(20);
    // Fokus pertama: logo ke beranda (tidak ada elemen tersembunyi sebelum navigasi).
    expect(stops[0]!.label).toContain('Golden Barber Indonesia');
    expect(stops.filter((s) => !s.visible).map((s) => s.label)).toEqual([]);
    expect(stops.filter((s) => !s.ring).map((s) => s.label)).toEqual([]);
    // Tidak terjebak: Tab tidak berputar di satu kelompok kecil elemen.
    expect(new Set(stops.map((s) => s.label)).size).toBeGreaterThan(20);
  });

  test('tab wilayah: panah kanan/kiri memindah tab dan panel', async ({ page }) => {
    const bandung = page.getByRole('tab', { name: 'Bandung Raya' });
    const jabo = page.getByRole('tab', { name: 'Jabodetabek' });
    await bandung.focus();
    await page.keyboard.press('ArrowRight');
    await expect(jabo).toBeFocused();
    await expect(jabo).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#cabang [role="tabpanel"]:visible')).toContainText('Karawaci');
    await page.keyboard.press('ArrowLeft');
    await expect(bandung).toHaveAttribute('aria-selected', 'true');
  });

  test('pricelist: pilih cabang dengan keyboard, lalu tombol booking bisa difokus', async ({
    page,
  }) => {
    const pricelist = page.locator('#harga');
    await hydrateSection(page, '#harga');
    if (isMobile()) {
      const select = page.locator('#pricelist-cabang');
      await select.focus();
      await page.keyboard.press('ArrowDown'); // Dipatiukur → cabang berikutnya (Dago)
    } else {
      const dago = pricelist.getByRole('button', { name: /^Dago / });
      await dago.focus();
      await page.keyboard.press('Enter');
      await expect(dago).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(pricelist.locator('[role="table"]:visible').first()).toHaveAttribute(
      'aria-label',
      /Dago/,
    );
    const book = pricelist.locator('a[aria-label^="Booking "][data-branch="dago"]:visible').first();
    await book.focus();
    await expect(book).toBeFocused();
  });

  test('FAQ: Enter membuka dan menutup jawaban', async ({ page }) => {
    const second = page.locator('#faq details').nth(1);
    await second.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(second).not.toHaveAttribute('open', '');
  });

  test('galeri: Enter membuka lightbox, panah pindah foto, Esc menutup dan fokus kembali', async ({
    page,
  }) => {
    const opener = page.getByRole('button', { name: 'Perbesar foto French Crop' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('#lightbox');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('#lightbox-title')).toHaveText('Two Block');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('form Academy: diisi dan dikirim hanya dengan keyboard', async ({ page }) => {
    await page.route('**/api/leads', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'x' } }),
      }),
    );
    const academy = page.locator('#academy');
    await hydrateSection(page, '#academy');
    await academy.getByLabel('Nama lengkap').focus();
    await page.keyboard.type('Budi Santoso');
    await academy.getByLabel('Nomor WhatsApp').focus();
    await page.keyboard.type('081234567890');
    await academy.getByLabel('Kota domisili').focus();
    await page.keyboard.type('Bandung');
    await academy.getByLabel(/Saya setuju/).focus();
    await page.keyboard.press('Space');
    await expect(academy.getByLabel(/Saya setuju/)).toBeChecked();
    await academy.getByRole('button', { name: 'Kirim Minat' }).focus();
    await page.keyboard.press('Enter');
    await expect(academy.getByText('Terima kasih, minatmu sudah kami terima!')).toBeVisible();
  });
});

test('drawer mobile: fokus terkunci di dalam menu dan kembali ke tombol saat ditutup', async ({
  page,
}) => {
  test.skip(!isMobile(), 'hanya mobile');
  await page.goto('/');
  const openButton = page.getByRole('button', { name: 'Buka menu' });
  await openButton.focus();
  await page.keyboard.press('Enter');
  const drawer = page.locator('#drawer');
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tutup menu' })).toBeFocused();

  // Tab berkali-kali tetap di dalam drawer.
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#drawer'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('#drawer'))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(openButton).toBeFocused();
});

test('halaman cabang: Tab menyusuri halaman dengan fokus terlihat', async ({ page }) => {
  await page.goto('/cabang/dipatiukur/');
  const stops = await tabThrough(page, 150);
  expect(stops.length).toBeGreaterThan(5);
  expect(stops.filter((s) => !s.visible).map((s) => s.label)).toEqual([]);
  expect(stops.filter((s) => !s.ring).map((s) => s.label)).toEqual([]);
});
