import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchBranchOperation, setBranchOpen } from '../api/store';
import type { BranchOperation } from '../api/types';

/**
 * O ESTADO DO DIA DAS FILIAIS — e ele é de cada uma, sem herança.
 *
 * Abrir/fechar deixou de ser do restaurante. Não existe padrão a herdar aqui,
 * de propósito: "o restaurante está fechado mas esta filial está aberta" não é
 * um estado que a operação consiga ler, e a única resposta possível é a da
 * própria loja.
 *
 * O hook guarda a LISTA, não uma filial. É o que permite ao dono de cinco lojas
 * ver as cinco chaves lado a lado — a conferência que não existia enquanto o
 * `is_open` era um só —, e é por isso que `toggleOpen` recebe a filial em vez
 * de fechá-la num id resolvido lá em cima.
 *
 * `branchId` só RESTRINGE a leitura: vazio traz todas as filiais que o token
 * alcança, que é uma só para quem está preso a uma filial. Minha loja lê tudo;
 * o quadro de Pedidos passa o filtro do cabeçalho.
 *
 * O QUE ESTÁ SALVANDO E O QUE FALHOU SÃO POR FILIAL. Com um estado só, fechar
 * a Aldeota travaria o interruptor das outras quatro, e o erro dela apareceria
 * na linha de todas.
 */
export function useBranchOperation(branchId: string) {
  const [branches, setBranches] = useState<BranchOperation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setBranches(await fetchBranchOperation(branchId || undefined));
    } catch (error) {
      setLoadError(messageFromUnknownError(error));
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleOpen = useCallback(async (alvo: string, isOpen: boolean): Promise<boolean> => {
    if (alvo === '') return false;

    setSaving((atuais) => [...atuais, alvo]);
    setErrors(({ [alvo]: _descartado, ...resto }) => resto);
    try {
      // A resposta é a linha já gravada, com `is_open_now` recalculado: a tela
      // adota o que o backend devolveu em vez de confiar no que mandou.
      const gravada = await setBranchOpen(alvo, isOpen);
      setBranches((atuais) =>
        (atuais ?? []).map((linha) => (linha.branch_id === alvo ? gravada : linha)),
      );
      return true;
    } catch (error) {
      setErrors((atuais) => ({ ...atuais, [alvo]: messageFromUnknownError(error) }));
      return false;
    } finally {
      setSaving((atuais) => atuais.filter((id) => id !== alvo));
    }
  }, []);

  return {
    /** Uma linha por filial que o token alcança, na ordem do backend. */
    branches,
    isLoading,
    /** O que impediu a LEITURA. Erro de gravação é por filial, em `errorFor`. */
    loadError,
    reload,
    toggleOpen,
    /** A linha de uma filial, ou nula: antes de carregar, ou fora do escopo. */
    branchOf: useCallback(
      (id: string) => (branches ?? []).find((linha) => linha.branch_id === id) ?? null,
      [branches],
    ),
    isSaving: useCallback((id: string) => saving.includes(id), [saving]),
    errorFor: useCallback((id: string) => errors[id] ?? null, [errors]),
  };
}
