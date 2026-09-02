/**
 * Transforma qualquer falha da API numa frase que dá para mostrar na tela.
 *
 * O backend responde erro de QUATRO formas diferentes:
 *   - HTTPException      -> { "detail": "texto" }
 *   - erro de validação  -> { "detail": [{ "loc": [...], "msg": "texto" }] }
 *   - detail TIPADO      -> { "detail": { "code": ..., "message": "texto" } }
 *   - erro de pagamento  -> { "error": { "message": "texto" } }
 * e ainda existe o caso de não ter resposta nenhuma (internet caiu).
 *
 * A TERCEIRA FORMA FALTAVA AQUI, e o preço dela foi alto: o 428 do
 * cancelamento de pedido em produção manda `detail` como objeto, com uma
 * `message` que o backend descreve como "pronta para ser mostrada no diálogo
 * de confirmação do painel". Sem ela, o objeto caía fora dos formatos
 * conhecidos e o lojista lia "A requisição falhou (428)" — um número HTTP no
 * lugar da frase em português que já vinha pronta. Ver
 * `orders/cancel-confirmation.ts`.
 *
 * Sem isso a tela mostraria "[object Object]", que é o que acontece quando se
 * joga o corpo do erro direto num elemento. As mensagens de 409 da máquina de
 * estados já vêm prontas e em português do backend — por isso elas passam
 * direto, sem tradução.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Erro de rede: o fetch nem chegou a receber resposta. status = 0. */
export function networkError(): ApiError {
  return new ApiError(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
}

type ValidationItem = { msg?: unknown; loc?: unknown };

function isValidationList(value: unknown): value is ValidationItem[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null);
}

/** Lê a mensagem que o backend mandou, seja qual for o formato. */
export function readDetailMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;

  if (typeof record.detail === 'string' && record.detail.trim() !== '') {
    return record.detail;
  }

  if (isValidationList(record.detail)) {
    const messages = record.detail
      .map((item) => (typeof item.msg === 'string' ? item.msg : null))
      .filter((msg): msg is string => msg !== null);
    if (messages.length > 0) return messages.join('; ');
  }

  /*
   * `detail` COMO OBJETO — o envelope tipado do FastAPI.
   *
   * Depois da lista de validação de propósito: aquela também é um objeto para o
   * `typeof`, e é o `Array.isArray` aqui que impede um `detail` de validação
   * mal formado (sem `msg` em item nenhum) de cair neste ramo e sair sem
   * mensagem.
   */
  const detail = record.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const message = (detail as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }

  const nested = record.error;
  if (nested && typeof nested === 'object') {
    const message = (nested as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }

  return null;
}

/** Frase genérica quando o backend não explicou nada. */
function fallbackMessageFor(status: number): string {
  if (status === 401) return 'Sessão expirada. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para isso.';
  if (status === 404) return 'Não encontrado.';
  if (status === 409) return 'Esta ação não é permitida agora.';
  if (status === 429) return 'Muitas requisições seguidas. Espere alguns segundos.';
  if (status >= 500) return `O servidor falhou (${status}). Tente de novo em instantes.`;
  return `A requisição falhou (${status}).`;
}

export function buildApiError(status: number, body: unknown): ApiError {
  return new ApiError(status, readDetailMessage(body) ?? fallbackMessageFor(status), body);
}

/** O que mostrar para o usuário, venha o erro de onde vier. */
export function messageFromUnknownError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Erro inesperado.';
}
