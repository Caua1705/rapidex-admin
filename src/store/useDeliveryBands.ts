import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchDeliveryTimeBands, replaceDeliveryTimeBands } from '../api/store';
import type { DeliveryTimeBand, DeliveryTimeBandInput } from '../api/types';

/**
 * As faixas de prazo desta filial.
 *
 * HOOK PRÓPRIO, e não um campo a mais em `useBranchDetail`: as faixas são outra
 * rota, com outro método (`PUT` que substitui tudo) e outro papel na escrita
 * (`GERENCIA`, enquanto o resto da aba é `loja.editarFilial`). Salvar as duas
 * coisas no mesmo botão faria um 403 numa metade parecer falha da outra.
 *
 * A LEITURA NÃO DERRUBA A ABA: sem as faixas, o prazo sai do tempo do Google e
 * o resto da tela de entrega continua editável. Um erro aqui vira uma linha no
 * bloco, e não uma tarja vermelha por cima da cobrança.
 */
export function useDeliveryBands(branchId: string) {
  const [bands, setBands] = useState<DeliveryTimeBand[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!branchId) return;

    let cancelado = false;
    setIsLoading(true);
    setLoadError(null);
    setBands(null);

    void (async () => {
      try {
        const lidas = await fetchDeliveryTimeBands(branchId);
        if (!cancelado) setBands(lidas);
      } catch (error) {
        if (!cancelado) setLoadError(messageFromUnknownError(error));
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [branchId]);

  /**
   * Substitui todas as faixas.
   *
   * A resposta é a lista já gravada e ordenada pelo backend, e é ela que
   * repinta a tabela — a ordem que vale é a da regra, não a de digitação.
   */
  const save = useCallback(
    async (proximas: DeliveryTimeBandInput[]): Promise<boolean> => {
      if (!branchId) return false;
      setIsSaving(true);
      setSaveError(null);
      try {
        setBands(await replaceDeliveryTimeBands(branchId, proximas));
        setSavedAt(Date.now());
        return true;
      } catch (error) {
        setSaveError(messageFromUnknownError(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [branchId],
  );

  return { bands, isLoading, isSaving, loadError, saveError, savedAt, save };
}
