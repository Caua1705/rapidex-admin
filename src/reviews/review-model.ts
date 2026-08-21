/**
 * ============================================================================
 * A LEITURA DO AGREGADO DE AVALIAÇÕES — e o que a tela não pode contrariar
 * ============================================================================
 *
 * `GET /admin/reviews` devolve as avaliações do período E o agregado delas no
 * mesmo corpo. Duas propriedades desse agregado o backend garantiu, e as duas
 * são fáceis de destruir sem nada acender no `npm run typecheck`:
 *
 * 1. **A MÉDIA SAI DO HISTOGRAMA.** `total` e `average` são calculados a
 *    partir das mesmas cinco contagens que desenham as barras — não de um
 *    `COUNT`/`AVG` paralelo. A tela lê os três do MESMO objeto e não recalcula
 *    nenhum a partir de `items`: `items` é uma PÁGINA (50 linhas) e já pode
 *    estar recortada por nota, então uma média tirada dali daria um número
 *    diferente do que as barras somam — exatamente o defeito que o backend
 *    resolveu do lado dele.
 *
 * 2. **`max_rating` NÃO ENTRA NO AGREGADO.** Filtrar a lista para "só as notas
 *    baixas" não pode fazer a média desabar: o lojista concluiria que a semana
 *    piorou quando ele só apertou um filtro de lista. Por isso nada neste
 *    arquivo recebe o filtro de nota — as funções daqui leem `summary`, que
 *    fala sempre do período inteiro.
 *
 * O que mora aqui é leitura de contrato e aritmética de barra. As FRASES estão
 * em `review-insights.ts`, como em Desempenho.
 */
import type { ReviewProblemTag, ReviewSummary } from '../api/types';
/*
 * O PERÍODO É O MESMO DE DESEMPENHO, e por isso ele é importado em vez de
 * reescrito. `datesForPreset` já resolve "7 dias" no fuso da OPERAÇÃO
 * (America/Fortaleza) contando hoje, e `rangeProblem` já barra o par vazio e o
 * invertido. Uma segunda cópia dessa conta aqui seria uma segunda verdade
 * sobre que dia é hoje — e o backend já mantém três cópias do `_period_bounds`
 * dele, registradas como resíduo conhecido. Não vamos acrescentar a nossa.
 *
 * O que esta tela tem a mais é o TETO de 366 dias (`MAX_REVIEW_PERIOD_DAYS`),
 * que os relatórios não têm. Ele entra em `periodProblem`, embaixo.
 */
import {
  rangeProblem,
  type PerformancePreset,
  type PerformanceRange,
} from '../performance/report-model';

/** O período da tela. Mesma forma da de Desempenho — ver o import acima. */
export type ReviewPeriod = PerformanceRange;
export type ReviewPreset = PerformancePreset;

/**
 * A NOTA ATÉ ONDE EXISTE ETIQUETA DE PROBLEMA — e o recorte que a tela abre.
 *
 * O backend só aceita `problem_tag` com nota até 3 (mandá-la com 4 ou 5
 * responde 422 a quem avalia), então "notas baixas" não é uma linha que
 * alguém traçou no painel: é a mesma linha que decide se a pergunta "o que deu
 * errado?" chegou a ser feita ao cliente.
 */
export const LOW_RATING_MAX = 3;

/**
 * As cinco notas, na ordem em que se leem: a melhor em cima.
 *
 * O agregado traz as CINCO chaves sempre, inclusive as zeradas — histograma
 * com buraco obriga cada front a preencher o que falta, e cada um preenche de
 * um jeito. Esta lista existe para a ORDEM, não para tapar ausência.
 */
export const RATING_SCALE = [5, 4, 3, 2, 1] as const;

/** O teto que o backend impõe ao período (`MAX_REVIEW_PERIOD_DAYS`). */
export const MAX_PERIOD_DAYS = 366;

/**
 * O piso da barra de uma contagem MAIOR QUE ZERO.
 *
 * Mesmo motivo do piso da coluna no gráfico de Desempenho: com 40 cincos e um
 * único 1, a barra do "1 estrela" seria meio pixel — indistinguível de
 * "ninguém deu essa nota", que é outra afirmação. Zero continua zero.
 */
const PISO_DA_BARRA = 0.06;

/**
 * OS RÓTULOS DAS SEIS ETIQUETAS, e por que este `Record` é a proteção.
 *
 * `ReviewProblemTag` é derivado do contrato gerado (ver `api/types.ts`), então
 * no dia em que o backend acrescentar uma sétima etiqueta a
 * `REVIEW_PROBLEM_TAGS` este objeto para de compilar por chave faltando. Uma
 * união escrita à mão continuaria compilando e a etiqueta nova chegaria à tela
 * sem rótulo.
 *
 * Os textos são do PAINEL, não da API: o contrato manda o código
 * (`veio_errado`), e rótulo em português vindo do backend transformaria
 * mudança de texto de tela em deploy de backend — a mesma regra da
 * classificação de Clientes.
 */
