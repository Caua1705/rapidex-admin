import { describe, expect, it } from 'vitest';

import {
  LIMITE_DE_DIAS,
  linhasDoRelatorio,
  problemaDoPeriodo,
  textoSemTaxa,
  totalAPagar,
} from './courier-report';
import type { CourierReport, CourierReportItem } from '../api/types';

function linha(overrides: Partial<CourierReportItem> = {}): CourierReportItem {
  return {
    courier_id: 'ent-1',
    name: 'Jorge Lima',
    phone: '85999990000',
    branch_id: 'fil-1',
    is_deleted: false,
    deliveries_count: 12,
    deliveries_without_fee: 0,
    fee_total: '96.00',
    ...overrides,
  };
}

function relatorio(overrides: Partial<CourierReport> = {}): CourierReport {
  return {
    restaurant_id: 'rest-1',
    branch_id: null,
    period: { start_date: '2026-08-01', end_date: '2026-08-31', days: 31 },
    deliveries_count: 12,
    deliveries_without_fee: 0,
    fee_total: '96.00',
    couriers: [linha()],
    ...overrides,
  };
}

/*
 * ============================================================================
 * O QUE NÃO TEM TAXA FICA AO LADO DA SOMA, NUNCA DENTRO
 * ============================================================================
 *
 * `deliveries_without_fee` são corridas de uma filial que não tinha taxa
 * configurada na hora da atribuição: elas entram na CONTAGEM e não na SOMA,
 * porque não há valor congelado nelas. É o número que o dono acerta à mão.
 *
 * Somá-las como zero seria dizer que aquelas corridas foram de graça — a mesma
 * mentira que a tela da taxa recusa contar do outro lado do balcão.
 */
describe('totalAPagar', () => {
  it('a soma é a que o backend mandou, e vem como string de duas casas', () => {
    expect(totalAPagar(relatorio({ fee_total: '117.00' }))).toBe(117);
  });

  it('soma zero com corridas sem taxa NÃO é "nada a pagar"', () => {
    const r = relatorio({ fee_total: '0.00', deliveries_count: 5, deliveries_without_fee: 5 });
    expect(totalAPagar(r)).toBe(0);
    expect(textoSemTaxa(r.deliveries_without_fee)).toContain('5');
  });

  /*
   * VALOR QUE NÃO É NÚMERO NÃO VIRA ZERO. `Number('')` é 0 e `Number(null)` é
   * 0 — as duas coerções que esta rodada passou inteira caçando. Aqui elas
   * fariam a tela afirmar "nada a pagar" num mês em que o dono deve.
   */
  it('resposta estranha não vira zero silencioso', () => {
    expect(totalAPagar(relatorio({ fee_total: '' }))).toBeNull();
    expect(totalAPagar(relatorio({ fee_total: 'abc' }))).toBeNull();
  });
});

describe('textoSemTaxa', () => {
  it('zero não vira frase: não há o que acertar à mão', () => {
    expect(textoSemTaxa(0)).toBeNull();
  });

  it('uma corrida fala no singular', () => {
    expect(textoSemTaxa(1)).toContain('1 corrida sem taxa');
  });

  it('mais de uma, no plural', () => {
    expect(textoSemTaxa(3)).toContain('3 corridas sem taxa');
  });
});

/*
 * ============================================================================
 * O TETO DE 92 DIAS É DO BACKEND, E A TELA O RESPEITA ANTES DE PERGUNTAR
 * ============================================================================
 *
 * `MAX_REPORT_DAYS = 92`, e acima disso a rota responde 400 com uma frase. A
 * tela recusa antes: um 400 depois de escolher as datas é uma ida à rede para
 * saber uma regra que já se sabia, e a frase do backend chega sem dizer qual
 * campo mexer.
 *
 * É ESPELHO DECLARADO — o número não está no `/openapi.json`, só na descrição
 * da rota e na constante do serviço.
 */
describe('problemaDoPeriodo', () => {
  it('período normal passa', () => {
    expect(problemaDoPeriodo({ startDate: '2026-08-01', endDate: '2026-08-31' })).toBeNull();
  });

  it('exatamente 92 dias passa: o teto é inclusivo', () => {
    // 2026-06-01 a 2026-08-31 são 92 dias contando os dois extremos.
    expect(problemaDoPeriodo({ startDate: '2026-06-01', endDate: '2026-08-31' })).toBeNull();
  });

  it('93 dias é recusado aqui, e não por um 400 depois do clique', () => {
    const problema = problemaDoPeriodo({ startDate: '2026-05-31', endDate: '2026-08-31' });
    expect(problema).toContain('92');
  });

  it('data invertida é recusada com o campo nomeado', () => {
    expect(problemaDoPeriodo({ startDate: '2026-08-31', endDate: '2026-08-01' })).toContain(
      'inicial',
    );
  });

  it('sem as duas datas, não há período', () => {
    expect(problemaDoPeriodo({ startDate: '', endDate: '2026-08-01' })).toBeTruthy();
  });

  /*
   * A CONTAGEM APARECE NA FRASE, e é ela que se confere.
   *
   * Um erro de um dia aqui move o teto para 91 ou 93 sem ninguém ver — os dois
   * casos acima (92 passa, 93 recusa) pegam a borda, e este pega o NÚMERO: se a
   * conta perder um dia, a frase diz 92 e o período tem 93.
   *
   * A aritmética é em UTC porque estas são datas de CALENDÁRIO, não instantes.
   * Mesma escolha de `previousRange` em Desempenho.
   */
  it('a frase diz quantos dias o período tem, e o número é exato', () => {
    // 2026-09-30 a 2026-12-31: 1 + 31 + 30 + 31 = 93.
    expect(problemaDoPeriodo({ startDate: '2026-09-30', endDate: '2026-12-31' })).toContain('93');
  });
});

/*
 * ============================================================================
 * QUEM JÁ SAIU CONTINUA NA LISTA, MARCADO
 * ============================================================================
 *
 * `is_deleted` é o entregador que saiu da loja e ainda tem corrida a receber.
 * Escondê-lo seria o dono não pagar quem trabalhou — e a lista existe para o
 * dia de pagar.
 */
describe('linhasDoRelatorio', () => {
  it('o excluído aparece, e vem marcado', () => {
    const linhas = linhasDoRelatorio(
      relatorio({ couriers: [linha(), linha({ courier_id: 'ent-2', is_deleted: true })] }),
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[1]!.saiu).toBe(true);
  });

  /*
   * A ORDEM É A DO BACKEND. Reordenar aqui daria uma segunda resposta para a
   * mesma pergunta — e o total do rodapé deixaria de casar com a leitura de
   * cima para baixo que o dono faz ao conferir.
   */
  it('a ordem não é refeita', () => {
    const linhas = linhasDoRelatorio(
      relatorio({
        couriers: [linha({ name: 'Zé' }), linha({ courier_id: 'ent-2', name: 'Ana' })],
      }),
    );
    expect(linhas.map((l) => l.nome)).toEqual(['Zé', 'Ana']);
  });

  it('a soma de cada linha também é número, e o inválido não vira zero', () => {
    const linhas = linhasDoRelatorio(relatorio({ couriers: [linha({ fee_total: 'x' })] }));
    expect(linhas[0]!.total).toBeNull();
  });
});

describe('LIMITE_DE_DIAS', () => {
  it('é o do backend, escrito com a origem', () => {
    expect(LIMITE_DE_DIAS).toBe(92);
  });
});
