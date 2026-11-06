// robots.txt (PRD F-08): blokir /admin dan /api, tunjuk ke sitemap. Dibuat saat build agar
// alamat sitemap mengikuti PUBLIC_SITE_URL, bukan tertulis keras.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const origin = String(site).replace(/\/$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api',
    '',
    `Sitemap: ${origin}/sitemap-index.xml`,
    '',
  ];
  return new Response(body.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
