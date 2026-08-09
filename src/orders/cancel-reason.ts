/**
 * O motivo do cancelamento.
 *
 * O backend exige de 3 a 300 caracteres e recusa fora disso com 422. Conferir
 * aqui não é desconfiança do backend: é para o lojista ver o limite ANTES de
 * clicar, no meio do turno, em vez de levar um erro de validação genérico
 * depois de já ter dado o pedido por cancelado na cabeça dele.
 *
 * Quem manda continua sendo o backend — se os limites divergirem, o pior que
 * acontece é a tela deixar enviar algo que volta com 422 e vira mensagem.
 */
import { CANCEL_REASON_MAX, CANCEL_REASON_MIN } from '../api/contract-pending';

export { CANCEL_REASON_MAX, CANCEL_REASON_MIN };

export type CancelReasonCheck =
  { valid: true; reason: string } | { valid: false; message: string | null };

/**
 * `message: null` é o campo ainda vazio: não há erro a mostrar antes de o
 * lojista digitar a primeira letra, só o botão travado.
 */
export function checkCancelReason(raw: string): CancelReasonCheck {
  const reason = raw.trim();

  if (reason.length === 0) return { valid: false, message: null };
  if (reason.length < CANCEL_REASON_MIN) {
    return {
      valid: false,
      message: `Escreva pelo menos ${CANCEL_REASON_MIN} caracteres.`,
    };
  }
  if (reason.length > CANCEL_REASON_MAX) {
    return {
      valid: false,
      message: `O motivo passa de ${CANCEL_REASON_MAX} caracteres (tem ${reason.length}).`,
    };
  }

  return { valid: true, reason };
}
