import type { OrderListItem } from '../api/types';
import type { Stage } from '../ds/status';
import { elapsedMinutes } from './format';
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
 * ============================================================================
 * O PEDIDO ONLINE CUJO DINHEIRO NUNCA CHEGOU
 * ============================================================================
 *
 * Pix gerado e não pago fica `pending` PARA SEMPRE. Não existe rotina no
 * backend que expire pedido pendente — é uma decisão em aberto, de propósito —
 * e o gateway só avisa quando avisa: `PAYMENT_STATUSES` do backend documenta
 * que Pix expirado vira `failed`, mas o que se vê na prática é a linha parada
 * em `pending` dias depois.
 *
 * O EFEITO NO QUADRO: eles entulham "Novos", que é a faixa que existe para
 * dizer "isto precisa de decisão AGORA". Um pedido de seis dias no topo dessa
 * faixa não precisa de decisão nenhuma — e faz o lojista reler a mesma linha
 * morta toda vez que abre a tela.
 *
 * O BLOCO É SOBRE ABANDONO, E NÃO SOBRE ESPERA. É a distinção que decide quem
 * desce: pix não pago é abandono — não há ninguém trabalhando naquilo —, e
 * cartão em análise antifraude (`in_review`) é o gateway trabalhando, com
 * veredito a caminho. A segunda espera FICA em "Novos" por mais que demore. Ver
 * `PAGAMENTOS_QUE_PODEM_PARAR`, que é onde essa lista mora e onde está escrito
 * por que ela é uma lista de quem entra.
 *
 * ELES NÃO SAEM DO QUADRO, E ISSO É A DECISÃO. Descem para um bloco próprio no
 * pé de "Novos", com rótulo próprio, na mesma faixa e na mesma matiz. Três
 * razões, e a primeira basta:
 *
 *   1. VOLTA SOZINHO. Se o cliente pagar no minuto 45, o SSE traz
 *      `order.updated`, `payment_status` vira `paid`, e `groupIntoLanes`
 *      recoloca a linha no topo de "Novos" no mesmo instante. Esconder exigiria
 *      uma regra de "desesconder", que é a parte que sempre erra.
 *   2. SUMIR É UMA DECISÃO QUE O BACKEND NÃO TOMOU. Pedido fora do quadro é
 *      pedido que ninguém olha de novo — a tela estaria cancelando por omissão.
 *   3. ESCONDER PEDE UM "ONDE FOI PARAR", que é um filtro novo na barra.
 *
 * NADA AQUI TOCA O PEDIDO. Não há chamada, não há status novo, não há
 * cancelamento: é uma partição da lista que já estava na tela.
 *
 * O CONTADOR DE "NOVOS" CONTINUA SOMANDO OS DOIS BLOCOS, e isso é limitação de
 * contrato, não escolha: `GET /admin/orders/status-counts` conta por `status`,
 * nunca por `payment_status`. Contar da lista carregada seria contar de uma
 * fatia de 100 já filtrada — um badge que às vezes bate e às vezes não é pior
 * que um badge grosso.
 */

/**
 * Quanto tempo um pagamento online pode ficar sem entrar antes de a linha
 * descer para o bloco.
 *
 * TRINTA MINUTOS É A ORDEM DE GRANDEZA DO TTL PADRÃO DE UM QR PIX, e é o número
 * menos defendido desta rodada: **falta confirmar contra o TTL real do QR do
 * Mercado Pago**. Quando esse número for conhecido, ele entra aqui — é o único
 * lugar do painel que decide isso, e `groupIntoLanes` aceita um valor
 * diferente por parâmetro para o dia em que ele vier de configuração.
 */
export const MINUTOS_ATE_PAGAMENTO_PARADO = 30;

