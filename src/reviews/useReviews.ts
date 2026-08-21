import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { listReviews, type ReviewFilters } from '../api/reviews';
import type { ReviewItem, ReviewSummary } from '../api/types';
import { datesForPreset } from '../performance/report-model';
import {
  LOW_RATING_MAX,
  periodProblem,
  type ReviewPeriod,
  type ReviewPreset,
} from './review-model';

/** Uma página. O mesmo tamanho de Clientes e do cardápio, e o padrão da rota. */
export const PAGE_SIZE = 50;

/**
 * ============================================================================
 * O ESTADO DA TELA DE AVALIAÇÕES
 * ============================================================================
 *
 * Uma rota, uma resposta, dois pedaços: a lista (recortada pelo filtro de
 * nota) e o agregado (sempre do período inteiro). Os dois chegam juntos, então
 * não há `Promise.allSettled` aqui como em Desempenho — não há como um falhar
 * sem o outro.
 *
 * A TELA ABRE EM "ATÉ 3 ESTRELAS", e essa é a decisão de produto do hook.
 *
 * O recorte que o dono usa de verdade é "o que deu errado esta semana"; abrir
 * na lista cronológica completa é obrigá-lo a montar essa pergunta toda vez.
 * O que paga o padrão são três coisas, e sem elas ele seria o "filtro que
 * ninguém lembra que ligou" que a tela de Pedidos existe para evitar:
 *
 *   - o seletor de nota fica SEMPRE VISÍVEL na faixa, nunca atrás de um botão;
 *   - o agregado acima da lista fala do período INTEIRO (o backend não aplica
 *     `max_rating` a ele), então a média e as barras não se movem com o
 *     filtro — o dono nunca vê a semana "piorar" por causa de um clique;
 *   - a lista escreve, na própria seção, qual recorte está no ar.
 *
 * TROCAR QUALQUER COISA VOLTA PARA A PRIMEIRA PÁGINA. Período, filial e nota
 * passam pelo mesmo `load`, que sempre pede `offset: 0`: um recorte novo
 * paginado do meio mostraria a página 3 de uma lista que agora tem uma.
 */
export function useReviews(branchId: string) {
  const [range, setRange] = useState<ReviewPeriod>(() => ({
    preset: 'last7',
    ...datesForPreset('last7', { startDate: '', endDate: '' }),
  }));
  const [maxRating, setMaxRating] = useState<number | null>(LOW_RATING_MAX);

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Descarta a resposta de um recorte que já não é o atual. */
  const requestRef = useRef(0);

  const problem = periodProblem(range);

  const load = useCallback(async (filtros: ReviewFilters) => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const page = await listReviews(filtros, PAGE_SIZE, 0);
      if (requestId !== requestRef.current) return;
      setItems(page.items);
      setSummary(page.summary);
      setHasMore(page.items.length >= PAGE_SIZE);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      /*
       * A LISTA E O AGREGADO SOMEM JUNTOS COM O ERRO. Manter na tela a média
       * do período anterior sob uma tarja vermelha faria o lojista ler um
       * número de outra pergunta como se fosse a resposta desta — e aqui o
       * risco é maior que em Clientes, porque média e barras são justamente o
       * que ele veio comparar entre um período e outro.
       */
      setItems([]);
      setSummary(null);
      setHasMore(false);
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    /*
     * Período inválido não vira requisição: o backend responderia 400 (data
     * invertida ou período acima de 366 dias) e a tela mostraria a frase do
     * servidor no lugar da nossa, que aponta qual das duas pontas está errada.
     */
    if (problem) {
      setIsLoading(false);
      return;
    }
    void load({
      startDate: range.startDate,
      endDate: range.endDate,
      branchId,
      maxRating,
    });
  }, [load, problem, range.startDate, range.endDate, branchId, maxRating]);

  /**
   * A próxima página.
   *
   * `offset` sai de `items.length`, e não de um contador de páginas: se uma
   * requisição se perder, o comprimento da lista continua sendo a verdade de
   * quanto já está na tela.
   *
   * O `summary` DA SEGUNDA PÁGINA É IGNORADO de propósito. Ele vem de novo no
   * corpo (a rota devolve sempre os dois), e é o mesmo agregado do mesmo
   * período — regravá-lo só abriria a janela para a média piscar por causa de
   * uma avaliação que chegou entre as duas chamadas, num número que o lojista
   * está lendo naquele instante.
   */
  const loadMore = useCallback(async () => {
    const requestId = requestRef.current;
    setIsLoadingMore(true);
    try {
      const page = await listReviews(
        { startDate: range.startDate, endDate: range.endDate, branchId, maxRating },
        PAGE_SIZE,
        items.length,
      );
      if (requestId !== requestRef.current) return;
      setItems((atuais) => [...atuais, ...page.items]);
      /*
       * NÃO EXISTE `total` DA LISTA no contrato desta rota, e `summary.total`
       * não serve de denominador — ele conta o período inteiro, sem o
       * `max_rating` que recortou a lista. Então "tem mais página" é uma
       * resposta CHEIA: página menor que o limite é a última.
       */
      setHasMore(page.items.length >= PAGE_SIZE);
      setErrorMessage(null);
    } catch (error) {
      if (requestId === requestRef.current) setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [branchId, items.length, maxRating, range.endDate, range.startDate]);

  const selectPreset = useCallback((preset: ReviewPreset) => {
    setRange((atual) => ({ preset, ...datesForPreset(preset, atual) }));
  }, []);

  const setCustomDate = useCallback((patch: { startDate?: string; endDate?: string }) => {
    setRange((atual) => ({ ...atual, ...patch, preset: 'custom' }));
  }, []);

  return {
    range,
    maxRating,
    problem,
    items,
    summary,
    isLoading,
    isLoadingMore,
    errorMessage,
    hasMore,
    selectPreset,
    setCustomDate,
    setMaxRating,
    loadMore,
  };
}
