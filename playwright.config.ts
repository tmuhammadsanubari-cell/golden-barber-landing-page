import { defineConfig, devices } from '@playwright/test';

// Port bisa diganti (E2E_PORT=4400 npm run test:e2e) bila 4321 dipakai dev server lain.
const port = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
