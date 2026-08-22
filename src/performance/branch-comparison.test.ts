/**
 * A comparação entre filiais.
 *
 * O QUE ESTES TESTES PROTEGEM: a fatia é sobre o que RESPONDEU, e a ordem é a
 * resposta.
 *
 * O caso perigoso é o parcial: com uma loja de pé e outra que falhou, um
 * denominador tirado do "total da rede" desenharia uma barra de 100% e o dono
 * leria uma falha de carregamento como um fato de negócio.
 */
import { describe, expect, it } from 'vitest';

import { compararFiliais, variacaoDaFilial } from './branch-comparison';
import type { Branch, SalesSummary } from '../api/types';

const PERIODO = { start_date: '2026-08-10', end_date: '2026-08-16', days: 7 };

function branch(id: string, nome: string): Branch {
  return {
    id,
    name: nome,
    slug: id,
    display_name: null,
    address: 'Rua Um, 100',
    neighborhood: 'Centro',
    city: 'Fortaleza',
    state: 'CE',
    is_main: false,
    is_active: true,
  };
}

function summaryOf(faturamento: string, percent: string | null = '10.0'): SalesSummary {
  const comparacao = {
    current: faturamento,
    previous: '1000.00',
    change: '0.00',
    change_percent: percent,
  };
  return {
    restaurant_id: 'r1',
    period: PERIODO,
    previous_period: PERIODO,
    orders_count: 10,
    revenue_total: faturamento,
    average_ticket: '50.00',
    breakdown: {
      subtotal_total: faturamento,
      delivery_fee_total: '0.00',
      service_fee_total: '0.00',
      discount_total: '0.00',
      commission_total: '0.00',
    },
    order_types: [],
    excluded_orders_count: 0,
    orders_count_comparison: comparacao,
    revenue_comparison: comparacao,
    average_ticket_comparison: comparacao,
  };
}

describe('compararFiliais', () => {
  /*
   * A ORDEM É A RESPOSTA. Na ordem em que o token devolveu as filiais, "qual
   * vai melhor" volta a exigir que o olho compare dois números de quatro
   * dígitos — que é o trabalho que a seção existe para poupar.
   */
  it('ordena por faturamento, maior primeiro', () => {
    const filiais = compararFiliais([
      { branch: branch('b1', 'Centro'), summary: summaryOf('800.00') },
      { branch: branch('b2', 'Aldeota'), summary: summaryOf('2000.00') },
      { branch: branch('b3', 'Zona Norte'), summary: summaryOf('1200.00') },
    ]);

    expect(filiais.map((item) => item.branch.name)).toEqual(['Aldeota', 'Zona Norte', 'Centro']);
  });

  it('a fatia soma 100 entre as filiais carregadas', () => {
    const filiais = compararFiliais([
      { branch: branch('b1', 'A'), summary: summaryOf('750.00') },
      { branch: branch('b2', 'B'), summary: summaryOf('250.00') },
    ]);

    expect(filiais[0]?.fatiaPct).toBeCloseTo(75, 5);
    expect(filiais[1]?.fatiaPct).toBeCloseTo(25, 5);
  });

  /*
   * SEM DENOMINADOR NÃO HÁ FATIA, e zero não é resposta: um período em que
   * nenhuma loja faturou não faz de ninguém "0% da rede" — não existe a rede da
   * qual ela seria fatia. É a mesma decisão de `revenue_share_percent` nulo no
   * contrato, e é ela que faz a barra sumir em vez de desenhar um traço.
   */
  it('período sem faturamento nenhum não tem fatia, e não tem zero', () => {
    const filiais = compararFiliais([
      { branch: branch('b1', 'A'), summary: summaryOf('0.00') },
      { branch: branch('b2', 'B'), summary: summaryOf('0.00') },
    ]);

    expect(filiais.every((item) => item.fatiaPct === null)).toBe(true);
  });

  it('uma filial só divide 100% consigo mesma', () => {
    const filiais = compararFiliais([
      { branch: branch('b1', 'A'), summary: summaryOf('500.00') },
    ]);
    expect(filiais[0]?.fatiaPct).toBeCloseTo(100, 5);
  });
});

describe('variacaoDaFilial', () => {
  /*
   * `change_percent` NULO É "SEM COMPARAÇÃO", NUNCA 0% — a mesma armadilha de
   * `readChange`. Aqui ela decidiria se a seta da linha aponta para baixo ou
   * some, e uma seta neutra afirmaria que a loja ficou igual à semana passada
   * quando a verdade é que na semana passada ela não vendeu.
   */
  it('percentual nulo continua nulo', () => {
    const filiais = compararFiliais([
      { branch: branch('b1', 'A'), summary: summaryOf('500.00', null) },
    ]);
    expect(variacaoDaFilial(filiais[0]!)).toBeNull();
  });

  it('lê o percentual do próprio resumo da filial', () => {
    const filiais = compararFiliais([
      { branch: branch('b1', 'A'), summary: summaryOf('500.00', '-12.5') },
    ]);
    expect(variacaoDaFilial(filiais[0]!)).toBe(-12.5);
  });
});
