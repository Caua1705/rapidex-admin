/**
 * O AMARRE DO FALSO AO CONTRATO.
 *
 * POR QUE existe: o item (e.4) da auditoria. `fake-api.ts` dizia no cabeçalho
 * que "uma mudança de contrato no backend quebra este arquivo no
 * `npm run typecheck`", e isso era só metade verdade. O que existia eram
 * apelidos escritos à mão (`type Category = Schemas['AdminCategoryResponse']`)
 * e um `json(route, status, body: unknown)` — o `unknown` aceitava qualquer
 * coisa, e nada ligava a resposta à ROTA que a devolve. Um campo renomeado no
 * backend acendia o `src/` e deixava o falso servindo o nome velho, com os 251
 * testes de e2e verdes contra uma API que não existe mais.
 *
 * A causa não era o campo errado; era não haver ligação. Este arquivo é a
 * ligação, e ela tem duas metades:
 *
 *   - **de compilação** — o corpo de cada resposta é o tipo que o contrato
 *     declara para aquele (rota, método, status). Não há `unknown` no caminho.
 *   - **de execução** — a rota e o método que o chamador NOMEIA são conferidos
 *     contra a requisição que chegou. Nomear a rota certa deixa de ser
 *     disciplina e vira condição para o teste passar.
 *
 * ----------------------------------------------------------------------------
 * A TERCEIRA METADE, DE 04/09/2026: O CORPO RECEBIDO
 * ----------------------------------------------------------------------------
 *
 * As duas acima olham a RESPOSTA. `corpoDe` passou a olhar o pedido: o corpo
 * que o painel manda é conferido contra o schema da rota, em execução, por
 * `e2e/schema.ts`. É a metade que o tipo não podia dar — `as CorpoEnviado` some
 * na compilação, e um `name` de 300 caracteres entrava inteiro.
 *
 * O que ele NÃO faz, e é preciso estar escrito: o contrato publica forma, não
 * REGRA. Índice único, `@model_validator` e o 409 que o serviço escreve à mão
 * não estão no `/openapi.json` (skill `rapidex-api` §4.8 e §4.10) — o que a
 * conferência nova alcança são os `Field(...)` que VIRAM schema (tamanho,
 * mínimo, enum, tipo, obrigatoriedade). Um falso mais frouxo que o backend nas
 * regras cruzadas continua sendo lido no serviço do backend, à mão.
 */
import type { Route } from '@playwright/test';

import { readDetailMessage } from '../src/api/errors';
import type { paths } from '../src/api/generated/openapi';
import contrato from './generated/openapi.json' with { type: 'json' };
import { problemasDoCorpo } from './schema';

/** Todo caminho que o backend publica. Um literal fora daqui não compila. */
export type Rota = keyof paths;

export type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * As respostas declaradas para (rota, método). Método que a rota não tem sai
 * como `never` — o contrato marca os ausentes com `get?: never`, e `undefined`
 * não satisfaz a forma abaixo.
 */
type Respostas<R extends Rota, M extends Metodo> =
  paths[R] extends Record<M, { responses: infer Rs }> ? Rs : never;

/**
 * O corpo JSON que o contrato declara para (rota, método, status).
 *
 * Status não declarado vira `never`, e isso é de propósito: a chamada não
 * compila e quem escreve precisa dizer, em `recusar`, que aquele status vem do
 * serviço do backend e não do contrato.
 */
export type Corpo<R extends Rota, M extends Metodo, S extends number> =
  Respostas<R, M> extends Record<S, { content: { 'application/json': infer B } }> ? B : never;

/** O corpo que o contrato declara para o request de (rota, método). */
export type CorpoEnviado<R extends Rota, M extends Metodo> =
  paths[R] extends Record<M, { requestBody: { content: { 'application/json': infer B } } }>
    ? B
    : paths[R] extends Record<M, { requestBody?: { content: { 'application/json': infer B } } }>
      ? B
      : never;

/**
 * Os parâmetros do caminho, com o NOME que o contrato lhes deu.
 * `/admin/branches/{branch_id}/settings` → `{ branch_id: string }`.
 */
export type ParametrosDaRota<R extends string> = R extends `${string}{${infer P}}${infer Resto}`
  ? Record<P, string> & ParametrosDaRota<Resto>
  : Record<never, string>;

const regexes = new Map<string, RegExp>();

function regexDaRota(rota: string): RegExp {
  const guardada = regexes.get(rota);
  if (guardada) return guardada;
  const partes = rota
    .split(/\{[^}]+\}/g)
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const criada = new RegExp(`^${partes.join('([^/]+)')}$`);
  regexes.set(rota, criada);
  return criada;
}

