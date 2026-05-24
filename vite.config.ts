import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import 'dotenv/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    // Port can be overridden via VITE_FRONTEND_PORT in .env (default 5173)
    port: Number(process.env.VITE_FRONTEND_PORT) || 5173,
    proxy: {
      '/api': {
        target:
          process.env.VITE_BACKEND_URL?.replace('/api', '') ??
          'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
