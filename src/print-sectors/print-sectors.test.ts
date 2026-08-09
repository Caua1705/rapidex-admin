import { describe, expect, it } from 'vitest';

import type { PrintSector } from '../api/types';
import {
  activeSectors,
  checkSectorName,
  nextSortOrder,
  NO_SECTOR_LABEL,
  sectorLabelFor,
  sortSectors,
} from './print-sectors';

function sector(overrides: Partial<PrintSector> & { id: string; name: string }): PrintSector {
  return {
    branch_id: 'b-1',
    is_active: true,
    sort_order: 0,
    ...overrides,
  };
}

describe('sortSectors', () => {
  it('ordena por sort_order e, no empate, pelo nome', () => {
    const ordenados = sortSectors([
      sector({ id: '3', name: 'Bar', sort_order: 1 }),
      sector({ id: '1', name: 'Chapa', sort_order: 0 }),
      sector({ id: '2', name: 'Adega', sort_order: 1 }),
    ]);

    expect(ordenados.map((entry) => entry.name)).toEqual(['Chapa', 'Adega', 'Bar']);
  });
});

describe('activeSectors', () => {
  // Oferecer um setor desligado seria mandar o pedido para uma impressora que o
  // lojista acabou de tirar do ar.
  it('só os ativos podem ser escolhidos num produto', () => {
    const escolhíveis = activeSectors([
      sector({ id: '1', name: 'Chapa' }),
      sector({ id: '2', name: 'Bar', is_active: false }),
    ]);

    expect(escolhíveis.map((entry) => entry.name)).toEqual(['Chapa']);
  });
});

describe('sectorLabelFor', () => {
  const setores = [
    sector({ id: 's-chapa', name: 'Chapa' }),
    sector({ id: 's-bar', name: 'Bar', is_active: false }),
  ];

  it('sem setor é "Não imprimir" — uma configuração válida, não um vazio', () => {
    expect(sectorLabelFor(null, setores)).toEqual({
      label: NO_SECTOR_LABEL,
      known: true,
      empty: true,
    });
    expect(sectorLabelFor(undefined, setores).empty).toBe(true);
  });

  it('mostra o nome do setor', () => {
    expect(sectorLabelFor('s-chapa', setores)).toMatchObject({ label: 'Chapa', known: true });
  });

  // O produto continua apontando para ele; esconder isso faria o lojista achar
  // que o item não imprime.
  it('setor desativado aparece marcado, e não sumindo', () => {
    expect(sectorLabelFor('s-bar', setores).label).toBe('Bar (desativado)');
  });

  /*
   * O caso que o cruzamento filial x restaurante cria: o produto é do
   * restaurante e o setor é da filial, então um id gravado por outra loja não
   * está nesta lista. Dizer "Não imprimir" seria mentir — o produto TEM setor.
   */
  it('id que não é desta filial vira aviso, não "Não imprimir"', () => {
    const resultado = sectorLabelFor('s-de-outra-filial', setores);

    expect(resultado.known).toBe(false);
    expect(resultado.empty).toBe(false);
    expect(resultado.label).not.toBe(NO_SECTOR_LABEL);
  });
});

describe('checkSectorName', () => {
  const existentes = [sector({ id: 's-1', name: 'Chapa' })];

  it('aceita um nome novo e devolve aparado', () => {
    expect(checkSectorName('  Bar  ', existentes)).toEqual({ valid: true, name: 'Bar' });
  });

  it('nome vazio é recusado', () => {
    expect(checkSectorName('   ', existentes).valid).toBe(false);
  });

  // Duas linhas "Chapa" deixam o lojista sem saber qual escolher no produto, e o
  // erro só apareceria num pedido impresso no lugar errado.
  it('nome repetido é recusado, sem diferenciar maiúscula', () => {
    expect(checkSectorName('Chapa', existentes).valid).toBe(false);
    expect(checkSectorName('chapa', existentes).valid).toBe(false);
    expect(checkSectorName('  CHAPA ', existentes).valid).toBe(false);
  });

  // Renomear sem mudar o nome não pode colidir com o próprio setor.
  it('ao renomear, o próprio setor não conta como repetido', () => {
    expect(checkSectorName('Chapa', existentes, { ignoreId: 's-1' }).valid).toBe(true);
  });

  it('recusa nome longo demais', () => {
    expect(checkSectorName('x'.repeat(61), existentes).valid).toBe(false);
    expect(checkSectorName('x'.repeat(60), existentes).valid).toBe(true);
  });
});

describe('nextSortOrder', () => {
  it('põe o setor novo no fim da lista', () => {
    expect(nextSortOrder([sector({ id: '1', name: 'A', sort_order: 0 })])).toBe(1);
    expect(nextSortOrder([sector({ id: '1', name: 'A', sort_order: 7 })])).toBe(8);
  });

  it('a primeira criação começa em zero', () => {
    expect(nextSortOrder([])).toBe(0);
  });
});