function nomesDosParametros(rota: string): string[] {
  return [...rota.matchAll(/\{([^}]+)\}/g)].map((achado) => achado[1] ?? '');
}

/**
 * Casa o caminho que chegou com um caminho DO CONTRATO, e devolve os
 * parâmetros pelo nome. Substitui as expressões regulares escritas à mão, que
 * eram a segunda fonte de verdade dos caminhos — a mesma família do
 * `print-sectors` que não existia e do `printing-sectors` que existia
 * (skill `rapidex-api` §5).
 */
export function casar<R extends Rota>(path: string, rota: R): ParametrosDaRota<R> | null {
  const achado = regexDaRota(rota).exec(path);
  if (!achado) return null;
  const nomes = nomesDosParametros(rota);
  const parametros: Record<string, string> = {};
  for (const [indice, nome] of nomes.entries()) {
    const valor = achado[indice + 1];
    // Um parâmetro vazio não é casamento: `/admin/products//image` não é o
    // caminho de produto nenhum.
    if (!valor) return null;
    parametros[nome] = valor;
  }
  return parametros as ParametrosDaRota<R>;
}

function conferirRequisicao(route: Route, metodo: Metodo, rota: Rota): void {
  const request = route.request();
  const recebido = request.method().toLowerCase();
  if (recebido !== metodo) {
    throw new Error(
      `O falso respondeu ${rota} como ${metodo.toUpperCase()}, e a requisição foi ${request.method()}.`,
    );
  }
  const path = new URL(request.url()).pathname;
  if (!regexDaRota(rota).test(path)) {
    throw new Error(`O falso respondeu como ${rota}, e o caminho pedido foi ${path}.`);
  }
}

function enviar(route: Route, status: number, corpo: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(corpo),
  });
}

/**
 * A resposta que o CONTRATO declara. O corpo é o tipo dele, e a rota e o método
 * nomeados são conferidos contra a requisição.
 *
 * ----------------------------------------------------------------------------
 * E O CORPO QUE CHEGOU TAMBÉM — porque ACEITAR é o que não se pode errar
 * ----------------------------------------------------------------------------
 *
 * `responder` é o falso dizendo "isto está certo". A conferência do corpo mora
 * AQUI, e não em `corpoDe`, e a diferença é a regra inteira:
 *
 *   **o falso não pode responder por esta porta a um corpo que a API recusaria.**
 *
 * Em `corpoDe` ela dispararia cedo demais — antes de o ramo ter a chance de
 * RECUSAR o corpo de propósito, que é o que vários deles fazem (o nome de
 * categoria acima de 120, o `branch_id` ausente, o `max_select` menor que o
 * mínimo). Esses ramos saem por `recusar`, que não passa por aqui: eles já
 * estão dizendo a coisa certa, com a frase do backend.
 *
 * O que sobra para esta linha é exatamente o buraco: a rota em que ninguém
 * lembrou de escrever a régua à mão, e o falso devolve 200 para o que produção
 * responderia 422. Era a deriva de REGRA que
 * `scratchpad/falso-contra-o-contrato.md` deixou escrita como aberta.
 */
export function responder<R extends Rota, M extends Metodo, S extends number>(
  route: Route,
  metodo: M,
  rota: R,
  status: S,
  corpo: Corpo<R, M, S>,
): Promise<void> {
  conferirRequisicao(route, metodo, rota);
  conferirCorpoRecebido(route, metodo, rota);
  return enviar(route, status, corpo);
}

/** O schema do corpo desta rota, quando ela recebe corpo. */
function schemaDoCorpo(rota: string, metodo: string): Record<string, unknown> | null {
  const operacoes = (
    contrato.paths as Record<
      string,
      Record<string, { requestBody?: { content?: Record<string, { schema?: unknown }> } }>
    >
  )[rota];
  const schema = operacoes?.[metodo]?.requestBody?.content?.['application/json']?.schema;
  return schema && typeof schema === 'object' ? (schema as Record<string, unknown>) : null;
}