/** O bloco dos parados. Fora de `LANES` de propósito — ver `BOARD_BLOCKS`. */
export const PAGAMENTO_PARADO_LANE: Lane = {
  key: 'pagamento-parado',
  title: 'Não pagos',
  statuses: ['pending'],
  /* A MESMA MATIZ DE "NOVOS". Eles não são outro estágio do pedido: são o mesmo
     estágio esperando uma coisa que talvez não venha. Quem já acusa o problema
     na linha é o fio vermelho que `ds-row--alerta` acende, e ele não depende
     deste bloco existir. */
  stage: 'pendente',
};

/**
 * A ORDEM EM QUE O QUADRO DESENHA OS BLOCOS — e por que ela não é `LANES`.
 *
 * `LANES` continua sendo a lista de FAIXAS: é ela que diz quais status cada
 * faixa cobre, e é dela que saem os contadores do topo. Acrescentar o bloco dos
 * parados ali faria `countFor` somar `pending` duas vezes e o badge de "Novos"
 * dobrar.
 *
 * Esta é a lista de DESENHO, e ela existe só para o bloco nascer logo abaixo
 * de "Novos" — que é o que faz ele ser lido como o pé daquela faixa, e não como
 * uma quarta faixa do turno.
 */
export const BOARD_BLOCKS: readonly Lane[] = LANES.flatMap((lane) =>
  lane.key === 'novos' ? [lane, PAGAMENTO_PARADO_LANE] : [lane],
);

/**
 * OS ÚNICOS ESTADOS DE PAGAMENTO QUE PODEM DESCER PARA O BLOCO.
 *
 * É uma lista de QUEM ENTRA, e não uma regra de quem fica de fora, e a inversão
 * é o conserto de um defeito real. Antes a condição era
 * `isAwaitingOnlinePayment(...)` — "tudo que não é `paid` nem `on_delivery`" —,
 * e foi assim que `in_review` desceu para cá SOZINHO no dia em que o cartão
 * subiu: ninguém escreveu uma linha a respeito, e um estado novo do backend
 * herdou um bloco que não é dele.
 *
 * Com a lista invertida, o próximo estado que o backend inventar fica em
 * "Novos" até alguém decidir o contrário — que é o lado certo para errar, já
 * que "Novos" é a faixa que o lojista olha.
 *
 * `in_review` NÃO ESTÁ AQUI, E É O CASO QUE ENSINOU A REGRA. O bloco existe
 * para tirar da vista o que NÃO VAI ACONTECER; a análise antifraude ainda pode
 * virar pedido. Pix não pago é abandono — não há ninguém trabalhando naquilo —,
 * cartão em análise é o gateway trabalhando, e o veredito chega por webhook sem
 * o cliente fazer nada. **O tempo não muda a natureza do estado:** a análise
 * pode levar 48 horas úteis e continua não sendo abandono, então não há limite
 * de minutos que a faça descer. Ela fica em "Novos", com o rótulo dela ("Em
 * análise antifraude", ver `PAYMENT_STATUS_LABELS`).
 *
 * ISSO SEPARA DUAS PERGUNTAS QUE ANDAVAM JUNTAS POR ACIDENTE. "A cozinha pode
 * preparar?" continua sendo `isAwaitingOnlinePayment`, e ela responde NÃO para
 * `in_review` — o alerta da linha diz isso. "Isto ainda vai acontecer?" é esta
 * lista. Eram a mesma função porque, enquanto só existia pix, as duas respostas
 * coincidiam.
 *
 * Os três que entram:
 *
 *   `pending`   pix gerado e não pago — o caso que criou o bloco, e o único que
 *               precisa do relógio para se decidir.
 *   `failed`    tentativa que já terminou.
 *   `refunded`  o dinheiro entrou e voltou (estorno ou contestação) num pedido
 *               que o lojista nunca chegou a aceitar. Não vai acontecer.
 */
const PAGAMENTOS_QUE_PODEM_PARAR: readonly string[] = ['pending', 'failed', 'refunded'];

