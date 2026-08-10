import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { adjustPrepTime, setPrepTimeBase } from '../api/orders';
import { fetchBusinessHours } from '../api/store';
import { backendWeekday, prepTimeForDay } from '../store/business-hours';
import { classifyPrepTimeFailure, toPrepRange, type PrepRange } from './prep-time';

/**
 * O tempo de preparo da filial aberta na tela.
 *
 * A FAIXA É LIDA NA ABERTURA, e não só depois do primeiro ajuste. O prazo mora
 * na linha de horário do dia (é por isso que o PATCH devolve um
 * `BusinessHourResponse`), então a leitura sai de
 * `GET /admin/branches/{id}/business-hours` filtrada pelo dia de hoje. Antes
 * disto a barra abria com um travessão solto ao lado dos botões: um controle
 * que só sabe somar, sem dizer somar a partir de quanto.
 *
 * Depois de ajustar, a resposta do PATCH substitui o que está na tela — sem
 * segunda chamada, porque ela já traz a faixa ajustada.
 */
export function usePrepTime(branchId: string) {
  const [range, setRange] = useState<PrepRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

    if (!branchId) return;

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const hours = await fetchBusinessHours(branchId);
        if (cancelled) return;
        const today = prepTimeForDay(hours, backendWeekday(new Date()));
        // `null` fica `null`: filial sem faixa gravada é um estado real, e a
        // barra diz "não definido" em vez de inventar um número.
        setRange(today);
      } catch {
        // A leitura falhando não vira erro na barra: o lojista veio para o
        // quadro de pedidos, e um alerta aqui roubaria a tela por causa de um
        // número auxiliar. Os botões continuam funcionando — quem manda a
        // verdade é a resposta do ajuste.
        if (!cancelled) setRange(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const adjust = useCallback(
    async (deltaMinutes: number) => {
      if (!branchId) return;
      setIsSaving(true);
      setErrorMessage(null);
      try {
        setRange(toPrepRange(await adjustPrepTime(branchId, deltaMinutes)));
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
        setRange(toPrepRange(await setPrepTimeBase(branchId, prepTimeMin, prepTimeMax)));
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
