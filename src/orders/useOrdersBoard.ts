import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { cancelOrder, fetchStatusCounts, listOrders, updateOrderStatus } from '../api/orders';
import { readCancelConfirmation, type CancelOutcome } from './cancel-confirmation';
import type { OrderListItem, OrderStreamEvent } from '../api/types';
import { defaultFilters, orderMatchesFilters, type OrdersFilterState } from './order-filters';
import { listItemFromDetail } from './order-mapping';
import { upsertOrder } from './stream-events';

/** 100 é o teto do `limit` da API. Uma página cobre o dia da maioria das lojas. */
const PAGE_SIZE = 100;

/** Espera antes de repuxar os badges, para uma rajada de eventos virar 1 chamada. */
const COUNTS_REFRESH_DELAY_MS = 500;

/**
 * Todo o estado da tela de pedidos.
 *
 * A lista fica também num ref, além do estado do React, porque o SSE precisa
 * saber AGORA se o pedido que chegou já estava na tela — e isso decide se o
 * alerta sonoro toca. Ler pelo estado dentro do callback do stream daria a
 * lista de um render anterior.
 */
export function useOrdersBoard() {
  const [filters, setFilters] = useState<OrdersFilterState>(defaultFilters);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalInFilter, setTotalInFilter] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ orderId: string; message: string } | null>(null);

  const ordersRef = useRef<OrderListItem[]>([]);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const countsTimerRef = useRef<number | undefined>(undefined);
  // Cada carga recebe um número. Resposta de uma carga antiga que chegar
  // atrasada é descartada, senão trocar o filtro duas vezes rápido poderia
  // deixar na tela o resultado do filtro anterior.
  const loadIdRef = useRef(0);

  /** Ref e estado sempre juntos: quem ler o ref vê o que a tela vai mostrar. */
  const commitOrders = useCallback((next: OrderListItem[]) => {
    ordersRef.current = next;
    setOrders(next);
  }, []);

  /** A última leitura dos contadores falhou: os números na tela podem estar velhos. */
  const [countsStale, setCountsStale] = useState(false);

  const refreshCounts = useCallback(async () => {
    try {
      const response = await fetchStatusCounts(filtersRef.current);
      const next: Record<string, number> = {};
      response.counts.forEach((entry) => {
        next[entry.status] = entry.count;
      });
      setCounts(next);
      setCountsStale(false);
    } catch {
      /*
       * O COMENTÁRIO ANTIGO DIZIA "o erro da lista já aparece", E ISSO SÓ VALE
       * SE AS DUAS CAÍREM JUNTAS.
       *
       * São rotas diferentes: `status-counts` falha sozinha, com a listagem
       * verde. O resultado é a faixa mostrando 4 pedidos e o contador dizendo
       * 7, sem nada aceso — duas expressões do mesmo fato discordando na mesma
       * tela, e o lojista sem saber em qual acreditar.
       *
       * Continua sem alerta e sem derrubar nada: o número que estava fica, e o
       * que muda é que a tela passa a DIZER que ele pode estar velho.
       */
      setCountsStale(true);
    }
  }, []);

  const scheduleCountsRefresh = useCallback(() => {
    window.clearTimeout(countsTimerRef.current);
    countsTimerRef.current = window.setTimeout(() => void refreshCounts(), COUNTS_REFRESH_DELAY_MS);
  }, [refreshCounts]);

  /** Recarrega a primeira página e os badges. É o "voltar ao estado correto". */
  const reload = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [page] = await Promise.all([
        listOrders(filtersRef.current, PAGE_SIZE, 0),
        refreshCounts(),
      ]);
      if (loadId !== loadIdRef.current) return;
      commitOrders(page.items);
      setTotalInFilter(page.total);
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (loadId === loadIdRef.current) setIsLoading(false);
    }
  }, [commitOrders, refreshCounts]);

  const loadMore = useCallback(async () => {
    const loadId = loadIdRef.current;
    try {
      const page = await listOrders(filtersRef.current, PAGE_SIZE, ordersRef.current.length);
      if (loadId !== loadIdRef.current) return;

      // Concatenar cegamente duplicaria pedidos que o SSE inseriu no topo e
      // deslocaram o offset. O upsert resolve pela chave.
      let merged = ordersRef.current;
      page.items.forEach((item) => {
        merged = upsertOrder(merged, item);
      });
      commitOrders(merged);
      setTotalInFilter(page.total);
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    }
  }, [commitOrders]);

  // Recarrega quando os filtros mudam (inclusive na primeira montagem).
  useEffect(() => {
    void reload();
  }, [filters, reload]);

  useEffect(() => () => window.clearTimeout(countsTimerRef.current), []);

  /**
   * Aplica um evento do SSE. Devolve se isso é um pedido NOVO na tela —
   * quem decide tocar o som é a página.
   */
  const applyStreamEvent = useCallback(
    (event: OrderStreamEvent): { isNewOrder: boolean } => {
      const incoming = event.order;
      if (!incoming) return { isNewOrder: false };

      // O stream manda todo pedido do restaurante; a tela pode estar filtrada.
      if (!orderMatchesFilters(incoming, filtersRef.current)) return { isNewOrder: false };

      const wasAbsent = !ordersRef.current.some((order) => order.id === incoming.id);
      commitOrders(upsertOrder(ordersRef.current, incoming));
      scheduleCountsRefresh();

      // Só toca para pedido que ainda não estava na tela: o replay da
      // reconexão reenvia eventos antigos, e alarme por pedido já visto
      // treinaria o lojista a ignorar o som.
      return { isNewOrder: event.type === 'order.created' && wasAbsent };
    },
    [commitOrders, scheduleCountsRefresh],
  );

  /**
   * Muda o status pelo backend, que é quem valida a máquina de estados.
   * Um 409 vira mensagem na tela e o pedido continua como estava.
   */
  const changeOrderStatus = useCallback(
    /**
     * `note` é o motivo da recusa, e é opcional — a rota já o aceita. É o que
     * faz o histórico do pedido dizer por que ele não saiu, em vez de só
     * "Recusado". Ver `RejectOrderDialog`.
     */
    async (orderId: string, status: string, note?: string): Promise<boolean> => {
      setActionError(null);
      try {
        const detail = await updateOrderStatus(orderId, status, note);
        commitOrders(upsertOrder(ordersRef.current, listItemFromDetail(detail)));
        scheduleCountsRefresh();
        return true;
      } catch (error) {
        setActionError({ orderId, message: messageFromUnknownError(error) });
        return false;
      }
    },
    [commitOrders, scheduleCountsRefresh],
  );

  /**
   * Cancela com motivo, por rota própria.
   *
   * Mesmo tratamento do `changeOrderStatus` — o backend devolve o pedido já
   * cancelado e o quadro aplica isso na hora, sem recarregar a lista inteira.
   *
   * O DESFECHO NÃO É BOOLEANO porque o backend tem três respostas, e a do meio
   * não é falha: a partir de `preparing`, cancelar sem `confirm` responde 428
   * pedindo o segundo clique. Ver `cancel-confirmation.ts`.
   */
  const cancelOrderWithReason = useCallback(
    async (orderId: string, reason: string, confirm = false): Promise<CancelOutcome> => {
      setActionError(null);
      try {
        const detail = await cancelOrder(orderId, reason, confirm);
        commitOrders(upsertOrder(ordersRef.current, listItemFromDetail(detail)));
        scheduleCountsRefresh();
        return { kind: 'cancelado' };
      } catch (error) {
        /*
         * O 428 NÃO VIRA `actionError`. Ele não é erro, e pintá-lo de vermelho
         * na barra do painel diria ao lojista que alguma coisa quebrou —
         * quando o que aconteceu é que o backend fez uma pergunta. Quem a
         * mostra é o diálogo, e a resposta dela é o segundo envio.
         */
        const confirmation = readCancelConfirmation(error);
        if (confirmation) return { kind: 'precisa-confirmar', confirmation };

        setActionError({ orderId, message: messageFromUnknownError(error) });
        return { kind: 'falhou' };
      }
    },
    [commitOrders, scheduleCountsRefresh],
  );

  /**
   * Aplica um patch nos filtros — e devolve o objeto ANTERIOR quando nada
   * mudou de fato.
   *
   * Sem essa conferência, todo patch criaria um objeto novo, o efeito acima
   * veria `filters` diferente e recarregaria a lista. Isso acontece de verdade
   * em dois lugares: o debounce da busca disparando com o mesmo texto, e a
   * filial do cabeçalho sendo aplicada na montagem.
   */
  const updateFilters = useCallback((patch: Partial<OrdersFilterState>) => {
    setFilters((current) => {
      const keys = Object.keys(patch) as (keyof OrdersFilterState)[];
      const changed = keys.some((key) => patch[key] !== undefined && patch[key] !== current[key]);
      return changed ? { ...current, ...patch } : current;
    });
  }, []);

  return {
    filters,
    updateFilters,
    orders,
    counts,
    countsStale,
    totalInFilter,
    isLoading,
    errorMessage,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
    reload,
    loadMore,
    applyStreamEvent,
    changeOrderStatus,
    cancelOrderWithReason,
  };
}
