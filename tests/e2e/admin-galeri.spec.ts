// Galeri admin (PRD F-21) dengan akun dan database sungguhan, termasuk unggah ke bucket `media`.
// Item uji NONAKTIF (tidak tampil di situs), bernama unik per proses, dan hanya dijalankan di
// project desktop (data bersama). Semua baris dan berkas uji dibersihkan lewat service role.
import { expect, test, type Page } from '@playwright/test';
import { e2eEnabled, hydrated, loginCached, service } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const isMobile = () => test.info().project.name === 'mobile';

// PNG 1×1 valid.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const fileName = (key: string) => `uji-e2e-${RUN}-${key}.png`;
const titleOf = (key: string) => `Uji e2e ${RUN} ${key}`;

const rowByTitle = async (title: string) => {
  const { data, error } = await service
    .from('gallery_items')
    .select('*')
    .eq('title', title)
    .maybeSingle();
  if (error) throw error;
  return data;
};
const rowById = async (id: string) => {
  const { data, error } = await service.from('gallery_items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};
const inBucket = async (path: string) => {
  const [folder, file] = path.split('/');
  const { data, error } = await service.storage.from('media').list(folder, { search: file });
  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === file);
};
const card = (page: Page, id: string) => page.locator(`[data-gallery-id="${id}"]`);

async function upload(page: Page, key: string, buffer: Buffer = PNG, mimeType = 'image/png', name = fileName(key)) {
  await page.locator('[data-gallery-input]').setInputFiles({ name, mimeType, buffer });
}

async function uploaded(page: Page, key: string) {
  await upload(page, key);
  await expect.poll(() => rowByTitle(titleOf(key)), { timeout: 20_000 }).not.toBeNull();
  const row = (await rowByTitle(titleOf(key)))!;
  await expect(card(page, row.id)).toBeVisible();
  return row;
}

test.afterAll(async () => {
  if (!e2eEnabled) return;
  const { data } = await service
    .from('gallery_items')
    .select('id, image_path')
    .like('title', `Uji e2e ${RUN}%`);
  const rows = data ?? [];
  if (rows.length > 0) {
    await service.from('gallery_items').delete().in('id', rows.map((row) => row.id));
    await service.storage.from('media').remove(rows.map((row) => row.image_path).filter((p) => !p.startsWith('/')));
  }
});

test.describe('Galeri: tampilan', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
    await page.goto('/admin/galeri');
    await hydrated(page);
  });

  test('judul, dropzone, grid kartu, dan menu Galeri aktif', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Galeri Model Rambut' })).toBeVisible();
    await expect(page.getByText('JPG, PNG, atau WebP · maks. 3 MB per file')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Galeri', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const cards = page.locator('[data-gallery-id]');
    expect(await cards.count()).toBeGreaterThanOrEqual(8);
    // Gambar dummy seed tampil dengan label Ilustrasi.
    await expect(page.getByText('Ilustrasi').first()).toBeVisible();
  });

  test('tap target ≥ 44px dan tanpa scroll horizontal; naik/turun tampil di layar sempit', async ({
    page,
  }) => {
    const first = page.locator('[data-gallery-id]').first();
    await first.scrollIntoViewIfNeeded();
    for (const name of [/^Detail /, /^Ganti gambar /, /^Hapus /]) {
      const box = await first.getByRole('button', { name }).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const sw = await first.getByRole('switch').boundingBox();
    expect(sw!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (isMobile()) {
      await expect(first.getByRole('button', { name: /^Turunkan / })).toBeVisible();
    }
  });
});

