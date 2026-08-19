/**
 * "Este item ainda tem como ser vendido?"
 *
 * GRUPO OBRIGATÓRIO EXISTE PORQUE A COZINHA NÃO PRODUZ SEM AQUELA INFORMAÇÃO.
 * Quando o lojista desativa a última opção ativa de um grupo obrigatório — e
 * ele desativa opção todo dia —, o produto deixa de ter como ser vendido: não
 * há o que escolher, e mandar para a chapa uma picanha sem ponto é pior que
 * não vender. O backend então o tira do cardápio público e recusa o pedido de
 * quem já o tinha no carrinho.
 *
 * O PROBLEMA QUE ISTO RESOLVE É O SILÊNCIO. `is_active` continua ligado,
 * `is_available` continua ligado, e o item simplesmente para de aparecer para
 * o cliente. Sem aviso, o lojista perde a venda sem saber que perdeu.
 *
 * ---
 *
 * POR QUE A REGRA ESTÁ ESCRITA AQUI TAMBÉM
 *
 * Ela já existe no backend, em `src/services/menu_rules.py`
 * (`blocking_required_group`), e o próprio arquivo de lá avisa que há mais de
 * uma expressão dela e que **todas precisam mudar juntas**. Duplicar regra é
 * ruim; o que justifica esta cópia é que ela responde uma pergunta que o
 * backend não tem como responder:
 *
 *     "se eu desativar ESTA opção, o item sai de venda?"
 *
 * É uma pergunta sobre uma mudança que ainda NÃO aconteceu. Não há rota para
 * perguntá-la, e descobrir depois de aplicar não serve: o ponto do aviso é
 * aparecer ANTES, enquanto dá para desistir.
 *
 * O ESTADO DEPOIS DA MUDANÇA É OUTRA COISA e não sai daqui. Quem responde é
 * `AdminProductResponse.unavailable_by_required_group`, que o backend já
 * calcula — inclusive em SQL, para a listagem não virar uma consulta por
 * produto.
 *
 * PENDÊNCIA ABERTA (19/08/2026): esse campo JÁ ESTÁ no contrato gerado, e a
 * tela ainda não o lê — ela continua deduzindo o estado atual daqui. Enquanto
 * as duas fontes convivem, elas divergem no dia em que a regra mudar de um lado
 * só, e quem erra é a tela do lojista. O conserto é a tela adotar o campo para
 * o ESTADO; esta função fica sendo só a simulação do "e se".
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
