import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// Astro hanya mengisi import.meta.env dari .env; kode data (src/lib/env.ts) membaca process.env
// untuk variabel server. Isi process.env dari .env tanpa menimpa variabel yang sudah diset
// (Vercel, CI).
for (const [key, value] of Object.entries(
  loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''),
)) {
  process.env[key] ??= value;
}

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
  output: 'static', // halaman publik statis
  adapter: vercel(), // rute dengan `export const prerender = false` jadi Vercel Functions
  integrations: [react(), sitemap({ filter: (page) => !page.includes('/admin') })],
  security: { checkOrigin: true },
  image: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  vite: { plugins: [tailwindcss()] },
});
