import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchCourierFee, updateCourierFee } from '../api/couriers';
import type { CourierFee } from '../api/types';
import { corpoDaTaxa, rascunhoDaTaxa, RASCUNHO_VAZIO, type CourierFeeDraft } from './courier-fee';

/**
 * A taxa por corrida de UMA filial: ler, editar e gravar.
 *
 * ELE NÃO RELÊ SOZINHO, ao contrário de `usePrintAgent`: isto é configuração
 * que o dono grava, não o estado de uma máquina em outra sala. Só muda quando
 * alguém muda.
 *
 * O `baseline` é o que está NO SERVIDOR, e ele existe para o corpo do PATCH
 * poder omitir o que não mudou — ver `corpoDaTaxa`. Depois de gravar, o
 * baseline passa a ser a RESPOSTA do backend, e não o rascunho: se o servidor
 * normalizou algo, é a versão dele que vale, e a próxima edição parte do que
 * está gravado de verdade.
 */
export function useCourierFee(branchId: string) {
  const [fee, setFee] = useState<CourierFee | null>(null);
  const [draft, setDraft] = useState<CourierFeeDraft>(RASCUNHO_VAZIO);
  const [baseline, setBaseline] = useState<CourierFeeDraft>(RASCUNHO_VAZIO);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [salvou, setSalvou] = useState(false);

  /** Descarta a resposta de uma filial que já não é a da tela. */
  const requestRef = useRef(0);

  useEffect(() => {
    if (!branchId) {
      setFee(null);
      setDraft(RASCUNHO_VAZIO);
      setBaseline(RASCUNHO_VAZIO);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const lida = await fetchCourierFee(branchId);
        if (requestId !== requestRef.current) return;
        aplicar(lida);
      } catch (error) {
        if (requestId !== requestRef.current) return;
        /*
         * A LEITURA QUE FALHOU NÃO VIRA "SEM TAXA". `fee` fica nulo e a tela
         * mostra o erro — `semTaxa(null)` é falso de propósito. Zerar o estado
         * aqui faria uma queda de rede afirmar ao dono que ele não paga nada
         * ao motoboy, que é a pior frase que esta seção pode dizer errado.
         */
        setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    })();

    function aplicar(lida: CourierFee) {
      const proximo = rascunhoDaTaxa(lida);
      setFee(lida);
      setDraft(proximo);
      setBaseline(proximo);
    }
  }, [branchId]);

  const editar = useCallback((mudanca: Partial<CourierFeeDraft>) => {
    setDraft((atual) => ({ ...atual, ...mudanca }));
    setProblem(null);
    setSalvou(false);
  }, []);

  const salvar = useCallback(async (): Promise<boolean> => {
    const corpo = corpoDaTaxa(draft, baseline);
    if (!corpo.ok) {
      setProblem(corpo.message);
      return false;
    }

    setIsSaving(true);
    setProblem(null);
    try {
      const gravada = await updateCourierFee(branchId, corpo.body);
      const proximo = rascunhoDaTaxa(gravada);
      setFee(gravada);
      setDraft(proximo);
      setBaseline(proximo);
      setSalvou(true);
      return true;
    } catch (error) {
      setProblem(messageFromUnknownError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [branchId, draft, baseline]);

  const isDirty =
    draft.base.trim() !== baseline.base.trim() || draft.perKm.trim() !== baseline.perKm.trim();

  return {
    fee,
    draft,
    isDirty,
    isLoading,
    isSaving,
    errorMessage,
    problem,
    salvou,
    editar,
    salvar,
  };
}
