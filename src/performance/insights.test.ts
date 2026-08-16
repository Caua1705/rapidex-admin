/**
 * As frases da tela de Desempenho.
 *
 * O QUE ESTES TESTES PROTEGEM: uma frase errada é pior que um número errado. O
 * número errado o lojista confere contra o caixa; a frase ele obedece — "terça
 * rende 40% menos" vira um cupom de terça na semana seguinte.
 *
 * Por isso cada caso aqui é uma AFIRMAÇÃO que a tela faz, e cada `null` é uma
 * afirmação que ela se recusa a fazer.
 */
import { describe, expect, it } from 'vitest';

import {
  diasQueExplicam,
  LIMIARES,
  readCancelamento,
  readConcentracao,
  readDesconto,
  readDiaFraco,
  readPagamento,
  readRetirada,
  readTicketOuVolume,
  readVeredito,
  semMovimento,
  vereditoDirecao,
  weekdayName,
} from './insights';
import type {
  Cancellations,
  MetricComparison,
  ProductSales,
  ReportPaymentMethods,
  SalesByDay,
  SalesSummary,
} from '../api/types';

const PERIODO = { start_date: '2026-08-10', end_date: '2026-08-16', days: 7 };
const ANTERIOR = { start_date: '2026-08-03', end_date: '2026-08-09', days: 7 };

function comparison(percent: string | null, overrides: Partial<MetricComparison> = {}): MetricComparison {
  return {
    current: '1000.00',
    previous: '800.00',
    change: '200.00',
    change_percent: percent,
    ...overrides,
  };
}

function summaryOf(overrides: Partial<SalesSummary> = {}): SalesSummary {
  return {
    restaurant_id: 'r1',
    period: PERIODO,
    previous_period: ANTERIOR,
    orders_count: 54,
    revenue_total: '3169.50',
    average_ticket: '58.69',
    breakdown: {
      subtotal_total: '2900.00',
      delivery_fee_total: '269.50',
      service_fee_total: '0.00',
      discount_total: '0.00',
      commission_total: '316.95',
    },
    order_types: [
      {
        order_type: 'delivery',
        orders_count: 50,
        revenue_total: '3000.00',
        revenue_share_percent: '94.6',
      },
      {
        order_type: 'pickup',
        orders_count: 4,
        revenue_total: '169.50',
        revenue_share_percent: '5.4',
      },
    ],
    excluded_orders_count: 2,
    orders_count_comparison: comparison('0.0'),
    revenue_comparison: comparison('62.0'),
    average_ticket_comparison: comparison('0.0'),
    ...overrides,
  };
}

/** Um período de dias, do jeito que `sales-by-day` devolve: todos preenchidos. */
function byDayOf(
  dias: readonly { day: string; revenue: string; orders?: number }[],
  periodo = PERIODO,
): SalesByDay {
  return {
    restaurant_id: 'r1',
    period: periodo,
    orders_count: dias.reduce((soma, dia) => soma + (dia.orders ?? 1), 0),
    revenue_total: String(dias.reduce((soma, dia) => soma + Number(dia.revenue), 0)),
    days: dias.map((dia) => ({
      day: dia.day,
      orders_count: dia.orders ?? 1,
      revenue_total: dia.revenue,
    })),
  };
}

/* ==========================================================================
 * O DIA DA SEMANA
 * ======================================================================= */

describe('weekdayName', () => {
  /*
   * ESTE É O TESTE DA ARMADILHA DE FUSO. `new Date('2026-08-15')` é meia-noite
   * UTC, que em America/Fortaleza é 21h do dia 14 — o nome sairia deslocado um
   * dia, e a frase "puxado por sábado" apontaria para a sexta.
   */
  it('lê o dia da semana sem deslocar por fuso', () => {
    expect(weekdayName('2026-08-15')).toBe('sábado');
    expect(weekdayName('2026-08-11')).toBe('terça');
  });

  it('devolve null no ilegível, para a frase não sair pela metade', () => {
    expect(weekdayName('não é data')).toBeNull();
  });
});

