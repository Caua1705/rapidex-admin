import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { cancelOrder, fetchStatusCounts, listOrders, updateOrderStatus } from '../api/orders';
import type { CancelConfirmation, OrderListItem, OrderStreamEvent } from '../api/types';
import { confirmacaoExigida } from './cancel-confirmation';
import { defaultFilters, orderMatchesFilters, type OrdersFilterState } from './order-filters';
import { listItemFromDetail } from './order-mapping';
import { upsertOrder } from './stream-events';

/**
 * OS TRÊS DESFECHOS DE UM CANCELAMENTO.
 *
 * `{ ok: true }` gravou; `{ ok: false, confirmation }` é o 428 — o backend
 * pedindo o segundo clique, e não uma falha; `{ ok: false, confirmation: null }`
 * é erro de verdade, e a mensagem dele já está em `actionError`.
 *
 * UM BOOLEANO NÃO DAVA CONTA, e é por isso que este tipo existe: com `false`
 * para os dois últimos casos, a tela não tinha como distinguir "o backend
 * recusou" de "o backend está perguntando" — e tratava os dois como recusa.
 */
export type CancelOutcome = { ok: boolean; confirmation: CancelConfirmation | null };

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
   * O backend devolve o pedido já cancelado e o quadro aplica isso na hora,
   * sem recarregar a lista inteira.
   *
   * ELE TEM TRÊS DESFECHOS, E NÃO DOIS, e é essa a diferença para
   * `changeOrderStatus`: entre "deu certo" e "deu erro" existe o 428
   * `confirmation_required`, que não é nem um nem outro. É o backend pedindo
   * uma precondição que a tela satisfaz na hora — o pedido já está em produção
   * e falta o segundo clique.
   *
   * **O 428 NÃO PODE VIRAR `actionError`**, e era exatamente o que acontecia:
   * `messageFromUnknownError` não acha frase num `detail` que é objeto, então o
   * lojista via a tarja vermelha genérica, o pedido continuava na chapa e não
   * havia caminho na tela para sair dali. Por isso a leitura de
   * `confirmacaoExigida` vem ANTES do `setActionError` — uma resposta que não é
   * erro não pode acender a régua de erro.
   */
  const cancelOrderWithReason = useCallback(
    async (
      orderId: string,
      reason: string,
      /** Só `true` vindo do diálogo de produção. Ver `api/orders.ts`. */
      confirmPreparedOrder = false,
    ): Promise<CancelOutcome> => {
      setActionError(null);
      try {
        const detail = await cancelOrder(orderId, reason, confirmPreparedOrder);
        commitOrders(upsertOrder(ordersRef.current, listItemFromDetail(detail)));
        scheduleCountsRefresh();
        return { ok: true, confirmation: null };
      } catch (error) {
        const confirmation = confirmacaoExigida(error);
        if (confirmation) return { ok: false, confirmation };

        setActionError({ orderId, message: messageFromUnknownError(error) });
        return { ok: false, confirmation: null };
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
