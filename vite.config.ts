import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const frontendHost = env.FRONTEND_HOST || '127.0.0.1';
  const frontendPort = Number(env.FRONTEND_PORT || 3300);
  const backendHost = env.BACKEND_HOST || '127.0.0.1';
  const backendPort = Number(env.BACKEND_PORT || 8300);

  return {
    plugins: [vue()],
    root: 'client',
    server: {
      host: frontendHost,
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': `http://${backendHost}:${backendPort}`
      }
    },
    build: {
      outDir: '../dist/client',
      emptyOutDir: true
    }
  };
});
