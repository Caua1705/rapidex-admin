/**
 * ============================================================================
 * OS BOTÕES DO RODAPÉ DO DETALHE — UM AVANÇO E UMA SAÍDA, POR ESTÁGIO
 * ============================================================================
 *
 * O DIAGNÓSTICO. O rodapé desenhava um botão para CADA destino que a máquina
 * de estados aceitava, todos com o mesmo peso. Num pedido pendente isso dava
 * três: "Aceito" em brasa, "Recusado" em vermelho e "Cancelado" em vermelho —
 * dois destrutivos lado a lado levando ao mesmo fim, e nada dizendo qual era o
 * caminho normal do turno. Quem está no balcão às 12h30 não escolhe entre três
 * caminhos: ele empurra o pedido adiante, ou tira o pedido da frente.
 *
 * A REGRA, ENTÃO, É DE DUAS COLUNAS:
 *
 *   O AVANÇO  — o próximo passo do pedido. É UM, é o primário, e é o único
 *               laranja do painel. Nunca há dois: quando a máquina de estados
 *               oferece dois caminhos para frente (de "Pronto", um pedido de
 *               entrega pode ir para a rua ou ser concluído na hora), quem
 *               decide é a MODALIDADE, não o lojista — entrega vai para a rua,
 *               retirada conclui.
 *
 *   A SAÍDA   — o jeito de tirar o pedido da frente. Também é UMA, e o nome
 *               dela muda com o estágio, porque a coisa que ela faz muda:
 *               antes de aceitar a pessoa RECUSA (a cozinha não gastou nada),
 *               depois de aceitar ela CANCELA (há trabalho jogado fora, e o
 *               motivo passa a ser obrigatório).
 *
 * POR QUE "CANCELAR" NÃO APARECE EM PENDENTE. As duas rotas existem no
 * backend, mas na tela elas eram duas maneiras de dizer "não vai sair" no mesmo
 * pedido, uma ao lado da outra. Recusar é a palavra do estágio, e a partir daqui
 * ela também pede confirmação e também grava o motivo (`note` do
 * `PATCH /status`) — o que se perde de cancelar ali é a rota, não o registro.
 *
 * OS RÓTULOS SÃO VERBOS. Eles eram o NOME DO ESTADO DE DESTINO ("Aceito",
 * "Recusado", "Pronto"), que é o mesmo texto que o chip do cabeçalho usa para
 * dizer onde o pedido JÁ ESTÁ. Um botão escrito "Aceito", ainda por cima
 * travado enquanto o Pix não confirma, lê como "já foi aceito" — que é
 * exatamente o contrário do que ele faz.
 *
 * O QUE ESTE MÓDULO NÃO DECIDE: se o botão pode ser apertado AGORA. Isso é
 * `checkTransition` em `order-status.ts`, e continua sendo — aqui só se decide
 * QUAL botão existe.
 *
 * ============================================================================
 * O AVANÇO SAIU DO RODAPÉ E FOI TAMBÉM PARA A LINHA
 * ============================================================================
 *
 * Este mapa nasceu para o rodapé do detalhe. Hoje ele serve DOIS lugares, e é
 * de propósito que seja o mesmo mapa: no telefone, o avanço aparece na própria
 * linha da lista (ver `ds/OrderRow`).
 *
 * O motivo é medido. Aceitar um pedido no celular custava quatro toques —
 * tocar a linha, esperar o painel de tela cheia, apertar "Aceitar pedido",
 * apertar "Fechar detalhe" (que media 28×34) para reencontrar a lista. É o
 * caminho mais caro do painel e é a ação mais frequente do turno.
 *
 * O QUE NÃO FOI PARA A LINHA: a SAÍDA. Recusar e cancelar são irreversíveis e
 * pedem confirmação; ao lado do avanço, numa linha de 90px de altura tocada com
 * o polegar, seriam dois alvos vizinhos com consequências opostas. A saída
 * continua a um toque de distância, dentro do detalhe, que é onde se lê o
 * pedido antes de negá-lo.
 */
