import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

// Butuh akun admin sungguhan (E2E_ADMIN_*) dan service role untuk menanam data uji.
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(email && password && url && serviceKey);

test.skip(!enabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

const service = enabled
  ? createClient(url!, serviceKey!, { auth: { persistSession: false } })
  : (null as never);

// Penanda unik per proses supaya project desktop & mobile tidak saling bentrok.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const created: string[] = [];

let phoneCounter = 0;
const nextPhone = () =>
  `62811${String(Date.now() % 100000).padStart(5, '0')}${String(++phoneCounter).padStart(2, '0')}`;

async function seed(
  name: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; phone: string }> {
  const phone = nextPhone();
  const { data, error } = await service
    .from('leads')
    .insert({
      type: 'academy',
      full_name: name,
      whatsapp_number: phone,
      city: 'Bandung',
      extra: { age: 21, experience: 'dasar' },
      consent: true,
      ip_hash: 'e'.repeat(64), // bukan hash IP sungguhan, tidak memengaruhi rate limit
      source_path: '/',
      ...overrides,
    })
    .select('id')
    .single();
  if (error) throw error;
  created.push(data.id);
  return { id: data.id, phone };
}

test.afterAll(async () => {
  if (created.length > 0) await service.from('leads').delete().in('id', created);
});

// Sama dengan baseURL di playwright.config.ts; header Origin wajib untuk POST /api/*.
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 4321}`;

async function login(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password, remember: true },
    headers: { Origin: ORIGIN },
  });
  expect(response.status()).toBe(200);
}

const visible = (page: Page, selector: string) => page.locator(`${selector}:visible`);
/** Teks yang benar-benar terlihat (tabel desktop dan kartu mobile sama-sama ada di HTML). */
const shown = (page: Page, text: string) => page.getByText(text).locator('visible=true').first();
/** Island React interaktif setelah atribut ssr hilang; select/tombol SSR sudah 'enabled' sebelum itu. */
const waitHydrated = (page: Page) =>
  page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);

test.describe('halaman leads admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('daftar: lead tampil, tab dan filter status bekerja', async ({ page }) => {
    const name = `UJI-E2E Daftar ${RUN}`;
    await seed(name);
    await seed(`${name} Selesai`, { status: 'closed' });

    await page.goto(`/admin/leads?type=academy&q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Leads' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Academy/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(visible(page, '[data-lead-id]')).toHaveCount(2);

    // Filter status: hanya yang Selesai.
    await page.getByRole('link', { name: /^Selesai · / }).click();
    await expect(page).toHaveURL(/status=closed/);
    await expect(visible(page, '[data-lead-id]')).toHaveCount(1);
    await expect(shown(page, `${name} Selesai`)).toBeVisible();

    // Hapus filter dari state kosong.
    await page.goto(`/admin/leads?type=partnership&q=${encodeURIComponent(name)}`);
    await expect(page.getByText('Tidak ada lead yang cocok')).toBeVisible();
    await page.getByRole('link', { name: 'Hapus filter' }).click();
    await expect(page).not.toHaveURL(/q=/);
  });

  test('pencarian: nama, dan nomor dalam format 08… maupun 62…', async ({ page }) => {
    const name = `UJI-E2E Cari ${RUN}`;
    const { phone } = await seed(name);
    const local = `0${phone.slice(2)}`;

    await page.goto('/admin/leads');
    await page.getByRole('searchbox', { name: 'Cari lead' }).fill(name);
    await page.getByRole('searchbox', { name: 'Cari lead' }).press('Enter');
    await expect(visible(page, '[data-lead-id]')).toHaveCount(1);

    for (const q of [local, phone, local.slice(0, 9)]) {
      await page.goto(`/admin/leads?type=academy&q=${encodeURIComponent(q)}`);
      await expect(shown(page, name), `q=${q}`).toBeVisible();
    }
  });

  test('pencarian tidak bisa disisipi filter PostgREST', async ({ page }) => {
    const name = `UJI-E2E Aman ${RUN}`;
    await seed(name);
    const response = await page.goto(`/admin/leads?q=${encodeURIComponent('x),status.eq.new,(y')}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Leads' })).toBeVisible();
  });

  test('detail: isian lengkap, Chat WA ke nomor lead, simpan status dan catatan', async ({
    page,
  }) => {
    const name = `UJI-E2E Detail ${RUN}`;
    const { id, phone } = await seed(name, { message: 'Ingin belajar fade.' });

    await page.goto(`/admin/leads?type=academy&q=${encodeURIComponent(name)}`);
    await visible(page, '[data-lead-id]')
      .first()
      .getByRole('link', { name: new RegExp(`detail ${name}`, 'i') })
      .click();
    await expect(page).toHaveURL(new RegExp(`id=${id}`));
    await waitHydrated(page);

    const panel = page.locator('aside.leads-detail');
    await expect(panel.getByRole('heading', { name })).toBeVisible();
    await expect(panel.getByText('Pengalaman mencukur')).toBeVisible();
    await expect(panel.getByText('Dasar', { exact: true })).toBeVisible();
    await expect(panel.getByText('Ingin belajar fade.')).toBeVisible();

    const wa = panel.getByRole('link', { name: 'Chat WA' });
    const href = (await wa.getAttribute('href'))!;
    expect(href.startsWith(`https://wa.me/${phone}?text=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain(`Halo ${name}`);

    await panel.locator('#lead-status').selectOption('contacted');
    await expect(page.getByRole('status').filter({ hasText: 'Status diperbarui' })).toBeVisible();
    await panel.getByLabel('Catatan admin').fill('Sudah ditelepon, minta jadwal Desember.');
    await panel.getByRole('button', { name: 'Simpan Catatan' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Catatan tersimpan' })).toBeVisible();

    const { data } = await service
      .from('leads')
      .select('status, admin_note, handled_by')
      .eq('id', id)
      .single();
    expect(data?.status).toBe('contacted');
    expect(data?.admin_note).toBe('Sudah ditelepon, minta jadwal Desember.');
    expect(data?.handled_by).toBeTruthy(); // admin yang menangani tercatat (PRD F-19)

    // Badge di daftar ikut berubah tanpa muat ulang (desktop menampilkan daftar di samping).
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(
        page.locator(`[data-lead-id="${id}"] [data-lead-badge]:visible`).first(),
      ).toHaveText('Dihubungi');
    }
  });

  test('Tandai Spam mengubah status; hapus permanen oleh Super Admin dengan konfirmasi', async ({
    page,
  }) => {
    const name = `UJI-E2E Hapus ${RUN}`;
    const { id } = await seed(name);
    await page.goto(`/admin/leads?type=academy&id=${id}`);
    await waitHydrated(page);
    const panel = page.locator('aside.leads-detail');

    await panel.getByRole('button', { name: 'Tandai Spam' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Ditandai sebagai spam' }),
    ).toBeVisible();
    const spam = await service.from('leads').select('status').eq('id', id).single();
    expect(spam.data?.status).toBe('spam');

    await panel.getByRole('button', { name: 'Hapus permanen' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`Hapus lead ${name}?`);
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toBeHidden();
    expect((await service.from('leads').select('id').eq('id', id)).data).toHaveLength(1);

    await panel.getByRole('button', { name: 'Hapus permanen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(page).not.toHaveURL(/id=/);
    expect((await service.from('leads').select('id').eq('id', id)).data).toHaveLength(0);
  });

  test('25 baris per halaman dan tautan Berikutnya', async ({ page }) => {
    const tag = `UJI-E2E Halaman ${RUN}`;
    const rows = Array.from({ length: 27 }, (_, index) => ({
      type: 'academy' as const,
      full_name: `${tag} ${String(index).padStart(2, '0')}`,
      whatsapp_number: `62812${String(Date.now() % 10000).padStart(4, '0')}${String(index).padStart(3, '0')}`,
      city: 'Bandung',
      extra: { experience: 'dasar' },
      consent: true,
      ip_hash: 'e'.repeat(64),
    }));
    const { data, error } = await service.from('leads').insert(rows).select('id');
    if (error) throw error;
    created.push(...data.map((row) => row.id));

    await page.goto(`/admin/leads?type=academy&q=${encodeURIComponent(tag)}`);
    await expect(visible(page, '[data-lead-id]')).toHaveCount(25);
    await expect(page.getByText('Halaman 1 dari 2')).toBeVisible();
    await page.getByRole('link', { name: 'Berikutnya' }).click();
    await expect(visible(page, '[data-lead-id]')).toHaveCount(2);
    await expect(page.getByText('Halaman 2 dari 2')).toBeVisible();
  });

  test('ekspor CSV: BOM, header, nama berkas, ikut filter, rumus dinetralkan', async ({ page }) => {
    const tag = `UJI-E2E Csv ${RUN}`;
    await seed(`${tag} Biasa`, { message: 'Halo, "dunia"\nbaris dua' });
    await seed(`=HYPERLINK("http://evil.example")`, { city: tag });

    const response = await page.request.get(
      `/api/admin/leads/export?type=academy&q=${encodeURIComponent(tag)}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toMatch(
      /attachment; filename="leads-academy-\d{8}\.csv"/,
    );

    const buffer = await response.body();
    expect([...buffer.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    expect(text.startsWith('Tanggal (WIB),Jenis,Nama,Nomor WhatsApp,Kota')).toBe(true);
    expect(text).toContain(`${tag} Biasa`);
    expect(text).toContain('"Halo, ""dunia""\nbaris dua"');
    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"")"`); // tidak menjadi rumus
    expect(text).not.toMatch(/,=HYPERLINK/);
  });

  test('sesi keluar: halaman dan API leads tertutup lagi', async ({ page }) => {
    await page.request.post('/api/auth/logout', {
      headers: { Origin: ORIGIN },
    });
    const api = await page.request.get('/api/admin/leads');
    expect(api.status()).toBe(401);
    const exportRes = await page.request.get('/api/admin/leads/export');
    expect(exportRes.status()).toBe(401);
    await page.goto('/admin/leads');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fleads$/);
  });
});

test.describe('tampilan mobile', () => {
  test('daftar jadi kartu, tap target ≥ 44px, detail satu halaman, tanpa overflow', async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'khusus viewport mobile');
    await login(page);
    const name = `UJI-E2E Mobile ${RUN}`;
    const { id } = await seed(name);

    await page.goto(`/admin/leads?type=academy&q=${encodeURIComponent(name)}`);
    const card = page.locator('article[data-lead-id]').first();
    await expect(card).toBeVisible();
    await expect(page.locator('[role="table"]')).toBeHidden();
    for (const locator of [
      card.getByRole('link', { name: /Chat WA/ }),
      card.getByRole('link', { name: /Detail/ }),
      page.getByRole('link', { name: /^Semua · / }),
      page.getByRole('link', { name: /Ekspor CSV/ }),
    ]) {
      expect((await locator.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    await card.getByRole('link', { name: /Detail/ }).click();
    await expect(page).toHaveURL(new RegExp(`id=${id}`));
    await expect(page.locator('.leads-list')).toBeHidden(); // detail menggantikan daftar
    await expect(page.getByRole('link', { name: 'Kembali ke daftar' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);
  });
});