/* ==========================================================================
 * O VEREDITO
 * ======================================================================= */

describe('vereditoDirecao', () => {
  it('trata a variação pequena como mesmo patamar, e não como alta', () => {
    const abaixoDoLimiar = String(LIMIARES.variacaoEstavelPct - 0.5);
    expect(vereditoDirecao(summaryOf({ revenue_comparison: comparison(abaixoDoLimiar) }))).toBe(
      'estavel',
    );
  });

  it('separa alta de queda acima do limiar', () => {
    expect(vereditoDirecao(summaryOf({ revenue_comparison: comparison('62.0') }))).toBe('alta');
    expect(vereditoDirecao(summaryOf({ revenue_comparison: comparison('-12.0') }))).toBe('queda');
  });

  it('reconhece a ausência de comparação, que não é estabilidade', () => {
    expect(vereditoDirecao(summaryOf({ revenue_comparison: comparison(null) }))).toBe(
      'sem-comparacao',
    );
  });
});

describe('readVeredito', () => {
  it('é a resposta da tela: percentual, direção e valor, numa frase só', () => {
    const frase = readVeredito(summaryOf(), null, null, 'os 7 dias anteriores').text;
    expect(frase).toContain('62%');
    expect(frase).toContain('mais que os 7 dias anteriores');
    /* O valor em reais NÃO entra na frase: ele está logo abaixo dela, na linha
       dos três números. Dizer os dois é dizer a mesma coisa duas vezes (§8). */
    expect(frase).not.toContain('3.169,50');
  });

  /*
   * `change_percent` NULO NÃO VIRA 0%. "Ficou igual à semana passada" e "na
   * semana passada não houve movimento" levam a decisões opostas.
   */
  it('sem período anterior, diz isso — e nunca escreve 0%', () => {
    const frase = readVeredito(
      summaryOf({ revenue_comparison: comparison(null) }),
      null,
      null,
      'os 7 dias anteriores',
    ).text;
    expect(frase).toContain('não teve movimento');
    expect(frase).not.toContain('0%');
  });

  /* Português: "no mesmo patamar DOS 7 dias anteriores", nunca "de os". */
  it('contrai a preposição na frase de estabilidade', () => {
    const frase = readVeredito(
      summaryOf({ revenue_comparison: comparison('1.0') }),
      null,
      null,
      'os 7 dias anteriores',
    ).text;
    expect(frase).toContain('no mesmo patamar dos 7 dias anteriores');
    expect(frase).not.toContain('de os');
  });

  it('acrescenta a causa por dia quando os dois períodos chegam', () => {
    const atual = byDayOf([
      { day: '2026-08-10', revenue: '100' },
      { day: '2026-08-11', revenue: '900' },
      { day: '2026-08-12', revenue: '100' },
    ]);
    const anterior = byDayOf(
      [
        { day: '2026-08-07', revenue: '100' },
        { day: '2026-08-08', revenue: '100' },
        { day: '2026-08-09', revenue: '100' },
      ],
      ANTERIOR,
    );

    const frase = readVeredito(summaryOf(), atual, anterior, 'os 7 dias anteriores').text;
    expect(frase).toContain('puxado por terça');
  });

  /*
   * A SEGUNDA CHAMADA É ENFEITE: quando ela falha, `byDayPrevious` chega nulo e
   * a tela continua inteira — com a frase, sem a causa.
   */
  it('sem o período anterior dia a dia, a frase existe sem a causa', () => {
    const frase = readVeredito(summaryOf(), byDayOf([{ day: '2026-08-10', revenue: '100' }]), null, 'os 7 dias anteriores').text;
    expect(frase).toContain('62%');
    expect(frase).not.toContain('puxado');
  });
});

