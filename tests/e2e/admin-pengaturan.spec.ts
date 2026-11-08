// Pengaturan Situs (PRD F-21) dengan akun dan database sungguhan. Karena landing e2e membaca
// pengaturan yang sama, satu-satunya penyimpanan nyata memakai Linktree (tidak dirender di situs),
// lalu nilai aslinya dipulihkan lewat service role. Pengujian lain hanya mengubah isian di form
// tanpa menyimpan. Penyimpanan semua kunci diuji di tests/integration/admin-settings.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { ORIGIN, e2eEnabled, hydrated, loginCached, service } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const isMobile = () => test.info().project.name === 'mobile';

const save = (page: Page) => page.getByRole('button', { name: 'Simpan Draf' });
const cancel = (page: Page) => page.getByRole('button', { name: 'Batalkan Perubahan' });
const bar = (page: Page) => page.locator('[data-settings-bar]');

let originalSocial: { value: Record<string, string>; updated_by: string | null } | null = null;
const strayUploads: string[] = [];

const setting = async (key: string) => {
  const { data, error } = await service.from('site_settings').select('*').eq('key', key).single();
  if (error) throw error;
  return data;
};

test.beforeAll(async () => {
  if (!e2eEnabled) return;
  originalSocial = (await setting('social_links')) as typeof originalSocial;
});

test.afterAll(async () => {
  if (!e2eEnabled) return;
  if (originalSocial) {
    await service
      .from('site_settings')
      .update({ value: originalSocial.value, updated_by: originalSocial.updated_by })
      .eq('key', 'social_links');
  }
  if (strayUploads.length > 0) await service.storage.from('media').remove(strayUploads);
});

