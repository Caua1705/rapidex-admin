import { defineConfig, devices } from '@playwright/test';

/**
 * A mesma captura de `shots.config.ts`, mas contra o servidor de
 * desenvolvimento.
 *
 * POR QUE DUAS CONFIGS: a de produção reconstrói o bundle a cada execução
 * (~3 min), o que é a régua certa para conferir o resultado final e a errada
 * para trabalhar. Esta reaproveita o `npm run dev` já aberto e fotografa em
 * segundos, que é o ciclo de quem está mexendo no CSS.
 *
 * Roda com `npx playwright test -c design/shots/dev.config.ts`, com o
 * `npm run dev -- --port 5199` aberto ao lado.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5199',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5199 --host 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
