import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchSettings, setStoreOpen, updateSettings } from '../api/store';
import type { RestaurantSettings, RestaurantSettingsUpdate } from '../api/types';

/**
 * As configurações do RESTAURANTE (não da filial).
 *
 * Abrir/fechar a loja mora aqui junto com o resto porque é o mesmo recurso do
 * outro lado — a resposta do `store-status` traz as configurações inteiras
 * atualizadas. Mas ela tem estado de "salvando" PRÓPRIO: com um só, clicar em
 * fechar a loja travaria os campos do formulário, e salvar o formulário
 * travaria o botão de fechar.
 */
export function useStoreSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
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

  const toggleOpen = useCallback(async (isOpen: boolean): Promise<boolean> => {
    setIsTogglingOpen(true);
    setErrorMessage(null);
    try {
      setSettings(await setStoreOpen(isOpen));
      return true;
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      return false;
    } finally {
      setIsTogglingOpen(false);
    }
  }, []);

  return {
    settings,
    isLoading,
    isSaving,
    isTogglingOpen,
    errorMessage,
    savedAt,
    reload,
    save,
    toggleOpen,
    dismissError: useCallback(() => setErrorMessage(null), []),
  };
}
