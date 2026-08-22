import { describe, expect, it } from 'vitest';

import type { Category, Product } from '../api/types';
import {
  categoryIdsForReorder,
  countBlockedByRequiredGroup,
  formatPriceInput,
  isProductActive,
  isProductAvailable,
  moveCategory,
  moveInList,
  parsePriceInput,
  podeReordenarProdutos,
  productDraftFrom,
  productIdsForReorder,
  productSaleState,
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

/* ==========================================================================
 * A SITUAÇÃO DE VENDA — e a que o lojista NÃO escolheu
 * ======================================================================= */

describe('productSaleState', () => {
  it('lê o campo do backend em vez de deduzir a regra de novo', () => {
    /*
     * A ARMADILHA QUE ESTE TESTE FECHA: o item está ativo e disponível — os
     * dois interruptores que o lojista controla estão ligados — e mesmo assim
     * ele não vende. Antes, a tela deduzia isso dos grupos de opção e a
     * listagem não os tem carregados, então a linha aparecia como qualquer
     * outra.
     */
    expect(
      productSaleState(
        product({ is_active: true, is_available: true, unavailable_by_required_group: true }),
      ),
    ).toBe('sem-opcao');
  });

  it('esgotado vence "sem opção" — o alarme é para quem ACHA que está vendendo', () => {
    /*
     * Num item já marcado como esgotado o lojista sabe que não vende, e trocar
     * a palavra ali não muda ação nenhuma. Gastar o alarme aí é como ele
     * aprende a ignorá-lo.
     */
    expect(
      productSaleState(product({ is_available: false, unavailable_by_required_group: true })),
    ).toBe('esgotado');
  });

  it('inativo vence tudo: o item nem está no cardápio', () => {
    expect(
      productSaleState(
        product({ is_active: false, is_available: false, unavailable_by_required_group: true }),
      ),
    ).toBe('inativo');
  });

  it('sem nada de errado, não há palavra nenhuma a escrever', () => {
    expect(productSaleState(product())).toBe('a-venda');
  });
});

describe('countBlockedByRequiredGroup', () => {
  it('conta só os que estão fora de venda por grupo, e não os esgotados', () => {
    const lista = [
      product({ id: 'a', unavailable_by_required_group: true }),
      product({ id: 'b', is_available: false, unavailable_by_required_group: true }),
      product({ id: 'c' }),
      product({ id: 'd', unavailable_by_required_group: true }),
    ];

    // 'b' não conta: ele já aparece como "Esgotado" e não é o alarme.
    expect(countBlockedByRequiredGroup(lista)).toBe(2);
  });
});

/* ==========================================================================
 * REORDENAR
 * ======================================================================= */

describe('moveInList', () => {
  it('TIRA e ENFIA, não troca dois de lugar', () => {
    /*
     * A diferença só aparece longe: puxar o quinto para o topo tem de empurrar
     * os quatro primeiros um degrau para baixo. Com troca, ['a','b','c','d','e']
     * viraria ['e','b','c','d','a'] — uma ordem que ninguém arrastou.
     */
    expect(moveInList(['a', 'b', 'c', 'd', 'e'], 4, 0)).toEqual(['e', 'a', 'b', 'c', 'd']);
  });

  it('mover para trás empurra o vizinho para a frente', () => {
    expect(moveInList(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('devolve null quando o movimento não muda nada', () => {
    expect(moveInList(['a', 'b'], 1, 1)).toBeNull();
    expect(moveInList(['a', 'b'], 0, 5)).toBeNull();
    expect(moveInList(['a', 'b'], -1, 0)).toBeNull();
  });

  it('com vizinhos, mover e trocar dão o mesmo resultado — é o que liga a seta ao arrastar', () => {
    const lista = [category({ id: 'a' }), category({ id: 'b' }), category({ id: 'c' })];

    expect(moveCategory(lista, 1, -1)?.map((item) => item.id)).toEqual(
      moveInList(lista, 1, 0)?.map((item) => item.id),
    );
  });
});

describe('productIdsForReorder', () => {
  it('devolve a lista completa na ordem, que é o que a rota exige', () => {
    expect(
      productIdsForReorder([product({ id: 'p2' }), product({ id: 'p1' }), product({ id: 'p3' })]),
    ).toEqual(['p2', 'p1', 'p3']);
  });
});

describe('podeReordenarProdutos', () => {
  it('não dá com a busca ligada: a lista é um recorte, e a ordem é da categoria', () => {
    expect(podeReordenarProdutos({ search: 'pic', loaded: 3, total: 3 })).toBe(false);
  });

  it('não dá com a paginação cortando: a rota exige a categoria inteira', () => {
    /*
     * A lista curta aqui não reordena de menos — o backend responde 400. É o
     * desfecho bom; o ruim seria ele aceitar e renumerar só o que veio.
     */
    expect(podeReordenarProdutos({ search: '', loaded: 50, total: 80 })).toBe(false);
  });

  it('dá com a categoria inteira na mão e nenhum filtro', () => {
    expect(podeReordenarProdutos({ search: '   ', loaded: 12, total: 12 })).toBe(true);
  });
});
