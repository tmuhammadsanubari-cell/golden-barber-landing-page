import { expect, test, type Page } from '@playwright/test';
import { ORIGIN, e2eEnabled, hydrated, loginCached, service } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

// Desktop dan mobile berjalan di proses terpisah dengan satu database. Tiap project membuat tiga
// layanan uji NONAKTIF bernama unik di kategorinya sendiri (desktop: hair_treatment, mobile:
// hair_colouring), jadi urut-ulang (butuh set kategori lengkap) tidak berbenturan dan layanan asli
// tidak disentuh. Trigger database mengisi ketersediaan 'unavailable' di semua cabang, jadi layanan uji
// tidak pernah tampil di situs publik.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `UJI-E2E Layanan ${RUN}`;
const NAMES = [`${PREFIX} 1`, `${PREFIX} 2`, `${PREFIX} 3`];

const isMobile = () => test.info().project.name === 'mobile';
const category = () => (isMobile() ? 'hair_colouring' : 'hair_treatment');
const categoryTitle = () => (isMobile() ? 'Hair Colouring' : 'Hair Treatment');
const idPrefix = () => (isMobile() ? 'm' : 'd');

const ids: string[] = [];
let branches: { id: string; name: string; slug: string }[] = [];

const svc = async (id: string) => {
  const { data, error } = await service.from('services').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};
