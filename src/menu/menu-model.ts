/**
 * As regras do cardápio que não dependem de React nem da rede.
 *
 * Duas delas são as que mais dão errado nesta tela, e por isso estão aqui,
 * isoladas e testadas:
 *
 *   1. `is_active` e `is_available` são coisas DIFERENTES. Ativo é o item
 *      existir no cardápio; disponível é ter hoje na cozinha. Um item inativo
 *      não está "esgotado" — ele não está à venda, ponto, e nem faz sentido
 *      oferecer o interruptor de esgotado para ele.
 *   2. A reordenação de categoria manda a LISTA COMPLETA de ids. Uma lista
 *      parcial não reordena de menos: apaga a posição de quem ficou de fora.
 */
import type { Category, Product } from '../api/types';
import { pairFromProduct, type CatalogPair } from './catalog-key';

/**
 * Os RASCUNHOS dos dois formulários do cardápio.
 *
 * Moram aqui, e não no hook, porque são o mesmo tipo de coisa que o resto deste
 * arquivo: a forma dos dados, sem React e sem rede. `useMenu` os reexporta para
 * quem já os importava de lá.
 */
export type CategoryDraft = {
  id: string | null;
  name: string;
  isActive: boolean;
};

export type ProductDraft = {
  id: string | null;
  categoryId: string;
  name: string;
  price: string;
  description: string;
  isActive: boolean;
  isAvailable: boolean;
  /** Setor de impressão. `null` é "Não imprimir" — uma escolha, não um vazio. */
  printSectorId: string | null;
  /**
   * Pareamento de catálogo com o mesmo item de outra loja. `null` é "sem par",
   * que é o estado normal de um item que só existe aqui. Ver `catalog-key.ts`.
   */
  catalog: CatalogPair | null;
};

/**
 * O rascunho de EDIÇÃO, a partir da linha que o backend devolveu.
 *
 * É uma função, e não um objeto montado na tela, por causa de um campo só: a
 * `catalog_key`. O corpo do PATCH manda a chave SEMPRE (nulo é como se desfaz o
 * par), então um rascunho que esquecesse de trazê-la mandaria `null` — e
 * corrigir o preço de um item pareado desfaria o pareamento dele, sem erro
 * nenhum na tela. Montado num lugar só e testado, esse esquecimento deixa de
 * ser possível.
 */
export function productDraftFrom(product: Product): ProductDraft {
  return {
    id: product.id,
    categoryId: product.category_id,
    name: product.name,
    price: formatPriceInput(product.price),
    description: product.description ?? '',
    isActive: product.is_active !== false,
    isAvailable: product.is_available !== false,
    printSectorId: product.printing_sector_id ?? null,
    catalog: pairFromProduct(product),
  };
}

/**
 * O backend devolve `boolean | null` com padrão `true`, então null é "ativo".
 * Só o `false` explícito desativa — tratar null como desativado sumiria com
 * metade do cardápio de um restaurante antigo.
 */
export function isProductActive(product: Pick<Product, 'is_active'>): boolean {
  return product.is_active !== false;
}

export function isProductAvailable(product: Pick<Product, 'is_available'>): boolean {
  return product.is_available !== false;
}

export function isCategoryActive(category: Pick<Category, 'is_active'>): boolean {
  return category.is_active !== false;
}

/* ==========================================================================
 * A SITUAÇÃO DE VENDA — três formas de não estar à venda, e uma delas ninguém
 * escolheu
 * ======================================================================= */

/**
 * As quatro respostas possíveis para "este item está à venda?".
 *
 * `sem-opcao` É A QUE JUSTIFICA ESTE TIPO EXISTIR. As outras três o lojista
 * escolheu: ele desativou o item, ele marcou que acabou, ou está tudo certo.
 * Esta ACONTECEU com ele — ele desativou a última opção de um grupo
 * obrigatório (coisa que faz todo dia, uma opção por vez) e o item saiu do
 * cardápio público sem que nada mudasse na linha dele. `is_active` continua
 * ligado, `is_available` continua ligado, e a venda para.
 *
 * Tratar as três como "não está à venda" apagaria justamente a diferença que
 * decide o que fazer: a primeira se desfaz num interruptor, a segunda no
 * mesmo interruptor, e a terceira exige abrir o item e reativar uma opção.
 */
export type ProductSaleState = 'a-venda' | 'esgotado' | 'sem-opcao' | 'inativo';

