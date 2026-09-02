/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * ============================================================================
 * O FUSO DO TESTE É O FUSO DA OPERAÇÃO, E ELE É FIXADO AQUI
 * ============================================================================
 *
 * O painel inteiro conta o dia em `America/Fortaleza` — é o que
 * `todayInOperationTimezone` existe para garantir, e é como o backend recorta
 * relatório e dia da semana. O TESTE, até esta linha, contava no fuso da
 * MÁQUINA: a do desenvolvedor em UTC-3 e o runner do CI em UTC.
 *
 * Três horas de desacordo entre as duas metades do portão, sem nada fixando
 * nenhuma delas. Nada estava vermelho por causa disso hoje, e é exatamente esse
 * o problema: um teste que muda de resposta conforme QUEM o roda não é um
 * portão, é um dado. O primeiro que dependesse do fuso passaria na máquina de
 * quem o escreveu e falharia no CI — ou, pior, o contrário.
 *
 * `America/Fortaleza` e não UTC porque é o fuso do produto: assim o teste lê a
 * mesma hora que o lojista lê, e uma asserção de "18h UTC vira 15h na tela"
 * continua sendo sobre a tela, e não sobre o runner.
 *
 * Fica em `process.env` e não em `test.env` porque `Date` e `Intl` leem o TZ
 * na inicialização do processo: os workers do Vitest herdam este valor ao
 * nascer, e um `TZ` definido depois não muda o relógio de quem já subiu.
 */
process.env.TZ = 'America/Fortaleza';

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