describe('diasQueExplicam', () => {
  it('não compara períodos de tamanhos diferentes', () => {
    const atual = byDayOf([
      { day: '2026-08-10', revenue: '100' },
      { day: '2026-08-11', revenue: '100' },
    ]);
    const anterior = byDayOf([{ day: '2026-08-09', revenue: '100' }], ANTERIOR);
    expect(diasQueExplicam(atual, anterior)).toBeNull();
  });

  it('desiste quando a causa precisa de dias demais — aí a causa é o período', () => {
    // Oito dias subindo igual: nenhum subconjunto de até três explica metade
    // da variação, e a resposta honesta é não nomear dia nenhum.
    const atual = byDayOf(
      Array.from({ length: 8 }, (_, i) => ({ day: `2026-08-${10 + i}`, revenue: '200' })),
    );
    const anterior = byDayOf(
      Array.from({ length: 8 }, (_, i) => ({ day: `2026-08-0${i + 1}`, revenue: '100' })),
      ANTERIOR,
    );
    expect(diasQueExplicam(atual, anterior)).toBeNull();
  });

  it('ignora os dias que empurram para o lado contrário da variação', () => {
    const atual = byDayOf([
      { day: '2026-08-10', revenue: '0' },
      { day: '2026-08-11', revenue: '900' },
    ]);
    const anterior = byDayOf(
      [
        { day: '2026-08-08', revenue: '300' },
        { day: '2026-08-09', revenue: '100' },
      ],
      ANTERIOR,
    );

    const causa = diasQueExplicam(atual, anterior);
    expect(causa?.direcao).toBe('alta');
    expect(causa?.dias).toEqual(['terça']);
  });

  it('não repete o nome do dia da semana quando ele aparece duas vezes', () => {
    const atual = byDayOf([
      { day: '2026-08-15', revenue: '500' },
      { day: '2026-08-22', revenue: '500' },
    ]);
    const anterior = byDayOf(
      [
        { day: '2026-08-01', revenue: '0' },
        { day: '2026-08-08', revenue: '0' },
      ],
      ANTERIOR,
    );

    expect(diasQueExplicam(atual, anterior)?.dias).toEqual(['sábado']);
  });
});

/* ==========================================================================
 * TICKET OU VOLUME
 * ======================================================================= */

describe('readTicketOuVolume', () => {
  it('diz que veio mais gente quando o ticket ficou parado', () => {
    const frase = readTicketOuVolume(
      summaryOf({
        orders_count_comparison: comparison('40.0'),
        average_ticket_comparison: comparison('0.5'),
      }),
    );
    expect(frase?.text).toContain('Veio mais gente');
  });

  it('diz que a mudança é no ticket quando o volume ficou parado', () => {
    const frase = readTicketOuVolume(
      summaryOf({
        orders_count_comparison: comparison('1.0'),
        average_ticket_comparison: comparison('22.0'),
      }),
    );
    expect(frase?.text).toContain('ticket médio subiu');
  });

  /* Os dois se mexeram: não há o que separar, e a frase não aparece. */
  it('não aparece quando os dois se mexeram', () => {
    expect(
      readTicketOuVolume(
        summaryOf({
          orders_count_comparison: comparison('30.0'),
          average_ticket_comparison: comparison('30.0'),
        }),
      ),
    ).toBeNull();
  });

  it('não aparece sem comparação', () => {
    expect(
      readTicketOuVolume(
        summaryOf({
          orders_count_comparison: comparison(null),
          average_ticket_comparison: comparison(null),
        }),
      ),
    ).toBeNull();
  });
});

/* ==========================================================================
 * O DIA FRACO
 * ======================================================================= */

