// Alur utama end-to-end (PRD 4.7 "Strategi Testing", M4 bagian 1). Tes per fitur sudah ada di
// spec lain; spec ini merangkai langkahnya seperti yang dilakukan pengunjung dan admin sungguhan,
// di viewport desktop (1440×900) dan mobile (390×844).
import { expect, test, type Page } from '@playwright/test';
import barbersJson from '../../src/data/seed/barbers.json' with { type: 'json' };
import { e2eEnabled, service } from './admin-helpers';

const isMobile = () => test.info().project.name === 'mobile';

const textOf = (url: string) => decodeURIComponent(new URL(url).searchParams.get('text') ?? '');

/** Tangkap tab wa.me tanpa benar-benar membuka WhatsApp. */
async function stubWhatsApp(page: Page) {
  await page
    .context()
    .route('https://wa.me/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>wa.me (stub)</title>' }),
    );
}

test.describe('pengunjung: pilih cabang → harga berubah → booking barber → WhatsApp', () => {
  // Barber aktif pertama Dago menurut seed (database identik seed, dijaga tests/integration).
  const dagoFirst = barbersJson
    .filter((b) => b.branch_slug === 'dago' && b.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)[0]!;
  // Situs publik memakai `name` ("By Barber" tetap "By Barber"); `label` hanya di admin (D-07).
  const dagoName = dagoFirst.name;
  const dagoPrice = `${dagoFirst.haircut_price / 1000}K`;

  test('Dipatiukur → Dago: tabel berganti, tombol booking membuka wa.me dengan pesan benar', async ({
    page,
  }) => {
    await stubWhatsApp(page);
    await page.goto('/');
    const pricelist = page.locator('#harga');
    await pricelist.scrollIntoViewIfNeeded();
    await expect(page.locator('#harga astro-island').first()).not.toHaveAttribute('ssr', '');

    // Default Dipatiukur.
    const table = pricelist.locator('[role="table"]:visible').first();
    await expect(table).toHaveAttribute('aria-label', /Dipatiukur/);

    // Pilih Dago: chip di desktop, dropdown di mobile.
    if (isMobile()) {
      await page.selectOption('#pricelist-cabang', 'dago');
    } else {
      await pricelist.getByRole('button', { name: /^Dago / }).click();
    }
    await expect(page).toHaveURL(/\?cabang=dago#harga$/);
    await expect(table).toHaveAttribute('aria-label', /Dago/);
    await expect(
      pricelist.getByText(dagoName, { exact: true }).locator('visible=true').first(),
    ).toBeVisible();

    // Klik tombol booking barber pertama Dago → tab baru ke wa.me.
    const book = pricelist
      .locator(`a[aria-label="Booking ${dagoName} via WhatsApp"]:visible`)
      .first();
    await expect(book).toHaveAttribute('data-wa-context', 'barber');
    await expect(book).toHaveAttribute('data-branch', 'dago');
    const [popup] = await Promise.all([page.waitForEvent('popup'), book.click()]);
    await popup.waitForLoadState('domcontentloaded');

    const url = new URL(popup.url());
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toMatch(/^\/62\d{8,13}$/);
    expect(textOf(popup.url())).toBe(
      `Halo Golden Barber Dago, saya mau booking Haircut Reguler dengan barber ${dagoName} (${dagoPrice}). Kapan slot yang tersedia?`,
    );
  });
});

test.describe('admin: login → ubah harga → status publikasi berubah', () => {
  test.skip(!e2eEnabled, 'E2E_ADMIN_* dan kunci Supabase belum diset');

  // Barber uji NONAKTIF bernama unik di cabang yang tidak diasersi spec lain (tidak tampil di situs).
  const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const NAME = `UJI-E2E Alur ${RUN}`;
  const branchSlug = () => (isMobile() ? 'ujung-berung' : 'karawaci');
  let barberId = '';

  test.beforeAll(async () => {
    const { data: branch, error: branchError } = await service
      .from('branches')
      .select('id')
      .eq('slug', branchSlug())
      .single();
    if (branchError) throw branchError;
    const { data: last } = await service
      .from('barbers')
      .select('sort_order')
      .eq('branch_id', branch.id)
      .order('sort_order', { ascending: false })
      .limit(1);
    // updated_at lama: barber ini dianggap sudah tayang, jadi yang mengubah status hanya edit di tes.
    const { data, error } = await service
      .from('barbers')
      .insert({
        branch_id: branch.id,
        name: NAME,
        is_active: false,
        sort_order: (last?.[0]?.sort_order ?? 0) + 1,
        haircut_price: 100000,
        updated_at: '2000-01-01T00:00:00Z',
      })
      .select('id')
      .single();
    if (error) throw error;
    barberId = data.id;
  });

  test.afterAll(async () => {
    await service.from('barbers').delete().like('name', 'UJI-E2E Alur %');
  });

  test('login lewat form, edit harga barber, PublishBar menandai perubahan belum tayang', async ({
    page,
  }) => {
    // Toolbar dev Astro mencegat klik di viewport mobile.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'astro-dev-toolbar{display:none!important}';
        document.head.append(style);
      });
    });

    // 1. Login lewat form.
    await page.goto('/admin/login?redirect=/admin');
    await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
    await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    // Cek pathname, bukan /\/admin$/: URL login sendiri berakhir "?redirect=/admin".
    await expect(page).toHaveURL((url) => url.pathname === '/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    // Dibaca dari dalam halaman: cookie sesi ber-Secure tidak ikut lewat page.request di http://localhost.
    const status = async () => {
      const res = await page.evaluate(async () => {
        const r = await fetch('/api/admin/publish/status');
        return { code: r.status, body: await r.json() };
      });
      expect(res.code).toBe(200);
      return res.body.data as {
        has_unpublished_changes: boolean;
        last_success_at: string | null;
        counts: { barbers: number };
      };
    };
    const before = await status();

    // 2. Ubah harga Haircut barber uji: 100K → 115K.
    await page.goto(`/admin/barber?cabang=${branchSlug()}`);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.locator('[data-hydrated="false"]')).toHaveCount(0);
    const control = page.locator(`#${isMobile() ? 'm' : 'd'}-${barberId}-haircut_price`);
    await control.scrollIntoViewIfNeeded();
    if (!isMobile()) await control.click();
    await control.fill('115');
    await control.press('Enter');

    await expect
      .poll(async () => {
        const { data } = await service
          .from('barbers')
          .select('haircut_price, updated_at')
          .eq('id', barberId)
          .single();
        return data;
      })
      .toMatchObject({ haircut_price: 115000 });

    // 3. Status publikasi berubah: baris ini kini lebih baru dari publikasi terakhir.
    const { data: row } = await service
      .from('barbers')
      .select('updated_at')
      .eq('id', barberId)
      .single();
    if (before.last_success_at) {
      expect(new Date(row!.updated_at).getTime()).toBeGreaterThan(
        new Date(before.last_success_at).getTime(),
      );
    }
    await expect
      .poll(async () => (await status()).counts.barbers)
      .toBeGreaterThan(before.counts.barbers);

    const bar = page.locator('[data-publishbar]');
    await expect(bar.getByRole('status')).toContainText(/perubahan belum dipublikasikan/);
    await expect(bar.getByRole('button', { name: 'Publikasikan', exact: true })).toBeEnabled();
  });
});
