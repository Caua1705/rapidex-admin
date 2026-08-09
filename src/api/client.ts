/**
 * O único ponto do painel que fala com a API.
 *
 * Usa `openapi-fetch` sobre os tipos gerados: o caminho, a query e o corpo de
 * cada chamada são conferidos pelo TypeScript contra o /openapi.json. Chamar
 * uma rota que não existe, ou esquecer um parâmetro, é erro de compilação e
 * não bug em produção.
 *
 * Duas coisas acontecem aqui e em nenhum outro lugar:
 *   1. o token da sessão entra no cabeçalho Authorization;
 *   2. um 401 em QUALQUER chamada derruba a sessão e volta para o login.
 */
import createClient from 'openapi-fetch';

import type { paths } from './generated/openapi';
import type { PendingPaths } from './contract-pending';
import { buildApiError, networkError } from './errors';
import { readSession } from '../auth/session-storage';

/**
 * O contrato gerado mais as rotas que o backend já entregou e o /openapi.json
 * ainda não descreve. `contract-pending.ts` explica quais são e como apagá-lo.
 * Quando ele sumir, este apelido volta a ser só `paths`.
 */
type ApiPaths = paths & PendingPaths;

/**
 * Sem barra no final: openapi-fetch concatena o caminho direto, e
 * "https://api.../" + "/admin/orders" viraria "//admin/orders".
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'https://api.pederapidex.com')
  .toString()
  .replace(/\/+$/, '');

// --- 401 global ---------------------------------------------------------

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** O SessionProvider se inscreve aqui para limpar a sessão e voltar ao login. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// --- cliente ------------------------------------------------------------

/**
 * Converte a exceção do fetch (internet caiu, DNS, CORS) em ApiError, para
 * que a tela tenha um só tipo de erro para tratar.
 */
async function fetchOrNetworkError(input: Request): Promise<Response> {
  try {
    return await fetch(input);
  } catch {
    throw networkError();
  }
}

export const apiClient = createClient<ApiPaths>({
  baseUrl: API_BASE_URL,
  fetch: fetchOrNetworkError,
});

apiClient.use({
  onRequest({ request }) {
    const session = readSession();
    if (session) {
      request.headers.set('Authorization', `Bearer ${session.accessToken}`);
    }
    return request;
  },

  onResponse({ request, response }) {
    // Só derruba a sessão se a requisição ia autenticada. O 401 do
    // POST /admin/auth/login é "senha errada", não "sessão expirada" — se
    // tratássemos igual, a tela de login se recarregaria a cada erro de senha.
    const wasAuthenticated = request.headers.has('Authorization');
    if (response.status === 401 && wasAuthenticated) {
      sessionExpiredListeners.forEach((listener) => listener());
    }
    return response;
  },
});

// --- resultado ----------------------------------------------------------

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Devolve o corpo em caso de sucesso e LANÇA ApiError em caso de falha.
 *
 * O openapi-fetch devolve `{ data, error }` sem lançar nada. Isso obrigaria
 * cada chamada a conferir `error` na mão, e uma conferência esquecida vira
 * tela em branco. Lançando, quem chama usa try/catch e o erro nunca passa
 * despercebido.
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.response.ok || result.data === undefined) {
    throw buildApiError(result.response.status, result.error);
  }
  return result.data;
}

/**
 * O mesmo, para rota que responde 204 sem corpo.
 *
 * `unwrap` não serve nesses casos: ele trata `data === undefined` como falha, e
 * um DELETE bem-sucedido não devolve nada — passar por ele lançaria erro em
 * cima de uma exclusão que deu certo.
 */
export function unwrapEmpty(result: ApiResult<unknown>): void {
  if (!result.response.ok) {
    throw buildApiError(result.response.status, result.error);
  }
}