describe('readDiaFraco', () => {
  it('aponta o dia da semana que se repete fraco', () => {
    const byDay = byDayOf([
      { day: '2026-08-10', revenue: '1000' }, // segunda
      { day: '2026-08-11', revenue: '50' }, // terça
      { day: '2026-08-12', revenue: '1000' },
      { day: '2026-08-13', revenue: '1000' },
      { day: '2026-08-17', revenue: '1000' },
      { day: '2026-08-18', revenue: '50' }, // terça de novo
    ]);

    const frase = readDiaFraco(byDay);
    expect(frase?.text).toContain('Terça');
    expect(frase?.text).toContain('menos que um dia comum');
  });

  /* Um único dia fraco é um dia, não um padrão — e a tela não sugere cupom
     em cima de uma ocorrência só. */
  it('não chama de padrão o que aconteceu uma vez', () => {
    const byDay = byDayOf([
      { day: '2026-08-10', revenue: '1000' },
      { day: '2026-08-11', revenue: '10' },
      { day: '2026-08-12', revenue: '1000' },
    ]);
    expect(readDiaFraco(byDay)).toBeNull();
  });

  it('não aparece quando nenhum dia destoa da média', () => {
    const byDay = byDayOf([
      { day: '2026-08-10', revenue: '1000' },
      { day: '2026-08-11', revenue: '950' },
      { day: '2026-08-17', revenue: '1000' },
      { day: '2026-08-18', revenue: '950' },
    ]);
    expect(readDiaFraco(byDay)).toBeNull();
  });

  it('não aparece sem faturamento nenhum, onde toda média é zero', () => {
    expect(readDiaFraco(byDayOf([{ day: '2026-08-10', revenue: '0' }]))).toBeNull();
  });
});

/* ==========================================================================
 * CONCENTRAÇÃO DE PRODUTO
 * ======================================================================= */

function productsOf(itens: readonly { nome: string; receita: string }[]): ProductSales {
  return {
    restaurant_id: 'r1',
    period: PERIODO,
    products: itens.map((item, index) => ({
      product_id: `p${index}`,
      product_name: item.nome,
      orders_count: 10,
      quantity_total: 10,
      revenue_total: item.receita,
    })),
    listed_revenue_total: String(itens.reduce((soma, item) => soma + Number(item.receita), 0)),
    revenue_note: 'não fecha com o faturamento do resumo',
  };
}

describe('readConcentracao', () => {
  it('avisa quando um produto sozinho carrega a receita da lista', () => {
    const frase = readConcentracao(
      productsOf([
        { nome: 'Costela', receita: '600' },
        { nome: 'Frango', receita: '400' },
      ]),
    );
    expect(frase?.text).toContain('Costela');
    expect(frase?.text).toContain('60%');
  });

  it('cala quando a receita está distribuída', () => {
    expect(
      readConcentracao(
        productsOf([
          { nome: 'A', receita: '100' },
          { nome: 'B', receita: '100' },
          { nome: 'C', receita: '100' },
          { nome: 'D', receita: '100' },
          { nome: 'E', receita: '100' },
        ]),
      ),
    ).toBeNull();
  });

  it('não divide por zero num período sem venda de item', () => {
    expect(readConcentracao(productsOf([{ nome: 'A', receita: '0' }]))).toBeNull();
  });
});

/* ==========================================================================
 * CANCELAMENTO
 * ======================================================================= */

function cancellationsOf(taxa: string | null): Cancellations {
  return {
    restaurant_id: 'r1',
    period: PERIODO,
    orders_count: 4,
    amount_total: '210.00',
    billable_orders_count: 54,
    cancellation_rate_percent: taxa,
    breakdown: [
      { status: 'cancelled', payment_status: 'failed', orders_count: 3, amount_total: '150.00' },
      { status: 'refunded', payment_status: 'refunded', orders_count: 1, amount_total: '60.00' },
    ],
  };
}

describe('readCancelamento', () => {
  it('fala quando a taxa passa do limiar, com a situação que mais pesa', () => {
    const frase = readCancelamento(cancellationsOf('8.2'));
    expect(frase?.text).toContain('8,2%');
    expect(frase?.text).toContain('210,00');
  });

  it('cala na taxa de rotina — cancelamento existe em toda operação', () => {
    expect(readCancelamento(cancellationsOf('1.0'))).toBeNull();
  });

  it('cala quando não há denominador', () => {
    expect(readCancelamento(cancellationsOf(null))).toBeNull();
  });
});

/* ==========================================================================
 * DESCONTO E RETIRADA
 * ======================================================================= */

