/**
 * ============================================================================
 * OS CINCO FILTROS DE CLIENTES — o que a tela guarda, e o que ela manda
 * ============================================================================
 *
 * `GET /admin/customers` passou a aceitar `segment`, `last_order_from`,
 * `last_order_to`, `min_ticket` e `max_ticket` (contrato de 21/08/2026, §6).
 *
 * O QUE ESTE ARQUIVO NÃO FAZ, E É A PRIMEIRA COISA A SABER: ele **não filtra
 * nada**. Não existe aqui um `customerMatchesFilters`, e a ausência é o ponto.
 * Os filtros valem no SQL, ANTES do `LIMIT` — o `total` do envelope conta o que
 * sobrou depois deles. Repetir a peneira no painel seria filtrar as 50 linhas
 * que por acaso estão na mão e apresentar o resultado como resposta sobre a
 * base: "3 em risco" quando são trinta.
 *
 * (A tela de Pedidos TEM um `orderMatchesFilters`, e não é contradição: lá ele
 * existe para decidir se um pedido que chegou pelo SSE cabe no recorte que está
 * na tela. Aqui não há stream, e não há segunda fonte a reconciliar.)
 *
 * O que mora aqui é o RASCUNHO do formulário — texto como o lojista digita — e
 * a tradução dele para a query. As duas coisas são separadas de propósito:
 * "1.234,56" é um estado de campo válido, e `1234.56` é o que a API entende.
 */
import { parseDecimal } from '../store/settings-model';
import { SEGMENT_LABEL } from './customer-segment';
import type { CustomerSegment } from '../api/types';
import type { CustomerFilters } from '../api/customers';

/**
 * O ESTADO DO FORMULÁRIO. Tudo string, inclusive o que vira número: é o que o
 * campo tem dentro, e um campo pela metade ("12,") precisa poder existir
 * enquanto a pessoa digita.
 *
 * `segment` vazio é "todas as classes", e não um sexto valor: o contrato manda
 * o parâmetro ausente para dizer isso, e é o que `toQuery` faz.
 */
export type CustomerFilterState = {
  segment: CustomerSegment | '';
  /** AAAA-MM-DD no dia da OPERAÇÃO — ver `toQuery`. */
  lastOrderFrom: string;
  lastOrderTo: string;
  /** Em reais, como o lojista digita: vírgula decimal, ponto de milhar. */
  minTicket: string;
  maxTicket: string;
};

export const NO_FILTERS: CustomerFilterState = {
  segment: '',
  lastOrderFrom: '',
  lastOrderTo: '',
  minTicket: '',
  maxTicket: '',
};

/** As opções do seletor de classe, com "Todas" como ausência de recorte. */
export const SEGMENT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Todas as classes' },
  ...(Object.keys(SEGMENT_LABEL) as CustomerSegment[]).map((segment) => ({
    value: segment,
    label: SEGMENT_LABEL[segment],
  })),
];

/**
 * QUANTOS CRITÉRIOS ESTÃO LIGADOS — o número que vai no botão.
 *
 * A FAIXA CONTA COMO UM, não como dois. "Ticket de 20 a 80" é um critério que o
 * lojista pensou uma vez; dizer "Filtros · 4" para duas faixas preenchidas
 * transformaria o contador num contador de CAMPOS, e o número deixaria de
 * corresponder ao que a pessoa lembra de ter ligado.
 *
 * Ele existe porque a tela esconde os critérios atrás de um botão, e um filtro
 * escondido é um filtro que ninguém lembra que ligou — é a razão pela qual
 * Pedidos não esconde os seus. Aqui o número é o que paga o esconderijo: a
 * lista pode estar recortada, e a faixa DIZ isso sem abrir nada.
 */
export function activeFilterCount(state: CustomerFilterState): number {
  let total = 0;
  if (state.segment !== '') total += 1;
  if (state.lastOrderFrom.trim() !== '' || state.lastOrderTo.trim() !== '') total += 1;
  if (state.minTicket.trim() !== '' || state.maxTicket.trim() !== '') total += 1;
  return total;
}

export function hasActiveFilters(state: CustomerFilterState): boolean {
  return activeFilterCount(state) > 0;
}

/**
 * O QUE IMPEDE DE APLICAR — e por que a conferência é feita aqui e não pelo 400.
 *
 * O backend responde **400** a intervalo invertido (data ou ticket), e não lista
 * vazia. A escolha dele é certa: uma lista vazia deixaria o lojista procurando o
 * cliente que sumiu da tela. Mas um 400 na cara de quem acabou de escrever duas
 * datas é uma tarja vermelha genérica no lugar da lista — e a lista some, porque
 * `useCustomers` esvazia em erro.
 *
 * Então a tela confere ANTES de chamar e diz qual das duas pontas está errada,
 * ao lado do campo. O 400 continua tratado (é a rede para o caso de as duas
 * regras divergirem um dia), só deixa de ser o caminho normal de quem digitou
 * uma data ao contrário.
 *
 * `null` quer dizer "pode aplicar".
 */
export function filterProblem(state: CustomerFilterState): {
  campo: 'periodo' | 'ticket';
  message: string;
} | null {
  const de = state.lastOrderFrom.trim();
  const ate = state.lastOrderTo.trim();
  // Comparação de string serve: as duas são AAAA-MM-DD, formato em que a ordem
  // lexicográfica É a ordem cronológica.
  if (de !== '' && ate !== '' && de > ate) {
    return { campo: 'periodo', message: 'A data inicial é depois da final.' };
  }

  const min = parseDecimal(state.minTicket);
  if (!min.ok) return { campo: 'ticket', message: min.message };
  const max = parseDecimal(state.maxTicket);
  if (!max.ok) return { campo: 'ticket', message: max.message };
  if (min.value !== null && max.value !== null && min.value > max.value) {
    return { campo: 'ticket', message: 'O ticket mínimo é maior que o máximo.' };
  }

  return null;
}

/**
 * O RASCUNHO → A QUERY. Só o que está preenchido entra; o resto some do
 * endereço, porque parâmetro ausente é como o contrato escreve "sem recorte".
 *
 * O TICKET VAI COMO STRING, com duas casas. O contrato aceita `number | string`
 * e do outro lado é `Decimal`: mandar `50.1` como número deixa a conversão para
 * o `float` do JSON, e um `min_ticket` de 50,10 que chega 50,099999 recorta uma
 * linha de menos sem ninguém ver. `toFixed(2)` é a mesma escolha que o resto do
 * painel faz para dinheiro.
 *
 * AS DATAS VÃO CRUAS. Elas já são o dia da OPERAÇÃO: saem de um
 * `input type="date"`, que devolve AAAA-MM-DD sem fuso nenhum, e o backend as
 * lê em `America/Fortaleza` — o dia que o lojista escolheu é o dia dele. Passar
 * por `Date` aqui seria reintroduzir o fuso do navegador no meio do caminho.
 */
export function toQuery(state: CustomerFilterState): CustomerFilters {
  const query: CustomerFilters = {};

  if (state.segment !== '') query.segment = state.segment;

  const de = state.lastOrderFrom.trim();
  const ate = state.lastOrderTo.trim();
  if (de !== '') query.lastOrderFrom = de;
  if (ate !== '') query.lastOrderTo = ate;

  const min = parseDecimal(state.minTicket);
  if (min.ok && min.value !== null) query.minTicket = min.value.toFixed(2);
  const max = parseDecimal(state.maxTicket);
  if (max.ok && max.value !== null) query.maxTicket = max.value.toFixed(2);

  return query;
}
