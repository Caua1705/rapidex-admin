import { describe, expect, it } from 'vitest';

import type { OrderItemWithOptions } from '../api/contract-pending';
import { readOptionGroups } from './order-options';

function item(overrides: Partial<OrderItemWithOptions> = {}): OrderItemWithOptions {
  return {
    id: 'item-1',
    product_name_snapshot: 'Filé à parmegiana',
    unit_price_snapshot: 62,
    quantity: 1,
    total: 62,
    ...overrides,
  };
}

describe('readOptionGroups', () => {
  it('agrupa as opções pelo grupo, na ordem em que vieram', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          {
            id: 'g1',
            group_name_snapshot: 'Acompanhamento',
            options: [
              { id: 'o1', option_name_snapshot: 'Espaguete', additional_price_snapshot: 0 },
            ],
          },
          {
            id: 'g2',
            group_name_snapshot: 'Adicional',
            options: [
              { id: 'o2', option_name_snapshot: 'Espaguete', additional_price_snapshot: 12 },
              { id: 'o3', option_name_snapshot: 'Bacon', additional_price_snapshot: 5 },
            ],
          },
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

  it('aceita o nome curto quando o backend não usa o sufixo _snapshot', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          { id: 'g1', name: 'Ponto da carne', options: [{ id: 'o1', name: 'Ao ponto' }] },
        ],
      }),
    );

    expect(grupos[0]?.label).toBe('Ponto da carne');
    expect(grupos[0]?.options[0]?.label).toBe('Ao ponto');
  });

  it('lê preço que vem como string decimal', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          {
            id: 'g1',
            group_name_snapshot: 'Adicional',
            options: [
              { id: 'o1', option_name_snapshot: 'Bacon', additional_price_snapshot: '5.50' },
            ],
          },
        ],
      }),
    );

    expect(grupos[0]?.options[0]?.additionalPrice).toBe(5.5);
  });

  it('item sem adicionais devolve lista vazia', () => {
    expect(readOptionGroups(item())).toEqual([]);
    expect(readOptionGroups(item({ option_groups: null }))).toEqual([]);
    expect(readOptionGroups(item({ option_groups: [] }))).toEqual([]);
  });

  // Linha recuada em branco sob o item parece defeito da tela, não dado
  // faltando no pedido.
  it('descarta opção sem rótulo e grupo que ficou sem nenhuma opção', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          {
            id: 'g1',
            group_name_snapshot: 'Vazio',
            options: [{ id: 'o1', option_name_snapshot: '  ' }],
          },
          { id: 'g2', group_name_snapshot: 'Sem lista' },
          {
            id: 'g3',
            group_name_snapshot: 'Adicional',
            options: [{ id: 'o2', option_name_snapshot: 'Bacon' }],
          },
        ],
      }),
    );

    expect(grupos.map((g) => g.label)).toEqual(['Adicional']);
  });

  it('preço ausente vira null, não zero — zero é um preço de verdade', () => {
    const grupos = readOptionGroups(
      item({
        option_groups: [
          {
            id: 'g1',
            group_name_snapshot: 'Acompanhamento',
            options: [
              { id: 'o1', option_name_snapshot: 'Arroz' },
              { id: 'o2', option_name_snapshot: 'Fritas', additional_price_snapshot: 0 },
            ],
          },
        ],
      }),
    );

    expect(grupos[0]?.options[0]?.additionalPrice).toBeNull();
    expect(grupos[0]?.options[1]?.additionalPrice).toBe(0);
  });
});
