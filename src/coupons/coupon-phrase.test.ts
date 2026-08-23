import { describe, expect, it } from 'vitest';

import type { CouponTemplate } from '../api/types';
import { rascunhoNovo, type CouponDraft } from './coupon-model';
import { resumoDoCupom } from './coupon-phrase';

function arte(overrides: Partial<CouponTemplate> = {}): CouponTemplate {
  return {
    id: 'arte-10',
    name: '10% OFF',
    image_path: null,
    image_url: null,
    discount_type: 'percent',
    discount_value: '10.00',
    sort_order: 1,
    ...overrides,
  };
}

function rascunho(overrides: Partial<CouponDraft> = {}): CouponDraft {
  return {
    ...rascunhoNovo('2026-09-01'),
    templateId: 'arte-10',
    title: 'Setembro',
    code: 'SETEMBRO',
    validFrom: '2026-09-01',
    validUntil: '2026-09-30',
    ...overrides,
  };
}

const FRETE = arte({ id: 'arte-frete', discount_type: 'free_delivery', discount_value: null });

describe('a frase-resumo', () => {
  it('não existe sem arte — é ela que diz quanto o cupom desconta', () => {
    expect(resumoDoCupom(rascunho({ templateId: '' }), null)).toBeNull();
  });

  it('começa pelo desconto da arte', () => {
    expect(resumoDoCupom(rascunho(), arte())?.frase).toMatch(/^10%/);
  });

  it('monta a campanha inteira numa frase só', () => {
    const resumo = resumoDoCupom(
      rascunho({
        minOrderValue: '60,00',
        totalUsageLimit: '100',
        usageLimitPerCustomer: '1',
        firstOrderOnly: true,
      }),
      FRETE,
    );

    expect(resumo?.frase).toBe(
      'Frete grátis, só em entrega, em pedidos de R$ 60,00 ou mais em produtos, ' +
        'de 01/09 a 30/09, 100 usos no total, 1 vez por cliente, só para quem nunca pediu aqui.',
    );
  });

  it('o teto do percentual entra no desconto, lido com a vírgula do lojista', () => {
    const resumo = resumoDoCupom(rascunho({ maxDiscountAmount: '15,00' }), arte());
    /* "15,00" com vírgula chegaria NaN num `Number()` cru — e o teto sumiria da
       frase sem nada acender, numa frase que existe justamente para conferir. */
    expect(resumo?.frase).toContain('10% (até R$ 15,00)');
  });

  it('campanha de um dia só diz o dia, não uma faixa de um ponto', () => {
    const resumo = resumoDoCupom(rascunho({ validUntil: '2026-09-01' }), arte());
    expect(resumo?.frase).toContain('só em 01/09');
  });
});

/* ==========================================================================
 * AS TRÊS ARMADILHAS — a razão de a frase existir
 * ======================================================================= */

describe('as ressalvas que o lojista descobriria depois', () => {
  /*
   * 1. `min_order_value` é comparado com o SUBTOTAL (`if subtotal < minimum`).
   *    A taxa de entrega não ajuda a alcançar o mínimo.
   */
  it('diz "em produtos" no mínimo, e explica que a taxa não conta', () => {
    const resumo = resumoDoCupom(rascunho({ minOrderValue: '60,00' }), arte());

    expect(resumo?.frase).toContain('em pedidos de R$ 60,00 ou mais em produtos');
    expect(resumo?.notas.join(' ')).toContain('taxa de entrega não conta');
  });

  it('sem mínimo não inventa a ressalva', () => {
    const resumo = resumoDoCupom(rascunho(), arte());
    expect(resumo?.frase).not.toContain('em produtos');
    expect(resumo?.notas.join(' ')).not.toContain('subtotal');
  });

  /*
   * 2. `free_delivery` desconta a taxa inteira, e na retirada a taxa é ZERO
   *    (`if order_type == "pickup": fee = ZERO`). O cupom é aceito e desconta
   *    R$ 0,00 — não é bloqueado, só não vale nada.
   */
  it('frete grátis diz "só em entrega" e explica a retirada', () => {
    const resumo = resumoDoCupom(rascunho(), FRETE);

    expect(resumo?.frase).toContain('só em entrega');
    expect(resumo?.notas.join(' ')).toContain('retirada');
    expect(resumo?.notas.join(' ')).toContain('R$ 0,00');
  });

  it('a ressalva da retirada não aparece em cupom que não é de frete', () => {
    const resumo = resumoDoCupom(rascunho(), arte());
    expect(resumo?.notas.join(' ')).not.toContain('retirada');
  });

  /*
   * 3. `first_order_only` olha `customer_has_valid_order(cliente, ESTE
   *    restaurante)`. É primeiro pedido NESTA loja, não na plataforma.
   */
  it('diz "nunca pediu aqui", e nunca "novos clientes"', () => {
    const resumo = resumoDoCupom(rascunho({ firstOrderOnly: true }), arte());

    expect(resumo?.frase).toContain('só para quem nunca pediu aqui');
    expect(resumo?.frase).not.toContain('novos clientes');
    expect(resumo?.notas.join(' ')).toContain('não na plataforma');
  });
});

describe('os limites de uso na frase', () => {
  it('escreve o intervalo entre usos em dias', () => {
    const resumo = resumoDoCupom(rascunho({ cooldownDays: '7' }), arte());
    expect(resumo?.frase).toContain('com 7 dias entre um uso e outro');
  });

  it('concorda o singular', () => {
    const resumo = resumoDoCupom(
      rascunho({ totalUsageLimit: '1', usageLimitPerCustomer: '1', cooldownDays: '1' }),
      arte(),
    );

    expect(resumo?.frase).toContain('1 uso no total');
    expect(resumo?.frase).toContain('1 vez por cliente');
    expect(resumo?.frase).toContain('com 1 dia entre um uso e outro');
  });

  /* Campo vazio é "sem limite", e sem limite não vira palavra na frase: uma
     frase que dissesse "sem limite de usos" seria mais longa para afirmar o
     que a ausência já diz. */
  it('não escreve nada sobre limite que o lojista não pôs', () => {
    const resumo = resumoDoCupom(rascunho(), arte());
    expect(resumo?.frase).not.toContain('usos');
    expect(resumo?.frase).not.toContain('por cliente');
  });
});
