import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'a07.spec.ts',
  workers: 1,
  outputDir: '../../../../artifacts/a07-playwright',
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
