import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  root: 'client',
  server: {
    host: '127.0.0.1',
    port: 3300,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8300'
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  }
});
