import { describe, expect, it } from 'vitest';

import {
  checkDeliveryConfig,
  estimateDeliveryFee,
  isDeliveryEstimable,
  type DeliveryConfig,
} from './delivery-config';

function config(overrides: Partial<DeliveryConfig> = {}): DeliveryConfig {
  return {
    delivery_base_fee: 5,
    delivery_fee_per_km: 2,
    delivery_min_fee: null,
    delivery_max_fee: null,
    delivery_max_distance_km: 10,
    ...overrides,
  };
}

describe('checkDeliveryConfig', () => {
  it('configuração completa não tem problema', () => {
    expect(checkDeliveryConfig(config())).toEqual([]);
  });

  /*
   * O defeito caro: sem base ou sem por-km a estimativa não roda, o endereço do
   * cliente volta como não atendível e a loja fica aberta sem receber nenhum
   * pedido de entrega. Isso é ERRO DE CONFIGURAÇÃO, não campo opcional vazio.
   */
  /*
   * A MENSAGEM DIZ SÓ O QUE FALTA. A consequência ("todo endereço volta como
   * não atendível…") é a mesma para os dois campos e saiu daqui: escrita nos
   * dois, ela aparecia duas vezes seguidas dentro do mesmo aviso. Quem a diz,
   * uma vez, é `DELIVERY_BLOCKED_CONSEQUENCE` no rodapé do aviso — e é
   * `blocksDelivery` que marca quais problemas a compartilham.
   */
  it('taxa base nula é erro de configuração', () => {
    const problems = checkDeliveryConfig(config({ delivery_base_fee: null }));

    expect(problems).toHaveLength(1);
    expect(problems[0]?.field).toBe('delivery_base_fee');
    expect(problems[0]?.message).toBe('Falta a taxa base.');
    expect(problems[0]?.blocksDelivery).toBe(true);
  });

  it('valor por km nulo é erro de configuração', () => {
    const problems = checkDeliveryConfig(config({ delivery_fee_per_km: null }));

    expect(problems).toHaveLength(1);
    expect(problems[0]?.field).toBe('delivery_fee_per_km');
    expect(problems[0]?.message).toBe('Falta o valor por km.');
    expect(problems[0]?.blocksDelivery).toBe(true);
  });

  /*
   * A incoerência de mínima/máxima NÃO derruba a entrega: ela dá preço
   * estranho. Marcá-la como bloqueante faria o aviso afirmar que a loja não
   * recebe pedido nenhum quando ela recebe.
   */
  it('mínima acima da máxima não bloqueia a entrega', () => {
    const problems = checkDeliveryConfig(config({ delivery_min_fee: 20, delivery_max_fee: 10 }));

    expect(problems).toHaveLength(1);
    expect(problems[0]?.blocksDelivery).toBeUndefined();
  });

  it('os dois nulos reclamam dos dois, não de um só', () => {
    const problems = checkDeliveryConfig(
      config({ delivery_base_fee: null, delivery_fee_per_km: null }),
    );

    expect(problems.map((problem) => problem.field)).toEqual([
      'delivery_base_fee',
      'delivery_fee_per_km',
    ]);
  });

  // Zero é uma configuração de verdade — entrega grátis — e não "faltando".
  it('taxa base zero é válida e não vira erro', () => {
    expect(checkDeliveryConfig(config({ delivery_base_fee: 0, delivery_fee_per_km: 0 }))).toEqual(
      [],
    );
  });

  it('mínima acima da máxima é incoerência', () => {
    const problems = checkDeliveryConfig(config({ delivery_min_fee: 12, delivery_max_fee: 8 }));

    expect(problems).toHaveLength(1);
    expect(problems[0]?.field).toBe('delivery_max_fee');
  });

  it('distância máxima zerada não atende ninguém', () => {
    const problems = checkDeliveryConfig(config({ delivery_max_distance_km: 0 }));

    expect(problems[0]?.field).toBe('delivery_max_distance_km');
  });
});

describe('isDeliveryEstimable', () => {
  it('depende só dos dois campos que a fórmula usa', () => {
    expect(isDeliveryEstimable(config())).toBe(true);
    expect(isDeliveryEstimable(config({ delivery_base_fee: null }))).toBe(false);
    expect(isDeliveryEstimable(config({ delivery_fee_per_km: null }))).toBe(false);
    // Faixa e distância são opcionais: sem elas a conta continua de pé.
    expect(
      isDeliveryEstimable(config({ delivery_max_fee: null, delivery_max_distance_km: null })),
    ).toBe(true);
  });
});

describe('estimateDeliveryFee', () => {
  it('base mais por km vezes a distância', () => {
    expect(estimateDeliveryFee(config(), 3)).toBe(11);
  });

  it('a mínima levanta o valor e a máxima o segura', () => {
    expect(estimateDeliveryFee(config({ delivery_min_fee: 9 }), 1)).toBe(9);
    expect(estimateDeliveryFee(config({ delivery_max_fee: 8 }), 5)).toBe(8);
  });

  // O mesmo "não atendível" que o cliente veria no app.
  it('acima da distância máxima não tem estimativa', () => {
    expect(estimateDeliveryFee(config({ delivery_max_distance_km: 6 }), 7)).toBeNull();
  });

  it('sem base ou sem por km não estima', () => {
    expect(estimateDeliveryFee(config({ delivery_base_fee: null }), 3)).toBeNull();
    expect(estimateDeliveryFee(config({ delivery_fee_per_km: null }), 3)).toBeNull();
  });

  it('arredonda no centavo', () => {
    expect(
      estimateDeliveryFee(config({ delivery_base_fee: 4.99, delivery_fee_per_km: 1.335 }), 2),
    ).toBe(7.66);
  });
});
