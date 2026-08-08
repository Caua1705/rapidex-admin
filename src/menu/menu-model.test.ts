import { describe, expect, it } from 'vitest';

import type { Category, Product } from '../api/types';
import {
  categoryIdsForReorder,
  formatPriceInput,
  isProductActive,
  isProductAvailable,
  moveCategory,
  parsePriceInput,
  showsAvailabilityToggle,
  sortCategories,
} from './menu-model';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Lanches',
    slug: 'lanches',
    sort_order: 0,
    is_active: true,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    category_id: 'cat-1',
    name: 'X-Burger',
    price: 24.9,
    is_active: true,
    is_available: true,
    sort_order: 0,
    ...overrides,
  };
}

describe('ativo x disponível', () => {
  it('trata null como ativo e disponível, porque o padrão do backend é true', () => {
    expect(isProductActive(product({ is_active: null }))).toBe(true);
    expect(isProductAvailable(product({ is_available: null }))).toBe(true);
  });

  it('só o false explícito desativa', () => {
    expect(isProductActive(product({ is_active: false }))).toBe(false);
    expect(isProductAvailable(product({ is_available: false }))).toBe(false);
  });

  // O ponto da tela: são eixos independentes.
  it('produto inativo pode estar marcado como disponível — e continua inativo', () => {
    const inativoDisponivel = product({ is_active: false, is_available: true });
    expect(isProductActive(inativoDisponivel)).toBe(false);
    expect(isProductAvailable(inativoDisponivel)).toBe(true);
  });

  it('não oferece o interruptor de esgotado em produto inativo', () => {
    expect(showsAvailabilityToggle(product({ is_active: true }))).toBe(true);
    expect(showsAvailabilityToggle(product({ is_active: false }))).toBe(false);
  });
});

describe('ordem das categorias', () => {
  it('ordena por sort_order e desempata pelo nome', () => {
    const ordered = sortCategories([
      category({ id: 'c3', name: 'Bebidas', sort_order: 1 }),
      category({ id: 'c2', name: 'Acompanhamentos', sort_order: 0 }),
      category({ id: 'c1', name: 'Lanches', sort_order: 0 }),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
  });

  it('sort_order nulo vale zero em vez de sumir do fim da lista', () => {
    const ordered = sortCategories([
      category({ id: 'c1', name: 'Zebra', sort_order: 5 }),
      category({ id: 'c2', name: 'Abacaxi', sort_order: null }),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('troca com a vizinha', () => {
    const lista = [category({ id: 'a' }), category({ id: 'b' }), category({ id: 'c' })];
    expect(moveCategory(lista, 1, -1)?.map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(moveCategory(lista, 1, 1)?.map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('recusa o movimento que sai da lista, para não gerar requisição à toa', () => {
    const lista = [category({ id: 'a' }), category({ id: 'b' })];
    expect(moveCategory(lista, 0, -1)).toBeNull();
    expect(moveCategory(lista, 1, 1)).toBeNull();
  });

  it('não altera a lista original', () => {
    const lista = [category({ id: 'a' }), category({ id: 'b' })];
    moveCategory(lista, 0, 1);
    expect(lista.map((c) => c.id)).toEqual(['a', 'b']);
  });

  /*
   * O contrato do reorder: a lista COMPLETA, na ordem final. Se um dia alguém
   * filtrar a barra lateral e mandar só o que aparece, este teste é o que
   * pega — mandar menos ids não reordena menos, zera a posição do resto.
   */
  it('o corpo do reorder leva todas as categorias, inclusive as inativas', () => {
    const lista = [
      category({ id: 'a', is_active: true }),
      category({ id: 'b', is_active: false }),
      category({ id: 'c', is_active: true }),
    ];
    expect(categoryIdsForReorder(lista)).toEqual(['a', 'b', 'c']);
    expect(categoryIdsForReorder(lista)).toHaveLength(lista.length);
  });
});

describe('preço', () => {
  it('aceita vírgula, ponto de milhar e espaço', () => {
    expect(parsePriceInput('24,90')).toBe(24.9);
    expect(parsePriceInput(' 1.234,50 ')).toBe(1234.5);
    expect(parsePriceInput('7')).toBe(7);
  });

  it('recusa vazio, texto e negativo', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('grátis')).toBeNull();
    expect(parsePriceInput('-3')).toBeNull();
  });

  it('leva e traz o mesmo valor', () => {
    expect(formatPriceInput(24.9)).toBe('24,90');
    expect(parsePriceInput(formatPriceInput(1234.5))).toBe(1234.5);
    expect(formatPriceInput(null)).toBe('');
  });
});
