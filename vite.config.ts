/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    // Só os testes unitários. Os arquivos de e2e/ são do Playwright e
    // quebrariam aqui, porque importam @playwright/test.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
