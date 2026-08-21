import { describe, expect, it } from 'vitest';

import {
  SEGMENT_HINT,
  SEGMENT_LABEL,
  billableNote,
  formatAverageTicket,
  segmentLabel,
} from './customer-segment';
import type { CustomerListItem, CustomerSegment } from '../api/types';

function customer(overrides: Partial<CustomerListItem> = {}): CustomerListItem {
  return {
    customer_name: 'Ana Paula',
    customer_phone: '85999990000',
    orders_count: 12,
    billable_orders_count: 10,
    total_spent: 748.5,
    average_ticket: 74.85,
    first_order_at: '2026-03-12T20:00:00Z',
    last_order_at: '2026-08-15T20:00:00Z',
    days_since_last_order: 5,
    cadence_days: 7,
    segment: 'fiel',
    ...overrides,
  };
}

/** As cinco classes do contrato, escritas por extenso e não derivadas do mapa. */
const CLASSES: readonly CustomerSegment[] = [
  'novo',
  'ocasional',
  'fiel',
  'em_risco',
  'perdido',
] as const;

describe('SEGMENT_LABEL', () => {
  it('escreve as cinco classes do contrato, e nenhuma sai vazia', () => {
    expect(CLASSES.map((classe) => SEGMENT_LABEL[classe])).toEqual([
      'Novo',
      'Ocasional',
      'Fiel',
      'Em risco',
      'Perdido',
    ]);
  });

  /*
   * O `Record<CustomerSegment, …>` já faz o compilador cobrar uma classe nova.
   * Este teste cobra o contrário: uma classe que SAIU do contrato e ficou no
   * mapa, que o TypeScript aceita calado e ninguém vê na tela.
   */
  it('não tem classe sobrando além das cinco', () => {
    expect(Object.keys(SEGMENT_LABEL).sort()).toEqual([...CLASSES].sort());
    expect(Object.keys(SEGMENT_HINT).sort()).toEqual([...CLASSES].sort());
  });

  /*
   * A ARMADILHA DE LEITURA DO CONTRATO: `novo` conta do PRIMEIRO pedido, não do
   * último, e não quer dizer "poucos pedidos". A explicação precisa dizer isso,
   * senão a próxima pessoa "conserta" o rótulo para "Primeiro pedido".
   */
  it('explica que "novo" é relacionamento recente, não pedido recente', () => {
    expect(SEGMENT_HINT.novo).toMatch(/PRIMEIRO pedido/);
  });
});

/**
 * O espaço do `Intl` entre "R$" e o número é INQUEBRÁVEL (U+00A0), e comparar
 * com um espaço comum falha com as duas strings idênticas na tela do erro. A
 * troca é a mesma de `orders/format.test.ts`.
 */
function dinheiro(texto: string): string {
  return texto.replace(/\s/g, ' ');
}

describe('formatAverageTicket', () => {
  it('mostra o ticket que o backend calculou', () => {
    expect(dinheiro(formatAverageTicket(customer()))).toBe('R$ 74,85');
  });

  /*
   * O TESTE QUE TRAVA O BUG QUE O BACKEND ACABOU DE CONSERTAR.
   *
   * `average_ticket` divide por `billable_orders_count`, não por `orders_count`
   * — é a diferença entre R$ 74,85 e os R$ 62,38 que a divisão ingênua daria.
   * Quem "consertar" isto para calcular na tela reintroduz o ticket
   * sub-reportado de quem já cancelou um pedido, e a linha volta a discordar do
   * relatório.
   */
  it('NÃO recalcula: o valor vem do backend, dividido pelos faturáveis', () => {
    const linha = customer({ total_spent: 748.5, orders_count: 12, billable_orders_count: 10 });
    expect(dinheiro(formatAverageTicket(linha))).toBe('R$ 74,85');
    expect(dinheiro(formatAverageTicket(linha))).not.toBe('R$ 62,38');
  });

  /*
   * `average_ticket` vem 0.0 quando não há pedido faturável, e isso não é
   * "gastou zero por pedido": é "não há o que dividir". O travessão é a mesma
   * convenção de `formatDate` e `formatSince` para o que não dá para saber.
   */
  it('sem pedido faturável mostra travessão, não R$ 0,00', () => {
    expect(formatAverageTicket(customer({ billable_orders_count: 0, average_ticket: 0 }))).toBe(
      '—',
    );
  });

  /*
   * O CAMPO QUE O CONTRATO PROMETE E A API NO AR NÃO MANDOU.
   *
   * `billable_orders_count` é obrigatório no `openapi.json`, então o tipo
   * gerado o dá como `number` e o compilador nunca vai cobrar este caso — foi
   * exatamente assim que a tela chegou a escrever "undefined de 35 pedidos"
   * enquanto o deploy estava atrás da entrega do RFV.
   *
   * O `as` existe só para escrever aqui o que o backend escreveu na rede.
   */
  it('travessão, e não lixo, quando o campo não chegou na resposta', () => {
    const semCampo = customer({
      billable_orders_count: undefined,
      average_ticket: undefined,
    } as Partial<CustomerListItem>);
    expect(formatAverageTicket(semCampo)).toBe('—');
  });
});

