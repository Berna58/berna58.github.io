import { defineConfig, devices } from '@playwright/test';

// Testes do painel contra o Supabase local: npm run test:admin (ver docs/operacao.md).
export default defineConfig({
  testDir: 'tests/admin',
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4323', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx astro preview --port 4323 --host 127.0.0.1',
    url: 'http://127.0.0.1:4323/admin/',
    reuseExistingServer: false,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
});
