// Pembantu bersama untuk e2e panel admin yang memakai akun dan database sungguhan.
import { createClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

export const adminEmail = process.env.E2E_ADMIN_EMAIL;
export const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const e2eEnabled = Boolean(adminEmail && adminPassword && url && serviceKey);

export const service = e2eEnabled
  ? createClient(url!, serviceKey!, { auth: { persistSession: false } })
  : (null as never);

export const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 4321}`;

type Cookies = Awaited<ReturnType<ReturnType<Page['context']>['cookies']>>;
let sessionCookies: Cookies = [];

/**
 * Login sekali per worker lalu pakai ulang cookie sesi: puluhan login beruntun menekan batas
 * laju Supabase Auth (dan endpoint login memetakan semua galat itu menjadi 401).
 */
export async function loginCached(page: Page) {
  // Toolbar dev Astro melayang di atas tombol (terutama di viewport mobile) dan mencegat klik.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar{display:none!important}';
      document.head.append(style);
    });
  });
  if (sessionCookies.length === 0) {
    const res = await page.request.post('/api/auth/login', {
      data: { email: adminEmail, password: adminPassword, remember: true },
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
 * `fill` yang mendahului hidrasi bisa tertimpa. `data-hydrated` = "false" di HTML server dan
 * "true" setelah efek pertama React.
 */
export async function hydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.locator('[data-hydrated]').first()).toBeAttached();
  await expect(page.locator('[data-hydrated="false"]')).toHaveCount(0);
}
