/**
 * O relato de erro, sem tela e sem rede — só as regras.
 *
 * ============================================================================
 * OS TRÊS LIMITES SÃO ESCRITOS À MÃO, E ISSO NÃO CONTRARIA A REGRA DO CONTRATO
 * ============================================================================
 *
 * Nada de contrato se escreve à mão neste repositório. Estes três números não
 * são contrato: **eles não existem no `/openapi.json`.** O Pydantic os declara
 * (`description` `min_length=1, max_length=4000`, `error_log` `max_length=20000`,
 * `screen` `max_length=200`) e o gerador do OpenAPI publica os três campos como
 * `string` seco — não há de onde gerá-los. É a mesma situação de
 * `cancel-reason.ts`, e a mesma decisão: escritos aqui, num lugar só, com a
 * origem nomeada. Se um dia o contrato ganhar as restrições, é daqui que elas
 * saem.
 *
 * E CONFERI-LOS NÃO É DESCONFIANÇA DO BACKEND. É que a tela onde este código
 * roda é a tela do painel que acabou de quebrar: um 422 aqui seria um erro de
 * validação **na última porta que restava**, com o lojista já tendo digitado o
 * que aconteceu. O `error_log` é o campo em risco de verdade — a pilha de
 * componentes do React passa de 20.000 caracteres com facilidade.
 */

/** `description`: `min_length=1, max_length=4000` no Pydantic do backend. */
export const DESCRICAO_MAX = 4000;
/** `error_log`: `max_length=20000`. É o que a pilha do React estoura. */
export const LOG_MAX = 20000;
/** `screen`: `max_length=200`. */
export const TELA_MAX = 200;

const MARCA_DE_CORTE = '\n… [cortado]';

export type DescricaoCheck =
  { valid: true; descricao: string } | { valid: false; message: string | null };

/**
 * `message: null` é o campo ainda vazio: não há erro a mostrar antes de a
 * pessoa digitar a primeira letra, só o botão travado.
 *
 * UMA LETRA BASTA, e é de propósito: o backend pede `min_length=1`. Exigir uma
 * frase de quem está no meio do movimento, com a tela quebrada, é trocar um
 * relato curto ("sumiu tudo ao clicar em salvar") por relato nenhum.
 */
export function checkDescricao(raw: string): DescricaoCheck {
  const descricao = raw.trim();

  if (descricao.length === 0) return { valid: false, message: null };
  if (descricao.length > DESCRICAO_MAX) {
    return {
      valid: false,
      message: `O relato passa de ${DESCRICAO_MAX} caracteres (tem ${descricao.length}).`,
    };
  }

  return { valid: true, descricao };
}

/** O que o `catch` recebeu, em texto — seja lá o que for que alguém lançou. */
function descreveErro(error: unknown): string {
  if (error instanceof Error) {
    // `stack` já começa com "Nome: mensagem" nos navegadores que este painel
    // suporta; onde não começar, o nome e a mensagem vêm antes dele.
    const cabeca = `${error.name}: ${error.message}`;
    const pilha = typeof error.stack === 'string' ? error.stack : '';
    return pilha.startsWith(error.name) ? pilha : `${cabeca}\n${pilha}`;
  }
  if (typeof error === 'string' && error.trim() !== '') return error;
  if (error === null || error === undefined) return 'Erro sem detalhe.';

  try {
    return JSON.stringify(error);
  } catch {
    // Objeto com referência circular. Ainda assim vale mais que nada.
    return String(error);
  }
}

/**
 * O log que vai no relato.
 *
 * **O CORTE É NA CAUDA, e ele não é arbitrário.** A causa está na primeira
 * linha (o nome e a mensagem) e nos primeiros quadros da pilha; o fim é o
 * arcabouço do React, igual em todo erro do painel. Cortar a cabeça deixaria
 * 20.000 caracteres de `renderWithHooks` e nenhuma pergunta respondida.
 *
 * A marca `[cortado]` fica no texto de propósito: sem ela, quem lê o relato no
 * suporte não tem como saber se a pilha acabou ali ou se ela foi truncada — e
 * procuraria por horas uma linha que nunca chegou.
 */
export function montarLog(error: unknown, componentStack: string | null): string {
  const partes = [descreveErro(error)];
  if (componentStack && componentStack.trim() !== '') {
    partes.push(`\n--- componentes ---${componentStack}`);
  }

  const inteiro = partes.join('\n');
  if (inteiro.length <= LOG_MAX) return inteiro;
  return inteiro.slice(0, LOG_MAX - MARCA_DE_CORTE.length) + MARCA_DE_CORTE;
}

/**
 * Onde a pessoa estava.
 *
 * É o CAMINHO da URL, e não o nome bonito da seção: `/loja/impressao` é o que
 * o suporte digita para chegar no mesmo lugar, e é o que sobrevive a uma
 * renomeação da tela. A query fica de fora — ela carrega busca e filtro, que é
 * texto que o lojista digitou.
 */
export function nomeDaTela(pathname: string): string {
  return pathname.slice(0, TELA_MAX);
}
