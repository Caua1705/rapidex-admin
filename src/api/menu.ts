/**
 * Chamadas da tela de cardápio.
 *
 * TODAS AS LEITURAS LEVAM `branch_id`, E ISSO NÃO É OPCIONAL AQUI.
 *
 * O cardápio deixou de ser do restaurante: cada filial tem os próprios
 * produtos, os próprios preços e as próprias categorias (revisões
 * `20260820_0026`/`0027` do backend). `GET /admin/categories` e
 * `GET /admin/products` ACEITAM a filial em query e, sem ela, devolvem o que o
 * token alcança — que num restaurante de duas lojas é o cardápio DUAS VEZES.
 *
 * Foi exatamente o que apareceu na tela: "Promoções 10 / Promoções 10",
 * "Entradas 29 / Entradas 29". Nada falhou, nada logou — a resposta era 200 e
 * estava certa para a pergunta que o painel fez. Por isso o parâmetro é
 * obrigatório na assinatura destas funções: um `branchId` esquecido volta a
 * ser erro de compilação, não uma lista dobrada na mão do lojista.
 */
import { apiClient, unwrap } from './client';
import type {
  Category,
  CategoryCreate,
  CategoryUpdate,
  OptionCreateBody,
  OptionEditBody,
  OptionGroupCreateBody,
  OptionGroupUpdateBody,
  Product,
  ProductCreate,
  ProductDetail,
  ProductImage,
  ProductListResponse,
  ProductOption,
  ProductOptionGroup,
  ProductUpdate,
} from './types';

