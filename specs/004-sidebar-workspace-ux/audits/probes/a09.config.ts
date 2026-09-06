import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'a09.spec.ts',
  workers: 1,
  outputDir: '../../../../artifacts/a09-playwright',
  timeout: 240000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