/**
 * A situação de venda de um item, a partir do que o backend devolveu.
 *
 * `unavailable_by_required_group` VEM CALCULADO, e a tela não o deduz mais.
 *
 * Ela deduzia: `required-groups.ts` tem a mesma regra escrita em TypeScript, e
 * a listagem a rodava sobre os grupos de opção. Duas expressões da mesma regra
 * divergem no dia em que uma das duas mudar — e quem erra é a tela do lojista,
 * em silêncio, exatamente como o defeito que ela existe para acusar. Hoje a
 * regra do ESTADO tem uma fonte só, o backend; a cópia daqui ficou sendo só a
 * simulação do "e se eu desativar esta opção", que é uma pergunta sobre uma
 * mudança que ainda não aconteceu e que nenhuma rota responde.
 *
 * A ORDEM DE PRECEDÊNCIA NÃO É ARBITRÁRIA, e ela decide o que a linha escreve
 * quando duas coisas são verdade ao mesmo tempo:
 *
 *   inativo → esgotado → sem-opcao → à venda
 *
 * `esgotado` na frente de `sem-opcao` porque o alarme só serve para o item que
 * o lojista ACHA que está vendendo. Num item já marcado como esgotado ele
 * sabe que não vende, e trocar a palavra ali não muda ação nenhuma — pior,
 * gastaria o alarme num caso em que não há nada errado. No instante em que ele
 * repuser o item, a linha passa a dizer "Sem opção" sozinha, que é quando a
 * informação começa a valer.
 */
export function productSaleState(
  product: Pick<Product, 'is_active' | 'is_available' | 'unavailable_by_required_group'>,
): ProductSaleState {
  if (!isProductActive(product)) return 'inativo';
  if (!isProductAvailable(product)) return 'esgotado';
  if (product.unavailable_by_required_group) return 'sem-opcao';
  return 'a-venda';
}

/**
 * Quantos itens da lista carregada estão fora de venda por grupo obrigatório.
 *
 * Serve ao aviso do topo da lista, que é o que torna o problema ACHÁVEL: numa
 * categoria de oitenta itens, uma etiqueta na linha 47 não é encontrada por
 * ninguém que não estivesse justamente rolando por ali.
 */
export function countBlockedByRequiredGroup(products: readonly Product[]): number {
  return products.filter((product) => productSaleState(product) === 'sem-opcao').length;
}

/**
 * O interruptor de esgotado só aparece em produto ativo.
 *
 * Num item inativo ele seria uma pergunta sem sentido — "tem hoje?" sobre algo
 * que não está à venda — e o pior: mudar a disponibilidade de um item inativo
 * não o faz voltar ao cardápio, então o lojista mexeria achando que resolveu.
 */
export function showsAvailabilityToggle(product: Pick<Product, 'is_active'>): boolean {
  return isProductActive(product);
}

/**
 * A POSIÇÃO AUSENTE VAI PARA O FIM, e não para o começo.
 *
 * `sort_order` é coluna ANULÁVEL no backend (`Mapped[int | None]`, com o
 * default 0 só do lado do Python — uma linha criada por SQL na mão fica com
 * NULL). O painel fazia `sort_order ?? 0`, e **zero é a PRIMEIRA posição**.
 *
 * O cardápio público ordena em SQL por `Category.sort_order, Product.sort_order,
 * Product.name`, e o Postgres ordena **NULLS LAST** por padrão. Ou seja: a
 * categoria sem posição aparecia em PRIMEIRO no painel e em ÚLTIMO para o
 * cliente — duas telas discordando sobre a mesma lista, sem nada acusar.
 *
 * É a mesma família do `new Date(null)`, que é a época e não `NaN`: um nulo que
 * vira um número VÁLIDO e se mistura aos de verdade. E o `??` não é acidente de
 * digitação — é o que se escreve para calar o `strict` do TypeScript, que é
 * justamente onde esta classe sobrevive ao typecheck.
 */
const FIM_DA_LISTA = Number.POSITIVE_INFINITY;

