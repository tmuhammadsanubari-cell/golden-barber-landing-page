import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

// Butuh akun admin sungguhan (E2E_ADMIN_*) dan service role untuk memeriksa/membersihkan database.
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(email && password && url && serviceKey);

test.skip(!enabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const service = enabled
  ? createClient(url!, serviceKey!, { auth: { persistSession: false } })
  : (null as never);
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 4321}`;
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NAME = `UJI-E2E Cabang ${RUN}`;
const SLUG = `uji-e2e-cabang-${RUN}`;
const PREFIX = 'UJI-E2E Cabang';

// Login sekali per worker lalu pakai ulang cookie sesi: puluhan login beruntun menekan batas
// laju Supabase Auth (dan endpoint login memetakan semua galat itu menjadi 401).
let sessionCookies: Awaited<ReturnType<ReturnType<Page['context']>['cookies']>> = [];

async function login(page: Page) {
  if (sessionCookies.length === 0) {
    const res = await page.request.post('/api/auth/login', {
      data: { email, password, remember: true },
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBe(200);
    sessionCookies = await page.context().cookies();
    return;
  }
  await page.context().addCookies(sessionCookies);
}

/**
 * Tunggu island React selesai hidrasi. Atribut `ssr` Astro dicopot sebelum React selesai, jadi
 * `fill` yang mendahului hidrasi bisa tertimpa (teks lama menempel). `data-hydrated` bernilai
 * "false" di HTML server dan "true" setelah efek pertama React.
 */
async function hydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.locator('[data-hydrated="false"]')).toHaveCount(0);
}

async function openList(page: Page, query = '') {
  await page.goto(`/admin/cabang${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Cabang' })).toBeVisible();
  await hydrated(page);
}

const dbBranches = async () => {
  const { data, error } = await service.from('branches').select('*').order('sort_order');
  if (error) throw error;
  return data;
};
const testBranch = async () => {
  const { data, error } = await service.from('branches').select('*').eq('slug', SLUG).maybeSingle();
  if (error) throw error;
  return data;
};
const row = (page: Page, name: string) =>
  page.locator('[data-branch-id]:visible').filter({ hasText: name }).first();

// Project desktop dan mobile berjalan di proses terpisah dengan satu database. Hanya desktop
// yang mengubah data; pembersihan dibatasi ke cabang uji milik proses ini (RUN), bukan semua
// `UJI-E2E Cabang*`. Cabang uji dibuat NONAKTIF supaya tidak tampil di situs publik (landing
// e2e membaca database yang sama), dan status pusat cabang asli tidak diubah di e2e: pindah
// pusat diuji di tests/integration.
test.afterAll(async ({}, testInfo) => {
  if (testInfo.project.name !== 'desktop') return;
  await service.from('branches').delete().like('name', `${PREFIX} ${RUN}%`);
  // Urut ulang meninggalkan celah setelah cabang uji dihapus: rapikan jadi 1..n seperti seed.
  const { data } = await service.from('branches').select('id').order('sort_order');
  for (const [index, row] of (data ?? []).entries()) {
    await service
      .from('branches')
      .update({ sort_order: index + 1 })
      .eq('id', row.id);
  }
});

test.describe('cabang: baca (desktop & mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('daftar mengikuti database: urutan, jumlah chip, badge Pusat, jumlah barber', async ({
    page,
  }) => {
    const branches = (await dbBranches()).filter((b) => !b.name.startsWith(PREFIX));
    const { data: barbers } = await service.from('barbers').select('branch_id');
    await openList(page);

    // Cabang uji dari tes lain mungkin ikut tampil; bandingkan hanya urutan cabang asli.
    const shownIds = await page
      .locator('[data-branch-id]:visible')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-branch-id')));
    const realIds = new Set(branches.map((b) => b.id));
    expect(shownIds.filter((id) => id && realIds.has(id))).toEqual(branches.map((b) => b.id));

    const aktif = branches.filter((b) => b.is_active && !b.is_new).length;
    const baru = branches.filter((b) => b.is_active && b.is_new).length;
    const nonaktif = branches.filter((b) => !b.is_active).length;
    await expect(page.getByRole('link', { name: /^Semua · \d+$/ })).toBeVisible();
    const chipNumber = async (label: string) =>
      Number(
        (await page
          .getByRole('link', { name: new RegExp(`^${label} · \\d+$`) })
          .textContent())!.split('·')[1],
      );
    // Cabang uji dari tes lain bisa menambah hitungan sementara, jadi gunakan "minimal".
    expect(await chipNumber('Aktif')).toBeGreaterThanOrEqual(aktif);
    expect(await chipNumber('Cabang Baru')).toBeGreaterThanOrEqual(baru);
    expect(await chipNumber('Nonaktif')).toBeGreaterThanOrEqual(nonaktif);

    const flagship = branches.find((b) => b.is_flagship)!;
    await expect(row(page, flagship.name).getByText('Pusat', { exact: true })).toBeVisible();
    const expectedBarbers = (barbers ?? []).filter((b) => b.branch_id === flagship.id).length;
    await expect(row(page, flagship.name)).toContainText(String(expectedBarbers));
  });

  test('pencarian dan filter memakai query string', async ({ page }) => {
    await openList(page, '?q=dago');
    await expect(row(page, 'Dago')).toBeVisible();
    await expect(page.locator('[data-branch-id]:visible')).toHaveCount(1);
    await openList(page, '?q=zzzz-tidak-ada');
    await expect(page.getByText('Tidak ada cabang yang cocok')).toBeVisible();
    // Query ngawur jatuh ke tampilan awal, bukan error.
    await openList(page, '?filter=ngawur');
    await expect(page.locator('[data-branch-id]:visible').first()).toBeVisible();
  });

  test('tanpa login diarahkan ke login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/admin/cabang');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fcabang/);
    await context.close();
  });
});

