/**
 * Tempo de preparo da filial.
 *
 * A rota devolve 409 em duas situações que pedem reações OPOSTAS:
 *
 *   - não há faixa base gravada → a tela abre um campo e o lojista informa
 *     min/max uma vez;
 *   - a filial está fechada → a tela mostra a mensagem e para. Não existe
 *     contorno: mexer no tempo de preparo de uma loja fechada não significa
 *     nada, e insistir só geraria uma segunda chamada que falha igual.
 *
 * Confundir as duas é o defeito caro aqui: abrir o campo de base numa filial
 * fechada faria o lojista preencher min/max achando que resolveu, e receber
 * outro 409. Por isso o padrão desta função é o lado SEGURO — 409 que ela não
 * reconhece vira `other`, que só mostra a mensagem do backend.
 */
import { ApiError } from '../api/errors';

export type PrepTimeFailure =
  /** Falta a faixa base: a tela pode oferecer o campo de min/max. */
  | 'base-missing'
  /** Filial fechada: só mostrar a mensagem. */
  | 'branch-closed'
  /** Qualquer outra coisa: só mostrar a mensagem. */
  | 'other';

/**
 * Onde o backend pode ter posto um código legível por máquina.
 *
 * O contrato descreve a rota, mas só as respostas 200 e 422 — o corpo do 409
 * que interessa aqui não está tipado em lugar nenhum. Por isso a função procura
 * o código nos lugares usuais e, se não achar, cai para o texto. No dia em que
 * o 409 for descrito, isto vira uma leitura só — e os testes dizem se quebrou.
 */
function readErrorCode(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;

  const candidates: unknown[] = [record.code, record.error_code];
  if (record.detail && typeof record.detail === 'object') {
    candidates.push((record.detail as Record<string, unknown>).code);
  }
  if (record.error && typeof record.error === 'object') {
    candidates.push((record.error as Record<string, unknown>).code);
  }

  const found = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  return typeof found === 'string' ? found.toLowerCase() : '';
}

export function classifyPrepTimeFailure(error: unknown): PrepTimeFailure {
  if (!(error instanceof ApiError) || error.status !== 409) return 'other';

  const code = readErrorCode(error.body);
  if (code) {
    // "fechada" é conferido primeiro: um código como
    // `branch_closed_prep_time` não pode cair no ramo do campo de base.
    if (code.includes('closed') || code.includes('fechad')) return 'branch-closed';
    if (code.includes('prep') && /not_set|not_configured|missing|base|unset/.test(code)) {
      return 'base-missing';
    }
    return 'other';
  }

  const message = error.message.toLowerCase();
  if (/fechad|closed/.test(message)) return 'branch-closed';
  if (/base|prep_time_min|configurad|definid|cadastrad/.test(message)) return 'base-missing';
  return 'other';
}

/**
 * "25–35 min", que é como o lojista fala da faixa.
 *
 * Recebe só os dois campos, e não a linha de horário inteira que o PATCH
 * devolve: é tudo o que formatar precisa. Os dois são ANULÁVEIS no contrato —
 * filial com horário gravado e sem prazo de preparo é um estado real, e é o
 * mesmo travessão de "ainda não carregou". Nos dois casos não há faixa a
 * mostrar, e inventar "0 min" diria ao lojista que a cozinha entrega na hora.
 */
export function formatPrepRange(
  range: { prep_time_min?: number | null; prep_time_max?: number | null } | null,
): string {
  const min = range?.prep_time_min ?? null;
  const max = range?.prep_time_max ?? null;
  if (min === null || max === null) return '—';
  if (min === max) return `${min} min`;
  return `${min}–${max} min`;
}

/** Os empurrões que a barra oferece, na ordem em que aparecem. */
export const PREP_TIME_DELTAS = [5, 10, -5] as const;

/** "+5", "+10", "−5" — com o sinal de menos de verdade, não o hífen. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
