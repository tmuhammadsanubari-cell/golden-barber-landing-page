import { expect, test, type Locator, type Page } from '@playwright/test';
import { e2eEnabled, hydrated, loginCached, service } from './admin-helpers';

test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

// Desktop dan mobile berjalan di proses terpisah dengan satu database, jadi tiap project memakai
// cabang asli sendiri (Condet / Graha Raya), diisi barber uji NONAKTIF dan bernama unik per proses
// (tidak tampil di situs publik, tidak dihitung dashboard). Cabang yang diasersi tes lain
// (Dipatiukur, Dago, Citra Raya) tidak disentuh. "Pindah cabang" memakai Peta sebagai tujuan.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `UJI-E2E Barber ${RUN}`;
const NAMES = [`${PREFIX} 1`, `${PREFIX} 2`, `${PREFIX} 3`];

const isMobile = () => test.info().project.name === 'mobile';
const homeSlug = () => (isMobile() ? 'graha-raya' : 'condet');

let homeId = '';
let petaId = '';
let homeName = '';
const ids: string[] = []; // id tiga barber uji
let addedId: string | null = null;

const barber = async (id: string) => {
  const { data, error } = await service.from('barbers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};
const branchBarbers = async (branchId: string) => {
  const { data, error } = await service
    .from('barbers')
    .select('*')
    .eq('branch_id', branchId)
    .order('sort_order');
  if (error) throw error;
  return data;
};

test.beforeAll(async () => {
  const { data: branches } = await service
    .from('branches')
    .select('id, slug, name')
    .in('slug', [homeSlug(), 'peta']);
  const home = branches!.find((b) => b.slug === homeSlug())!;
  homeId = home.id;
  homeName = home.name;
  petaId = branches!.find((b) => b.slug === 'peta')!.id;

  const existing = await branchBarbers(homeId);
  const start = Math.max(0, ...existing.map((b) => b.sort_order));
  const rows = [
    { haircut_price: 130000, haircut_original_price: 150000, long_trim_price: 150000 },
    { haircut_price: 100000, haircut_original_price: null, long_trim_price: 115000 },
    { haircut_price: 85000, haircut_original_price: null, long_trim_price: null },
  ];
  for (const [index, row] of rows.entries()) {
    const { data, error } = await service
      .from('barbers')
      .insert({
        branch_id: homeId,
        name: NAMES[index]!,
        is_active: false,
        sort_order: start + index + 1,
        ...row,
      })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(data.id);
  }
});

test.afterAll(async () => {
  await service.from('barbers').delete().like('name', `${PREFIX}%`);
  // Pengaman: seed memakai sort_order 1..n per cabang; rapikan bila ada celah.
  for (const branchId of [homeId, petaId]) {
    if (!branchId) continue;
    const rows = await branchBarbers(branchId);
    for (const [index, row] of rows.entries()) {
      if (row.sort_order !== index + 1) {
        await service
          .from('barbers')
          .update({ sort_order: index + 1 })
          .eq('id', row.id);
      }
    }
  }
});

async function openBranch(page: Page, slug = homeSlug()) {
  await page.goto(`/admin/barber?cabang=${slug}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Barber & Harga' })).toBeVisible();
  await hydrated(page);
}

const rowOf = (page: Page, id: string) => page.locator(`[data-barber-id="${id}"]:visible`);

type PriceKey =
  'haircut_price' | 'haircut_original_price' | 'long_trim_price' | 'long_trim_original_price';

/** Desktop: klik teks harga → input. Mobile: input selalu ada. Lalu ketik dan Enter. */
async function editPrice(page: Page, id: string, key: PriceKey, text: string) {
  const prefix = isMobile() ? 'm' : 'd';
  const control = page.locator(`#${prefix}-${id}-${key}`);
  if (!isMobile()) await control.click();
  await control.fill(text);
  await control.press('Enter');
}

const priceControl = (page: Page, id: string, key: PriceKey): Locator =>
  page.locator(`#${isMobile() ? 'm' : 'd'}-${id}-${key}`);

test.describe.serial('barber & harga', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('daftar mengikuti database: urutan, ringkasan, harga tampil', async ({ page }) => {
    const all = await branchBarbers(homeId);
    await openBranch(page);

    const shown = await page
      .locator('[data-barber-id]:visible')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-barber-id')));
    expect(shown).toEqual(all.map((b) => b.id));
    await expect(page.getByText(new RegExp(`^${all.length} baris`))).toBeVisible();

    // Harga barber uji pertama: 130K dengan harga coret 150K.
    if (isMobile()) {
      await expect(priceControl(page, ids[0]!, 'haircut_price')).toHaveValue('130');
      await expect(priceControl(page, ids[0]!, 'haircut_original_price')).toHaveValue('150');
    } else {
      await expect(priceControl(page, ids[0]!, 'haircut_price')).toHaveText('130K');
      await expect(priceControl(page, ids[0]!, 'haircut_original_price')).toHaveText('150K');
      await expect(priceControl(page, ids[1]!, 'haircut_original_price')).toHaveText('—');
    }
    // Barber nonaktif: saklar Aktif mati.
    await expect(rowOf(page, ids[0]!).getByRole('switch', { name: /^Aktif/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('edit harga inline: "120", "125.000", dan "130K" dinormalisasi, tersimpan, tampil "Tersimpan"', async ({
    page,
  }) => {
    await openBranch(page);
    const id = ids[1]!;

    await editPrice(page, id, 'haircut_price', '120');
    await expect.poll(async () => (await barber(id))!.haircut_price).toBe(120000);
    await expect(rowOf(page, id).getByText('Tersimpan').first()).toBeVisible();

    await editPrice(page, id, 'long_trim_price', '125.000');
    await expect.poll(async () => (await barber(id))!.long_trim_price).toBe(125000);

    await editPrice(page, id, 'haircut_price', '110K');
    await expect.poll(async () => (await barber(id))!.haircut_price).toBe(110000);

    // Setelah muat ulang, nilai yang tersimpan tampil.
    await openBranch(page);
    if (isMobile()) {
      await expect(priceControl(page, id, 'haircut_price')).toHaveValue('110');
      await expect(priceControl(page, id, 'long_trim_price')).toHaveValue('125');
    } else {
      await expect(priceControl(page, id, 'haircut_price')).toHaveText('110K');
      await expect(priceControl(page, id, 'long_trim_price')).toHaveText('125K');
    }
  });

  test('harga coret: harus lebih besar dari harga aktual; bisa diganti dan dikosongkan', async ({
    page,
  }) => {
    await openBranch(page);
    const id = ids[0]!; // 130K, coret 150K
    const alert = rowOf(page, id).getByRole('alert');

    await editPrice(page, id, 'haircut_original_price', '120');
    await expect(alert).toContainText('Harga coret harus lebih besar dari harga aktual.');
    expect((await barber(id))!.haircut_original_price).toBe(150000);

    // Sama dengan harga aktual juga ditolak. Escape membatalkan dan memulihkan nilai lama.
    await priceControl(page, id, 'haircut_original_price').fill('130');
    await priceControl(page, id, 'haircut_original_price').press('Enter');
    await expect(alert).toContainText('lebih besar');
    await priceControl(page, id, 'haircut_original_price').press('Escape');
    await expect(alert).toHaveCount(0);
    expect((await barber(id))!.haircut_original_price).toBe(150000);

    await editPrice(page, id, 'haircut_original_price', '160');
    await expect.poll(async () => (await barber(id))!.haircut_original_price).toBe(160000);

    // Menaikkan harga aktual sampai menyentuh harga coret ditolak, pesan di sel yang sedang diedit.
    await editPrice(page, id, 'haircut_price', '160');
    await expect(alert).toContainText('Harga coret harus lebih besar');
    expect((await barber(id))!.haircut_price).toBe(130000);
    await priceControl(page, id, 'haircut_price').press('Escape');

    // Kosongkan harga coret.
    await editPrice(page, id, 'haircut_original_price', '');
    await expect.poll(async () => (await barber(id))!.haircut_original_price).toBeNull();
    await expect(alert).toHaveCount(0);
  });

  test('batas dan format harga: minimal Rp10.000, maksimal Rp10.000.000, sampah ditolak, haircut wajib', async ({
    page,
  }) => {
    await openBranch(page);
    const id = ids[2]!;
    const alert = rowOf(page, id).getByRole('alert');
    const key = 'haircut_price';

    await editPrice(page, id, key, '5000');
    await expect(alert).toContainText('Harga minimal Rp10.000.');
    await priceControl(page, id, key).press('Escape');

    await editPrice(page, id, key, '12000000');
    await expect(alert).toContainText('Harga maksimal Rp10.000.000.');
    await priceControl(page, id, key).press('Escape');

    await editPrice(page, id, key, 'murah');
    await expect(alert).toContainText('Harga tidak valid');
    await priceControl(page, id, key).press('Escape');

    await editPrice(page, id, key, '');
    await expect(alert).toContainText('wajib diisi');
    await priceControl(page, id, key).press('Escape');

    expect((await barber(id))!.haircut_price).toBe(85000);

    // Batas yang sah: tepat Rp10.000 diterima, lalu kembalikan.
    await editPrice(page, id, key, '10000');
    await expect.poll(async () => (await barber(id))!.haircut_price).toBe(10000);
    await editPrice(page, id, key, '85');
    await expect.poll(async () => (await barber(id))!.haircut_price).toBe(85000);
  });

  test('nama inline, By Barber memunculkan label, label tersimpan', async ({ page }) => {
    await openBranch(page);
    const id = ids[2]!;
    const prefix = isMobile() ? 'm' : 'd';

    await page.locator(`#${prefix}-${id}-name`).click();
    const nameInput = page.locator(`#${prefix}-${id}-name`);
    await nameInput.fill(`${NAMES[2]} baru`);
    await nameInput.press('Enter');
    await expect.poll(async () => (await barber(id))!.name).toBe(`${NAMES[2]} baru`);

    // Nama kosong ditolak.
    await page.locator(`#${prefix}-${id}-name`).click();
    await page.locator(`#${prefix}-${id}-name`).fill('  ');
    await page.locator(`#${prefix}-${id}-name`).press('Enter');
    await expect(rowOf(page, id).getByRole('alert')).toContainText('Nama barber wajib diisi.');
    await page.locator(`#${prefix}-${id}-name`).press('Escape');

    await expect(page.locator(`#${prefix}-${id}-label`)).toHaveCount(0);
    await rowOf(page, id)
      .getByRole('switch', { name: /^By Barber/ })
      .click();
    await expect.poll(async () => (await barber(id))!.is_generic).toBe(true);

    await page.locator(`#${prefix}-${id}-label`).click();
    await page.locator(`#${prefix}-${id}-label`).fill('Tier 9');
    await page.locator(`#${prefix}-${id}-label`).press('Enter');
    await expect.poll(async () => (await barber(id))!.label).toBe('Tier 9');

    await rowOf(page, id)
      .getByRole('switch', { name: /^By Barber/ })
      .click();
    await expect.poll(async () => (await barber(id))!.is_generic).toBe(false);
    await service.from('barbers').update({ name: NAMES[2]!, label: null }).eq('id', id);
  });

  test('salin harga dari barber lain', async ({ page }) => {
    await openBranch(page);
    const [source, target] = [ids[0]!, ids[2]!];
    await rowOf(page, target)
      .getByRole('button', { name: /^Salin harga ke/ })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Salin harga ke');
    // Sebelum memilih sumber, tombol Salin dimatikan.
    await expect(dialog.getByRole('button', { name: 'Salin Harga' })).toBeDisabled();
    await dialog.getByLabel('Salin dari').selectOption(source);
    await dialog.getByRole('button', { name: 'Salin Harga' }).click();
    await expect(dialog).toHaveCount(0);

    const [from, to] = [(await barber(source))!, (await barber(target))!];
    expect(to.haircut_price).toBe(from.haircut_price);
    expect(to.haircut_original_price).toBe(from.haircut_original_price);
    expect(to.long_trim_price).toBe(from.long_trim_price);
    expect(to.long_trim_original_price).toBe(from.long_trim_original_price);
    if (isMobile()) {
      await expect(priceControl(page, target, 'haircut_price')).toHaveValue('130');
    } else {
      await expect(priceControl(page, target, 'haircut_price')).toHaveText('130K');
    }
  });

  test('urutan: naik satu posisi tersimpan, barber asli tidak bergeser', async ({ page }) => {
    const before = await branchBarbers(homeId);
    const realBefore = before
      .filter((b) => !b.name.startsWith(PREFIX))
      .map((b) => [b.id, b.sort_order]);
    await openBranch(page);

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

    const after = await branchBarbers(homeId);
    const order = after.map((b) => b.id);
    expect(order.indexOf(ids[2]!)).toBe(order.indexOf(ids[1]!) - 1);
    expect(after.map((b) => b.sort_order)).toEqual(after.map((_, i) => i + 1));
    expect(
      after.filter((b) => !b.name.startsWith(PREFIX)).map((b) => [b.id, b.sort_order]),
    ).toEqual(realBefore);

    // Saat pencarian aktif, urutan tidak boleh diubah.
    await page.getByLabel('Cari').fill(NAMES[0]!);
    await expect(page.locator('[data-barber-id]:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^(Atur urutan|Naikkan|Turunkan)/ })).toHaveCount(
      0,
    );
    await page.getByLabel('Cari').fill('zzzz-tidak-ada');
    await expect(page.getByText('Tidak ada barber yang cocok')).toBeVisible();
  });

  test('pindah cabang: barber dan harganya pindah ke akhir cabang tujuan', async ({ page }) => {
    const id = ids[1]!;
    const before = (await barber(id))!;
    await openBranch(page);
    await rowOf(page, id)
      .getByRole('button', { name: /^Pindah/ })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Pindahkan' })).toBeDisabled();
    // Cabang sendiri tidak ada di daftar tujuan.
    await expect(dialog.getByRole('option', { name: new RegExp(`^${homeName}`) })).toHaveCount(0);
    await dialog.getByLabel('Cabang tujuan').selectOption(petaId);
    await dialog.getByRole('button', { name: 'Pindahkan' }).click();
    await expect(page.getByText(/dipindah ke Peta/).first()).toBeVisible();

    await expect(rowOf(page, id)).toHaveCount(0);
    const after = (await barber(id))!;
    expect(after.branch_id).toBe(petaId);
    expect(after.haircut_price).toBe(before.haircut_price);
    // Peta juga dipakai project lain sebagai tujuan, jadi "paling akhir" tidak tentu milik kita;
    // yang pasti: urutannya setelah semua barber asli Peta.
    const realInPeta = (await branchBarbers(petaId)).filter((b) => !b.name.startsWith('UJI-E2E'));
    expect(after.sort_order).toBeGreaterThan(Math.max(...realInPeta.map((b) => b.sort_order)));

    // Muncul di halaman Peta.
    await openBranch(page, 'peta');
    await expect(rowOf(page, id)).toBeVisible();
  });

  test('tambah barber: validasi dialog, lalu tersimpan di akhir daftar cabang', async ({
    page,
  }) => {
    await openBranch(page);
    const name = `${PREFIX} baru`;
    await page.getByRole('button', { name: 'Tambah Barber' }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Simpan Barber' }).click();
    await expect(dialog.getByText('Nama barber wajib diisi.')).toBeVisible();
    await expect(dialog.getByText(/Harga Haircut Reguler wajib diisi/)).toBeVisible();

    await dialog.locator('#add-name').fill(name);
    await dialog.locator('#add-haircut_price').fill('95');
    await dialog.locator('#add-long_trim_price').fill('110K');
    await dialog.getByRole('button', { name: 'Simpan Barber' }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => (await branchBarbers(homeId)).find((b) => b.name === name) ?? null)
      .not.toBeNull();
    const created = (await branchBarbers(homeId)).find((b) => b.name === name)!;
    addedId = created.id;
    // Cegah barber uji aktif lebih lama dari perlu (dashboard & situs membaca database yang sama).
    await service.from('barbers').update({ is_active: false }).eq('id', created.id);

    expect(created).toMatchObject({
      haircut_price: 95000,
      long_trim_price: 110000,
      is_generic: false,
    });
    const all = await branchBarbers(homeId);
    expect(all[all.length - 1]!.id).toBe(created.id);
    await expect(rowOf(page, created.id)).toBeVisible();
  });

  test('hapus: Batal tidak menghapus; Hapus menghapus', async ({ page }) => {
    const id = addedId!;
    expect(id).toBeTruthy();
    await openBranch(page);
    const del = () => rowOf(page, id).getByRole('button', { name: /^Hapus/ });

    await del().click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`Hapus barber ${PREFIX} baru?`);
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await barber(id)).not.toBeNull();

    await del().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect.poll(() => barber(id)).toBeNull();
    await expect(rowOf(page, id)).toHaveCount(0);
  });

  test('API: tanpa login ditolak; body kosong, field asing, dan id sembarang ditolak', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const anon = await context.request.get(`/api/admin/barbers?branch_id=${homeId}`);
    expect(anon.status()).toBe(401);
    await context.close();

    const page = await (await browser.newContext()).newPage();
    await loginCached(page);
    const headers = { Origin: `http://localhost:${process.env.E2E_PORT ?? 4321}` };
    const url = `/api/admin/barbers/${ids[0]}`;

    const empty = await page.request.patch(url, { headers, data: {} });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).error.code).toBe('VALIDATION_ERROR');

    const foreign = await page.request.patch(url, { headers, data: { branch_id: petaId } });
    expect(foreign.status()).toBe(400);

    const low = await page.request.patch(url, { headers, data: { haircut_price: '9K' } });
    expect(low.status()).toBe(400);
    expect((await low.json()).error.details.haircut_price).toBe('Harga minimal Rp10.000.');

    const unknown = await page.request.patch(
      '/api/admin/barbers/00000000-0000-4000-8000-000000000000',
      {
        headers,
        data: { name: 'X' },
      },
    );
    expect(unknown.status()).toBe(404);

    const bad = await page.request.patch('/api/admin/barbers/bukan-uuid', {
      headers,
      data: { name: 'X' },
    });
    expect(bad.status()).toBe(404);

    // Contoh PRD: harga "120K" + coret 150000 → 200 dan nilai ternormalisasi di response.
    const ok = await page.request.patch(url, {
      headers,
      data: { haircut_price: '120K', haircut_original_price: 150000 },
    });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.data).toMatchObject({ haircut_price: 120000, haircut_original_price: 150000 });
    await service.from('barbers').update({ haircut_price: 130000 }).eq('id', ids[0]!);
  });
});

test.describe('barber & harga: tampilan mobile', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'khusus viewport mobile');
    await loginCached(page);
  });

  test('kartu, tanpa scroll horizontal, tap target ≥ 44px', async ({ page }) => {
    await openBranch(page);
    await expect(page.locator('[role="table"]:visible')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const card = rowOf(page, ids[0]!);
    for (const control of await card.locator('button, input, select, a').all()) {
      const box = await control.boundingBox();
      const label =
        (await control.getAttribute('aria-label')) ??
        (await control.getAttribute('id')) ??
        'kontrol';
      expect(box!.height, label).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('barber & harga: pilih cabang', () => {
  test.beforeEach(async ({ page }) => {
    await loginCached(page);
  });

  test('pilihan cabang memuat barber cabang itu; slug ngawur jatuh ke cabang pusat', async ({
    page,
  }) => {
    const { data: dago } = await service.from('branches').select('id').eq('slug', 'dago').single();
    const expected = await branchBarbers(dago!.id);
    await openBranch(page);
    await page.locator('#bb-cab').selectOption(dago!.id);
    await expect(page).toHaveURL(/\/admin\/barber\?cabang=dago/);
    await hydrated(page);
    await expect(page.locator('[data-barber-id]:visible')).toHaveCount(expected.length);

    await openBranch(page, 'slug-ngawur');
    const { data: flagship } = await service
      .from('branches')
      .select('id')
      .eq('is_flagship', true)
      .single();
    await expect(page.locator('#bb-cab')).toHaveValue(flagship!.id);
  });

  test('tanpa login diarahkan ke login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/admin/barber');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fbarber/);
    await context.close();
  });
});
