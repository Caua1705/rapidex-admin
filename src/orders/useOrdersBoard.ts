import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchStatusCounts, listOrders, updateOrderStatus } from '../api/orders';
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

  const refreshCounts = useCallback(async () => {
    try {
      const response = await fetchStatusCounts(filtersRef.current);
      const next: Record<string, number> = {};
      response.counts.forEach((entry) => {
        next[entry.status] = entry.count;
      });
      setCounts(next);
    } catch {
      // Badge desatualizado não impede trabalhar, e o erro da lista já aparece.
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
    async (orderId: string, status: string): Promise<boolean> => {
      setActionError(null);
      try {
        const detail = await updateOrderStatus(orderId, status);
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

  const updateFilters = useCallback((patch: Partial<OrdersFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  return {
    filters,
    updateFilters,
    orders,
    counts,
    totalInFilter,
    isLoading,
    errorMessage,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
    reload,
    loadMore,
    applyStreamEvent,
    changeOrderStatus,
  };
}
