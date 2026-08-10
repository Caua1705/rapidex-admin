import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { adjustPrepTime, setPrepTimeBase } from '../api/orders';
import { classifyPrepTimeFailure, toPrepRange, type PrepRange } from './prep-time';
import { usePrepRange } from './usePrepRange';

/**
 * O tempo de preparo da filial aberta na tela, com os ajustes.
 *
 * A FAIXA É LIDA NA ABERTURA por `usePrepRange`, e não só depois do primeiro
 * ajuste — antes disto a barra abria com um travessão solto ao lado dos botões:
 * um controle que só sabe somar, sem dizer somar a partir de quanto. A mesma
 * leitura serve de régua para o cronômetro da Cozinha, e é de propósito que
 * seja a mesma: se fossem duas, o alarme da cozinha e a promessa feita ao
 * cliente seriam números diferentes.
 *
 * Depois de ajustar, a resposta do PATCH substitui o que veio da leitura — sem
 * segunda chamada, porque ela já traz a faixa ajustada.
 */
export function usePrepTime(branchId: string) {
  const loaded = usePrepRange(branchId);
  /** O que o ajuste gravou nesta sessão; vence o que foi lido na abertura. */
  const [adjusted, setAdjusted] = useState<PrepRange | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** O backend recusou por não ter base: a tela abre o campo de min/max. */
  const [needsBase, setNeedsBase] = useState(false);

  const range = adjusted ?? loaded.range;
  const isLoading = loaded.isLoading;

  // A faixa é de UMA filial. Trocar de filial no cabeçalho sem zerar isto
  // deixaria o número de uma loja em cima do nome de outra.
  useEffect(() => {
    setAdjusted(null);
    setErrorMessage(null);
    setNeedsBase(false);
  }, [branchId]);

  const adjust = useCallback(
    async (deltaMinutes: number) => {
      if (!branchId) return;
      setIsSaving(true);
      setErrorMessage(null);
      try {
        setAdjusted(toPrepRange(await adjustPrepTime(branchId, deltaMinutes)));
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
        setAdjusted(toPrepRange(await setPrepTimeBase(branchId, prepTimeMin, prepTimeMax)));
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
    isLoading,
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
