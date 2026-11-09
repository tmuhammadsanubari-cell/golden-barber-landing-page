// Pemanasan dev server sebelum tes. Dev server Astro/Vite mengompilasi halaman dan mengoptimalkan
// dependensi client saat PERTAMA dibuka, lalu memuat ulang halaman yang sedang terbuka ("Outdated
// Optimize Dep", navigasi tiba-tiba). Di suite sebesar ini, itu membuat tes acak gagal dengan
// `net::ERR_ABORTED`, klik yang tak berpindah, atau navigasi di tengah asersi. Membuka semua
// halaman sekali di sini (dengan browser sungguhan, agar modul client ikut dikompilasi) membuat tes
// berjalan di atas server yang sudah stabil.
import { chromium, type FullConfig } from '@playwright/test';

const PUBLIC_PAGES = ['/', '/cabang/dipatiukur/', '/kebijakan-privasi/', '/admin/login'];
const ADMIN_PAGES = [
  '/admin',
  '/admin/cabang',
  '/admin/barber',
  '/admin/layanan',
  '/admin/layanan?tab=ketersediaan',
  '/admin/leads',
  '/admin/galeri',
  '/admin/testimoni',
  '/admin/faq',
  '/admin/pengaturan',
  '/admin/publikasi',
  '/admin/pengguna',
];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  const warm = async (path: string) => {
    try {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 90_000 });
    } catch {
      // Muat ulang oleh Vite saat pemanasan itu justru tujuannya; lewati.
    }
  };

  for (const path of PUBLIC_PAGES) await warm(path);

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (email && password) {
    const res = await context.request.post('/api/auth/login', {
      data: { email, password, remember: true },
      headers: { Origin: new URL(baseURL).origin },
    });
    if (res.ok()) {
      // Dua putaran: putaran kedua memastikan tidak ada pengoptimalan susulan.
      for (let round = 0; round < 2; round += 1) {
        for (const path of ADMIN_PAGES) await warm(path);
      }
    }
  }
  await browser.close();
}
