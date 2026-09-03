/**
 * ============================================================================
 * A ATRIBUIÇÃO — pôr o pedido nas mãos de um entregador
 * ============================================================================
 *
 * A ROTA RESPONDE 200 MESMO COM ITENS RECUSADOS, e quem decide é o `ok` de CADA
 * item. Ler o 200 como sucesso é a forma mais silenciosa de o pedido de
 * retirada no meio da seleção nunca chegar a ninguém: a tela diria "5 pedidos
 * entregues ao Jorge" e quatro teriam sido gravados.
 *
 * A escrita é uma só — os `ok` são gravados juntos, e os outros não são
 * gravados. Um pedido de retirada selecionado por engano não pode derrubar os
 * outros quatro que o atendente marcou.
 *
 * ----------------------------------------------------------------------------
 * AS FRASES SÃO NOSSAS, E O CONTRATO DIZ ISSO
 * ----------------------------------------------------------------------------
 *
 * `AssignmentErrorCode` sai no `/openapi.json` como ENUM de propósito: "o
 * painel escreve a mensagem por codigo, nao pelo texto". A glosa que a
 * descrição da rota traz é explicação para quem lê o contrato — não é texto de
 * tela, e casá-la seria um acordo que se desfaz em silêncio.
 */
import { isTerminalStatus } from '../orders/order-status';
import type { AssignmentResultItem, OrderCourier, OrderListItem, Courier } from '../api/types';

/** O que a frase de `other_branch` precisa saber para não ficar sem sentido. */
export type AlvoDaRecusa = {
  entregador: string;
  filialDoEntregador: string;
};

/**
 * Este pedido pode receber um entregador?
 *
 * DUAS DAS QUATRO RECUSAS A TELA JÁ SABE PREVER — `not_delivery` e
 * `order_closed` estão no tipo e no status da própria linha. Oferecer o botão
 * para depois explicar por que ele não funcionou é pior que não oferecê-lo: o
 * lojista clica, lê, e aprende que o painel promete o que não cumpre.
 *
 * As outras duas dependem de escopo e de filial, e a tela não tem como prevê-las
 * em todo caso. É para elas que `fraseDaRecusa` existe.
 */
export function podeReceberEntregador(order: { order_type: string; status: string }): boolean {
  return order.order_type === 'delivery' && !isTerminalStatus(order.status);
}

/**
 * Quem está com o pedido.
 *
 * TRÊS ESTADOS, E OS TRÊS SÃO DIFERENTES:
 *
 *   `undefined`  a leitura ainda não voltou — a tela não afirma nada;
 *   `null`       ninguém pegou, e isso é 200 com os dois campos nulos. Estado
 *                NORMAL do pedido, não erro;
 *   o entregador quem está com ele agora.
 *
 * O 404 da rota é outra coisa — o pedido que este lojista não alcança —, e
 * confundi-lo com "ninguém ainda" faria a tela mostrar "não encontrado" no
 * pedido que está aberto na frente dela.
 */
export function quemEstaCom(resposta: OrderCourier | undefined): Courier | null | undefined {
  if (!resposta) return undefined;
  return resposta.courier ?? null;
}

export type ItemRecusado = {
  orderId: string;
  /** O código cru do contrato. A frase sai de `fraseDaRecusa`. */
  motivo: string;
};

export type ResumoDoLote = {
  gravados: number;
  recusados: readonly ItemRecusado[];
  /** Só quando NADA foi recusado. 200 com recusa não é sucesso. */
  tudoCerto: boolean;
};

/** O que a tela precisa contar depois de um lote. Ver o cabeçalho. */
export function resumoDoLote(itens: readonly AssignmentResultItem[]): ResumoDoLote {
  const recusados = itens
    .filter((item) => !item.ok)
    .map((item) => ({ orderId: item.order_id, motivo: item.error ?? 'desconhecido' }));

  return {
    gravados: itens.length - recusados.length,
    recusados,
    tudoCerto: recusados.length === 0,
  };
}

/**
 * A frase de cada motivo.
 *
 * `not_found` NÃO DISTINGUE inexistente, de outro restaurante e de filial
 * invisível: o backend uniu os três "para nao virar oraculo de UUID", e a tela
 * não pode desfazer isso — separá-los seria afirmar o que ninguém lhe contou, e
 * transformaria o painel num confirmador de ids alheios.
 *
 * O `default` NÃO É DEFENSIVO POR HÁBITO: o backend pode ganhar um quinto
 * motivo antes de este painel saber dele, e uma linha sem frase é uma linha
 * recusada em branco — o pior desfecho para uma lista cuja razão de existir é
 * dizer o que não entrou.
 */
export function fraseDaRecusa(motivo: string, alvo: AlvoDaRecusa): string {
  switch (motivo) {
    case 'not_found':
      return 'Este pedido não está na sua lista.';
    case 'not_delivery':
      return 'Retirada não tem entregador.';
    case 'order_closed':
      return 'Este pedido já terminou.';
    case 'other_branch':
      return `${alvo.entregador} é da ${alvo.filialDoEntregador}, e este pedido é de outra.`;
    default:
      return 'O backend recusou este pedido, sem dizer o motivo em palavras que o painel conheça.';
  }
}

/**
 * A linha do quadro, depois de uma atribuição — aplicada LOCALMENTE.
 *
 * O STREAM NÃO EMITE EVENTO NA ATRIBUIÇÃO: `AdminOrderStreamService` varre
 * pedidos criados e histórico de STATUS, e atribuir grava em
 * `courier_assignments` sem tocar em nenhum dos dois. `AdminOrderListItem` já
 * traz `courier_id`/`courier_name`, e o evento os carrega — mas só quando o
 * evento existe, isto é, na próxima mudança de status.
 *
 * Então quem atualiza a linha é a RESPOSTA do POST, aqui. A limitação conhecida
 * é o segundo atendente: o quadro DELE continua velho até o pedido andar. Está
 * anotado como pedido de backend em `scratchpad/rodada-entregador.md`.
 */
export function comEntregador(
  order: OrderListItem,
  courier: { id: string; name: string } | null,
): OrderListItem {
  return {
    ...order,
    courier_id: courier?.id ?? null,
    courier_name: courier?.name ?? null,
  };
}
