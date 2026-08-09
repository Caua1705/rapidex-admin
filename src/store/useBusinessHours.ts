import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchBusinessHours, replaceBusinessHours } from '../api/store';
import type { BusinessHour } from '../api/types';
import { hasMultiplePeriods, weekFromResponse, weekPayload, type DayDraft } from './business-hours';

/**
 * A semana de funcionamento da filial.
 *
 * O rascunho da grade fica aqui, e não em cada linha, porque o salvamento é da
 * SEMANA INTEIRA: o PUT substitui tudo. Um estado por linha faria a tela mandar
 * o que ela tem em mãos, que é justamente como se fecha a loja em cinco dias
 * sem querer.
 */
export function useBusinessHours(branchId: string) {
  const [week, setWeek] = useState<DayDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** O backend tem mais de uma faixa em algum dia; esta grade só edita uma. */
  const [collapsedPeriods, setCollapsedPeriods] = useState(false);

  const adopt = useCallback((hours: BusinessHour[]) => {
    setWeek(weekFromResponse(hours));
    setCollapsedPeriods(hasMultiplePeriods(hours));
  }, []);

  useEffect(() => {
    if (!branchId) {
      setWeek([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const hours = await fetchBusinessHours(branchId);
        if (!cancelled) adopt(hours);
      } catch (error) {
        if (!cancelled) setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, adopt]);

  /** Muda uma linha da grade sem tocar nas outras seis. */
  const updateDay = useCallback((weekday: number, patch: Partial<DayDraft>) => {
    setWeek((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!branchId) return false;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // `weekPayload` é quem garante os 7 dias no corpo. Ver business-hours.ts.
      adopt(await replaceBusinessHours(branchId, weekPayload(week)));
      setSavedAt(Date.now());
      return true;
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [branchId, week, adopt]);

  return { week, isLoading, isSaving, errorMessage, savedAt, collapsedPeriods, updateDay, save };
}
