import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'a08.spec.ts',
  workers: 1,
  outputDir: '../../../../artifacts/a08-playwright',
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
