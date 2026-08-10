import { defineConfig, devices } from '@playwright/test';

/**
 * Config só para tirar print das telas — não é suíte de teste.
 *
 * Fica fora de `e2e/` de propósito: `npm run e2e` não deve gastar tempo com
 * captura de imagem, e um "teste" que só fotografa nunca falha por regressão.
 * Roda com `npx playwright test -c design/shots/shots.config.ts`.
 *
 * Ele sobe o MESMO build de produção do e2e e usa o MESMO backend falso
 * (`e2e/fake-api.ts`), então o que aparece no print é o painel com dados —
 * pedidos nas colunas, cardápio com itens — e não a tela vazia de um ambiente
 * sem loja.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4174 --host 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:4174',
    },
  },
});
