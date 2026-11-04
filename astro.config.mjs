import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

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