export const PROBLEM_TAG_LABEL: Record<ReviewProblemTag, string> = {
  atrasou: 'Atrasou',
  veio_errado: 'Veio errado',
  veio_frio: 'Veio frio',
  faltou_item: 'Faltou item',
  qualidade: 'Qualidade',
  outro: 'Outro',
};

/**
 * O rótulo de uma etiqueta que veio do agregado.
 *
 * `by_problem_tag` é `{[key: string]: number}` no contrato — as chaves não são
 * tipadas, e a descrição do agregado avisa que a lista PODE CRESCER. Uma
 * etiqueta desconhecida aparece com o próprio código em vez de sumir da soma:
 * a contagem continua batendo com o total de notas baixas, e quem vê
 * "reembolso" na tela sabe que o painel está atrás do backend. Devolver
 * "Outro" seria juntá-la a uma etiqueta que existe de verdade.
 */
export function problemTagLabel(tag: string): string {
  return PROBLEM_TAG_LABEL[tag as ReviewProblemTag] ?? tag;
}

/**
 * Quantas avaliações tiveram uma nota.
 *
 * O `?? 0` não é preenchimento de buraco — o backend garante as cinco chaves.
 * Ele é a resposta para a chave que não veio: a tela mostra zero em vez de
 * espalhar `undefined` por dentro de uma soma.
 */
export function ratingCount(summary: ReviewSummary, rating: number): number {
  return summary.by_rating[String(rating)] ?? 0;
}

/** Quantas notas foram BAIXAS — 1, 2 ou 3, a faixa em que se pergunta o motivo. */
export function lowRatingCount(summary: ReviewSummary): number {
  let total = 0;
  for (let nota = 1; nota <= LOW_RATING_MAX; nota += 1) total += ratingCount(summary, nota);
  return total;
}

export type RatingRow = { rating: number; count: number; ratio: number };

/**
 * As cinco linhas do histograma, da melhor nota para a pior.
 *
 * A BARRA É PROPORCIONAL À MAIOR CONTAGEM, não ao total: a pergunta que o
 * histograma responde é "qual nota apareceu mais", e contra o total quatro das
 * cinco barras ficariam rentes ao chão numa loja que vai bem. A contagem vai
 * escrita ao lado, então a proporção nunca é a única leitura.
 */
export function ratingRows(summary: ReviewSummary): RatingRow[] {
  const contagens = RATING_SCALE.map((rating) => ({ rating, count: ratingCount(summary, rating) }));
  const maior = contagens.reduce((maximo, linha) => Math.max(maximo, linha.count), 0);

  return contagens.map(({ rating, count }) => ({ rating, count, ratio: barRatio(count, maior) }));
}

export type TagRow = { tag: string; label: string; count: number; ratio: number };

/**
 * AS ETIQUETAS, DA MAIS FREQUENTE PARA A MENOS — a informação mais acionável
 * da tela inteira.
 *
 * "Três pessoas disseram que atrasou nesta semana" é o que faz alguém mexer na
 * operação; "média 3,4" não é. É para isso que a etiqueta é lista fechada em
 * vez de texto livre: texto livre não soma.
 *
 * O DENOMINADOR DA BARRA É O TOTAL DE NOTAS BAIXAS, e não a soma das
 * etiquetas. A etiqueta é opcional para quem avalia, então parte das notas
 * baixas não tem nenhuma — usar a soma das etiquetas faria "3 de 3" parecer
 * unanimidade quando foram 3 de 8. O `Math.max` cobre o caso patológico de a
 * soma das etiquetas passar do total de baixas: a barra satura em 100% em vez
 * de estourar a linha.
 *
 * EMPATE DESEMPATA PELO RÓTULO, e não pela ordem em que o JSON chegou: duas
 * etiquetas com 2 cada trocariam de lugar entre um recarregamento e outro, e
 * uma lista que se remexe sozinha é uma lista em que ninguém confia.
 */
