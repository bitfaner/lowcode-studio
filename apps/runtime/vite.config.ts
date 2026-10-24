import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const fromRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export default defineConfig(({ command }) => ({
  // 开发态直连 5174 根路径；构建产物由服务端托管在 /runtime/ 下
  base: command === 'build' ? '/runtime/' : '/',
  resolve: {
    alias: {
      '@lc/schema': fromRoot('packages/schema/src/index.ts'),
      '@lc/shared': fromRoot('packages/shared/src/index.ts'),
      '@lc/page-runtime': fromRoot('packages/page-runtime/src/index.ts'),
      '@lc/materials': fromRoot('packages/materials/src/index.ts'),
      '@lc/materials-react': fromRoot('packages/materials-react/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
}));