/**
 * Este pedido está esperando um dinheiro que provavelmente não vem?
 *
 * `failed` e `refunded` caem no bloco NA HORA, sem esperar os trinta minutos:
 * nenhum dos dois é "ainda pode pagar". Cartão recusado é uma tentativa que já
 * terminou, e o cliente pode tentar de novo no mesmo pedido — quando tentar,
 * `payment_status` volta para `pending` e a linha sobe com o relógio zerado do
 * lado certo. Dinheiro estornado não volta sozinho de jeito nenhum.
 *
 * SEM `created_at` A LINHA FICA ONDE ESTÁ. Não dá para medir a espera de um
 * pedido sem hora, e na dúvida o pedido continua onde o lojista o vê.
 */
export function isPagamentoParado(
  order: OrderListItem,
  now: number = Date.now(),
  minutos: number = MINUTOS_ATE_PAGAMENTO_PARADO,
): boolean {
  if (!PAGAMENTOS_QUE_PODEM_PARAR.includes(order.payment_status)) return false;
  if (order.payment_status !== 'pending') return true;

  const espera = elapsedMinutes(order.created_at, now);
  return espera !== null && espera >= minutos;
}

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
export function groupIntoLanes(
  orders: OrderListItem[],
  now: number = Date.now(),
  minutos: number = MINUTOS_ATE_PAGAMENTO_PARADO,
): Record<string, OrderListItem[]> {
  const grouped: Record<string, OrderListItem[]> = {};
  BOARD_BLOCKS.forEach((lane) => {
    grouped[lane.key] = [];
  });

  orders.forEach((order) => {
    if (HISTORY_STATUSES.includes(order.status as OrderStatus)) return;
    const lane = LANES.find((candidate) =>
      candidate.statuses.includes(order.status as OrderStatus),
    );
    const key = lane?.key ?? LANES[0]!.key;

    /*
     * A DESCIDA SÓ VALE NA PRIMEIRA FAIXA. Um pedido já aceito com pagamento
     * pendente é outro problema — e um que o backend não deixa acontecer, já
     * que `checkTransition` e a rota recusam levar para a cozinha o que não
     * foi pago. Se acontecer mesmo assim, ele fica no bloco do estágio dele,
     * onde o alerta da linha continua dizendo "não preparar".
     */
    if (key === LANES[0]!.key && isPagamentoParado(order, now, minutos)) {
      grouped[PAGAMENTO_PARADO_LANE.key]?.push(order);
      return;
    }

    grouped[key]?.push(order);
  });

  return grouped;
}

/**
 * O PRIMEIRO PEDIDO QUE A TELA DESENHA — o de cima da lista, seja qual for a
 * aba.
 *
 * Ele existe porque a tela escolhe um pedido sozinha na abertura (ver
 * `OrdersPage`), e "o primeiro" não é `orders[0]`: em "Em andamento" a lista é
 * a concatenação das faixas na ordem de `LANES`, e a primeira faixa pode estar
 * vazia. `orders[0]` seria o primeiro pedido CARREGADO, que pode estar na
 * terceira faixa e não ser o primeiro que o olho encontra.
 *
 * `null` quando não há nada para escolher.
 */
export function firstVisibleOrder(orders: OrderListItem[], view: BoardView): OrderListItem | null {
  if (view === 'historico') return historyOrders(orders)[0] ?? null;

  /*
   * A VARREDURA É POR `BOARD_BLOCKS`, não por `LANES`: com todos os novos
   * parados no pagamento, `LANES` pularia o bloco inteiro e a tela abriria num
   * pedido do meio da lista — enquanto o olho encontra primeiro a linha que
   * está no alto. A promessa deste retorno é "o primeiro que o olho encontra",
   * e quem sabe a ordem do desenho é a lista de desenho.
   */
  const grouped = groupIntoLanes(orders);
  for (const lane of BOARD_BLOCKS) {
    const primeiro = grouped[lane.key]?.[0];
    if (primeiro) return primeiro;
  }
  return null;
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
