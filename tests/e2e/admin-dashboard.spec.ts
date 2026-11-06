import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

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
const created: string[] = [];

test.afterAll(async () => {
  if (created.length > 0) await service.from('leads').delete().in('id', created);
});

async function login(page: Page) {
  const res = await page.request.post('/api/auth/login', {
    data: { email, password, remember: true },
    headers: { Origin: ORIGIN },
  });
  expect(res.status()).toBe(200);
}

const stat = (page: Page, key: string) => page.locator(`[data-stat="${key}"]`);

test.describe('dashboard admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('kartu statistik sama dengan isi database', async ({ page }) => {
    const [branches, barbers] = await Promise.all([
      service.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
      service.from('barbers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(stat(page, 'branches')).toHaveText(String(branches.count));
    await expect(stat(page, 'barbers')).toHaveText(String(barbers.count));
    await expect(page.getByText(/\d+ Bandung Raya · \d+ Jabodetabek/)).toBeVisible();
    await expect(page.getByText('Publikasi Terakhir')).toBeVisible();
  });

  test('lead baru muncul di lead terbaru dan tercatat di Lead Baru; Detail membuka lead', async ({
    page,
  }) => {
    const name = `UJI-E2E Dashboard ${RUN}`;
    const { data, error } = await service
      .from('leads')
      .insert({
        type: 'partnership',
        full_name: name,
        whatsapp_number: `62813${String(Date.now() % 1000000).padStart(6, '0')}`,
        city: 'Bogor',
        extra: { location_status: 'sudah_ada' },
        consent: true,
        ip_hash: 'e'.repeat(64),
      })
      .select('id')
      .single();
    if (error) throw error;
    created.push(data.id);

    await page.goto('/admin');
    // Hitungan global ikut berubah oleh tes paralel, jadi hanya pastikan ada minimal satu lead baru.
    expect(Number(await stat(page, 'new-leads').textContent())).toBeGreaterThanOrEqual(1);
    const row = page.locator(`[data-lead-id="${data.id}"]:visible`).first();
    await expect(row).toContainText(name);
    await expect(row).toContainText('Kemitraan');

    await row.getByRole('link', { name: new RegExp(`Detail ${name}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/leads\\?type=partnership&id=${data.id}`));
    await expect(page.locator('aside.leads-detail').getByRole('heading', { name })).toBeVisible();
  });

  test('"Perlu Perhatian" dihitung dari data nyata', async ({ page }) => {
    const [incomplete, withBarbers] = await Promise.all([
      service.from('branches').select('name').eq('is_active', true).eq('address_incomplete', true),
      service.from('branches').select('id, name, barbers(id)').eq('is_active', true),
    ]);
    const withoutPricelist = (withBarbers.data ?? []).filter(
      (branch) => !(branch.barbers as { id: string }[]).length,
    );
    await page.goto('/admin');
    const section = page.getByRole('region', { name: 'Perlu Perhatian' });
    if (withoutPricelist.length > 0) {
      await expect(section).toContainText(withoutPricelist[0]!.name);
      await expect(section).toContainText('belum diisi');
    }
    if ((incomplete.data ?? []).length > 0) {
      await expect(section).toContainText(incomplete.data![0]!.name);
      await expect(section).toContainText('belum lengkap');
    }
  });

  test('aksi cepat: tautan benar dan tap target ≥ 44px, tanpa overflow', async ({ page }) => {
    await page.goto('/admin');
    const nav = page.getByRole('navigation', { name: 'Aksi cepat' });
    await expect(nav.getByRole('link', { name: 'Ubah harga barber' })).toHaveAttribute(
      'href',
      '/admin/barber',
    );
    await expect(nav.getByRole('link', { name: 'Ekspor leads (CSV)' })).toHaveAttribute(
      'href',
      '/api/admin/leads/export',
    );
    for (const link of await nav.getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);
  });

  test('menu samping menandai Dashboard aktif; drawer mobile bisa dibuka dan ditutup', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(
      page.locator('#sidebar').getByRole('link', { name: 'Dashboard', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.waitForFunction(() => document.querySelector('script[type="module"]') !== null);
      await page.waitForTimeout(500);
      await expect(page.locator('#sidebar')).not.toBeInViewport();
      await page.getByRole('button', { name: 'Buka menu' }).click();
      await expect(page.locator('#sidebar')).toBeInViewport();
      await page.keyboard.press('Escape');
      await expect(page.locator('#sidebar')).not.toBeInViewport();
    }
  });
});