/** Ordem de exibição: `sort_order` do backend e, no empate, o nome. */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const orderA = a.sort_order ?? FIM_DA_LISTA;
    const orderB = b.sort_order ?? FIM_DA_LISTA;
    // `Infinity - Infinity` é NaN, e um comparador que devolve NaN embaralha a
    // lista em silêncio. Duas sem posição empatam e caem no desempate por nome.
    if (orderA !== orderB) return orderA < orderB ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function sortProducts(products: readonly Product[]): Product[] {
  return [...products].sort((a, b) => {
    const orderA = a.sort_order ?? FIM_DA_LISTA;
    const orderB = b.sort_order ?? FIM_DA_LISTA;
    if (orderA !== orderB) return orderA < orderB ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/* ==========================================================================
 * REORDENAR
 * ======================================================================= */

/**
 * TIRA O ITEM DE UMA POSIÇÃO E O ENFIA EM OUTRA — não troca dois de lugar.
 *
 * A diferença só aparece quando `from` e `to` não são vizinhos, e é a diferença
 * entre arrastar e trocar: puxar o quinto item para o topo tem de empurrar os
 * quatro primeiros um degrau para baixo, e não jogar o primeiro lá para o
 * quinto lugar. Com a troca, arrastar duas casas já bagunça o cardápio de um
 * jeito que ninguém pediu.
 *
 * Devolve `null` quando o movimento não muda nada — índice igual, ou fora da
 * lista —, para quem chama não disparar uma requisição inútil e não pintar um
 * realce de "esta se moveu" em cima de algo parado.
 */
export function moveInList<T>(list: readonly T[], from: number, to: number): T[] | null {
  if (from === to) return null;
  if (from < 0 || from >= list.length) return null;
  if (to < 0 || to >= list.length) return null;

  const reordered = [...list];
  const [moved] = reordered.splice(from, 1);
  if (moved === undefined) return null;
  reordered.splice(to, 0, moved);
  return reordered;
}

/**
 * Troca a categoria de lugar com a vizinha.
 *
 * Continua existindo ao lado de `moveInList` porque é OUTRA entrada: as setas
 * pensam em "sobe um / desce um" e o arrastar pensa em "sai daqui, entra ali".
 * Por dentro é a mesma função — com vizinhos, mover e trocar dão o mesmo
 * resultado —, e é isso que garante que os dois caminhos nunca produzam ordens
 * diferentes.
 */
export function moveCategory(
  categories: readonly Category[],
  index: number,
  direction: -1 | 1,
): Category[] | null {
  return moveInList(categories, index, index + direction);
}

/**
 * O corpo do PATCH /admin/categories/reorder.
 *
 * Existe como função própria — em vez de um `.map()` solto na tela — porque o
 * erro que ela previne é silencioso: mandar só as categorias visíveis passa no
 * TypeScript, devolve 200, e zera a ordem das que estavam filtradas.
 */
export function categoryIdsForReorder(categories: readonly Category[]): string[] {
  return categories.map((category) => category.id);
}

/**
 * O corpo do PATCH /admin/products/reorder.
 *
 * MESMA REGRA DA REORDENAÇÃO DE CATEGORIA, com uma diferença que morde: a lista
 * completa exigida aqui é a **da CATEGORIA**, não a do restaurante — o
 * `sort_order` de produto só significa alguma coisa dentro dela, e o cardápio
 * público ordena por `Category.sort_order, Product.sort_order, Product.name`.
 * Mandar produtos de duas categorias numa sequência única renumeraria as duas
 * numa escala só.
 *
 * E, ao contrário da barra de categorias — que nunca é filtrada de propósito —,
 * **a lista de produtos da tela É filtrada e É paginada**. Por isso quem chama
 * só pode arrastar com a categoria inteira na mão: ver `podeReordenarProdutos`.
 * Uma lista parcial aqui devolve 400 do backend, e é o desfecho BOM — o ruim
 * seria ele aceitar e renumerar o que sobrou.
 */
export function productIdsForReorder(products: readonly Product[]): string[] {
  return products.map((product) => product.id);
}

/**
 * Dá para arrastar produto agora?
 *
 * DUAS CONDIÇÕES, E AS DUAS SÃO SOBRE A MESMA COISA: a rota exige a lista
 * COMPLETA da categoria, e a tela nem sempre a tem.
 *
 *   1. **sem busca em vigor** — a busca recorta a lista, e a ordem que se
 *      arrasta entre três resultados filtrados não descreve a categoria;
 *   2. **tudo carregado** — a listagem é paginada de 50 em 50, e uma categoria
 *      de 80 itens chega pela metade.
 *
 * A tela não esconde o controle quando isto é falso: ela DIZ o motivo. Um
 * punho de arrastar que some sem explicação é lido como defeito, e o lojista
 * fica procurando o que fez de errado.
 */
export function podeReordenarProdutos({
  search,
  loaded,
  total,
}: {
  search: string;
  loaded: number;
  total: number;
}): boolean {
  return search.trim() === '' && loaded >= total;
}

/**
 * Preço digitado pelo lojista → número para a API.
 *
 * Aceita vírgula porque é assim que se digita preço no Brasil, e recusa o
 * negativo e o vazio antes de sair da tela: o 422 do backend chegaria como
 * "erro de validação" genérico, tarde demais para ajudar.
 */
export function parsePriceInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Número da API → texto do campo, no formato que o lojista digita. */
export function formatPriceInput(price: number | string | null | undefined): string {
  if (price == null) return '';
  const value = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2).replace('.', ',');
}
