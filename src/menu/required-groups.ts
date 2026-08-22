/**
 * "SE EU DESATIVAR ESTA OPÇÃO, O ITEM SAI DE VENDA?"
 *
 * ESTE ARQUIVO RESPONDE UMA PERGUNTA SÓ, e ela é sobre uma mudança que ainda
 * NÃO ACONTECEU. É por isso que ele existe apesar de a regra já morar no
 * backend: não há rota para perguntar "e se", e descobrir depois de aplicar não
 * serve — o ponto do aviso é aparecer ENQUANTO dá para desistir.
 *
 * ---
 *
 * A PENDÊNCIA DE 19/08/2026 ESTAVA AQUI, E FOI FECHADA.
 *
 * O que ela dizia: `AdminProductResponse.unavailable_by_required_group` já
 * estava no contrato e a tela ainda deduzia o ESTADO ATUAL daqui, com a regra
 * escrita duas vezes — no backend e neste arquivo. Duas expressões da mesma
 * regra divergem no dia em que uma delas mudar, e quem erra é a tela do
 * lojista, em silêncio, que é exatamente o defeito que o aviso existe para
 * acusar.
 *
 * A LINHA QUE SEPARA AS DUAS COISAS, hoje:
 *
 *   - **o estado AGORA** sai do backend, por `productSaleState`
 *     (`menu-model.ts`). A listagem não tem os grupos de opção carregados, e
 *     nem poderia: seriam N requisições para desenhar uma etiqueta;
 *   - **o estado DEPOIS de uma mudança que o lojista está prestes a fazer**
 *     sai daqui, e só o diálogo do produto o usa — porque só ele tem os grupos
 *     na mão e só ele precisa NOMEAR o grupo que vai ficar vazio. Um aviso que
 *     diz "um grupo obrigatório ficou vazio" manda procurar em todos.
 *
 * GRUPO OBRIGATÓRIO EXISTE PORQUE A COZINHA NÃO PRODUZ SEM AQUELA INFORMAÇÃO.
 * Quando o lojista desativa a última opção ativa de um grupo obrigatório — e
 * ele desativa opção todo dia —, o produto deixa de ter como ser vendido: não
 * há o que escolher, e mandar para a chapa uma picanha sem ponto é pior que
 * não vender. O backend então o tira do cardápio público e recusa o pedido de
 * quem já o tinha no carrinho.
 *
 * A regra espelhada abaixo é a `blocking_required_group` de
 * `src/services/menu_rules.py`, e o arquivo de lá avisa que há mais de uma
 * expressão dela e que **todas precisam mudar juntas**.
 */
import type { ProductOptionGroup } from '../api/types';

/** As opções ativas de um grupo. */
export function activeOptions(group: ProductOptionGroup) {
  return (group.options ?? []).filter((option) => option.is_active);
}

/**
 * O grupo obrigatório que tira o item de venda, ou `null`.
 *
 * Espelha `blocking_required_group` do backend, inclusive na parte fácil de
 * errar: **grupo desativado não conta**. O lojista desligou o passo inteiro de
 * propósito, e aí não há exigência nenhuma a cumprir — tratar grupo inativo
 * como bloqueio faria a tela acusar item saudável.
 *
 * Devolve o GRUPO e não um booleano porque quem chama precisa nomeá-lo: um
 * aviso que diz "um grupo obrigatório ficou vazio" manda procurar em todos.
 */
export function blockingRequiredGroup(
  groups: readonly ProductOptionGroup[],
): ProductOptionGroup | null {
  for (const group of groups) {
    if (!group.is_active || !group.is_required) continue;
    if (activeOptions(group).length === 0) return group;
  }
  return null;
}

/**
 * O grupo que ficaria vazio SE esta opção fosse desativada agora.
 *
 * `null` quando desativar é inofensivo — que é o caso da imensa maioria dos
 * cliques, e por isso o aviso não pode aparecer sempre: um diálogo que
 * confirma tudo é um diálogo que ninguém lê.
 */
export function groupEmptiedByDeactivating(
  groups: readonly ProductOptionGroup[],
  optionId: string,
): ProductOptionGroup | null {
  const simulado = groups.map((group) => ({
    ...group,
    options: (group.options ?? []).map((option) =>
      option.id === optionId ? { ...option, is_active: false } : option,
    ),
  }));

  const jaBloqueado = blockingRequiredGroup(groups);
  const bloqueadoDepois = blockingRequiredGroup(simulado);

  // Se o item JÁ estava fora de venda pelo mesmo grupo, desativar mais uma
  // opção não muda nada — e avisar "isto vai tirar o item de venda" sobre algo
  // que já saiu é a forma mais rápida de o lojista aprender a ignorar o aviso.
  if (jaBloqueado && bloqueadoDepois && jaBloqueado.id === bloqueadoDepois.id) return null;

  return bloqueadoDepois;
}
