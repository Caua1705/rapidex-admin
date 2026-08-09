import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchBranch, updateBranch } from '../api/store';
import type { Branch, BranchUpdate } from '../api/types';

/**
 * A filial aberta na tela, com cadastro e regras de entrega.
 *
 * As abas Filial e Entrega compartilham este hook porque compartilham o
 * recurso: os dois formulários salvam pelo mesmo `PATCH /admin/branches/{id}`,
 * cada um mandando só os seus campos. Dois hooks separados leriam a mesma
 * filial duas vezes e, pior, guardariam duas cópias que divergem assim que uma
 * das abas salvasse.
 *
 * `branchId` vazio ("Todas as filiais" no cabeçalho) não carrega nada: não
 * existe filial a editar, e a tela mostra o estado que pede para escolher uma.
 */
export function useBranchDetail(branchId: string) {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!branchId) {
      setBranch(null);
      setErrorMessage(null);
      return;
    }

    // Trocar de filial no cabeçalho não pode deixar o cadastro da anterior na
    // tela enquanto o novo carrega: o lojista editaria a loja errada.
    let cancelled = false;
    setBranch(null);
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const loaded = await fetchBranch(branchId);
        if (!cancelled) setBranch(loaded);
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

  const save = useCallback(
    async (patch: BranchUpdate): Promise<boolean> => {
      if (!branchId) return false;
      setIsSaving(true);
      setErrorMessage(null);
      try {
        setBranch(await updateBranch(branchId, patch));
        setSavedAt(Date.now());
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

  return { branch, isLoading, isSaving, errorMessage, savedAt, save };
}
