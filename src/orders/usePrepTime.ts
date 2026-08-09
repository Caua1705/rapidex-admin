import { useCallback, useEffect, useState } from 'react';

import type { PrepTimeResponse } from '../api/contract-pending';
import { messageFromUnknownError } from '../api/errors';
import { adjustPrepTime, setPrepTimeBase } from '../api/orders';
import { classifyPrepTimeFailure } from './prep-time';

/**
 * O tempo de preparo da filial aberta na tela.
 *
 * A faixa começa desconhecida de propósito: não existe rota que a leia, e
 * `GET /admin/branches` não devolve `prep_time_min`/`max`. A única fonte é a
 * resposta do próprio ajuste — por isso a tela mostra "—" até o primeiro
 * empurrão e depois passa a mostrar o que o backend devolveu, sem segunda
 * chamada.
 */
export function usePrepTime(branchId: string) {
  const [range, setRange] = useState<PrepTimeResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** O backend recusou por não ter base: a tela abre o campo de min/max. */
  const [needsBase, setNeedsBase] = useState(false);

  // A faixa é de UMA filial. Trocar de filial no cabeçalho sem zerar isto
  // deixaria o número de uma loja em cima do nome de outra.
  useEffect(() => {
    setRange(null);
    setErrorMessage(null);
    setNeedsBase(false);
  }, [branchId]);

  const adjust = useCallback(
    async (deltaMinutes: number) => {
      if (!branchId) return;
      setIsSaving(true);
      setErrorMessage(null);
      try {
        setRange(await adjustPrepTime(branchId, deltaMinutes));
        setNeedsBase(false);
      } catch (error) {
        const failure = classifyPrepTimeFailure(error);
        if (failure === 'base-missing') {
          // Único caso em que a tela oferece um caminho adiante.
          setNeedsBase(true);
          setErrorMessage(null);
        } else {
          // Filial fechada (e qualquer 409 que não dê para classificar):
          // mostra o que o backend disse e para por aqui. Não há contorno.
          setNeedsBase(false);
          setErrorMessage(messageFromUnknownError(error));
        }
      } finally {
        setIsSaving(false);
      }
    },
    [branchId],
  );

  /**
   * Grava a faixa base uma vez.
   *
   * Não reaplica o empurrão que levou o 409: o lojista acabou de digitar a
   * faixa que quer, e somar 5 minutos por cima disso entregaria um número que
   * ele não pediu.
   */
  const saveBase = useCallback(
    async (prepTimeMin: number, prepTimeMax: number) => {
      if (!branchId) return false;
      setIsSaving(true);
      setErrorMessage(null);
      try {
        setRange(await setPrepTimeBase(branchId, prepTimeMin, prepTimeMax));
        setNeedsBase(false);
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [branchId],
  );

  return {
    range,
    isSaving,
    errorMessage,
    needsBase,
    adjust,
    saveBase,
    dismiss: useCallback(() => {
      setNeedsBase(false);
      setErrorMessage(null);
    }, []),
  };
}