export async function listCategories(branchId: string): Promise<Category[]> {
  return unwrap(
    await apiClient.GET('/admin/categories', { params: { query: { branch_id: branchId } } }),
  );
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
 *
 * A LISTA COMPLETA PASSOU A SER A DA FILIAL, e `branch_id` é obrigatório no
 * corpo (422 sem ele). As duas coisas andam juntas: a lista completa de uma
 * loja é parcial para a outra, e sem o recorte o backend não teria como saber
 * qual das duas leituras o painel quis.
 */
export async function reorderCategories(
  branchId: string,
  categoryIds: string[],
): Promise<Category[]> {
  return unwrap(
    await apiClient.PATCH('/admin/categories/reorder', {
      body: { branch_id: branchId, category_ids: categoryIds },
    }),
  );
}

/**
 * Nova ordem dos produtos DE UMA CATEGORIA, do primeiro para o último.
 *
 * A LISTA COMPLETA EXIGIDA É A DA CATEGORIA, e não a da filial: `sort_order` de
 * produto só significa alguma coisa dentro dela — o cardápio público ordena por
 * `Category.sort_order, Product.sort_order, Product.name`. Faltando algum id, o
 * backend responde 400, e esse é o desfecho BOM: o ruim seria ele aceitar a
 * lista curta e renumerar só o que veio, deixando o resto da categoria com a
 * ordem embaralhada e nada acendendo.
 *
 * `category_id` VAI NO CORPO e a reordenação de categoria não tem equivalente
 * porque lá o conjunto que compartilha a numeração é a filial inteira; aqui é a
 * categoria. Ver `ProductReorderRequest` no contrato.
 *
 * Quem monta a lista usa `productIdsForReorder`, e quem decide SE dá para
 * arrastar usa `podeReordenarProdutos` — os dois em `menu/menu-model.ts`. A
 * segunda existe porque a lista desta tela é filtrada pela busca e paginada de
 * 50 em 50: nas duas situações ela é parcial, e parcial aqui é 400.
 */
export async function reorderProducts(
  categoryId: string,
  productIds: string[],
): Promise<Product[]> {
  return unwrap(
    await apiClient.PATCH('/admin/products/reorder', {
      body: { category_id: categoryId, product_ids: productIds },
    }),
  );
}

export async function listProducts(params: {
  branchId: string;
  categoryId?: string;
  search?: string;
  limit: number;
  offset: number;
}): Promise<ProductListResponse> {
  return unwrap(
    await apiClient.GET('/admin/products', {
      params: {
        query: {
          branch_id: params.branchId,
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

/**
 * Cria o item.
 *
 * SEM `branch_id`, e não é esquecimento: a filial vem da categoria. `category_id`
 * já determina a loja, e mandar os dois abriria um corpo em que eles podem
 * discordar — cujo único desfecho seria um 400 que não precisa existir.
 */
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
 * ============================================================================
 * TRÊS ESCRITORES SOBRE `PATCH /admin/options/{option_id}`, e é de propósito
 * ============================================================================
 *
 * A rota aceita os cinco campos e é PARCIAL DE VERDADE: `update_option` faz
 * `payload.model_dump(exclude_unset=True)` e `AdminOptionUpdate` não tem
 * `@model_validator` — o que não vier não é tocado, e nada é validado contra o
 * que está gravado. É o oposto do vizinho `PATCH /admin/option-groups/{id}`,
 * que valida a MESCLA e por isso exige o formulário inteiro (`rapidex-api`
 * §4.9). As duas rotas são irmãs e a regra delas é contrária.
 *
 * Um único `updateOption(id, corpoParcial)` deixaria cada chamador escolher o
 * que mandar — e o dia em que um deles montasse o corpo a partir de um rascunho
 * completo, o interruptor de "ativa" e a posição da lista viriam de carona.
 * Três funções estreitas fazem o corpo ser o que o CONTROLE decide:
 *
 *   - o formulário  → `updateOption`        (nome, descrição, preço)
 *   - o interruptor → `setOptionActive`     (só `is_active`)
 *   - as setas      → `setOptionSortOrder`  (só `sort_order`)
 *
 * Todas respondem a OPÇÃO (`AdminOptionResponse`), que não diz nada sobre o
 * produto: quem precisa saber se o item saiu de venda relê o produto depois
 * (ver `menu/required-groups.ts`).
 */

/** Nome, descrição e preço — o que o formulário em linha mostra, e só isso. */
export async function updateOption(optionId: string, body: OptionEditBody): Promise<ProductOption> {
  return unwrap(
    await apiClient.PATCH('/admin/options/{option_id}', {
      params: { path: { option_id: optionId } },
      body,
    }),
  );
}

/** Liga ou desliga uma opção de complemento. */
export async function setOptionActive(optionId: string, isActive: boolean): Promise<ProductOption> {
  return unwrap(
    await apiClient.PATCH('/admin/options/{option_id}', {
      params: { path: { option_id: optionId } },
      body: { is_active: isActive },
    }),
  );
}

/**
 * A posição da opção dentro do grupo.
 *
 * UMA REQUISIÇÃO POR OPÇÃO QUE MUDOU DE LUGAR — não há rota de lote. As
 * categorias e os produtos têm `PATCH .../reorder`, que recebem a lista
 * completa de ids; as opções não têm nada equivalente. Quem decide o que
 * precisa ser escrito é `ordemDasOpcoes`, para não gastar requisição
 * reescrevendo a posição de quem não se moveu.
 */
export async function setOptionSortOrder(
  optionId: string,
  sortOrder: number,
): Promise<ProductOption> {
  return unwrap(
    await apiClient.PATCH('/admin/options/{option_id}', {
      params: { path: { option_id: optionId } },
      body: { sort_order: sortOrder },
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

// --- grupos de complemento ------------------------------------------------

/**
 * ============================================================================
 * AS QUATRO ROTAS QUE ESTAVAM PARADAS
 * ============================================================================
 *
 * O painel LIA os grupos (eles vêm dentro de `GET /admin/products/{id}`) e só
 * sabia ligar e desligar uma opção que já existia. Criar grupo, editar as
 * regras dele e criar opção estavam prontas no backend e nunca tinham sido
 * chamadas — e sem elas montar "Escolha o tamanho" e "Adicionais" era um
 * chamado para o suporte, num cardápio que muda toda semana.
 *
 * LER É `PESSOAS`, ESCREVER É `GERÊNCIA` (ver `papeis.ts`). O atendente abre o
 * item e vê os grupos; quem os monta é a gerência.
 */

/**
 * Os grupos de um produto, pela rota própria.
 *
 * Ela existe além do que já vem no detalhe do produto, e é a que se usa DEPOIS
 * de gravar: a resposta de `POST`/`PATCH` é o grupo, não o produto, e reler o
 * produto inteiro para pegar a lista nova traria junto preço, foto e setor —
 * campos que outra aba pode ter mudado no meio.
 */
export async function listProductOptionGroups(productId: string): Promise<ProductOptionGroup[]> {
  return unwrap(
    await apiClient.GET('/admin/products/{product_id}/option-groups', {
      params: { path: { product_id: productId } },
    }),
  );
}

export async function createOptionGroup(
  productId: string,
  body: OptionGroupCreateBody,
): Promise<ProductOptionGroup> {
  return unwrap(
    await apiClient.POST('/admin/products/{product_id}/option-groups', {
      params: { path: { product_id: productId } },
      body,
    }),
  );
}

/**
 * Edita as regras do grupo.
 *
 * O CORPO LEVA O FORMULÁRIO INTEIRO, e o porquê está em
 * `menu/option-groups.ts`: o backend valida o RESULTADO DA MESCLA com o que
 * está no banco, então um corpo parcial pode ser recusado por causa de um campo
 * que a tela nem mostrou.
 */
export async function updateOptionGroup(
  groupId: string,
  body: OptionGroupUpdateBody,
): Promise<ProductOptionGroup> {
  return unwrap(
    await apiClient.PATCH('/admin/option-groups/{group_id}', {
      params: { path: { group_id: groupId } },
      body,
    }),
  );
}

/**
 * Cria uma opção dentro do grupo.
 *
 * A resposta é a OPÇÃO, e ela NÃO traz o grupo atualizado — quem desenha a
 * lista acrescenta a opção devolvida ao grupo que já tem em mãos, como
 * `setOptionActive` faz. Reler o produto aqui seria uma segunda chamada para
 * saber o que a primeira já respondeu.
 */
export async function createOption(
  groupId: string,
  body: OptionCreateBody,
): Promise<ProductOption> {
  return unwrap(
    await apiClient.POST('/admin/option-groups/{group_id}/options', {
      params: { path: { group_id: groupId } },
      body,
    }),
  );
}
