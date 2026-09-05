import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'a04-a05.spec.ts',
  workers: 1,
  outputDir: '../../../../artifacts/a04-a05-playwright',
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