test.describe.serial('Galeri: unggah dan kelola (desktop)', () => {
  let a: NonNullable<Awaited<ReturnType<typeof rowByTitle>>>;
  let b: NonNullable<Awaited<ReturnType<typeof rowByTitle>>>;

  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(), 'Data bersama: hanya desktop');
    await loginCached(page);
    await page.goto('/admin/galeri');
    await hydrated(page);
  });

  test('ringkasan sama dengan isi database', async ({ page }) => {
    const [all, active] = await Promise.all([
      service.from('gallery_items').select('id', { count: 'exact', head: true }),
      service.from('gallery_items').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    await expect(page.locator('[data-gallery-summary]')).toContainText(
      `${all.count} gambar · ${active.count} aktif`,
    );
  });

  test('unggah PNG: kartu baru nonaktif, berkas ada di storage, alt text diminta', async ({
    page,
  }) => {
    a = await uploaded(page, 'a');
    expect(a.is_active).toBe(false);
    expect(a.image_path).toMatch(/^gallery\/[0-9a-f-]{36}\.png$/);
    expect(await inBucket(a.image_path)).toBe(true);
    await expect(card(page, a.id).getByText('Alt text belum diisi')).toBeVisible();
    await expect(card(page, a.id).getByText('Disembunyikan')).toBeVisible();
    // Gambar termuat dari URL publik storage.
    const loaded = await card(page, a.id)
      .locator('img')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test('file > 3 MB dan format GIF ditolak sebelum dikirim, dengan pesan jelas', async ({ page }) => {
    const before = (await service.from('gallery_items').select('id', { count: 'exact', head: true })).count;
    let uploadCalls = 0;
    await page.route('**/api/admin/uploads', (route) => {
      uploadCalls += 1;
      return route.fallback();
    });
    await upload(page, 'big', Buffer.alloc(3 * 1024 * 1024 + 1), 'image/png', `besar-${RUN}.png`);
    await expect(page.getByRole('alert').filter({ hasText: 'File terlalu besar (3,0 MB)' })).toBeVisible();
    await expect(page.getByText('Maksimal 3 MB — kompres atau simpan sebagai WebP.')).toBeVisible();

    await upload(page, 'gif', Buffer.from('GIF89a'), 'image/gif', `animasi-${RUN}.gif`);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Format file harus JPG, PNG, atau WebP.' }),
    ).toBeVisible();

    expect(uploadCalls).toBe(0);
    expect((await service.from('gallery_items').select('id', { count: 'exact', head: true })).count).toBe(before);
    // Berkas yang ditolak tidak punya "Coba lagi" (tidak ada gunanya); bisa ditutup.
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tutup' }).first().click();
  });

  test('menampilkan tanpa alt text ditolak dengan pesan', async ({ page }) => {
    await card(page, a.id).getByRole('switch').click();
    await expect(page.getByText('Alt text wajib diisi sebelum gambar ditampilkan di situs.')).toBeVisible();
    expect((await rowById(a.id))!.is_active).toBe(false);
  });

  test('Detail: isi alt text, deskripsi, label ilustrasi; peringatan hilang', async ({ page }) => {
    await card(page, a.id).getByRole('button', { name: /^Detail / }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Alt text').fill('Foto uji model rambut');
    await dialog.getByLabel('Deskripsi (opsional)').fill('Deskripsi uji');
    await dialog.getByLabel(/Foto ilustrasi/).check();
    await dialog.getByRole('button', { name: 'Simpan' }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, a.id).getByText('Alt text belum diisi')).toHaveCount(0);
    await expect(card(page, a.id).getByText('Ilustrasi')).toBeVisible();
    const row = (await rowById(a.id))!;
    expect(row).toMatchObject({
      alt_text: 'Foto uji model rambut',
      description: 'Deskripsi uji',
      is_placeholder: true,
      is_active: false,
    });
  });

  test('judul inline: Enter menyimpan, Escape membatalkan, kosong ditolak', async ({ page }) => {
    const input = card(page, a.id).getByRole('textbox');
    await input.fill(`${titleOf('a')} ubah`);
    await input.press('Enter');
    await expect.poll(async () => (await rowById(a.id))!.title).toBe(`${titleOf('a')} ubah`);

    await input.fill('dibatalkan');
    await input.press('Escape');
    await expect(input).toHaveValue(`${titleOf('a')} ubah`);
    expect((await rowById(a.id))!.title).toBe(`${titleOf('a')} ubah`);

    await input.fill(' ');
    await input.press('Enter');
    await expect(card(page, a.id).getByRole('alert')).toContainText('Judul gaya minimal 2 karakter.');
    expect((await rowById(a.id))!.title).toBe(`${titleOf('a')} ubah`);
  });

  test('urutan: panah atas/bawah di pegangan menyimpan urutan', async ({ page }) => {
    b = await uploaded(page, 'b');
    expect(b.sort_order).toBeGreaterThan(a.sort_order);

    await card(page, b.id).getByRole('button', { name: /^Atur urutan / }).press('ArrowUp');
    await expect.poll(async () => (await rowById(b.id))!.sort_order).toBe(a.sort_order);
    expect((await rowById(a.id))!.sort_order).toBe(b.sort_order);

    // Kembalikan (juga memastikan arah sebaliknya bekerja).
    await card(page, b.id).getByRole('button', { name: /^Atur urutan / }).press('ArrowDown');
    await expect.poll(async () => (await rowById(b.id))!.sort_order).toBe(b.sort_order);
  });

  test('ganti gambar: berkas lama terhapus, berkas baru terunggah', async ({ page }) => {
    const oldPath = a.image_path;
    const chooser = page.waitForEvent('filechooser');
    await card(page, a.id).getByRole('button', { name: /^Ganti gambar / }).click();
    await (await chooser).setFiles({ name: `ganti-${RUN}.png`, mimeType: 'image/png', buffer: PNG });
    await expect.poll(async () => (await rowById(a.id))!.image_path, { timeout: 20_000 }).not.toBe(oldPath);
    const next = (await rowById(a.id))!.image_path;
    expect(await inBucket(next)).toBe(true);
    expect(await inBucket(oldPath)).toBe(false);
    a = (await rowById(a.id))!;
  });

  test('hapus: konfirmasi, baris dan berkas hilang', async ({ page }) => {
    const path = b.image_path;
    await card(page, b.id).getByRole('button', { name: /^Hapus / }).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toContainText('berkas fotonya dihapus dari penyimpanan');
    await dialog.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(card(page, b.id)).toHaveCount(0);
    expect(await rowById(b.id)).toBeNull();
    expect(await inBucket(path)).toBe(false);
  });
});

test('tanpa login → diarahkan ke halaman masuk; API galeri dan unggah ditolak', async ({ page }) => {
  await page.goto('/admin/galeri');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get('/api/admin/gallery')).status()).toBe(401);
  const res = await page.request.post('/api/admin/uploads', {
    data: { folder: 'gallery', content_type: 'image/png', size: 10 },
    headers: { Origin: `http://localhost:${process.env.E2E_PORT ?? 4321}` },
  });
  expect(res.status()).toBe(401);
});
