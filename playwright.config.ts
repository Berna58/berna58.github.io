import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // o axe é pesado: poucos processos em paralelo evitam timeouts falsos (sobretudo com o Supabase local ligado)
  workers: 2,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4322' },
  webServer: {
    command: 'npx astro preview --port 4322 --host 127.0.0.1',
    url: 'http://127.0.0.1:4322/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
