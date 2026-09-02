import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    /*
     * O NAVEGADOR DO TESTE VIVE NO FUSO DA OPERAÇÃO — ver o comentário longo em
     * `vite.config.ts`.
     *
     * Sem isto, o navegador herda o fuso da máquina: UTC-3 no desenvolvedor,
     * UTC no runner do CI. Três horas de diferença numa suíte cujo produto conta
     * o dia em `America/Fortaleza`, e cuja falha mais recente
     * (`6eb77c5`) foi exatamente um teste que quebrava entre 00:00 e 01:30.
     *
     * Fixar o fuso não conserta teste que depende da HORA CORRENTE — isso é
     * outra coisa e está tratado caso a caso. O que ele fecha é a metade em que
     * a resposta mudava conforme a máquina.
     */
    timezoneId: 'America/Fortaleza',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // O e2e roda contra o build de produção servido pelo `vite preview`.
  // Toda a API é interceptada por page.route() em e2e/fake-api.ts, então o
  // teste não depende do backend estar no ar — é o que mantém o CI verde.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // A base da API é a MESMA origem do site no e2e. Assim as chamadas
      // interceptadas não são cross-origin e o navegador não dispara preflight
      // CORS — que o page.route() não intercepta e faria tudo falhar.
      VITE_API_BASE_URL: 'http://127.0.0.1:4173',
    },
  },
});
