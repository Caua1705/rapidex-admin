import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchRestaurantProfile, updateRestaurantProfile } from '../api/store';
import type { RestaurantProfile, RestaurantProfileUpdate } from '../api/types';

/**
 * O perfil do restaurante — a marca, não os padrões que a filial herda.
 *
 * ELE NÃO SOBE PARA O `StoreLayout`, ao contrário de `useStoreSettings` e
 * `useBranchDetail`. Aqueles moram lá porque DUAS seções os dividem (Geral e
 * Valores; Filial e Entrega), e duas cópias divergiriam assim que uma das
 * páginas gravasse. Este recurso tem uma consumidora só, e um hook no layout é
 * uma leitura de API em toda seção de Loja para alimentar uma delas.
 *
 * A leitura é `PESSOAS` e a gravação é `SOMENTE_DONO` — mas a seção inteira já
 * exige `loja.editarMarca`, então quem chega aqui pode as duas.
 */
export function useRestaurantProfile() {
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setProfile(await fetchRestaurantProfile());
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (patch: RestaurantProfileUpdate): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // A resposta é o perfil inteiro já gravado: a tela adota o que o backend
      // devolveu em vez de confiar no que mandou. É o que faz o campo legado
      // que ficou de fora do corpo reaparecer como ele realmente está.
      setProfile(await updateRestaurantProfile(patch));
      setSavedAt(Date.now());
      return true;
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { profile, isLoading, isSaving, errorMessage, savedAt, reload, save };
}