export function tagRows(summary: ReviewSummary): TagRow[] {
  const denominador = Math.max(lowRatingCount(summary), taggedCount(summary));

  return Object.entries(summary.by_problem_tag)
    .filter(([, count]) => count > 0)
    .map(([tag, count]) => ({
      tag,
      label: problemTagLabel(tag),
      count,
      ratio: barRatio(count, denominador),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

/** Quantas notas baixas apontaram alguma etiqueta. */
export function taggedCount(summary: ReviewSummary): number {
  return Object.values(summary.by_problem_tag).reduce((soma, count) => soma + count, 0);
}

/**
 * Quantas notas baixas NÃO apontaram etiqueta.
 *
 * Ela existe porque, sem essa linha, a soma das etiquetas na tela não fecha com
 * o número de notas baixas logo acima — e duas somas que discordam na mesma
 * dobra lêem como defeito. `Math.max(0, …)` porque o backend é a autoridade dos
 * dois números: se um dia eles se contradisserem, a tela mostra zero em vez de
 * um negativo.
 */
export function untaggedLowCount(summary: ReviewSummary): number {
  return Math.max(0, lowRatingCount(summary) - taggedCount(summary));
}

function barRatio(count: number, maior: number): number {
  if (maior <= 0 || count <= 0) return 0;
  return Math.max(PISO_DA_BARRA, Math.min(1, count / maior));
}

/**
 * A MÉDIA, COM UMA CASA.
 *
 * `average` NULO É "ninguém avaliou", e vira travessão — nunca "0,0". O
 * backend é explícito sobre isso: média zero se lê como "todo mundo odiou",
 * que é o oposto de não ter resposta nenhuma. Um `?? 0` nesta linha compila,
 * passa no teste de tipo e mente.
 *
 * Uma casa, e não as duas que o backend arredonda: "4,25" promete uma precisão
 * que doze avaliações não têm, e o dígito a mais não muda decisão nenhuma.
 */
export function formatAverage(average: number | null | undefined): string {
  if (average === null || average === undefined || !Number.isFinite(average)) return '—';
  return average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Quantos dias o período tem, contando as duas pontas. `null` se as datas não
 * forem legíveis, ou se estiverem invertidas.
 *
 * A ARITMÉTICA É EM UTC de propósito, como em `previousRange` de Desempenho:
 * estas são datas de CALENDÁRIO (AAAA-MM-DD), não instantes, e somar
 * 86.400.000 ms num fuso com horário de verão pularia ou repetiria um dia.
 */
export function periodDays(range: { startDate: string; endDate: string }): number | null {
  const inicio = Date.parse(`${range.startDate}T12:00:00Z`);
  const fim = Date.parse(`${range.endDate}T12:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) return null;
  return Math.round((fim - inicio) / 86_400_000) + 1;
}

/**
 * O que impede de consultar — e por que a conferência é feita aqui.
 *
 * As duas primeiras causas (par incompleto, data invertida) são as de
 * Desempenho e saem de `rangeProblem`. A terceira é só desta rota: o backend
 * responde **400** acima de 366 dias (`MAX_REVIEW_PERIOD_DAYS`), e esse 400
 * chegaria à tela como uma frase de servidor no lugar da lista. Dizer o teto
 * antes de chamar é mais barato que explicá-lo depois.
 *
 * `null` quer dizer "pode consultar".
 */
export function periodProblem(range: ReviewPeriod): string | null {
  const base = rangeProblem(range);
  if (base) return base;

  const dias = periodDays(range);
  if (dias === null) return 'A data inicial é depois da final.';
  if (dias > MAX_PERIOD_DAYS) return `O período máximo de consulta é de ${MAX_PERIOD_DAYS} dias.`;
  return null;
}

/**
 * AS OPÇÕES DO FILTRO DE NOTA.
 *
 * O contrato tem `max_rating` ("só notas ATÉ este valor") e mais nada: não
 * existe nota mínima, nem "exatamente 3 estrelas". Por isso o filtro é uma
 * FAIXA que sempre começa em 1 — e os rótulos dizem isso ("até 3 estrelas"),
 * em vez de "3 estrelas", que prometeria um recorte que a rota não faz.
 *
 * A PRIMEIRA OPÇÃO É A QUE A TELA ABRE, e é a que o dono usa de verdade. "Todas
 * as notas" fica por último não por ser menos importante, mas porque a ordem
 * aqui é a da faixa: do recorte mais apertado para o mais largo.
 *
 * O valor vazio é ausência do parâmetro, que é como o contrato escreve "sem
 * recorte" — nunca `max_rating=null` no endereço.
 */
export const RATING_OPTIONS: readonly { value: string; label: string }[] = [
  { value: String(LOW_RATING_MAX), label: 'Até 3 estrelas' },
  { value: '2', label: 'Até 2 estrelas' },
  { value: '1', label: 'Só 1 estrela' },
  { value: '4', label: 'Até 4 estrelas' },
  { value: '', label: 'Todas as notas' },
];

/** O que o seletor devolve → o que a query manda. Vazio é "sem recorte". */
export function maxRatingFrom(value: string): number | null {
  const numero = Number(value);
  if (!Number.isInteger(numero) || numero < 1 || numero > 5) return null;
  return numero;
}

/**
 * "3 avaliações" / "1 avaliação".
 *
 * Um helper, e não um ternário no JSX, porque a tela escreve meia dúzia de
 * frases com contagem — e é assim que uma delas acaba saindo com
 * "1 avaliações".
 */
export function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
