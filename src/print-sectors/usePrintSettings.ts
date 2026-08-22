import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchPrintSettings, updatePrintSettings } from '../api/print-settings';
import type { BranchPrintSettings, BranchPrintSettingsUpdate } from '../api/types';

/**
 * O rodapé e as vias desta filial: o que está gravado, e como gravar.
 *
 * ELE NÃO RELÊ SOZINHO, ao contrário de `usePrintAgent` ao lado — e a diferença
 * é o que cada um mostra. O agente é o estado de um computador em outra sala,
 * que cai sem avisar; isto é configuração que só muda quando alguém a muda.
 * Repergunta periódica aqui atropelaria o formulário que o lojista está
 * preenchendo.
 *
 * A RESPOSTA DO PATCH SUBSTITUI O QUE ESTAVA, e não é economia de uma segunda
 * chamada: o backend NORMALIZA o texto do rodapé na gravação (caractere de
 * controle sai, `\t` vira espaço, linha em branco repetida colapsa), então o
 * que ele guardou pode não ser byte a byte o que foi enviado. Quem chama
 * repinta o campo com isto — a tela mostrando um texto e a bobina imprimindo
 * outro é a divergência que ninguém descobre até o papel sair.
 *
 * A LEITURA É DE QUEM OPERA (`PESSOAS`) e a escrita é da gerência: o 403 do
 * PATCH não é caso de tela, porque a tela não oferece o controle a quem não o
 * alcança. O 403 do GET seria, mas ele não acontece — quem abre Impressão já
 * passa por `PESSOAS`.
 */
export function usePrintSettings(branchId: string) {
  const [settings, setSettings] = useState<BranchPrintSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /** Descarta a resposta de uma filial que já não é a que está na tela. */
  const branchRef = useRef(branchId);
  branchRef.current = branchId;

  useEffect(() => {
    if (!branchId) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setSettings(null);

    void (async () => {
      try {
        const lido = await fetchPrintSettings(branchId);
        if (!cancelled && branchRef.current === branchId) setSettings(lido);
      } catch (error) {
        if (!cancelled) setLoadError(messageFromUnknownError(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const save = useCallback(
    async (body: BranchPrintSettingsUpdate): Promise<boolean> => {
      if (!branchId) return false;
      setIsSaving(true);
      setSaveError(null);
      try {
        setSettings(await updatePrintSettings(branchId, body));
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

  return {
    settings,
    isLoading,
    isSaving,
    loadError,
    saveError,
    savedAt,
    save,
    dismissError: useCallback(() => setSaveError(null), []),
  };
}
