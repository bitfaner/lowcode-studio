import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lc/schema': fileURLToPath(new URL('../schema/src/index.ts', import.meta.url)),
      '@lc/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      '@lc/materials': fileURLToPath(new URL('../materials/src/index.ts', import.meta.url)),
      '@lc/page-runtime': fileURLToPath(new URL('../page-runtime/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../apps/studio/public/vendor', import.meta.url)),
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      name: 'LcMaterials',
      formats: ['umd'],
      fileName: () => 'lc-materials.umd.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'antd', 'dayjs'],
      output: {
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          antd: 'antd',
          dayjs: 'dayjs',
        },
      },
    },
  },
});
