import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchSettings, updateSettings } from '../api/store';
import type { RestaurantSettings, RestaurantSettingsUpdate } from '../api/types';

/**
 * Os PADRÕES do restaurante (não o estado da filial).
 *
 * ABRIR/FECHAR SAIU DAQUI. Enquanto `is_open` era do restaurante, ele morava
 * junto porque era o mesmo recurso do outro lado — a resposta do `store-status`
 * trazia as configurações inteiras. Hoje o estado do dia é de cada filial e tem
 * hook próprio (`useBranchOperation`); `accepts_delivery` e `accepts_pickup`
 * foram junto, pelo mesmo caminho.
 *
 * O que sobrou aqui é o que a filial HERDA quando não sobrescreve: valor
 * mínimo, prazo estimado e taxa de serviço.
 */
export function useStoreSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setSettings(await fetchSettings());
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (patch: RestaurantSettingsUpdate): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // A resposta é a configuração inteira já gravada: a tela adota o que o
      // backend devolveu em vez de confiar no que mandou.
      setSettings(await updateSettings(patch));
      setSavedAt(Date.now());
      return true;
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    settings,
    isLoading,
    isSaving,
    errorMessage,
    savedAt,
    reload,
    save,
    dismissError: useCallback(() => setErrorMessage(null), []),
  };
}
