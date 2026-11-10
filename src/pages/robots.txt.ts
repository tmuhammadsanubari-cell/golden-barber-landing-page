// robots.txt (PRD F-08): blokir /admin dan /api, tunjuk ke sitemap. Dibuat saat build agar
// alamat sitemap mengikuti PUBLIC_SITE_URL, bukan tertulis keras.
// Mode prototipe (D-41): halaman tetap boleh dirayapi supaya mesin pencari MELIHAT meta
// `noindex` (Disallow justru membuat URL bisa terindeks tanpa isi), tetapi sitemap tidak
// diumumkan.
import type { APIRoute } from 'astro';
import { isPrototype } from '@/lib/site-mode';

export function robotsTxt(origin: string, prototype: boolean): string {
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api', ''];
  if (!prototype) body.push(`Sitemap: ${origin.replace(/\/$/, '')}/sitemap-index.xml`, '');
  return body.join('\n');
}

export const GET: APIRoute = ({ site }) =>
  new Response(robotsTxt(String(site), isPrototype()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
