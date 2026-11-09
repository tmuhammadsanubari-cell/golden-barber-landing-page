// Testimoni dan FAQ admin (PRD F-21) dengan akun dan database sungguhan. Baris uji NONAKTIF (landing
// e2e menghitung FAQ/testimoni aktif), bernama unik per proses, dan hanya dibuat di project desktop.
// Baris asli tidak disentuh. Semua baris uji dibersihkan lewat service role.
import { expect, test, type Page } from '@playwright/test';
import { e2eEnabled, hydrated, loginCached, service } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const T = `UJI-E2E Testimoni ${RUN}`;
const F = `UJI-E2E FAQ ${RUN}?`;
const isMobile = () => test.info().project.name === 'mobile';

/** ConfirmDialog memakai role alertdialog; form memakai dialog. */
const confirmDialog = (page: Page) => page.getByRole('alertdialog').or(page.getByRole('dialog'));

const row = (page: Page, id: string) => page.locator(`[data-row-id="${id}"]`);

async function tstByName(name: string) {
  const { data, error } = await service.from('testimonials').select('*').eq('customer_name', name).maybeSingle();
  if (error) throw error;
  return data;
}
async function tstById(id: string) {
  const { data, error } = await service.from('testimonials').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
async function faqByQuestion(question: string) {
  const { data, error } = await service.from('faqs').select('*').eq('question', question).maybeSingle();
  if (error) throw error;
  return data;
}
async function faqById(id: string) {
  const { data, error } = await service.from('faqs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

test.afterAll(async () => {
  if (!e2eEnabled) return;
  await service.from('testimonials').delete().like('customer_name', `${T}%`);
  await service.from('faqs').delete().like('question', `${F}%`);
});

// ---------------------------------------------------------------------------------------------
// Testimoni
// ---------------------------------------------------------------------------------------------

test.describe('Testimoni: tampilan', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
    await page.goto('/admin/testimoni');
    await hydrated(page);
  });

  test('judul, daftar contoh dengan label, menu aktif', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Testimoni' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Testimoni', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.locator('[data-row-id]').count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByText('Contoh', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('img', { name: 'Rating 5 dari 5' }).first()).toBeVisible();
  });

  test('tap target ≥ 44px, tanpa scroll horizontal, naik/turun tampil di layar sempit', async ({ page }) => {
    const first = page.locator('[data-row-id]').first();
    await first.scrollIntoViewIfNeeded();
    for (const name of [/^Edit testimoni /, /^Hapus testimoni /]) {
      const box = await first.getByRole('button', { name }).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect((await first.getByRole('switch').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (isMobile()) await expect(first.getByRole('button', { name: /^Turunkan / })).toBeVisible();
  });
});

test.describe.serial('Testimoni: tambah, ubah, urutkan, hapus (desktop)', () => {
  let a: NonNullable<Awaited<ReturnType<typeof tstByName>>>;
  let b: NonNullable<Awaited<ReturnType<typeof tstByName>>>;

  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(), 'Data bersama: hanya desktop');
    await loginCached(page);
    await page.goto('/admin/testimoni');
    await hydrated(page);
  });

  async function add(page: Page, name: string, content: string) {
    await page.getByRole('button', { name: 'Tambah Testimoni' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nama pelanggan').fill(name);
    await dialog.getByLabel('Isi testimoni').fill(content);
    await dialog.getByLabel('Tampilkan di situs').uncheck();
    await dialog.getByRole('button', { name: 'Simpan Testimoni' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => tstByName(name)).not.toBeNull();
    return (await tstByName(name))!;
  }

  test('ringkasan sama dengan isi database', async ({ page }) => {
    const [all, active] = await Promise.all([
      service.from('testimonials').select('id', { count: 'exact', head: true }),
      service.from('testimonials').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    await expect(page.locator('[data-count-summary]')).toContainText(`${all.count} testimoni · ${active.count} aktif`);
  });

  test('form kosong menampilkan pesan per field dan tidak mengirim apa pun', async ({ page }) => {
    let posts = 0;
    await page.route('**/api/admin/testimonials', (route) => {
      if (route.request().method() === 'POST') posts += 1;
      return route.fallback();
    });
    await page.getByRole('button', { name: 'Tambah Testimoni' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Simpan Testimoni' }).click();
    await expect(dialog.getByText('Nama pelanggan wajib diisi.')).toBeVisible();
    await expect(dialog.getByText('Isi testimoni wajib diisi.')).toBeVisible();
    await dialog.getByLabel('Isi testimoni').fill('x'.repeat(520));
    // Batas 500 karakter dijaga isian itu sendiri.
    await expect(dialog.getByLabel('Isi testimoni')).toHaveValue('x'.repeat(500));
    await expect(dialog.getByText('500/500 karakter')).toBeVisible();
    expect(posts).toBe(0);
    await dialog.getByRole('button', { name: 'Batal' }).click();
  });

  test('tambah: baris baru nonaktif dengan rating, sumber, dan cabang yang dipilih', async ({ page }) => {
    await page.getByRole('button', { name: 'Tambah Testimoni' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nama pelanggan').fill(`${T} A`);
    await dialog.getByLabel('Cabang').selectOption({ index: 1 });
    await dialog.getByLabel('Rating').selectOption('4');
    await dialog.getByLabel('Sumber').selectOption('google');
    await dialog.getByLabel('Isi testimoni').fill('Potongan rapi, barber ramah.');
    await dialog.getByLabel(/Konten contoh/).check();
    await dialog.getByLabel('Tampilkan di situs').uncheck();
    await dialog.getByRole('button', { name: 'Simpan Testimoni' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => tstByName(`${T} A`)).not.toBeNull();
    a = (await tstByName(`${T} A`))!;
    expect(a).toMatchObject({ rating: 4, source: 'google', is_active: false, is_placeholder: true });
    expect(a.branch_id).not.toBeNull();
    await expect(row(page, a.id)).toContainText('Potongan rapi, barber ramah.');
    await expect(row(page, a.id).getByRole('img', { name: 'Rating 4 dari 5' })).toBeVisible();
    await expect(row(page, a.id).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  test('edit: ubah rating dan isi, cabang kembali ke semua cabang', async ({ page }) => {
    await row(page, a.id).getByRole('button', { name: /^Edit testimoni / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Rating')).toHaveValue('4');
    await dialog.getByLabel('Rating').selectOption('2');
    await dialog.getByLabel('Cabang').selectOption('');
    await dialog.getByLabel('Isi testimoni').fill('Isi sudah diubah.');
    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await tstById(a.id))!.content).toBe('Isi sudah diubah.');
    expect(await tstById(a.id)).toMatchObject({ rating: 2, branch_id: null });
    await expect(row(page, a.id)).toContainText('Semua cabang');
  });

  test('urutan: panah atas/bawah menyimpan; dipulihkan lagi', async ({ page }) => {
    b = await add(page, `${T} B`, 'Testimoni kedua.');
    expect(b.sort_order).toBeGreaterThan(a.sort_order);
    await row(page, b.id).getByRole('button', { name: /^Atur urutan / }).press('ArrowUp');
    await expect.poll(async () => (await tstById(b.id))!.sort_order).toBe(a.sort_order);
    expect((await tstById(a.id))!.sort_order).toBe(b.sort_order);
    await row(page, b.id).getByRole('button', { name: /^Atur urutan / }).press('ArrowDown');
    await expect.poll(async () => (await tstById(b.id))!.sort_order).toBe(b.sort_order);
  });

  test('hapus: konfirmasi lalu baris hilang', async ({ page }) => {
    await row(page, b.id).getByRole('button', { name: /^Hapus testimoni / }).click();
    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('dihapus permanen');
    await dialog.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(row(page, b.id)).toHaveCount(0);
    expect(await tstById(b.id)).toBeNull();
    await row(page, a.id).getByRole('button', { name: /^Hapus testimoni / }).click();
    await confirmDialog(page).getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(row(page, a.id)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------------------------

test.describe('FAQ: tampilan', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
    await page.goto('/admin/faq');
    await hydrated(page);
  });

  test('judul, daftar FAQ, catatan jawaban menunggu konfirmasi', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'FAQ' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FAQ', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.locator('[data-row-id]').count()).toBeGreaterThanOrEqual(8);
    await expect(page.locator('[data-pending-note]')).toContainText('belum punya jawaban final');
    await expect(page.getByText('Menunggu jawaban').first()).toBeVisible();
  });

  test('tap target ≥ 44px dan tanpa scroll horizontal', async ({ page }) => {
    const first = page.locator('[data-row-id]').first();
    await first.scrollIntoViewIfNeeded();
    for (const name of [/^Edit FAQ /, /^Hapus FAQ /]) {
      const box = await first.getByRole('button', { name }).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe.serial('FAQ: tambah, jawaban final, urutkan, hapus (desktop)', () => {
  let a: NonNullable<Awaited<ReturnType<typeof faqByQuestion>>>;
  let pending: NonNullable<Awaited<ReturnType<typeof faqByQuestion>>>;

  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(), 'Data bersama: hanya desktop');
    await loginCached(page);
    await page.goto('/admin/faq');
    await hydrated(page);
  });

  test('ringkasan sama dengan isi database', async ({ page }) => {
    const [all, active] = await Promise.all([
      service.from('faqs').select('id', { count: 'exact', head: true }),
      service.from('faqs').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    await expect(page.locator('[data-count-summary]')).toContainText(`${all.count} FAQ · ${active.count} aktif`);
  });

  test('tambah: validasi, lalu baris baru nonaktif', async ({ page }) => {
    await page.getByRole('button', { name: 'Tambah FAQ' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Simpan FAQ' }).click();
    await expect(dialog.getByText('Pertanyaan wajib diisi.')).toBeVisible();
    await expect(dialog.getByText('Jawaban wajib diisi.')).toBeVisible();

    await dialog.getByLabel('Pertanyaan').fill(`${F} A`);
    await dialog.getByLabel('Jawaban').fill('Jawaban uji lengkap.');
    await dialog.getByLabel('Tampilkan di situs').uncheck();
    await dialog.getByRole('button', { name: 'Simpan FAQ' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => faqByQuestion(`${F} A`)).not.toBeNull();
    a = (await faqByQuestion(`${F} A`))!;
    expect(a).toMatchObject({ answer: 'Jawaban uji lengkap.', is_active: false });
    await expect(row(page, a.id)).toContainText('Jawaban uji lengkap.');
  });

  test('FAQ menunggu konfirmasi pemilik: tidak bisa ditampilkan sebelum jawaban final', async ({ page }) => {
    const { data, error } = await service
      .from('faqs')
      .insert({
        question: `${F} P`,
        answer: 'MENUNGGU KONFIRMASI PEMILIK',
        is_active: false,
        sort_order: 900,
      })
      .select('*')
      .single();
    if (error) throw error;
    pending = data;
    await page.reload();
    await hydrated(page);

    const r = row(page, pending.id);
    await expect(r.getByText('Menunggu jawaban')).toBeVisible();
    await r.getByRole('switch').click();
    await expect(page.getByText(/menunggu konfirmasi pemilik/i).first()).toBeVisible();
    expect((await faqById(pending.id))!.is_active).toBe(false);

    // Edit: jawaban penanda dikosongkan di form; isi jawaban final lalu simpan (tetap nonaktif).
    await r.getByRole('button', { name: /^Edit FAQ / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Jawaban')).toHaveValue('');
    await dialog.getByLabel('Jawaban').fill('Jawaban final uji.');
    await dialog.getByLabel('Tampilkan di situs').uncheck();
    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await faqById(pending.id))!.answer).toBe('Jawaban final uji.');
    await expect(r.getByText('Menunggu jawaban')).toHaveCount(0);
  });

  test('form menolak FAQ aktif tanpa jawaban final', async ({ page }) => {
    await page.getByRole('button', { name: 'Tambah FAQ' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Pertanyaan').fill(`${F} X`);
    await dialog.getByLabel('Jawaban').fill('MENUNGGU KONFIRMASI PEMILIK');
    await dialog.getByRole('button', { name: 'Simpan FAQ' }).click();
    await expect(dialog.getByRole('alert')).toContainText('menunggu konfirmasi pemilik');
    expect(await faqByQuestion(`${F} X`)).toBeNull();
    await dialog.getByRole('button', { name: 'Batal' }).click();
  });

  test('urutan: panah atas/bawah menyimpan; dipulihkan lagi', async ({ page }) => {
    await expect(row(page, pending.id)).toBeVisible();
    const aRow = (await faqById(a.id))!;
    const pRow = (await faqById(pending.id))!;
    expect(pRow.sort_order).toBeGreaterThan(aRow.sort_order);
    await row(page, pending.id).getByRole('button', { name: /^Atur urutan / }).press('ArrowUp');
    await expect.poll(async () => (await faqById(pending.id))!.sort_order).toBe(aRow.sort_order);
    // Simpan urutan menomori ulang semua baris 1..n, jadi yang dipulihkan adalah urutan relatifnya.
    await row(page, pending.id).getByRole('button', { name: /^Atur urutan / }).press('ArrowDown');
    await expect
      .poll(async () => (await faqById(pending.id))!.sort_order > (await faqById(a.id))!.sort_order)
      .toBe(true);
  });

  test('hapus: konfirmasi lalu baris hilang', async ({ page }) => {
    for (const id of [a.id, pending.id]) {
      await row(page, id).getByRole('button', { name: /^Hapus FAQ / }).click();
      const dialog = confirmDialog(page);
      await expect(dialog).toContainText('dihapus permanen');
      await dialog.getByRole('button', { name: 'Hapus', exact: true }).click();
      await expect(row(page, id)).toHaveCount(0);
      expect(await faqById(id)).toBeNull();
    }
  });
});

test('tanpa login → diarahkan ke login; API testimoni dan FAQ ditolak', async ({ page }) => {
  for (const path of ['/admin/testimoni', '/admin/faq']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  expect((await page.request.get('/api/admin/testimonials')).status()).toBe(401);
  expect((await page.request.get('/api/admin/faqs')).status()).toBe(401);
});
