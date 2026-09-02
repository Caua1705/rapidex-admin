/**
 * O 428 do cancelamento — o backend PEDINDO um segundo clique, não recusando.
 *
 * A PARTIR DE "INICIAR PREPARO", O PEDIDO NÃO PODIA MAIS SER CANCELADO PELO
 * PAINEL. Nem por dono, nem por gerente. O cliente ligava desistindo às 20h10,
 * a comida estava na chapa, e a única saída era o suporte. Isso valia para
 * `preparing`, `ready` e `out_for_delivery` — a maior parte da vida de um
 * pedido.
 *
 * A rota exige `confirm_prepared_order: true` a partir de `preparing`. Sem ele
 * ela responde **428**, e o contrato diz com todas as letras que isso NÃO é
 * erro: "o painel abre o diálogo de confirmação e reenvia". O painel mandava
 * `false` fixo e não tinha o diálogo, então o segundo clique nunca acontecia.
 *
 * POR QUE 428 E NÃO 409, e por que isso obriga um leitor próprio: os 409 desta
 * mesma rota são conflitos de verdade ("pedido já entregue não muda mais") e
 * saem com `detail` de TEXTO. Este sai com `detail` de OBJETO, tipado, dizendo
 * qual diálogo abrir. Distinguir os dois pelo texto da mensagem seria o painel
 * lendo prosa para decidir fluxo.
 *
 * ESTE MÓDULO NÃO DECIDE SE CANCELA. Ele só traduz a resposta do backend na
 * pergunta que a tela faz ao lojista; quem reenvia é `handleCancel`.
 */
import { ApiError } from '../api/errors';

/**
 * O desfecho de uma tentativa de cancelamento.
 *
 * Ele substitui o `boolean` de antes porque agora há TRÊS desfechos, e o do
 * meio não é nem sucesso nem falha: é o backend pedindo um segundo clique. Um
 * booleano obrigaria a tela a descobrir isso relendo o erro — e foi
 * exatamente por isso que o 428 acabou como "A requisição falhou (428)".
 */
export type CancelOutcome =
  | { kind: 'cancelado' }
  | { kind: 'precisa-confirmar'; confirmation: CancelConfirmation }
  | { kind: 'falhou' };

/** O que a tela precisa para montar a segunda pergunta. */
export type CancelConfirmation = {
  /**
   * A frase que o backend mandou pronta.
   *
   * Ela é do backend e não nossa de propósito: é ele que sabe o que o
   * cancelamento custa (o custo da comida não volta), e essa regra muda no
   * backend sem o painel ser reimplantado.
   */
  message: string;
  /** `preparing`, `ready` ou `out_for_delivery`. Vazio se o backend omitiu. */
  orderStatus: string;
};

/**
 * O código que separa "confirme e eu faço" de "não dá".
 *
 * Ele é conferido, e não presumido do 428, porque um 428 de qualquer outra
 * precondição futura não é uma coisa que o lojista resolve clicando de novo —
 * e insistir num diálogo que reenvia sempre a mesma coisa é o pior desfecho
 * possível para quem está no meio do turno.
 */
const CODIGO = 'confirmation_required';

export function readCancelConfirmation(error: unknown): CancelConfirmation | null {
  if (!(error instanceof ApiError) || error.status !== 428) return null;

  const body = error.body;
  if (!body || typeof body !== 'object') return null;

  const detail = (body as Record<string, unknown>).detail;
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;

  const record = detail as Record<string, unknown>;
  if (record.code !== CODIGO) return null;

  /*
   * `order_status` ausente NÃO invalida a confirmação: é ele que destrava o
   * cancelamento, e o campo só escolhe a palavra do título. Recusar o 428
   * inteiro por falta de um texto deixaria o pedido sem poder ser cancelado —
   * que é exatamente o defeito que este arquivo existe para desfazer.
   */
  return {
    message: typeof record.message === 'string' ? record.message : '',
    orderStatus: typeof record.order_status === 'string' ? record.order_status : '',
  };
}

/**
 * O título do diálogo, e o ÚNICO uso de `order_status`.
 *
 * A mensagem do backend é a mesma para os três estados ("já está em produção").
 * O status é o que permite dizer **"já saiu para entrega"** — e a diferença
 * muda a decisão: a comida não está só feita, ela está na rua com o entregador,
 * e cancelar agora significa alguém voltando com ela.
 */
export function tituloDaConfirmacao(orderStatus: string): string {
  switch (orderStatus) {
    case 'preparing':
      return 'A comida já está sendo feita';
    case 'ready':
      return 'A comida já está pronta';
    case 'out_for_delivery':
      return 'O pedido já saiu para entrega';
    default:
      // Status que este painel ainda não conhece: a frase genérica do backend,
      // que continua verdadeira. Inventar um estado seria pior que ser vago.
      return 'Este pedido já está em produção';
  }
}
