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

/** Ordem de exibição: `sort_order` do backend e, no empate, o nome. */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function sortProducts(products: readonly Product[]): Product[] {
  return [...products].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Troca a categoria de lugar com a vizinha.
 *
 * Devolve null quando o movimento sai da lista, para quem chama não disparar
 * uma requisição que não muda nada.
 */
export function moveCategory(
  categories: readonly Category[],
  index: number,
  direction: -1 | 1,
): Category[] | null {
  const target = index + direction;
  const moved = categories[index];
  const displaced = categories[target];
  if (!moved || !displaced) return null;

  const reordered = [...categories];
  reordered[index] = displaced;
  reordered[target] = moved;
  return reordered;
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
