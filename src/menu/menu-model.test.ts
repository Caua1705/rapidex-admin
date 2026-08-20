import { describe, expect, it } from 'vitest';

import type { Category, Product } from '../api/types';
import {
  categoryIdsForReorder,
  formatPriceInput,
  isProductActive,
  isProductAvailable,
  moveCategory,
  parsePriceInput,
  productDraftFrom,
  showsAvailabilityToggle,
  sortCategories,
} from './menu-model';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    // O contrato passou a exigir o campo: categoria e produto são DA FILIAL,
    // e é o que impede um fixture de descrever uma linha que o banco não
    // aceita mais gravar.
    branch_id: 'fil-1',
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
    branch_id: 'fil-1',
    category_id: 'cat-1',
    name: 'X-Burger',
    price: 24.9,
    is_active: true,
    is_available: true,
    sort_order: 0,
    // O contrato passou a exigir o campo: o backend calcula em SQL se um grupo
    // obrigatório sem opção disponível tirou o item de venda.
    unavailable_by_required_group: false,
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

describe('productDraftFrom', () => {
  /*
   * O CAMPO QUE ESTA FUNÇÃO EXISTE POR CAUSA DE. O corpo do PATCH manda
   * `catalog_key` sempre — nulo é como o lojista separa dois itens —, então um
   * rascunho que não trouxesse a chave mandaria `null` de volta e desfaria o
   * pareamento de um item porque alguém corrigiu o preço dele. Nada falharia
   * na tela; a linha do relatório é que pararia de somar as duas lojas.
   */
  it('carrega a chave de catálogo, para editar o preço não desfazer o par', () => {
    expect(productDraftFrom(product({ catalog_key: 'prod-1' })).catalog).toEqual({
      key: 'prod-1',
      twin: null,
    });
  });

  it('produto sem chave abre sem par, que é o estado normal', () => {
    expect(productDraftFrom(product({ catalog_key: null })).catalog).toBeNull();
  });

  /* O resto do rascunho, para a extração não ter perdido campo pelo caminho. */
  it('traz o item como ele está, com o preço no formato que se digita', () => {
    const draft = productDraftFrom(
      product({
        id: 'prod-9',
        category_id: 'cat-2',
        name: 'Picanha',
        price: 59.9,
        description: null,
        is_active: false,
        is_available: false,
        printing_sector_id: 'sec-chapa',
      }),
    );

    expect(draft).toEqual({
      id: 'prod-9',
      categoryId: 'cat-2',
      name: 'Picanha',
      price: '59,90',
      description: '',
      isActive: false,
      isAvailable: false,
      printSectorId: 'sec-chapa',
      catalog: null,
    });
  });

  /*
   * `null` em `is_active` é ATIVO (o padrão do backend), e o mesmo vale para
   * `is_available`. Tratá-los como desligados sumiria com metade do cardápio
   * de um restaurante antigo — a mesma regra de `isProductActive`.
   */
  it('trata null de ativo e disponível como ligado', () => {
    const draft = productDraftFrom(product({ is_active: null, is_available: null }));
    expect([draft.isActive, draft.isAvailable]).toEqual([true, true]);
  });
});
