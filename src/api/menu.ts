/** Chamadas da tela de cardápio. */
import { apiClient, unwrap } from './client';
import type {
  Category,
  CategoryCreate,
  CategoryUpdate,
  Product,
  ProductCreate,
  ProductDetail,
  ProductImage,
  ProductListResponse,
  ProductOption,
  ProductUpdate,
} from './types';

export async function listCategories(): Promise<Category[]> {
  return unwrap(await apiClient.GET('/admin/categories'));
}

export async function createCategory(body: CategoryCreate): Promise<Category> {
  return unwrap(await apiClient.POST('/admin/categories', { body }));
}

export async function updateCategory(categoryId: string, body: CategoryUpdate): Promise<Category> {
  return unwrap(
    await apiClient.PATCH('/admin/categories/{category_id}', {
      params: { path: { category_id: categoryId } },
      body,
    }),
  );
}

/**
 * Nova ordem das categorias, da primeira para a última.
 *
 * O corpo é a LISTA COMPLETA de ids, não o par (id, posição) do que mudou: é o
 * contrato do backend, que renumera tudo a partir do que recebe. Mandar uma
 * lista parcial não reordena de menos — apaga a posição de quem ficou de fora.
 * Por isso quem chama monta a lista a partir de `categoryIdsForReorder`, que
 * parte de todas as categorias carregadas e nunca de uma lista filtrada.
 */
export async function reorderCategories(categoryIds: string[]): Promise<Category[]> {
  return unwrap(
    await apiClient.PATCH('/admin/categories/reorder', {
      body: { category_ids: categoryIds },
    }),
  );
}

export async function listProducts(params: {
  categoryId?: string;
  search?: string;
  limit: number;
  offset: number;
}): Promise<ProductListResponse> {
  return unwrap(
    await apiClient.GET('/admin/products', {
      params: {
        query: {
          ...(params.categoryId ? { category_id: params.categoryId } : {}),
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
          // `is_active` fica de fora de propósito: a tela do lojista mostra
          // também o que está desativado — desativar é o substituto de excluir,
          // e o que some da tela ninguém reativa.
          limit: params.limit,
          offset: params.offset,
        },
      },
    }),
  );
}

/** O produto com os grupos de complemento; a listagem não os traz. */
export async function fetchProductDetail(productId: string): Promise<ProductDetail> {
  return unwrap(
    await apiClient.GET('/admin/products/{product_id}', {
      params: { path: { product_id: productId } },
    }),
  );
}

export async function createProduct(body: ProductCreate): Promise<Product> {
  return unwrap(await apiClient.POST('/admin/products', { body }));
}

export async function updateProduct(productId: string, body: ProductUpdate): Promise<Product> {
  return unwrap(
    await apiClient.PATCH('/admin/products/{product_id}', {
      params: { path: { product_id: productId } },
      body,
    }),
  );
}

/**
 * Sobe a foto do produto.
 *
 * MULTIPART, e por isso o `bodySerializer` próprio: o padrão do `openapi-fetch`
 * é JSON, e serializar um `FormData` como JSON manda `{}` — o backend
 * responderia 422 reclamando de campo obrigatório com o arquivo na mão. O
 * `Content-Type` sai de propósito: quem precisa escrevê-lo é o navegador, que
 * é o único que conhece o `boundary` do corpo.
 *
 * O QUE SOBE JÁ VEM PRONTO. O backend não converte nem redimensiona (confere
 * os bytes, o tamanho, e grava como veio), então quem recorta, reduz e
 * recodifica em WebP é o painel — ver `menu/product-image.ts`.
 *
 * A FOTO ANTERIOR NÃO É APAGADA, e isso é decisão do backend, não esquecimento
 * nosso: o objeto novo nasce com sufixo aleatório e o antigo fica no bucket,
 * porque apagar na hora deixaria o cardápio sem imagem enquanto o CDN ainda
 * serve a URL velha em cache. Sobra lixo no bucket — o preço por nunca mostrar
 * imagem quebrada ao cliente.
 */
export async function uploadProductImage(
  productId: string,
  file: Blob,
  fileName: string,
): Promise<ProductImage> {
  const form = new FormData();
  form.append('file', file, fileName);

  return unwrap(
    await apiClient.POST('/admin/products/{product_id}/image', {
      params: { path: { product_id: productId } },
      body: form as unknown as { file: string },
      bodySerializer: (body: unknown) => body as FormData,
    }),
  );
}

/**
 * Liga ou desliga uma opção de complemento.
 *
 * A resposta é a OPÇÃO (`AdminOptionResponse`) — ela não diz nada sobre o
 * produto. Quem precisa saber se o produto saiu de venda por causa desta
 * mudança relê o produto depois; ver `menu/required-groups.ts`.
 */
export async function setOptionActive(optionId: string, isActive: boolean): Promise<ProductOption> {
  return unwrap(
    await apiClient.PATCH('/admin/options/{option_id}', {
      params: { path: { option_id: optionId } },
      body: { is_active: isActive },
    }),
  );
}

/**
 * Esgotado / disponível.
 *
 * Rota própria, e não um PATCH do produto inteiro: é a ação mais frequente do
 * dia ("acabou a costela") e um corpo de um campo só não tem como reenviar
 * preço velho e desfazer uma edição feita em outra aba.
 */
export async function setProductAvailability(
  productId: string,
  isAvailable: boolean,
): Promise<Product> {
  return unwrap(
    await apiClient.PATCH('/admin/products/{product_id}/availability', {
      params: { path: { product_id: productId } },
      body: { is_available: isAvailable },
    }),
  );
}
