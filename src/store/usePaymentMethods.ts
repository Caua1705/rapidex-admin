import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
  type PaymentMethodCreateBody,
} from '../api/store';
import type { PaymentMethod, PaymentMethodUpdate } from '../api/types';

/** As formas de pagamento da filial, na ordem em que o cliente as vê. */
function sortMethods(methods: readonly PaymentMethod[]): PaymentMethod[] {
  return [...methods].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

export function usePaymentMethods(branchId: string) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Ids com uma chamada em voo, para travar só a linha mexida. */
  const [pendingIds, setPendingIds] = useState<readonly string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!branchId) {
      setMethods([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const loaded = await listPaymentMethods(branchId);
        if (!cancelled) setMethods(sortMethods(loaded));
      } catch (error) {
        if (!cancelled) setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const markPending = useCallback((methodId: string, pending: boolean) => {
    setPendingIds((current) =>
      pending ? [...current, methodId] : current.filter((id) => id !== methodId),
    );
  }, []);

  const create = useCallback(
    /*
     * O CORPO NÃO LEVA `earns_cashback`, e isso é a decisão, não um esquecimento.
     *
     * A forma nova nasce com o default `true` da coluna, e quem quiser desligar
     * desmarca a caixa na linha depois — um PATCH, que é onde o campo é
     * opcional de verdade. Mandá-lo aqui daria 403 no gerente pelo simples fato
     * de a chave existir no JSON (ver `PaymentMethodCreateBody`), e o gerente
     * PODE cadastrar forma de pagamento.
     */
    async (body: PaymentMethodCreateBody): Promise<boolean> => {
      if (!branchId) return false;
      setIsCreating(true);
      setErrorMessage(null);
      try {
        const created = await createPaymentMethod(branchId, body);
        setMethods((current) => sortMethods([...current, created]));
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [branchId],
  );

  /**
   * `payment_flow` e `method_type` não entram no corpo — o contrato não os
   * aceita. Trocar o fluxo de uma forma já cadastrada mudaria, no meio do
   * expediente, como os próximos pedidos são cobrados.
   */
  const update = useCallback(
    async (methodId: string, patch: PaymentMethodUpdate): Promise<boolean> => {
      markPending(methodId, true);
      setErrorMessage(null);
      try {
        const updated = await updatePaymentMethod(methodId, patch);
        setMethods((current) =>
          sortMethods(current.map((method) => (method.id === methodId ? updated : method))),
        );
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        markPending(methodId, false);
      }
    },
    [markPending],
  );

  const remove = useCallback(
    async (methodId: string): Promise<boolean> => {
      markPending(methodId, true);
      setErrorMessage(null);
      try {
        await deletePaymentMethod(methodId);
        setMethods((current) => current.filter((method) => method.id !== methodId));
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        markPending(methodId, false);
      }
    },
    [markPending],
  );

  return { methods, isLoading, isCreating, pendingIds, errorMessage, create, update, remove };
}