test.describe('Pengaturan: tampilan dan isian (tanpa menyimpan)', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
    await page.goto('/admin/pengaturan');
    await hydrated(page);
  });

  test('judul, navigasi bagian, dan isian terisi dari database', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Pengaturan Situs' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Bagian pengaturan' });
    for (const name of ['Hero', 'Kontak', 'Template Pesan WA', 'Rating Google', 'Teks Academy & Kemitraan', 'Keunggulan & Termasuk']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    const hero = (await setting('hero')).value as { title: string };
    await expect(page.locator('#s-judul')).toHaveValue(hero.title);
    await expect(page.locator('#s-wa')).toHaveValue('812-1480-7192');
    await expect(page.locator('#s-rv')).toHaveValue('4,9');
    await expect(page.getByRole('link', { name: 'Pengaturan', exact: true })).toHaveAttribute('aria-current', 'page');
    // 7 template, masing-masing dengan pratinjau.
    await expect(page.locator('[data-template]')).toHaveCount(7);
    await expect(page.locator('[data-preview="general"]')).toContainText('Halo Golden Barber');
  });

  test('tanpa perubahan: Simpan dan Batalkan nonaktif, bilah memberi tahu', async ({ page }) => {
    await expect(save(page)).toBeDisabled();
    await expect(cancel(page)).toBeDisabled();
    await expect(bar(page)).toContainText('Tidak ada perubahan');
    await expect(bar(page)).toContainText('disimpan sebagai draf sampai dipublikasikan');
  });

  test('nomor WA: format lain tapi nilai sama = tidak berubah; nomor salah = galat', async ({ page }) => {
    await page.locator('#s-wa').fill('0812 1480 7192');
    await expect(bar(page)).toContainText('Tidak ada perubahan');
    await page.locator('#s-wa').fill('123');
    await expect(page.getByText('Nomor WhatsApp tidak valid. Contoh: 0812-1480-7192.')).toBeVisible();
    await expect(bar(page)).toContainText('1 isian perlu diperbaiki (Kontak)');
    await expect(page.getByRole('navigation', { name: 'Bagian pengaturan' }).getByRole('img', { name: 'ada isian bermasalah' })).toBeVisible();
  });

  test('URL salah (Linktree) ditolak dan Simpan tidak mengirim apa pun', async ({ page }) => {
    let puts = 0;
    await page.route('**/api/admin/settings/**', (route) => {
      if (route.request().method() === 'PUT') puts += 1;
      return route.fallback();
    });
    await page.locator('#s-lt').fill('goldenbarber_id');
    await expect(page.getByText('Masukkan URL lengkap berawalan https://')).toBeVisible();
    await save(page).click();
    await expect(page.getByText('1 isian perlu diperbaiki').first()).toBeVisible();
    expect(puts).toBe(0);
    await page.locator('#s-lt').fill('javascript:alert(1)');
    await expect(page.getByText('Masukkan URL lengkap berawalan https://')).toBeVisible();
    await cancel(page).click();
    await expect(page.locator('#s-lt')).toHaveValue((originalSocial!.value as Record<string, string>).linktree);
  });

  test('pratinjau teks hero tampil sebelum disimpan dan ikut berubah saat mengetik (PRD F-21)', async ({ page }) => {
    const preview = page.locator('[data-hero-preview]');
    await expect(preview).toBeVisible();
    const hero = (await setting('hero')).value as { title: string; subtitle: string };
    await expect(preview.locator('[data-hero-preview-title]')).toContainText('Choose Your Haircut.');
    await expect(preview.locator('[data-hero-preview-accent]')).toHaveText("The Winner's Cut.");
    await expect(preview).toContainText(hero.subtitle);

    await page.locator('#s-judul').fill('Potong Rapi. Pulang Percaya Diri.');
    await page.locator('#s-sub').fill('Subjudul percobaan untuk pratinjau.');
    await expect(preview.locator('[data-hero-preview-accent]')).toHaveText('Pulang Percaya Diri.');
    await expect(preview).toContainText('Subjudul percobaan untuk pratinjau.');
    // Satu kalimat: tidak ada bagian aksen.
    await page.locator('#s-judul').fill('Judul satu kalimat saja');
    await expect(preview.locator('[data-hero-preview-accent]')).toHaveCount(0);
    // Belum tersimpan: database tidak berubah sampai "Simpan Draf".
    expect(((await setting('hero')).value as { title: string }).title).toBe(hero.title);
    await cancel(page).click();
    await expect(preview.locator('[data-hero-preview-accent]')).toHaveText("The Winner's Cut.");
  });

  test('rating: 4,55 dan 6 ditolak, 4,8 diterima', async ({ page }) => {
    await page.locator('#s-rv').fill('4,55');
    await expect(page.getByText('Nilai rating maksimal satu angka desimal.')).toBeVisible();
    await page.locator('#s-rv').fill('6');
    await expect(page.getByText('Nilai rating antara 1 dan 5.')).toBeVisible();
    await page.locator('#s-rv').fill('4,8');
    await expect(page.getByText('Nilai rating antara 1 dan 5.')).toHaveCount(0);
    await expect(bar(page)).toContainText('1 bagian berubah');
    await cancel(page).click();
    await expect(page.locator('#s-rv')).toHaveValue('4,9');
  });

  test('template WA: chip menyisipkan di kursor dan pratinjau ikut; placeholder asing ditolak', async ({ page }) => {
    const barber = page.locator('#tpl-barber');
    await barber.fill('Halo , siap');
    await barber.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
    await page.getByRole('button', { name: 'Sisipkan {nama_barber} ke Booking barber' }).click();
    await expect(barber).toHaveValue('Halo {nama_barber}, siap');
    await expect(page.locator('[data-preview="barber"]')).toContainText('Halo Aditia, siap');

    // Template umum tidak punya data apa pun: tidak ada chip, dan placeholder ditolak.
    await expect(page.locator('[data-template="general"]').getByText('Template ini tidak memakai placeholder.')).toBeVisible();
    await page.locator('#tpl-general').fill('Halo {nama_cabang}');
    await expect(page.getByText(/Placeholder \{nama_cabang\} tidak bisa dipakai di template ini/)).toBeVisible();
    await expect(bar(page)).toContainText('Template Pesan WA');
    await cancel(page).click();
    await expect(page.locator('#tpl-general')).not.toHaveValue('Halo {nama_cabang}');
  });

  test('keunggulan: tambah, pindah, hapus; batas 8 dan minimal 1; batalkan memulihkan', async ({ page }) => {
    const before = await page.locator('[data-highlight]').count();
    await page.getByRole('button', { name: 'Tambah poin' }).click();
    await expect(page.locator('[data-highlight]')).toHaveCount(before + 1);
    // Poin baru kosong: galat judul/deskripsi muncul.
    await expect(page.getByRole('alert').filter({ hasText: /wajib diisi/ }).first()).toBeVisible();
    await expect(save(page)).toBeEnabled();

    const firstTitle = await page.locator('#hl-title-0').inputValue();
    await page.getByRole('button', { name: /^Turunkan poin / }).first().click();
    await expect(page.locator('#hl-title-1')).toHaveValue(firstTitle);

    await page.getByRole('button', { name: /^Hapus poin / }).last().click();
    await expect(page.locator('[data-highlight]')).toHaveCount(before);
    await cancel(page).click();
    await expect(page.locator('#hl-title-0')).toHaveValue(firstTitle);
  });

  test('gambar hero: unggah mengganti pratinjau (belum disimpan), Batalkan memulihkan', async ({ page }) => {
    const before = await page.locator('.st-hero-img img').getAttribute('src');
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.locator('[data-hero-input]').setInputFiles({ name: `hero-${RUN}.png`, mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('[data-hero-path]')).toHaveText(/^[0-9a-f-]{36}\.png$/, { timeout: 20_000 });
    const name = (await page.locator('[data-hero-path]').textContent())!;
    strayUploads.push(`site/${name}`);
    await expect(page.locator('.st-hero-img img')).toHaveAttribute('src', /\/storage\/v1\/object\/public\/media\/site\//);
    await expect(bar(page)).toContainText('1 bagian berubah');
    // Belum disimpan: database masih memakai gambar lama.
    expect(((await setting('hero')).value as { image_path: string }).image_path).not.toContain(name);
    await cancel(page).click();
    await expect(page.locator('.st-hero-img img')).toHaveAttribute('src', before!);
  });

  test('file hero > 3 MB ditolak sebelum dikirim', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/admin/uploads', (route) => {
      calls += 1;
      return route.fallback();
    });
    await page.locator('[data-hero-input]').setInputFiles({
      name: `besar-${RUN}.png`,
      mimeType: 'image/png',
      buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
    });
    await expect(page.getByText('File terlalu besar (3,0 MB)')).toBeVisible();
    expect(calls).toBe(0);
    await expect(bar(page)).toContainText('Tidak ada perubahan');
  });

  test('tap target ≥ 44px, bilah simpan terlihat, tanpa scroll horizontal', async ({ page }) => {
    await page.locator('#s-lt').fill('x');
    await expect(bar(page)).toBeVisible();
    for (const button of [save(page), cancel(page)]) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const chip = await page.getByRole('button', { name: /^Sisipkan \{harga\}/ }).boundingBox();
    expect(chip!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (isMobile()) {
      // Bilah tetap menempel di dasar layar.
      const box = await bar(page).boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 4);
    }
  });
});

