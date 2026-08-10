import type { OrderListItem } from '../api/types';
import type { Stage } from '../ds/status';
import type { OrderStatus } from './order-status';

/**
 * O QUADRO EM TRÊS FAIXAS — e por que sete colunas saíram.
 *
 * A versão anterior tinha sete colunas verticais, uma por status. Em 1440px
 * isso dava sete cabeçalhos para filas de dois cartões: muito enquadramento
 * para pouco pedido, e uma leitura ruim — o olho descia sete vezes para achar
 * o que fazer. Duas dessas colunas (Concluído e Cancelados) eram consulta, não
 * trabalho: ninguém as toca durante o turno, e elas ocupavam 28% da largura.
 *
 * AGORA SÃO TRÊS FAIXAS HORIZONTAIS, e elas não são "as sete agrupadas de
 * qualquer jeito": cada uma é uma PERGUNTA diferente do turno.
 *
 *   NOVOS       precisa de decisão AGORA — aceitar ou recusar
 *   EM PREPARO  está com a cozinha; o que muda aqui é o tempo
 *   PRONTOS     saiu da chapa; está com o balcão e com a rua
 *
 * O pedido caminha da esquerda para a direita DENTRO da faixa e de cima para
 * baixo ENTRE elas, que é a ordem em que a cozinha trabalha.
 *
 * Aceito e Preparando dividem faixa porque, do ponto de vista de quem olha o
 * quadro, são o mesmo estado: "a cozinha está com ele". Pronto e Saiu para
 * entrega dividem pela mesma razão — "não é mais problema da chapa". A
 * distinção continua existindo no cartão (a matiz do estágio e o cronômetro) e
 * no painel de detalhe, onde ela decide qual botão aparece.
 */
export type Lane = {
  key: string;
  title: string;
  statuses: readonly OrderStatus[];
  /** O estágio que dá a cor da faixa — o primeiro status dela. */
  stage: Stage;
};

export const LANES: readonly Lane[] = [
  { key: 'novos', title: 'Novos', statuses: ['pending'], stage: 'pendente' },
  {
    key: 'preparo',
    title: 'Em preparo',
    statuses: ['accepted', 'preparing'],
    stage: 'preparando',
  },
  {
    key: 'prontos',
    title: 'Prontos e na rua',
    statuses: ['ready', 'out_for_delivery'],
    stage: 'pronto',
  },
];

/**
 * O HISTÓRICO — o que saiu do quadro.
 *
 * `rejected` e `cancelled` andam juntos porque são o mesmo fim de linha para
 * quem consulta; a diferença entre "eu recusei" e "o cliente desistiu" está no
 * motivo, que o detalhe mostra.
 */
export const HISTORY_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled', 'rejected'];

export type BoardView = 'andamento' | 'historico';

/** Os status que cada aba mostra. É o que decide onde um pedido aparece. */
export function statusesForView(view: BoardView): readonly OrderStatus[] {
  return view === 'historico' ? HISTORY_STATUSES : LANES.flatMap((lane) => lane.statuses);
}

/**
 * Distribui os pedidos carregados nas três faixas, mantendo a ordem da lista.
 *
 * Pedido de status desconhecido (backend novo, painel velho) NÃO some: ele cai
 * na primeira faixa, que é a que alguém olha. Sumir seria pior — o lojista
 * ficaria sem saber que ele existe.
 */
export function groupIntoLanes(orders: OrderListItem[]): Record<string, OrderListItem[]> {
  const grouped: Record<string, OrderListItem[]> = {};
  LANES.forEach((lane) => {
    grouped[lane.key] = [];
  });

  orders.forEach((order) => {
    if (HISTORY_STATUSES.includes(order.status as OrderStatus)) return;
    const lane = LANES.find((candidate) =>
      candidate.statuses.includes(order.status as OrderStatus),
    );
    grouped[lane?.key ?? LANES[0]!.key]?.push(order);
  });

  return grouped;
}

/** Os pedidos do histórico, na ordem em que vieram. */
export function historyOrders(orders: OrderListItem[]): OrderListItem[] {
  return orders.filter((order) => HISTORY_STATUSES.includes(order.status as OrderStatus));
}

/** Soma dos contadores do backend para um conjunto de status. */
export function countFor(statuses: readonly OrderStatus[], counts: Record<string, number>): number {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}

/** O contador de uma aba: a soma de tudo o que ela mostra. */
export function countForView(view: BoardView, counts: Record<string, number>): number {
  return countFor(statusesForView(view), counts);
}