describe('readDesconto', () => {
  it('diz quanto saiu em desconto quando isso deixa de ser detalhe', () => {
    const frase = readDesconto(
      summaryOf({
        revenue_total: '1000.00',
        breakdown: {
          subtotal_total: '1000.00',
          delivery_fee_total: '0.00',
          service_fee_total: '0.00',
          discount_total: '120.00',
          commission_total: '100.00',
        },
      }),
    );
    /* A frase carrega a PROPORÇÃO, não o valor: R$ 120,00 já está na linha
       "Descontos" da composição, três linhas acima. */
    expect(frase?.text).toContain('12%');
    expect(frase?.text).not.toContain('120,00');
  });

  it('cala quando não houve desconto', () => {
    expect(readDesconto(summaryOf())).toBeNull();
  });
});

describe('readRetirada', () => {
  it('cala quando retirada é exceção', () => {
    expect(readRetirada(summaryOf())).toBeNull();
  });

  it('fala quando retirada virou canal', () => {
    const frase = readRetirada(
      summaryOf({
        order_types: [
          {
            order_type: 'pickup',
            orders_count: 20,
            revenue_total: '1000.00',
            revenue_share_percent: '35.0',
          },
        ],
      }),
    );
    expect(frase?.text).toContain('35%');
    expect(frase?.text).toContain('sem custo de entrega');
  });
});

/* ==========================================================================
 * PAGAMENTO — a seção que virou uma linha, e só às vezes
 * ======================================================================= */

function paymentsOf(
  itens: readonly { metodo: string | null; fatia: string }[],
): ReportPaymentMethods {
  return {
    restaurant_id: 'r1',
    period: PERIODO,
    orders_count: 54,
    revenue_total: '3169.50',
    payment_methods: itens.map((item) => ({
      payment_method: item.metodo,
      orders_count: 10,
      revenue_total: '1000.00',
      revenue_share_percent: item.fatia,
    })),
  };
}

describe('readPagamento', () => {
  /*
   * A REGRA QUE TIROU A TABELA DA TELA: "58% em crédito" não muda decisão
   * nenhuma do lojista. Só há duas leituras acionáveis, e fora delas a tela
   * não escreve nada sobre pagamento.
   */
  it('cala na distribuição comum, que não muda decisão nenhuma', () => {
    expect(
      readPagamento(
        paymentsOf([
          { metodo: 'pix', fatia: '58.0' },
          { metodo: 'credit_card', fatia: '42.0' },
        ]),
      ),
    ).toBeNull();
  });

  it('fala quando uma forma concentra o faturamento', () => {
    const frase = readPagamento(
      paymentsOf([
        { metodo: 'pix', fatia: '82.0' },
        { metodo: 'cash', fatia: '18.0' },
      ]),
    );
    expect(frase?.text).toContain('Pix');
    expect(frase?.text).toContain('82%');
  });

  it('fala do dinheiro antes de qualquer outra forma — é troco a separar', () => {
    const frase = readPagamento(
      paymentsOf([
        { metodo: 'pix', fatia: '60.0' },
        { metodo: 'cash', fatia: '40.0' },
      ]),
    );
    expect(frase?.id).toBe('pagamento-dinheiro');
    expect(frase?.text).toContain('troco');
  });

  /*
   * FORMA NULA NÃO VIRA "OUTRO". "Outro" é uma forma de pagamento de verdade,
   * escolhível na configuração da filial; nulo é pedido cuja forma ninguém
   * registrou — e concentrar 90% do faturamento nisso é uma frase bem diferente.
   */
  it('não chama de "Outro" a forma que ninguém registrou', () => {
    const frase = readPagamento(paymentsOf([{ metodo: null, fatia: '90.0' }]));
    expect(frase?.text).toContain('Sem forma registrada');
    expect(frase?.text).not.toContain('Outro');
  });
});

/* ==========================================================================
 * O ESTADO VAZIO
 * ======================================================================= */

describe('semMovimento', () => {
  it('reconhece o período sem nenhum pedido faturado', () => {
    expect(semMovimento(summaryOf({ orders_count: 0 }))).toBe(true);
  });

  it('não confunde "ainda carregando" com "não vendeu"', () => {
    expect(semMovimento(null)).toBe(false);
  });
});