test.describe.serial('Pengaturan: simpan sebagai draf (desktop, hanya Linktree)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(), 'Data bersama: hanya desktop');
    await loginCached(page);
    await page.goto('/admin/pengaturan');
    await hydrated(page);
  });

  test('simpan: tersimpan di database, dicatat penulisnya, bilah kembali "Tidak ada perubahan"', async ({ page }) => {
    const url = `https://linktr.ee/uji-e2e-${RUN}`;
    await page.locator('#s-lt').fill(url);
    await expect(bar(page)).toContainText('1 bagian berubah');
    await save(page).click();
    await expect(page.getByText('Pengaturan disimpan sebagai draf')).toBeVisible();
    await expect(bar(page)).toContainText('Tidak ada perubahan');
    await expect.poll(async () => ((await setting('social_links')).value as Record<string, string>).linktree).toBe(url);
    const row = await setting('social_links');
    expect(row.updated_by).not.toBeNull();
    // Bagian lain di baris yang sama tidak berubah.
    expect((row.value as Record<string, string>).instagram).toBe(originalSocial!.value.instagram);
  });

  test('nilai tersimpan tetap setelah muat ulang dan menandai PublishBar "belum dipublikasikan"', async ({ page }) => {
    await expect(page.locator('#s-lt')).toHaveValue(new RegExp(`uji-e2e-${RUN}$`));
    await expect(page.locator('[data-publishbar]')).toContainText(/perubahan belum dipublikasikan/);
  });

  test('batalkan mengembalikan ke nilai tersimpan; server menolak nilai buruk walau lolos klien', async ({ page }) => {
    await page.locator('#s-lt').fill('https://linktr.ee/sementara');
    await cancel(page).click();
    await expect(page.locator('#s-lt')).toHaveValue(new RegExp(`uji-e2e-${RUN}$`));

    // Lewati validasi klien: API menolak sendiri.
    const res = await page.request.put('/api/admin/settings/social_links', {
      data: { value: { instagram: 'javascript:alert(1)', threads: 'x', linktree: '', academy_instagram: 'x' } },
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.details).toHaveProperty('instagram');
    const none = await page.request.put('/api/admin/settings/seo_defaults', {
      data: { value: {} },
      headers: { Origin: ORIGIN },
    });
    expect(none.status()).toBe(404);
  });
});

test('tanpa login → diarahkan ke halaman masuk; API pengaturan ditolak', async ({ page }) => {
  await page.goto('/admin/pengaturan');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get('/api/admin/settings')).status()).toBe(401);
  const res = await page.request.put('/api/admin/settings/hero', {
    data: { value: {} },
    headers: { Origin: ORIGIN },
  });
  expect(res.status()).toBe(401);
});
