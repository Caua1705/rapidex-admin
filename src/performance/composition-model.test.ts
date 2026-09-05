import { describe, expect, it } from 'vitest';

import {
  arcosDoDonut,
  brutoDoPeriodo,
  cashbackResgatado,
  DONUT_PERIMETRO,
  partesDoBruto,
  saidasDoBruto,
} from './composition-model';
import type { CommissionReport, SalesSummary } from '../api/types';

function summary(breakdown: Partial<SalesSummary['breakdown']> = {}): SalesSummary {
  const comparison = { current: '0', previous: '0', change: '0', change_percent: null };
  const period = { start_date: '2026-09-01', end_date: '2026-09-07', days: 7 };

  return {
    restaurant_id: 'r1',
    period,
    previous_period: period,
    revenue_total: '900.00',
    revenue_comparison: comparison,
    orders_count: 10,
    orders_count_comparison: comparison,
    average_ticket: '90.00',
    average_ticket_comparison: comparison,
    excluded_orders_count: 0,
    order_types: [],
    breakdown: {
      subtotal_total: '800.00',
      delivery_fee_total: '150.00',
      service_fee_total: '50.00',
      discount_total: '100.00',
      commission_total: '90.00',
      ...breakdown,
    },
  };
}

function commission(cashbacks: string[]): CommissionReport {
  return {
    restaurant_id: 'r1',
    start_date: '2026-09-01',
    end_date: '2026-09-07',
    orders_count: cashbacks.length,
    excluded_orders_count: 0,
    commission_base_total: '1000.00',
    commission_total: '90.00',
    orders: cashbacks.map((valor, index) => ({
      order_id: `o${index}`,
      order_number: index + 1,
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'pix',
      created_at: null,
      order_total: '100.00',
      subtotal: '90.00',
      coupon_discount_amount: '0.00',
      cashback_redeemed_amount: valor,
      commission_base_amount: '100.00',
      commission_percent: '9.00',
      commission_amount: '9.00',
    })),
  };
}

/*
 * O BRUTO É SOMADO, NÃO LIDO DE `revenue_total` — e este teste é a fechadura
 * disso. `revenue_total` (900) já vem com os 100 de desconto abatidos; usá-lo
 * como denominador faria as três fatias somarem 111%.
 */
describe('brutoDoPeriodo', () => {
  it('soma as três partes que o cliente pagou, sem abater o desconto', () => {
    expect(brutoDoPeriodo(summary())).toBe(1000);
  });

  it('é zero no período sem movimento, e não quebra', () => {
    const vazio = summary({ subtotal_total: '0', delivery_fee_total: '0', service_fee_total: '0' });

    expect(brutoDoPeriodo(vazio)).toBe(0);
  });
});

describe('partesDoBruto', () => {
  it('divide o bruto entre produtos, entrega e serviço, maior primeiro', () => {
    const partes = partesDoBruto(summary());

    expect(partes.map((parte) => parte.id)).toEqual(['itens', 'entrega', 'servico']);
    expect(partes[0]).toEqual({ id: 'itens', rotulo: 'Produtos', valor: 800, fatiaPct: 80 });
  });

  it('as fatias somam cem por cento do bruto', () => {
    const soma = partesDoBruto(summary()).reduce(
      (total, parte) => total + (parte.fatiaPct ?? 0),
      0,
    );

    expect(Math.round(soma)).toBe(100);
  });

  /*
   * Uma loja que não cobra taxa de serviço não tem uma fatia de 0% — ela não
   * tem taxa de serviço. O rótulo com "R$ 0,00" ao lado de um arco invisível é
   * uma linha gasta para dizer o nada.
   */
  it('não desenha fatia de valor zero', () => {
    const partes = partesDoBruto(summary({ service_fee_total: '0.00' }));

    expect(partes.map((parte) => parte.id)).toEqual(['itens', 'entrega']);
  });

  /* Sem bruto não há do que ser fatia: `null`, e nunca 0% — a tela mostra
     travessão em vez de afirmar que o produto foi zero por cento de zero. */
  it('sem bruto nenhum, não sobra fatia nem percentual', () => {
    const vazio = summary({ subtotal_total: '0', delivery_fee_total: '0', service_fee_total: '0' });

    expect(partesDoBruto(vazio)).toEqual([]);
  });
});

describe('cashbackResgatado', () => {
  it('soma o resgate pedido a pedido, porque não há agregado', () => {
    expect(cashbackResgatado(commission(['10.50', '4.50', '0.00']))).toBe(15);
  });

  it('é zero quando ninguém resgatou', () => {
    expect(cashbackResgatado(commission(['0.00', '0.00']))).toBe(0);
  });
});

describe('saidasDoBruto', () => {
  it('mede desconto, comissão e cashback contra o MESMO bruto da rosca', () => {
    const saidas = saidasDoBruto(summary(), commission(['20.00']));

    expect(saidas).toEqual([
      { id: 'desconto', rotulo: 'Descontos', valor: 100, fatiaPct: 10 },
      { id: 'comissao', rotulo: 'Comissão da plataforma', valor: 90, fatiaPct: 9 },
      { id: 'cashback', rotulo: 'Cashback resgatado', valor: 20, fatiaPct: 2 },
    ]);
  });

  /*
   * SEM O EXTRATO, A COMISSÃO NÃO É ZERO — ELA NÃO É DITA. A rota é
   * SOMENTE_DONO e para a gerência nem é pedida; escrever "Comissão R$ 0,00"
   * seria uma afirmação falsa sobre o contrato da loja com a plataforma.
   */
  it('sem o extrato de comissão, só o desconto sai', () => {
    expect(saidasDoBruto(summary(), null).map((saida) => saida.id)).toEqual(['desconto']);
  });

  it('não desenha saída de valor zero', () => {
    expect(saidasDoBruto(summary({ discount_total: '0.00' }), null)).toEqual([]);
  });
});

describe('arcosDoDonut', () => {
  it('o primeiro arco começa na origem e mede a fatia dele', () => {
    const arcos = arcosDoDonut(partesDoBruto(summary()));

    expect(arcos).toHaveLength(3);
    expect(arcos[0]?.offset).toBe(0);
    expect(arcos[0]?.dash.startsWith(String(Math.round(DONUT_PERIMETRO * 0.8 * 1000) / 1000))).toBe(
      true,
    );
  });

  /* O acúmulo é NEGATIVO, e é o que faz a segunda fatia começar onde a
     primeira acabou em vez de por cima dela. */
  it('cada arco seguinte começa onde o anterior acabou', () => {
    const arcos = arcosDoDonut(partesDoBruto(summary()));

    expect(arcos[1]?.offset).toBe(-(Math.round(DONUT_PERIMETRO * 0.8 * 1000) / 1000));
  });

  it('os arcos somam o perímetro inteiro', () => {
    const arcos = arcosDoDonut(partesDoBruto(summary()));
    const soma = arcos.reduce((total, arco) => total + Number(arco.dash.split(' ')[0]), 0);

    expect(soma).toBeCloseTo(DONUT_PERIMETRO, 2);
  });

  /* Um anel cinza sem arco nenhum afirma "cem por cento de alguma coisa". */
  it('sem fatia nenhuma, não desenha anel', () => {
    expect(arcosDoDonut([])).toEqual([]);
  });
});
