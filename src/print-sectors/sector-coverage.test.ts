import { describe, expect, it } from 'vitest';

import type { PrintSector, Product } from '../api/types';
import { coverageOf, formatItemCount } from './sector-coverage';

function sector(id: string): PrintSector {
  return { id, branch_id: 'b1', name: id, is_active: true, sort_order: 0 };
}

function product(id: string, printingSectorId: string | null | undefined): Product {
  return { id, printing_sector_id: printingSectorId } as Product;
}

const SETORES = [sector('chapa'), sector('bar')];

describe('coverageOf', () => {
  it('conta os itens de cada setor', () => {
    const coverage = coverageOf(
      [product('1', 'chapa'), product('2', 'chapa'), product('3', 'bar')],
      SETORES,
    );

    expect(coverage.countBySectorId).toEqual({ chapa: 2, bar: 1 });
    expect(coverage.total).toBe(3);
  });

  /*
   * O número que faz esta tela existir: item sem setor não sai na comanda de
   * produção, e o lojista precisa descobrir antes do sábado à noite.
   */
  it('conta separadamente quem não tem setor', () => {
    const coverage = coverageOf([product('1', 'chapa'), product('2', null)], SETORES);

    expect(coverage.withoutSector).toBe(1);
    expect(coverage.countBySectorId).toEqual({ chapa: 1 });
  });

  /* Campo ausente na resposta é o mesmo que nulo: os dois são "não imprime". */
  it('trata campo ausente como sem setor', () => {
    expect(coverageOf([product('1', undefined)], SETORES).withoutSector).toBe(1);
  });

  /*
   * Setor de OUTRA filial é caso diferente de "sem setor", e é o único que a
   * tela chama de inconsistência: ninguém escolheu isso. Somar os dois num
   * alarme só faria a loja que vende refrigerante (sem setor de propósito)
   * gritar junto com a que tem cadastro errado.
   */
  it('separa setor desconhecido de sem setor', () => {
    const coverage = coverageOf(
      [product('1', 'de-outra-filial'), product('2', null), product('3', 'bar')],
      SETORES,
    );

    expect(coverage.strangeSector).toBe(1);
    expect(coverage.withoutSector).toBe(1);
    expect(coverage.countBySectorId).toEqual({ bar: 1 });
  });

  it('conta o setor desativado como conhecido', () => {
    // Desativado ainda é desta filial: o produto que aponta para ele tem um
    // cadastro coerente, e chamá-lo de estranho mandaria o lojista arrumar o
    // que não está quebrado.
    const desativado = { ...sector('sobremesa'), is_active: false };
    const coverage = coverageOf([product('1', 'sobremesa')], [...SETORES, desativado]);

    expect(coverage.strangeSector).toBe(0);
    expect(coverage.countBySectorId).toEqual({ sobremesa: 1 });
  });

  it('fecha a conta: setores + sem setor + estranhos = total', () => {
    const produtos = [
      product('1', 'chapa'),
      product('2', 'bar'),
      product('3', null),
      product('4', 'sumido'),
    ];
    const coverage = coverageOf(produtos, SETORES);
    const emSetores = Object.values(coverage.countBySectorId).reduce((a, b) => a + b, 0);

    expect(emSetores + coverage.withoutSector + coverage.strangeSector).toBe(coverage.total);
  });

  it('devolve zeros para um cardápio vazio', () => {
    expect(coverageOf([], SETORES)).toEqual({
      countBySectorId: {},
      withoutSector: 0,
      strangeSector: 0,
      total: 0,
    });
  });
});

describe('formatItemCount', () => {
  /* Zero vira palavra: o setor vazio é o que se procura, e "0" some no meio
     de algarismos parecidos numa lista lida de bate-pronto. */
  it('escreve o zero por extenso', () => {
    expect(formatItemCount(0)).toBe('nenhum item');
  });

  it('concorda o singular', () => {
    expect(formatItemCount(1)).toBe('1 item');
  });

  it('concorda o plural', () => {
    expect(formatItemCount(12)).toBe('12 itens');
  });
});
