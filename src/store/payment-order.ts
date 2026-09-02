import type { PaymentMethod } from '../api/types';

/**
 * ============================================================================
 * A ORDEM DAS FORMAS DE PAGAMENTO — a MESMA que o cliente vê
 * ============================================================================
 *
 * O painel não é uma segunda opinião sobre a ordem: ele mostra ao lojista o que
 * o cliente vai encontrar no checkout. Quando as duas listas discordam, cada
 * uma parece certa sozinha, e ninguém tem como notar — que é o pior tipo de
 * defeito.
 *
 * A CONSULTA DO CLIENTE é `branch_repository.list_enabled_payment_methods`:
 *
 *     ORDER BY payment_flow ASC, sort_order ASC, id ASC
 *
 * e a listagem do painel (`admin_settings_repository.list_payment_methods`) usa
 * **exatamente a mesma**, de propósito — a única diferença entre elas é o filtro
 * `enabled`, porque o painel precisa ver a forma desligada para religá-la.
 *
 * ----------------------------------------------------------------------------
 * O QUE ESTAVA ERRADO, E POR QUE ELE ACERTAVA QUASE NUNCA
 * ----------------------------------------------------------------------------
 *
 * O painel desempatava por `label`, alfabético — e o comentário dele dizia, com
 * todas as letras, ser "a ordem em que o cliente as vê".
 *
 * Só que **toda forma nasce com `sort_order: 0`**: é assim que
 * `PaymentMethodsTab` as cria, e não há como reordená-las na tela. Ou seja,
 * TODAS empatam, e o desempate decidia a lista inteira. O lojista via
 * "Dinheiro, Pix" e o cliente via a ordem em que elas foram cadastradas.
 *
 * ----------------------------------------------------------------------------
 * POR QUE ORDENAR AQUI EM VEZ DE CONFIAR NA RESPOSTA
 * ----------------------------------------------------------------------------
 *
 * A resposta JÁ CHEGA nessa ordem, e não reordenar seria o mais simples. Mas o
 * painel altera a lista em memória depois de criar e de editar — sem uma regra
 * explícita, a linha nova cairia no fim e a ordem da tela passaria a depender
 * de quantas coisas o lojista mexeu desde que abriu.
 *
 * Escrita aqui, ela é a MESMA regra em todos os três momentos, e o teste a
 * prende contra o `ORDER BY` de lá.
 */
export function ordemDoCliente(methods: readonly PaymentMethod[]): PaymentMethod[] {
  return [...methods].sort((a, b) => {
    if (a.payment_flow !== b.payment_flow) return a.payment_flow < b.payment_flow ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;

    /*
     * `id ASC`, e não o rótulo. O id é UUID: o Postgres o ordena pelos 16
     * bytes, e a forma canônica em minúsculas compara igual como texto — então
     * `localeCompare` aqui reproduz o `ORDER BY id` de lá.
     *
     * É um critério arbitrário, e é de propósito: o que importa não é ele ser
     * bonito, é ser O MESMO dos dois lados.
     */
    return a.id.localeCompare(b.id);
  });
}