function conferirCorpoRecebido(route: Route, metodo: Metodo, rota: Rota): void {
  const schema = schemaDoCorpo(rota, metodo);
  if (!schema) return;

  const request = route.request();
  if (!request.postData()) return;

  let corpo: unknown;
  try {
    corpo = request.postDataJSON();
  } catch {
    // Corpo que não é JSON não é assunto desta régua — `upload` de foto passa
    // por aqui como multipart, e o schema dele não é `application/json`.
    return;
  }

  const problemas = problemasDoCorpo(corpo, schema, contrato, `${metodo.toUpperCase()} ${rota}`);
  if (problemas.length === 0) return;

  throw new Error(
    'O FALSO IA RESPONDER 2xx A UM CORPO QUE A API RECUSARIA COM 422.\n' +
      `  ${problemas.join('\n  ')}\n` +
      '  Ou o painel monta o corpo errado (e o lojista levaria 422), ou este ramo\n' +
      '  do falso deveria recusar — e aí a recusa sai por `recusar`, com a frase\n' +
      '  do backend.',
  );
}

/**
 * A RECUSA que o contrato não declara.
 *
 * O FastAPI publica o 422 da validação (e os poucos 4xx com schema próprio, como
 * o 428 do cancelamento); o resto — 400, 403, 404, 409, 500 — sai de
 * `HTTPException` no serviço e não aparece no `/openapi.json`. Esses passam por
 * aqui, e a rota e o método continuam sendo conferidos.
 *
 * O corpo não é livre: ele precisa ser um dos QUATRO formatos que
 * `src/api/errors.ts` sabe ler. Um formato inventado aqui faz o teste afirmar
 * uma frase que produção nunca manda — e, pior, esconde o caso em que o lojista
 * leria o número HTTP no lugar da frase (skill `revisao`, o `detail` que é
 * objeto). Nenhum ramo do falso precisou de um corpo ilegível: se algum dia
 * precisar, ele ganha função própria em vez de afrouxar esta.
 */
export function recusar<R extends Rota, M extends Metodo>(
  route: Route,
  metodo: M,
  rota: R,
  status: number,
  corpo: unknown,
): Promise<void> {
  conferirRequisicao(route, metodo, rota);
  if (readDetailMessage(corpo) === null) {
    throw new Error(
      `A recusa ${status} de ${rota} tem um corpo que src/api/errors.ts não sabe ler: ` +
        `${JSON.stringify(corpo)}. Na tela isso vira o número HTTP no lugar da frase.`,
    );
  }
  return enviar(route, status, corpo);
}

/**
 * A recusa que a ROTA responde em qualquer método — o 404 de "este id não
 * existe", que vem antes de o ramo saber se é GET, PATCH ou DELETE. O caminho
 * continua conferido; o método é o único que fica de fora, e por isso ela tem
 * nome próprio em vez de um `metodo` mentiroso.
 */
export function recusarEmQualquerMetodo<R extends Rota>(
  route: Route,
  rota: R,
  status: number,
  corpo: unknown,
): Promise<void> {
  const path = new URL(route.request().url()).pathname;
  if (!regexDaRota(rota).test(path)) {
    throw new Error(`O falso respondeu como ${rota}, e o caminho pedido foi ${path}.`);
  }
  return enviar(route, status, corpo);
}

/**
 * A recusa que NÃO É DE ROTA NENHUMA: as três redes que o backend arma antes de
 * olhar o caminho — sessão expirada (401), senha temporária por trocar (403) e
 * o caminho que este falso não simula.
 */
export function recusarSemRota(route: Route, status: number, corpo: unknown): Promise<void> {
  return enviar(route, status, corpo);
}

/** O 204, que não tem corpo para tipar — sobra conferir rota e método. */
export function semCorpo<R extends Rota, M extends Metodo>(
  route: Route,
  metodo: M,
  rota: R,
): Promise<void> {
  conferirRequisicao(route, metodo, rota);
  return route.fulfill({ status: 204, body: '' });
}

/**
 * O corpo que CHEGOU, no tipo que o contrato declara para a rota.
 *
 * Sem isto cada ramo escrevia a forma do request à mão
 * (`as { minutes: number; reason?: string | null }`) — contrato escrito à mão,
 * que é o que a skill `rapidex-api` §2 proíbe no `src/` e o que o
 * `contract-pending.ts` já custou duas vezes.
 *
 * ELE NÃO CONFERE NADA, de propósito: quem lê um corpo pode estar prestes a
 * RECUSÁ-LO, e é o que vários ramos fazem. A conferência mora em `responder`,
 * que é a porta do "isto está certo" — ver o comentário de lá.
 */
export function corpoDe<R extends Rota, M extends Metodo>(
  route: Route,
  _metodo: M,
  _rota: R,
): CorpoEnviado<R, M> {
  return route.request().postDataJSON() as CorpoEnviado<R, M>;
}
