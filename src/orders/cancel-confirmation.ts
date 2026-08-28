/**
 * O 428 DO CANCELAMENTO — a resposta que NÃO é erro.
 *
 * `PATCH /admin/orders/{id}/cancel` responde **428 `confirmation_required`**
 * quando o pedido já está em produção e o corpo não trouxe
 * `confirm_prepared_order: true`. O contrato é explícito sobre o que fazer:
 * "o painel abre o diálogo de confirmação e reenvia".
 *
 * ----------------------------------------------------------------------------
 * POR QUE ISTO É UM ARQUIVO, E NÃO UM `if` DENTRO DO HOOK
 * ----------------------------------------------------------------------------
 *
 * Porque o defeito que ele conserta é de LEITURA, e leitura errada de corpo de
 * erro não acende nada. Sem este arquivo, o 428 caía no `catch` genérico do
 * quadro e virava `messageFromUnknownError` — que, num `detail` que é OBJETO e
 * não string, não acha frase nenhuma e devolve o texto genérico. O lojista via
 * uma tarja vermelha, o pedido continuava na chapa, e não havia caminho na
 * tela para sair dali.
 *
 * ----------------------------------------------------------------------------
 * COMO SE SABE QUE É ELE, SEM LER O TEXTO DA MENSAGEM
 * ----------------------------------------------------------------------------
 *
 * Três âncoras, e nenhuma delas é a frase:
 *
 *   1. **status 428.** Os conflitos de verdade desta rota são 409 ("pedido
 *      entregue não muda mais"). O backend separou os códigos de propósito,
 *      para o painel não ter de distinguir pelo texto.
 *   2. **`detail` é OBJETO.** Nos 409 e nos 422 ele é string ou lista. Um
 *      `detail` de string num 428 não entra aqui.
 *   3. **`code === 'confirmation_required'`.** É o enum do contrato
 *      (`CancelOrderErrorCode`), e existe justamente para o painel escrever a
 *      tela a partir da LISTA de desfechos, não do status HTTP.
 *
 * Faltando qualquer uma, a função devolve `null` e o erro segue o caminho
 * normal — falhar para o lado de "isto é um erro" é o certo: o pior caso é uma
 * mensagem na tela, e não um cancelamento confirmado por engano.
 */
import { ApiError } from '../api/errors';
import type { CancelConfirmation } from '../api/types';

/** O único código que o contrato publica hoje (`CancelOrderErrorCode`). */
const CONFIRMATION_REQUIRED = 'confirmation_required';

/**
 * A confirmação que o backend está pedindo, ou `null` se a falha for outra.
 *
 * `unknown` na entrada porque quem chama está num `catch`: qualquer coisa pode
 * chegar aqui, inclusive um erro de rede sem corpo nenhum.
 */
export function confirmacaoExigida(erro: unknown): CancelConfirmation | null {
  if (!(erro instanceof ApiError) || erro.status !== 428) return null;

  const corpo = erro.body;
  if (!corpo || typeof corpo !== 'object') return null;

  const detalhe = (corpo as Record<string, unknown>).detail;
  if (!detalhe || typeof detalhe !== 'object' || Array.isArray(detalhe)) return null;

  const registro = detalhe as Record<string, unknown>;
  if (registro.code !== CONFIRMATION_REQUIRED) return null;
  if (typeof registro.message !== 'string' || typeof registro.order_status !== 'string') {
    return null;
  }

  return {
    code: CONFIRMATION_REQUIRED,
    message: registro.message,
    order_status: registro.order_status,
  };
}

/**
 * O QUE JÁ ACONTECEU COM ESTE PEDIDO — a frase do topo do diálogo.
 *
 * O backend manda uma `message` pronta ("Este pedido já está em produção…"), e
 * ela serve. Mas ele manda `order_status` JUNTO, e o contrato diz para que:
 * "é o que permite ao painel dizer 'já saiu para entrega' em vez de 'já está em
 * preparo'". As três situações são o mesmo 428 e conversas diferentes — na
 * primeira dá para avisar a cozinha, na terceira o motoboy está na rua com a
 * comida, e quem confirma precisa saber em qual das três está.
 *
 * A lista espelha `PREPARED_ORDER_STATUSES` (`order_state_machine.py`), e é a
 * única razão de ela existir aqui: são os três status que o backend considera
 * "comida já feita".
 *
 * STATUS DESCONHECIDO CAI NA FRASE DO BACKEND, e não numa inventada. Se a
 * plataforma acrescentar um quarto estado à produção, o painel prefere dizer a
 * verdade genérica a afirmar um estágio errado sobre um pedido que ele não
 * sabe ler.
 */
const PRODUCAO: Record<string, string> = {
  preparing: 'A cozinha já está preparando este pedido.',
  ready: 'Este pedido já está pronto, esperando para sair.',
  out_for_delivery: 'Este pedido já saiu para entrega — a comida está na rua.',
};

export function fraseDaProducao(confirmacao: CancelConfirmation): string {
  return PRODUCAO[confirmacao.order_status] ?? confirmacao.message;
}

/**
 * O QUE CANCELAR AGORA CUSTA — a segunda frase, e ela não muda com o status.
 *
 * "Não pode ser desfeita" diz o tamanho; isto diz o estrago, que é a mesma
 * regra do `RejectOrderDialog`. O texto fica colado no que o backend afirma
 * ("cancelar agora não devolve o custo da comida para o restaurante") e NÃO
 * promete nada sobre estorno ao cliente: o dinheiro segue o `payment_status`,
 * por caminho próprio, e prometer devolução aqui seria a tela respondendo por
 * uma regra que não é dela.
 */
export const CUSTO_DO_CANCELAMENTO =
  'A comida já feita não volta, e o custo dela fica com a loja. O pedido sai do quadro e vai ' +
  'para o histórico como cancelado.';
