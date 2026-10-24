import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Vite 5 的内置模块表不认识 Node 24 的 node:sqlite，测试时走 shim
      'node:sqlite': fileURLToPath(
        new URL('./apps/server/src/sqlite-shim.ts', import.meta.url),
      ),
      '@lc/schema': fileURLToPath(new URL('./packages/schema/src/index.ts', import.meta.url)),
      '@lc/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@lc/page-runtime': fileURLToPath(
        new URL('./packages/page-runtime/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/server/src/**/*.test.ts'],
    environment: 'node',
  },
});
