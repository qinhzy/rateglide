import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api/visa': {
        target: 'https://www.visa.co.uk',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/visa', ''),
      },
      '/api/mastercard': {
        target: 'https://www.mastercard.com',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/mastercard', ''),
      },
      '/api/revolut': {
        target: 'https://www.revolut.com',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/revolut', ''),
      },
      '/api/wise': {
        target: 'https://wise.com',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/wise', ''),
      },
      '/api/compare': {
        target: 'https://api.wise.com',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/compare', ''),
      },
      '/api/market': {
        target: 'https://open.er-api.com',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/market', ''),
      },
      '/api/ecb': {
        target: 'https://api.frankfurter.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/ecb', ''),
      },
      '/api/boc': {
        target: 'https://www.boc.cn',
        changeOrigin: true,
        rewrite: (p) => p.replace('/api/boc', ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        popup: 'popup.html',
        options: 'options.html',
        practice: 'practice.html',
      },
    },
  },
});
