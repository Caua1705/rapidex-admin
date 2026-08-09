import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchOrderDetail, listOrders, updateOrderStatus } from '../api/orders';
import type { OrderDetail, OrderListItem, OrderStreamEvent } from '../api/types';
import { listItemFromDetail } from '../orders/order-mapping';
import { upsertOrder } from '../orders/stream-events';
import { belongsInKitchen, KITCHEN_STATUSES } from './kitchen-board';

/** Teto por status. Uma cozinha com mais de 100 pedidos abertos parou de fluir. */
const PAGE_SIZE = 100;

/**
 * O estado da tela de Cozinha.
 *
 * REUSA a mesma fonte do quadro de pedidos — `/admin/orders` e o mesmo SSE —,
 * mas carrega POR STATUS, uma chamada para cada um dos três, em paralelo. A
 * alternativa seria filtrar por data como o quadro faz, e aí um pedido feito às
 * 23h50 sumiria da cozinha à meia-noite, no meio do preparo. Status não tem
 * virada de dia.
 *
 * Os ITENS não vêm na listagem: `/admin/orders` devolve cabeçalho de pedido. A
 * cozinha precisa do que preparar, então cada pedido visível tem seu detalhe
 * buscado uma vez e guardado por id. Item de pedido não muda depois de feito,
 * então não há o que invalidar.
 */
export function useKitchenOrders(branchId: string) {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [details, setDetails] = useState<Record<string, OrderDetail>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ orderId: string; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const ordersRef = useRef<OrderListItem[]>([]);
  const branchRef = useRef(branchId);
  branchRef.current = branchId;
  const loadIdRef = useRef(0);
  /** Ids com o detalhe já buscado ou em voo, para não pedir duas vezes. */
  const requestedDetails = useRef(new Set<string>());

  const commit = useCallback((next: OrderListItem[]) => {
    ordersRef.current = next;
    setOrders(next);
  }, []);

  const reload = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const pages = await Promise.all(
        KITCHEN_STATUSES.map((status) =>
          listOrders({ branchId: branchRef.current || undefined, status }, PAGE_SIZE, 0),
        ),
      );
      if (loadId !== loadIdRef.current) return;
      commit(pages.flatMap((page) => page.items));
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (loadId === loadIdRef.current) setIsLoading(false);
    }
  }, [commit]);

  useEffect(() => {
    void reload();
  }, [reload, branchId]);

  // Busca o detalhe do que está na tela e ainda não tem itens carregados.
  useEffect(() => {
    const missing = orders
      .filter(belongsInKitchen)
      .filter((order) => !requestedDetails.current.has(order.id));
    if (missing.length === 0) return;

    let cancelled = false;
    missing.forEach((order) => requestedDetails.current.add(order.id));

    void (async () => {
      const loaded = await Promise.all(
        missing.map(async (order) => {
          try {
            return await fetchOrderDetail(order.id);
          } catch {
            // Um detalhe que falhou não pode derrubar a tela: o cartão aparece
            // com o cabeçalho e sem a lista de itens, e a próxima montagem
            // tenta de novo.
            requestedDetails.current.delete(order.id);
            return null;
          }
        }),
      );
      if (cancelled) return;

      setDetails((current) => {
        const next = { ...current };
        loaded.forEach((detail) => {
          if (detail) next[detail.id] = detail;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [orders]);

  /**
   * Aplica um evento do SSE.
   *
   * O stream manda TODO pedido do restaurante, inclusive os que não são da
   * cozinha. O `upsert` entra com qualquer um deles e a filtragem acontece na
   * hora de agrupar: assim, um pedido que sai de "pendente" para "aceito"
   * aparece sozinho aqui, e um que vai para "saiu para entrega" desaparece —
   * os dois pelo mesmo caminho.
   */
  const applyStreamEvent = useCallback(
    (event: OrderStreamEvent) => {
      const incoming = event.order;
      if (!incoming) return;
      if (branchRef.current && incoming.branch_id !== branchRef.current) return;
      commit(upsertOrder(ordersRef.current, incoming));
    },
    [commit],
  );

  /** O botão do cartão. O backend continua sendo quem valida a transição. */
  const advance = useCallback(
    async (orderId: string, target: string): Promise<boolean> => {
      setPendingId(orderId);
      setActionError(null);
      try {
        const detail = await updateOrderStatus(orderId, target);
        commit(upsertOrder(ordersRef.current, listItemFromDetail(detail)));
        setDetails((current) => ({ ...current, [detail.id]: detail }));
        return true;
      } catch (error) {
        setActionError({ orderId, message: messageFromUnknownError(error) });
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [commit],
  );

  return {
    orders,
    details,
    isLoading,
    errorMessage,
    actionError,
    pendingId,
    reload,
    applyStreamEvent,
    advance,
  };
}
