import { defineConfig } from '@playwright/test';

// Playwright drives the built Electron app (apps/desktop/out) through
// `_electron.launch`; no browsers are downloaded or used.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
