import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '@convey/shared': resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1/plugins': {
        target: process.env.CONVEY_PLUGINS_INTERNAL_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v1': {
        target: process.env.CONVEY_API_INTERNAL_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/swagger': {
        target: process.env.CONVEY_API_INTERNAL_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.CONVEY_API_INTERNAL_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/metrics': {
        target: process.env.CONVEY_API_INTERNAL_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
