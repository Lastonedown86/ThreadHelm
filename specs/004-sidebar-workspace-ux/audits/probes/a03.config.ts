import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'a03.spec.ts',
  workers: 1,
  outputDir: '../../../../artifacts/a03-playwright',
  timeout: 240000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