describe('segmentLabel', () => {
  it('devolve o rótulo das cinco classes do contrato', () => {
    expect(CLASSES.map((classe) => segmentLabel(classe))).toEqual([
      'Novo',
      'Ocasional',
      'Fiel',
      'Em risco',
      'Perdido',
    ]);
  });

  /*
   * O CAMPO QUE NÃO CHEGOU. `segment` é obrigatório no contrato, então o
   * compilador nunca cobra este caso — e foi ele que deixou a coluna
   * "Classificação" em branco enquanto o deploy do backend estava atrás da
   * entrega do RFV. Célula vazia lê como falha de carregamento.
   */
  it('devolve null quando o campo não veio na resposta', () => {
    expect(segmentLabel(undefined as unknown as CustomerSegment)).toBeNull();
  });

  /*
   * E a sexta classe que o backend mande antes de a tela conhecê-la. A trava de
   * compilação continua sendo o `Record`; isto é a rede para o intervalo entre
   * os dois deploys.
   */
  it('devolve null para uma classe que a tela não conhece', () => {
    expect(segmentLabel('campeao' as CustomerSegment)).toBeNull();
  });
});

describe('billableNote', () => {
  it('cala quando os dois contadores são o mesmo: não há conta a explicar', () => {
    expect(billableNote(customer({ orders_count: 10, billable_orders_count: 10 }))).toBeNull();
  });

  /*
   * A linha que responde ao chamado do contrato: "12 pedidos, R$ 748,50, ticket
   * R$ 74,85 — a conta não bate". Bate, e o denominador é o que diz por quê.
   */
  it('diz o denominador quando cancelado ou recusado ficou de fora', () => {
    expect(billableNote(customer({ orders_count: 12, billable_orders_count: 10 }))).toBe(
      '10 de 12 pedidos',
    );
  });

  it('quem só tem pedido cancelado não tem denominador nenhum', () => {
    expect(billableNote(customer({ orders_count: 3, billable_orders_count: 0 }))).toBe(
      'nenhum faturável',
    );
  });

  /*
   * `billable_orders_count` maior que `orders_count` não existe no contrato —
   * mas um `<=` escrito como `===` faria a nota aparecer com um número maior
   * que o total, que é a forma mais confusa possível de errar.
   */
  it('não escreve nota quando não há pedido a subtrair', () => {
    expect(billableNote(customer({ orders_count: 1, billable_orders_count: 1 }))).toBeNull();
  });

  /*
   * A NOTA É UMA EXPLICAÇÃO DE DIVISÃO — sem divisor ela não tem o que dizer.
   *
   * Era aqui que a palavra `undefined` saía na tela: `35 <= undefined` é falso
   * e `undefined <= 0` também, então os dois portões deixavam passar e a
   * interpolação escrevia o buraco por extenso, embaixo do ticket.
   */
  it('cala quando o denominador não veio na resposta', () => {
    const semCampo = customer({
      orders_count: 35,
      billable_orders_count: undefined,
    } as Partial<CustomerListItem>);
    expect(billableNote(semCampo)).toBeNull();
  });
});