test.describe('cabang: mobile', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'khusus viewport mobile');
    await login(page);
  });

  test('kartu cabang, tanpa scroll horizontal, tap target ≥ 44px', async ({ page }) => {
    await openList(page);
    await expect(page.locator('[role="table"]:visible')).toHaveCount(0);
    const cards = page.locator('article[data-branch-id]:visible');
    expect(await cards.count()).toBeGreaterThanOrEqual((await dbBranches()).length - 5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    for (const control of await cards.first().locator('a, button').all()) {
      const box = await control.boundingBox();
      expect(
        box!.height,
        (await control.getAttribute('aria-label')) ?? undefined,
      ).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('panel edit membuka satu halaman penuh dengan tombol kembali', async ({ page }) => {
    await openList(page);
    await cardsEdit(page, 'Dago');
    await expect(page).toHaveURL(/\/admin\/cabang\?id=/);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Dago' })).toBeVisible();
    await expect(page.locator('[data-branch-id]:visible')).toHaveCount(0);
    await expect(page.getByLabel('Nama cabang')).toHaveValue('Dago');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('link', { name: 'Kembali ke daftar' }).click();
    await expect(page).toHaveURL(/\/admin\/cabang$/);
  });
});

async function cardsEdit(page: Page, name: string) {
  await page
    .locator('article[data-branch-id]:visible')
    .filter({ hasText: name })
    .first()
    .getByRole('link', { name: `Edit ${name}` })
    .click();
}

test.describe.serial('cabang: ubah data (desktop, berurutan)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'mengubah database bersama: hanya desktop');
    await login(page);
  });

  test('tambah cabang: slug otomatis, jam tutup salah ditolak, lalu tersimpan di akhir urutan', async ({
    page,
  }) => {
    const before = await dbBranches();
    await openList(page);
    await page.getByRole('link', { name: 'Tambah Cabang' }).click();
    await hydrated(page);

    await page.getByLabel('Nama cabang').fill(NAME);
    await expect(page.getByLabel('Slug URL')).toHaveValue(SLUG);
    await page.getByLabel('Alamat jalan').fill('Jl. Uji Coba No.1');
    await page.getByLabel('Kota/Kabupaten').fill('Kota Bandung');
    await page.getByLabel('Jam tutup').fill('07:00');
    await page.getByRole('button', { name: 'Simpan Cabang' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: '1 isian perlu diperbaiki' }),
    ).toBeVisible();
    await expect(page.getByText('Jam tutup harus lebih besar dari jam buka.')).toBeVisible();
    expect(await testBranch()).toBeNull();

    await page.getByLabel('Jam tutup').fill('22:00');
    // Nonaktif: cabang uji tidak boleh tampil di situs publik.
    await page.getByRole('switch', { name: /^Aktif/ }).click();
    await page.getByRole('button', { name: 'Simpan Cabang' }).click();
    await expect(page).toHaveURL(/\/admin\/cabang\?id=/);

    const created = await testBranch();
    expect(created).not.toBeNull();
    expect(created!.name).toBe(NAME);
    expect(created!.is_active).toBe(false);
    expect(created!.close_time.slice(0, 5)).toBe('22:00');
    expect(created!.sort_order).toBeGreaterThan(Math.max(...before.map((b) => b.sort_order)));
    // Trigger database mengisi ketersediaan semua layanan untuk cabang baru.
    const { count: services } = await service
      .from('services')
      .select('id', { count: 'exact', head: true });
    const { count: filled } = await service
      .from('branch_services')
      .select('service_id', { count: 'exact', head: true })
      .eq('branch_id', created!.id);
    expect(filled).toBe(services);
  });

  test('slug yang sudah dipakai ditolak dengan pesan CONFLICT', async ({ page }) => {
    await openList(page, '?baru=1');
    await page.getByLabel('Nama cabang').fill(`${NAME} dobel`);
    await page.getByLabel('Slug URL').fill('dago');
    await page.getByLabel('Alamat jalan').fill('Jl. Uji Coba No.2');
    await page.getByLabel('Kota/Kabupaten').fill('Kota Bandung');
    await page.getByRole('button', { name: 'Simpan Cabang' }).click();
    await expect(page.getByText('Slug sudah dipakai cabang lain').first()).toBeVisible();
    const { data } = await service.from('branches').select('id').like('name', `${NAME} dobel`);
    expect(data).toHaveLength(0);
  });

  test('API menolak slug dobel dengan 409 dan kode CONFLICT', async ({ page }) => {
    const dago = (await dbBranches()).find((b) => b.slug === 'dago')!;
    const res = await page.request.put(`/api/admin/branches/${dago.id}`, {
      headers: { Origin: ORIGIN },
      data: {
        name: dago.name,
        slug: 'dipatiukur',
        region: dago.region,
        address: dago.address,
        city: dago.city,
        province: dago.province,
        open_time: '08:00',
        close_time: '23:00',
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toBe('Slug sudah dipakai cabang lain');
    expect((await dbBranches()).find((b) => b.id === dago.id)!.slug).toBe('dago');
  });

  test('edit alamat, nomor WA, dan kode pos tersimpan; menu baris', async ({ page }) => {
    const created = (await testBranch())!;
    await openList(page, `?id=${created.id}`);
    await page.getByLabel('Alamat jalan').fill('Jl. Uji Coba No.99');
    await page.getByLabel('Kode pos').fill('40132');
    await page.getByLabel(/Nomor WA khusus/).fill('0812-0000-0777');
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect.poll(async () => (await testBranch())!.address).toBe('Jl. Uji Coba No.99');
    const edited = (await testBranch())!;
    expect(edited.postal_code).toBe('40132');
    expect(edited.whatsapp_number).toBe('6281200000777');

    await openList(page);
    await row(page, NAME)
      .getByRole('button', { name: `Aksi lain untuk ${NAME}` })
      .click();
    await expect(row(page, NAME).getByText('Nonaktif', { exact: true })).toBeVisible();
    // Cabang uji tidak boleh pernah aktif di e2e (dashboard & landing membaca database yang sama),
    // jadi cukup pastikan menu menawarkan "Aktifkan"; aktif/nonaktif diuji di tests/integration.
    await expect(page.getByRole('menuitem', { name: 'Aktifkan' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Hapus…' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('cabang pusat: konfirmasi muncul dan Batal tidak mengubah apa pun', async ({ page }) => {
    const created = (await testBranch())!;
    await openList(page, `?id=${created.id}`);
    await page.getByRole('switch', { name: /Cabang Pusat/ }).click();
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`Jadikan ${NAME} cabang pusat?`);
    // Batal: tidak ada yang berubah di database.
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await testBranch())!.is_flagship).toBe(false);
    // Perpindahan pusat yang sesungguhnya diuji di tests/integration (tidak menyentuh data
    // cabang asli saat e2e lain membaca situs publik).
  });

  test('urutan: tombol panah di keyboard menyimpan sort_order dan tetap berurutan', async ({
    page,
  }) => {
    const created = (await testBranch())!;
    await openList(page);
    const all = await dbBranches();
    const before = all.findIndex((b) => b.id === created.id);
    expect(before).toBeGreaterThan(0);

    const handle = row(page, NAME).getByRole('button', { name: /^Atur urutan/ });
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByText('Urutan disimpan').first()).toBeVisible();

    const after = await dbBranches();
    expect(after.findIndex((b) => b.id === created.id)).toBe(before - 1);
    expect(after.map((b) => b.sort_order)).toEqual(after.map((_, i) => i + 1));

    // Dengan filter aktif, urutan tidak boleh diubah.
    await openList(page, `?q=${encodeURIComponent(NAME)}`);
    await expect(row(page, NAME).getByRole('button', { name: /^Atur urutan/ })).toHaveCount(0);
  });

  test('hapus dicegah bila cabang masih punya barber', async ({ page }) => {
    const { data: barbers } = await service.from('barbers').select('branch_id');
    const counts = new Map<string, number>();
    for (const b of barbers ?? []) counts.set(b.branch_id, (counts.get(b.branch_id) ?? 0) + 1);
    const withBarbers = (await dbBranches()).find((b) => (counts.get(b.id) ?? 0) > 0)!;

    const res = await page.request.delete(`/api/admin/branches/${withBarbers.id}`, {
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.message).toContain('masih memiliki barber');
    expect((await dbBranches()).some((b) => b.id === withBarbers.id)).toBe(true);

    await openList(page);
    await row(page, withBarbers.name)
      .getByRole('button', { name: `Aksi lain untuk ${withBarbers.name}` })
      .click();
    await page.getByRole('menuitem', { name: 'Hapus…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`masih punya ${counts.get(withBarbers.id)} barber`);
    await expect(dialog.getByRole('button', { name: 'Hapus', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('hapus cabang tanpa barber lewat dialog konfirmasi', async ({ page }) => {
    const created = (await testBranch())!;
    await openList(page);
    await row(page, NAME)
      .getByRole('button', { name: `Aksi lain untuk ${NAME}` })
      .click();
    await page.getByRole('menuitem', { name: 'Hapus…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`Hapus cabang ${NAME}?`);
    await dialog.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect.poll(testBranch).toBeNull();
    // Ketersediaan layanan ikut terhapus (cascade).
    const { count } = await service
      .from('branch_services')
      .select('service_id', { count: 'exact', head: true })
      .eq('branch_id', created.id);
    expect(count).toBe(0);
  });
});
