import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'a06.spec.ts',
  workers: 1,
  outputDir: '../../../../artifacts/a06-playwright',
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
