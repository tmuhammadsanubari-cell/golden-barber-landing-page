// Mode situs (D-41). Selama belum ada persetujuan Golden Barber, situs berjalan sebagai
// PROTOTIPE: semua halaman publik `noindex`, `robots.txt` tanpa baris Sitemap, dan banner
// "Prototipe" tampil di atas halaman. Default sengaja prototipe supaya lupa mengisi env tidak
// membuat situs terindeks sebagai situs resmi. Setelah disetujui: SITE_MODE=live di Vercel
// lalu Publikasikan ulang.
import { env } from '@/lib/env';

export type SiteMode = 'prototype' | 'live';

export function parseSiteMode(value: string | undefined): SiteMode {
  return value?.trim().toLowerCase() === 'live' ? 'live' : 'prototype';
}

export function siteMode(): SiteMode {
  return parseSiteMode(env('SITE_MODE'));
}

export function isPrototype(): boolean {
  return siteMode() === 'prototype';
}
