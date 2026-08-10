import { describe, expect, it } from 'vitest';

import type { OrderItem, OrderItemOption, OrderItemOptionGroup } from '../api/types';
import { readOptionGroups } from './order-options';

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    product_name_snapshot: 'Filé à parmegiana',
    unit_price_snapshot: 62,
    quantity: 1,
    total: 62,
    ...overrides,
  };
}

/** Uma opção completa — no contrato os quatro campos são obrigatórios. */
function option(overrides: Partial<OrderItemOption> = {}): OrderItemOption {
  return {
    id: 'o1',
    option_id: 'opt-1',
    option_name_snapshot: 'Espaguete',
    additional_price_snapshot: 0,
    ...overrides,
  };
}

function group(overrides: Partial<OrderItemOptionGroup> = {}): OrderItemOptionGroup {
  return {
    option_group_id: 'g1',
    option_group_name_snapshot: 'Acompanhamento',
    options: [option()],
    ...overrides,
  };
}

describe('readOptionGroups', () => {
  it('agrupa as opções pelo grupo, na ordem em que vieram', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          group({
            option_group_id: 'g1',
            option_group_name_snapshot: 'Acompanhamento',
            options: [option({ id: 'o1', option_name_snapshot: 'Espaguete' })],
          }),
          group({
            option_group_id: 'g2',
            option_group_name_snapshot: 'Adicional',
            options: [
              option({
                id: 'o2',
                option_name_snapshot: 'Espaguete',
                additional_price_snapshot: 12,
              }),
              option({ id: 'o3', option_name_snapshot: 'Bacon', additional_price_snapshot: 5 }),
            ],
          }),
        ],
      }),
    );

    expect(grupos.map((g) => g.label)).toEqual(['Acompanhamento', 'Adicional']);
    // É o grupo que separa a TROCA de acompanhamento da PORÇÃO EXTRA — as duas
    // opções têm o mesmo nome e significados opostos para a cozinha.
    expect(grupos[0]?.options.map((o) => o.label)).toEqual(['Espaguete']);
    expect(grupos[1]?.options.map((o) => o.label)).toEqual(['Espaguete', 'Bacon']);
    expect(grupos[1]?.options[0]?.additionalPrice).toBe(12);
  });

  it('a chave de cada linha é o id que veio do backend', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [group({ option_group_id: 'g-9', options: [option({ id: 'o-9' })] })],
      }),
    );

    expect(grupos[0]?.key).toBe('g-9');
    expect(grupos[0]?.options[0]?.key).toBe('o-9');
  });

  it('zero é um preço de verdade e aparece como zero', () => {
    const grupos = readOptionGroups(
      item({ option_groups: [group({ options: [option({ additional_price_snapshot: 0 })] })] }),
    );

    expect(grupos[0]?.options[0]?.additionalPrice).toBe(0);
  });

  it('item sem adicionais devolve lista vazia', () => {
    expect(readOptionGroups(item())).toEqual([]);
    expect(readOptionGroups(item({ option_groups: [] }))).toEqual([]);
  });

  // Linha recuada em branco sob o item parece defeito da tela, não dado
  // faltando no pedido.
  it('descarta opção sem rótulo e grupo que ficou sem nenhuma opção', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          group({
            option_group_id: 'g1',
            option_group_name_snapshot: 'Vazio',
            options: [option({ option_name_snapshot: '  ' })],
          }),
          group({ option_group_id: 'g2', option_group_name_snapshot: 'Sem lista', options: [] }),
          group({
            option_group_id: 'g3',
            option_group_name_snapshot: 'Adicional',
            options: [option({ id: 'o2', option_name_snapshot: 'Bacon' })],
          }),
        ],
      }),
    );

    expect(grupos.map((g) => g.label)).toEqual(['Adicional']);
  });
});
