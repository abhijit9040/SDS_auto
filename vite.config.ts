/// <reference types="vitest" />
import 'dotenv/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@client': path.resolve(__dirname, './src/client'),
      '@server': path.resolve(__dirname, './src/server'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        headers: {
          'X-Internal-Secret': process.env.INTERNAL_DEV_SECRET || '',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const secret = process.env.INTERNAL_DEV_SECRET;
            if (secret) {
              proxyReq.setHeader('X-Internal-Secret', secret);
            }
          });
        },
      },
      '/webhooks': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ring': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oauth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['../../tests/**/*.test.ts'],
    setupFiles: ['../../tests/vitest.setup.ts'],
    env: {
      // B8: Hermetic test secrets — allow `npm test` to pass on a clean clone
      // with no .env file. These are fixed test-only values; the real server
      // startup guard (validateConfig) still enforces real secrets at runtime.
      RING_WEBHOOK_SECRET:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      INTERNAL_DEV_SECRET:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      // Allow WebSocket connections without Origin in most tests.
      // B7 tests that verify Origin-rejection temporarily unset this flag.
      ALLOW_NO_ORIGIN: '1',
    },
  },
});
