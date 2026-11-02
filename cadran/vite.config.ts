import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  base: './',
  build: { outDir: '../dist-cadran', emptyOutDir: true },
  server: { port: 5174 },
  test: { include: ['tests/**/*.test.ts'] },
});
