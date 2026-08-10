import { defineConfig, devices } from '@playwright/test';

/**
 * Prints da galeria do design system (`/ui`).
 *
 * Config separada porque a galeria SÓ EXISTE EM DESENVOLVIMENTO — no build de
 * produção o `import.meta.env.DEV` apaga a rota. Por isso aqui o servidor é o
 * `vite dev`, e não o `vite preview` das outras capturas.
 *
 *   npx playwright test -c design/shots/ui.config.ts
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'galeria.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5174 --host 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:5174/ui',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
