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