const categoryServices = async () => {
  const { data, error } = await service
    .from('services')
    .select('*')
    .eq('category', category())
    .order('sort_order');
  if (error) throw error;
  return data;
};
const cellRow = async (branchId: string, serviceId: string) => {
  const { data, error } = await service
    .from('branch_services')
    .select('*')
    .eq('branch_id', branchId)
    .eq('service_id', serviceId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

test.beforeAll(async () => {
  const { data } = await service.from('branches').select('id, name, slug').order('sort_order');
  branches = data!;
  const existing = await categoryServices();
  const start = Math.max(0, ...existing.map((s) => s.sort_order));
  const rows = [
    { price_type: 'fixed', price_min: 40000, price_max: null },
    { price_type: 'start_from', price_min: 350000, price_max: null },
    { price_type: 'range', price_min: 150000, price_max: 300000 },
  ] as const;
  for (const [index, row] of rows.entries()) {
    const { data: made, error } = await service
      .from('services')
      .insert({
        slug: `uji-e2e-layanan-${RUN}-${index + 1}`,
        name: NAMES[index]!,
        category: category(),
        is_active: false,
        sort_order: start + index + 1,
        ...row,
      })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(made.id);
  }
});

test.afterAll(async () => {
  // branch_services ikut terhapus (cascade). Termasuk layanan yang dibuat lewat UI.
  await service.from('services').delete().like('name', `${PREFIX}%`);
  // Pengaman: seed memakai sort_order 1..n per kategori; rapikan bila ada celah.
  const rows = await categoryServices();
  for (const [index, row] of rows.entries()) {
    if (row.sort_order !== index + 1) {
      await service
        .from('services')
        .update({ sort_order: index + 1 })
        .eq('id', row.id);
    }
  }
});

async function openKatalog(page: Page, query = '') {
  await page.goto(`/admin/layanan${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Layanan' })).toBeVisible();
  await hydrated(page);
}
async function openMatriks(page: Page) {
  await page.goto('/admin/layanan?tab=ketersediaan');
  await expect(page.getByRole('heading', { level: 1, name: 'Layanan' })).toBeVisible();
  await hydrated(page);
}

const rowOf = (page: Page, id: string) => page.locator(`[data-service-id="${id}"]:visible`);
const cellSelect = (page: Page, branchId: string, serviceId: string) =>
  page.locator(`#av-${branchId}-${serviceId}`);

test.describe('layanan: baca', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('katalog mengikuti database: kelompok, nama, harga per tipe', async ({ page }) => {
    const { data: all } = await service.from('services').select('*').order('sort_order');
    const real = all!.filter((s) => !s.name.startsWith('UJI-E2E'));
    await openKatalog(page);

    for (const title of ['Add-ons', 'Hair Colouring', 'Hair Treatment']) {
      await expect(
        page
          .getByText(new RegExp(`^${title}`))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
    }
    const trim = real.find((s) => s.slug === 'trim')!;
    await expect(rowOf(page, trim.id)).toContainText('Trim');
    await expect(rowOf(page, trim.id)).toContainText('20K');
    const peek = real.find((s) => s.slug === 'peek-a-boo')!;
    await expect(rowOf(page, peek.id)).toContainText('Mulai 350K');
    const perm = real.find((s) => s.slug === 'down-perm')!;
    await expect(rowOf(page, perm.id)).toContainText('150K–300K');
    const basic = real.find((s) => s.slug === 'basic-colour')!;
    await expect(rowOf(page, basic.id)).toContainText('Dark Brown');
    // Semua layanan asli tampil.
    for (const item of real) await expect(rowOf(page, item.id)).toHaveCount(1);
  });

  test('matriks: setiap sel sama dengan database', async ({ page }) => {
    const { data: rows } = await service.from('branch_services').select('*');
    const real = new Map<string, string>(
      (rows ?? []).map((r) => [`av-${r.branch_id}-${r.service_id}`, r.status] as [string, string]),
    );
    await openMatriks(page);

    const shown = await page
      .locator('select.av')
      .evaluateAll((els) =>
        els.map((el) => [el.id, (el as HTMLSelectElement).value] as [string, string]),
      );
    const realShown = shown.filter(([id]) => real.has(id));
    // Cabang/layanan uji milik tes lain bisa ikut tampil; bandingkan yang ada di database saat ini.
    expect(realShown.length).toBeGreaterThanOrEqual(14 * 11);
    for (const [id, value] of realShown) expect(value, id).toBe(real.get(id));
  });

  test('tab dan query: ?tab ngawur jatuh ke katalog; ?baru=1 membuka dialog tambah', async ({
    page,
  }) => {
    await page.goto('/admin/layanan?tab=ngawur');
    await expect(page.getByRole('link', { name: 'Katalog Layanan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await openKatalog(page, '?baru=1');
    await expect(page.getByRole('dialog')).toContainText('Tambah layanan');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('link', { name: 'Ketersediaan per Cabang' }).click();
    await expect(page).toHaveURL(/tab=ketersediaan/);
  });

  test('tanpa login diarahkan ke login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/admin/layanan');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Flayanan/);
    await context.close();
  });
});

test.describe.serial('layanan: katalog (ubah data)', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('tipe harga inline: Tetap → Mulai dari tersimpan; ke Rentang tanpa harga maks membuka form', async ({
    page,
  }) => {
    await openKatalog(page);
    const id = ids[0]!; // fixed 40K
    const select = page.locator(`#${idPrefix()}-${id}-type`);

    await select.selectOption('start_from');
    await expect.poll(async () => (await svc(id))!.price_type).toBe('start_from');
    await expect(rowOf(page, id)).toContainText('Mulai 40K');

    // Rentang butuh harga maksimum: dialog terbuka dengan tipe terpilih, database belum berubah.
    await select.selectOption('range');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Edit ${NAMES[0]}`);
    await expect(dialog.locator('#svc-price_type')).toHaveValue('range');
    expect((await svc(id))!.price_type).toBe('start_from');

    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(dialog.getByText('Isi harga maksimum untuk tipe Rentang.')).toBeVisible();
    await dialog.locator('#svc-price_max').fill('40K');
    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(
      dialog.getByText('Harga maksimum harus lebih besar dari harga minimum.'),
    ).toBeVisible();

    await dialog.locator('#svc-price_max').fill('90');
    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await svc(id))!)
      .toMatchObject({ price_type: 'range', price_min: 40000, price_max: 90000 });
    await expect(rowOf(page, id)).toContainText('40K–90K');

    // Kembali ke Tetap mengosongkan harga maksimum di database.
    await select.selectOption('fixed');
    await expect.poll(async () => (await svc(id))!.price_max).toBeNull();
  });

  test('edit lewat dialog: nama, kategori tetap, harga, catatan; slug tidak berubah', async ({
    page,
  }) => {
    await openKatalog(page);
    const id = ids[1]!;
    const before = (await svc(id))!;
    await rowOf(page, id)
      .getByRole('button', { name: `Edit ${NAMES[1]}` })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('#svc-name')).toHaveValue(NAMES[1]!);
    await expect(dialog.locator('#svc-price_min')).toHaveValue('350K');
    await dialog.locator('#svc-price_min').fill('5000');
    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(dialog.getByText('Harga minimal Rp10.000.')).toBeVisible();

    await dialog.locator('#svc-price_min').fill('375');
    await dialog.locator('#svc-note').fill('Catatan uji');
    await dialog.locator('#svc-description').fill('Deskripsi uji');
    await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(dialog).toHaveCount(0);

    await expect.poll(async () => (await svc(id))!.price_min).toBe(375000);
    const after = (await svc(id))!;
    expect(after).toMatchObject({
      note: 'Catatan uji',
      description: 'Deskripsi uji',
      slug: before.slug,
    });
    await expect(rowOf(page, id)).toContainText('Mulai 375K');
    await expect(rowOf(page, id)).toContainText('Catatan uji');
  });

  test('tampil di situs: saklar menyimpan is_active', async ({ page }) => {
    await openKatalog(page);
    const id = ids[2]!;
    const toggle = rowOf(page, id).getByRole('switch', { name: `Tampilkan ${NAMES[2]} di situs` });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect.poll(async () => (await svc(id))!.is_active).toBe(true);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect.poll(async () => (await svc(id))!.is_active).toBe(false);
  });

  test('urutan: naik satu posisi dalam kategori tersimpan; layanan asli tidak bergeser', async ({
    page,
  }) => {
    const before = await categoryServices();
    const realBefore = before
      .filter((s) => !s.name.startsWith(PREFIX))
      .map((s) => [s.id, s.sort_order]);
    await openKatalog(page);

    if (isMobile()) {
      await rowOf(page, ids[2]!)
        .getByRole('button', { name: /^Naikkan/ })
        .click();
    } else {
      await rowOf(page, ids[2]!)
        .getByRole('button', { name: /^Atur urutan/ })
        .focus();
      await page.keyboard.press('ArrowUp');
    }
    await expect(page.getByText('Urutan disimpan').first()).toBeVisible();

    const after = await categoryServices();
    const order = after.map((s) => s.id);
    expect(order.indexOf(ids[2]!)).toBe(order.indexOf(ids[1]!) - 1);
    expect(after.map((s) => s.sort_order)).toEqual(after.map((_, i) => i + 1));
    expect(
      after.filter((s) => !s.name.startsWith(PREFIX)).map((s) => [s.id, s.sort_order]),
    ).toEqual(realBefore);
  });

  test('tambah layanan: validasi dialog, lalu tersimpan; ketersediaan semua cabang "Tidak Tersedia"', async ({
    page,
  }) => {
    await openKatalog(page);
    const name = `${PREFIX} baru`;
    await page.getByRole('link', { name: 'Tambah Layanan' }).click();
    await hydrated(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Simpan Layanan' }).click();
    await expect(dialog.getByText('Nama layanan minimal 2 karakter.')).toBeVisible();
    await expect(dialog.getByText(/Harga wajib diisi/)).toBeVisible();

    await dialog.locator('#svc-name').fill(name);
    await dialog.locator('#svc-category').selectOption(category());
    await dialog.locator('#svc-price_min').fill('95');
    await dialog.locator('#svc-note').fill('Uji');
    // Cabang uji tidak boleh tampil di situs publik: matikan "Tampil di situs".
    await dialog.getByLabel(/^Tampil di situs/).uncheck();
    await dialog.getByRole('button', { name: 'Simpan Layanan' }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => (await categoryServices()).find((s) => s.name === name) ?? null)
      .not.toBeNull();
    const created = (await categoryServices()).find((s) => s.name === name)!;
    expect(created).toMatchObject({
      slug: `uji-e2e-layanan-${RUN}-baru`,
      price_type: 'fixed',
      price_min: 95000,
      price_max: null,
      is_active: false,
      note: 'Uji',
    });
    const all = await categoryServices();
    expect(all[all.length - 1]!.id).toBe(created.id);

    // Trigger: ketersediaan di semua cabang, status awal tidak tersedia.
    const { data: rows } = await service
      .from('branch_services')
      .select('status')
      .eq('service_id', created.id);
    const { count } = await service.from('branches').select('id', { count: 'exact', head: true });
    expect(rows).toHaveLength(count!);
    expect(rows!.every((r) => r.status === 'unavailable')).toBe(true);
    await expect(rowOf(page, created.id)).toBeVisible();
  });

  test('hapus: Batal tidak menghapus; Hapus menghapus layanan dan ketersediaannya', async ({
    page,
  }) => {
    const created = (await categoryServices()).find((s) => s.name === `${PREFIX} baru`)!;
    await openKatalog(page);
    const del = () =>
      rowOf(page, created.id).getByRole('button', { name: `Hapus ${created.name}` });

    await del().click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`Hapus layanan ${created.name}?`);
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await svc(created.id)).not.toBeNull();

    await del().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect.poll(() => svc(created.id)).toBeNull();
    const { count } = await service
      .from('branch_services')
      .select('service_id', { count: 'exact', head: true })
      .eq('service_id', created.id);
    expect(count).toBe(0);
  });
});

test.describe.serial('layanan: matriks (ubah data)', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('ganti status satu sel tersimpan dan bertahan setelah muat ulang', async ({ page }) => {
    await openMatriks(page);
    const [branch, id] = [branches[1]!, ids[0]!];
    const select = cellSelect(page, branch.id, id);
    await expect(select).toHaveValue('unavailable');

    await select.selectOption('soon');
    await expect.poll(async () => (await cellRow(branch.id, id))!.status).toBe('soon');
    await expect(select).toHaveClass(/soon/);

    await select.selectOption('available');
    await expect.poll(async () => (await cellRow(branch.id, id))!.status).toBe('available');

    await openMatriks(page);
    await expect(cellSelect(page, branch.id, id)).toHaveValue('available');
    // Sel lain di baris yang sama tidak berubah.
    expect((await cellRow(branches[0]!.id, id))!.status).toBe('unavailable');
  });

  test('harga khusus: simpan "85" dan "100K", tampil di sel, validasi, lalu hapus', async ({
    page,
  }) => {
    await openMatriks(page);
    const [branch, id] = [branches[2]!, ids[1]!];
    const open = () =>
      page.getByRole('button', {
        name: new RegExp(`^(Atur harga khusus|Harga khusus) ${NAMES[1]} di ${branch.name}`),
      });

    await open().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#ov-max').fill('100K');
    await dialog.getByRole('button', { name: 'Simpan Harga' }).click();
    await expect(dialog.getByText('Isi harga minimum dulu sebelum harga maksimum.')).toBeVisible();

    await dialog.locator('#ov-min').fill('120K');
    await dialog.getByRole('button', { name: 'Simpan Harga' }).click();
    await expect(
      dialog.getByText('Harga maksimum harus lebih besar dari harga minimum.'),
    ).toBeVisible();
    expect((await cellRow(branch.id, id))!.price_override_min).toBeNull();

    await dialog.locator('#ov-min').fill('85');
    await dialog.locator('#ov-max').fill('100K');
    await dialog.getByRole('button', { name: 'Simpan Harga' }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await cellRow(branch.id, id))!)
      .toMatchObject({ price_override_min: 85000, price_override_max: 100000 });
    await expect(
      cellSelect(page, branch.id, id).locator('xpath=ancestor::span[@role="cell"]'),
    ).toContainText('85K–100K');
    // Status sel tidak ikut berubah.
    expect((await cellRow(branch.id, id))!.status).toBe('unavailable');

    await open().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hapus harga khusus' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
      .poll(async () => (await cellRow(branch.id, id))!)
      .toMatchObject({ price_override_min: null, price_override_max: null });
  });

  test('terapkan ke semua cabang: status sama di semua cabang, harga khusus tetap', async ({
    page,
  }) => {
    const [id, branch] = [ids[2]!, branches[3]!];
    await service
      .from('branch_services')
      .update({ price_override_min: 88000 })
      .eq('branch_id', branch.id)
      .eq('service_id', id);
    await openMatriks(page);

    await page.getByRole('button', { name: `Terapkan status ${NAMES[2]} ke semua cabang` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Terapkan' })).toBeDisabled();
    await dialog.getByLabel('Status untuk semua cabang').selectOption('soon');
    await dialog.getByRole('button', { name: 'Terapkan' }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => {
        const { data } = await service
          .from('branch_services')
          .select('status')
          .eq('service_id', id);
        // Spec Cabang membuat/menghapus cabang uji bersamaan: bandingkan dengan jumlah cabang saat ini.
        const { count } = await service.from('branches').select('id', { count: 'exact', head: true });
        return data!.every((r) => r.status === 'soon') && data!.length === count;
      })
      .toBe(true);
    expect((await cellRow(branch.id, id))!.price_override_min).toBe(88000);
    for (const b of branches) await expect(cellSelect(page, b.id, id)).toHaveValue('soon');

    // Layanan lain tidak ikut berubah.
    expect((await cellRow(branches[0]!.id, ids[0]!))!.status).toBe('unavailable');
  });

  test('kolom layanan menempel saat matriks digeser ke samping', async ({ page }) => {
    await openMatriks(page);
    const region = page.getByRole('region', { name: /Matriks ketersediaan/ });
    const header = page.getByRole('rowheader', { name: new RegExp(NAMES[0]!) });
    const regionBox = (await region.boundingBox())!;
    const before = (await header.boundingBox())!;
    expect(Math.abs(before.x - regionBox.x)).toBeLessThan(3);

    await region.evaluate((el) => (el.scrollLeft = 700));
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    const after = (await header.boundingBox())!;
    expect(Math.abs(after.x - regionBox.x)).toBeLessThan(3); // tetap di tepi kiri
    // Sel cabang terakhir kini terlihat.
    // Cabang uji dari tes lain bisa ikut ada, jadi ambil sel terakhir di baris, bukan cabang tertentu.
    // Letak baris layanan uji berbeda per kategori/viewport: gulir halaman ke baris itu (vertikal saja),
    // lalu geser matriks sampai ujung kanan.
    const row = page.locator(`[data-service-id="${ids[0]}"]`).first();
    await row.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await region.evaluate((el) => (el.scrollLeft = el.scrollWidth));
    await expect(
      page.locator(`[data-service-id="${ids[0]}"]`).first().locator('select.av').last(),
    ).toBeInViewport();
  });
});

test.describe('layanan: API', () => {
  test('tanpa login 401; body tidak valid 400; id sembarang 404; contoh bulk upsert 200', async ({
    browser,
  }) => {
    const anon = await browser.newContext();
    expect((await anon.request.get('/api/admin/services')).status()).toBe(401);
    await anon.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCached(page);
    const headers = { Origin: ORIGIN };
    const [serviceId, branch] = [ids[0]!, branches[4]!];

    const emptyPatch = await page.request.patch(`/api/admin/services/${serviceId}`, {
      headers,
      data: {},
    });
    expect(emptyPatch.status()).toBe(400);
    const foreign = await page.request.patch(`/api/admin/services/${serviceId}`, {
      headers,
      data: { slug: 'x' },
    });
    expect(foreign.status()).toBe(400);
    const noMax = await page.request.patch(`/api/admin/services/${serviceId}`, {
      headers,
      data: { price_type: 'range' },
    });
    expect(noMax.status()).toBe(400);
    expect((await noMax.json()).error.details.price_max).toBe(
      'Isi harga maksimum untuk tipe Rentang.',
    );
    const unknown = await page.request.patch(
      '/api/admin/services/00000000-0000-4000-8000-000000000000',
      {
        headers,
        data: { name: 'Layanan X' },
      },
    );
    expect(unknown.status()).toBe(404);

    const badBulk = await page.request.put(`/api/admin/branches/${branch.id}/services`, {
      headers,
      data: [{ service_id: serviceId, status: 'buka' }],
    });
    expect(badBulk.status()).toBe(400);
    const dupBulk = await page.request.put(`/api/admin/branches/${branch.id}/services`, {
      headers,
      data: [
        { service_id: serviceId, status: 'soon' },
        { service_id: serviceId, status: 'available' },
      ],
    });
    expect(dupBulk.status()).toBe(400);
    const noBranch = await page.request.put(
      '/api/admin/branches/00000000-0000-4000-8000-000000000000/services',
      { headers, data: [{ service_id: serviceId, status: 'soon' }] },
    );
    expect(noBranch.status()).toBe(404);

    const ok = await page.request.put(`/api/admin/branches/${branch.id}/services`, {
      headers,
      data: [{ service_id: serviceId, status: 'soon', price_override_min: '85K' }],
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).data[0]).toMatchObject({
      status: 'soon',
      price_override_min: 85000,
      price_override_max: null,
    });
    const list = await page.request.get(`/api/admin/branches/${branch.id}/services`);
    expect(list.status()).toBe(200);
    expect(
      (await list.json()).data.some((r: { service_id: string }) => r.service_id === serviceId),
    ).toBe(true);

    const all = await page.request.put(`/api/admin/services/${serviceId}/availability`, {
      headers,
      data: { status: 'nope' },
    });
    expect(all.status()).toBe(400);
    await context.close();
  });
});

test.describe('layanan: tampilan mobile', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'khusus viewport mobile');
    await loginCached(page);
  });

  test('katalog: kartu, tanpa scroll horizontal, tap target ≥ 44px', async ({ page }) => {
    await openKatalog(page);
    await expect(page.locator('[role="table"]:visible')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const card = rowOf(page, ids[0]!);
    for (const control of await card.locator('button, select, a').all()) {
      const box = await control.boundingBox();
      const label =
        (await control.getAttribute('aria-label')) ??
        (await control.getAttribute('id')) ??
        'kontrol';
      expect(box!.height, label).toBeGreaterThanOrEqual(44);
    }
    await expect(
      page.getByText(categoryTitle(), { exact: false }).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test('matriks: halaman tidak melebar; hanya area matriks yang bisa digeser; kontrol ≥ 44px', async ({
    page,
  }) => {
    await openMatriks(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const region = page.getByRole('region', { name: /Matriks ketersediaan/ });
    expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth + 100)).toBe(true);

    const row = page.locator(`[data-service-id="${ids[0]}"]`).first();
    for (const control of await row.locator('select, button').all()) {
      const box = await control.boundingBox();
      if (!box) continue; // di luar area terlihat tetap ada di DOM; ukuran tetap valid
      const label = (await control.getAttribute('aria-label')) ?? 'kontrol';
      expect(box.height, label).toBeGreaterThanOrEqual(44);
    }
  });
});
