import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchBranchOperation, setBranchOpen } from '../api/store';
import type { BranchOperation } from '../api/types';

/**
 * O ESTADO DO DIA DA LOJA — e ele é de cada filial, sem herança.
 *
 * Abrir/fechar deixou de ser do restaurante. Não existe padrão a herdar aqui,
 * de propósito: "o restaurante está fechado mas esta filial está aberta" não é
 * um estado que a operação consiga ler, e a única resposta possível é a da
 * própria loja.
 *
 * O hook é UM só para os dois consumidores, e a diferença entre eles é o
 * `branchId`:
 *
 *   - Minha loja passa a filial adotada e opera sobre ela;
 *   - o quadro de Pedidos passa o filtro do cabeçalho, que pode ser vazio
 *     ("todas as filiais") — e aí ele só LÊ, sem botão para clicar.
 *
 * Uma chamada por tela: `GET /admin/branches/operation` já monta a lista
 * inteira, e o `branch_id` só restringe.
 */
export function useBranchOperation(branchId: string) {
  const [branches, setBranches] = useState<BranchOperation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setBranches(await fetchBranchOperation(branchId || undefined));
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleOpen = useCallback(
    async (isOpen: boolean): Promise<boolean> => {
      // Sem filial não há o que abrir: quem chama isto é uma tela que já
      // resolveu uma (ver `useAdoptedBranch`).
      if (branchId === '') return false;

      setIsTogglingOpen(true);
      setErrorMessage(null);
      try {
        // A resposta é a linha já gravada, com `is_open_now` recalculado: a
        // tela adota o que o backend devolveu em vez de confiar no que mandou.
        const gravada = await setBranchOpen(branchId, isOpen);
        setBranches((atuais) =>
          (atuais ?? []).map((linha) => (linha.branch_id === gravada.branch_id ? gravada : linha)),
        );
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        setIsTogglingOpen(false);
      }
    },
    [branchId],
  );

  return {
    /** Todas as linhas que a chamada trouxe. */
    branches,
    /** A linha da filial pedida. Nula com "todas as filiais" ou antes de carregar. */
    branch:
      branchId === '' ? null : (branches?.find((linha) => linha.branch_id === branchId) ?? null),
    isLoading,
    isTogglingOpen,
    errorMessage,
    reload,
    toggleOpen,
  };
}