import { isTerminalStatus, type OrderStatus } from './order-status';

/** Uma confirmação, quando a ação não tem desfazer. */
export type ConfirmKind = 'recusar' | 'cancelar';

export type OrderAction = {
  /** Para onde o botão leva. É também o sufixo do `data-testid`. */
  target: OrderStatus;
  /** O que o botão diz — sempre um verbo, nunca o nome do estado. */
  label: string;
  /**
   * O MESMO VERBO, NO TAMANHO DA LINHA.
   *
   * O avanço deixou de morar só no rodapé do detalhe: ele aparece também na
   * LINHA da lista, no telefone (ver `ds/OrderRow`). Lá "Marcar como pronto"
   * mede mais que o nome do cliente ao lado, então o rótulo encolhe — mas
   * encolhe AQUI, no mesmo mapa, e não numa segunda tabela em outro arquivo.
   * Duas listas de rótulo para a mesma ação é como o rodapé passa a dizer uma
   * coisa e a linha outra.
   *
   * Continua sendo VERBO, pela mesma razão do `label`: "Pronto" é o nome do
   * estado e leria como "já está pronto".
   */
  short: string;
  /** O que ele diz enquanto o backend responde. */
  sending: string;
  /** `null` quando a ação vai direto: avançar o pedido tem desfazer. */
  confirm: ConfirmKind | null;
};

/** O pedido, pelo pouco que estas regras precisam saber dele. */
export type ActionSubject = { status: string; order_type: string };

function avanco(target: OrderStatus, label: string, short: string): OrderAction {
  return { target, label, short, sending: 'Enviando…', confirm: null };
}

/**
 * O PRÓXIMO PASSO DO PEDIDO — o botão primário, e o único.
 *
 * `null` em estado final e em status desconhecido: painel velho contra backend
 * novo não inventa um caminho adiante.
 */
export function advanceActionFor(order: ActionSubject): OrderAction | null {
  switch (order.status) {
    case 'pending':
      return avanco('accepted', 'Aceitar pedido', 'Aceitar');
    case 'accepted':
      return avanco('preparing', 'Iniciar preparo', 'Preparar');
    case 'preparing':
      return avanco('ready', 'Marcar como pronto', 'Marcar pronto');
    /*
     * DE "PRONTO" QUEM ESCOLHE É A MODALIDADE. A retirada não sai para
     * entrega (o backend recusa, e `checkTransition` já dizia isso), então
     * oferecer os dois deixava um botão permanentemente travado ao lado do
     * bom — e a razão dele não muda durante o turno, que é o critério para o
     * botão SUMIR em vez de ficar cinza.
     */
    case 'ready':
      return order.order_type === 'delivery'
        ? avanco('out_for_delivery', 'Enviar para entrega', 'Despachar')
        : avanco('completed', 'Concluir pedido', 'Concluir');
    case 'out_for_delivery':
      return avanco('completed', 'Concluir pedido', 'Concluir');
    default:
      return null;
  }
}

/**
 * O JEITO DE TIRAR O PEDIDO DA FRENTE — um só, e com confirmação sempre.
 *
 * Em pendente é RECUSAR, e ele é de quem opera: vai por `PATCH /status`.
 * Depois de aceito é CANCELAR, que é rota própria (`PATCH /cancel`) e é da
 * gerência — por isso `podeCancelar` some com o botão em vez de travá-lo: a
 * razão é quem a pessoa é, e ela não muda durante o turno.
 */
export function exitActionFor(order: ActionSubject, podeCancelar: boolean): OrderAction | null {
  if (isTerminalStatus(order.status)) return null;

  if (order.status === 'pending') {
    return {
      target: 'rejected',
      label: 'Recusar pedido',
      short: 'Recusar',
      sending: 'Recusando…',
      confirm: 'recusar',
    };
  }

  if (!podeCancelar) return null;

  return {
    target: 'cancelled',
    label: 'Cancelar pedido',
    short: 'Cancelar',
    sending: 'Cancelando…',
    confirm: 'cancelar',
  };
}
