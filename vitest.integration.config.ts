// Uji terhadap database Supabase sungguhan (RLS, kesamaan data dengan seed).
// Jalankan: npm run test:db. Butuh .env berisi kunci Supabase dan jaringan.
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    // Satu database bersama: file tes yang mengubah data tidak boleh jalan bersamaan.
    fileParallelism: false,
    env: loadEnv('test', process.cwd(), ''),
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
