import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Unit test selalu pakai seed JSON, tanpa jaringan.
  test: { include: ['tests/unit/**/*.test.ts'], env: { DATA_SOURCE: 'json' } },
});
