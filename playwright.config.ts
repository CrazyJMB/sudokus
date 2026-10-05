import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 150_000,
  use: { baseURL: 'http://127.0.0.1:4174', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && npm run preview -- --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
