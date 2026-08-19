import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchBranchOperation, setBranchOpen, setBranchOrderTypes } from '../api/store';
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
 * `is_open` era um só —, e é por isso que `toggle` recebe a filial em vez de
 * fechá-la num id resolvido lá em cima.
 *
 * `branchId` só RESTRINGE a leitura: vazio traz todas as filiais que o token
 * alcança, que é uma só para quem está preso a uma filial. Minha loja lê tudo;
 * o quadro de Pedidos passa o filtro do cabeçalho.
 *
 * O QUE ESTÁ SALVANDO É POR CONTROLE, e o que falhou é por FILIAL. Com um
 * estado só, fechar a Aldeota travaria o interruptor das outras quatro; com um
 * por filial, desligar a entrega travaria a chave de abrir da mesma linha
 * enquanto a rede responde. O erro fica por filial de propósito: a linha tem um
 * lugar só para dizer o que aconteceu.
 */

/** Os três interruptores de uma linha. Cada um vai por uma rota. */
export type OperationField = 'is_open' | 'accepts_delivery' | 'accepts_pickup';

const chave = (branchId: string, campo: OperationField) => `${branchId}#${campo}`;
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

  /**
   * Liga ou desliga UM dos três interruptores de UMA filial.
   *
   * As duas rotas são separadas no backend porque os gestos são diferentes —
   * fechar a loja é do balcão, desligar a entrega é da gerência —, mas as duas
   * respondem a linha de operação inteira, e por isso a tela trata as três
   * chaves pelo mesmo caminho.
   */
  const toggle = useCallback(
    async (alvo: string, campo: OperationField, valor: boolean): Promise<boolean> => {
      if (alvo === '') return false;

      setSaving((atuais) => [...atuais, chave(alvo, campo)]);
      setErrors(({ [alvo]: _descartado, ...resto }) => resto);
      try {
        // A resposta é a linha já gravada, com `is_open_now` recalculado: a tela
        // adota o que o backend devolveu em vez de confiar no que mandou.
        //
        // O corpo do order-types leva SÓ o campo que mudou: mandar os dois
        // reenviaria por cima do que outra aba acabou de gravar.
        const gravada =
          campo === 'is_open'
            ? await setBranchOpen(alvo, valor)
            : await setBranchOrderTypes(alvo, { [campo]: valor });
        setBranches((atuais) =>
          (atuais ?? []).map((linha) => (linha.branch_id === alvo ? gravada : linha)),
        );
        return true;
      } catch (error) {
        setErrors((atuais) => ({ ...atuais, [alvo]: messageFromUnknownError(error) }));
        return false;
      } finally {
        setSaving((atuais) => atuais.filter((id) => id !== chave(alvo, campo)));
      }
    },
    [],
  );

  return {
    /** Uma linha por filial que o token alcança, na ordem do backend. */
    branches,
    isLoading,
    /** O que impediu a LEITURA. Erro de gravação é por filial, em `errorFor`. */
    loadError,
    reload,
    toggle,
    /** A linha de uma filial, ou nula: antes de carregar, ou fora do escopo. */
    branchOf: useCallback(
      (id: string) => (branches ?? []).find((linha) => linha.branch_id === id) ?? null,
      [branches],
    ),
    isSaving: useCallback(
      (id: string, campo: OperationField) => saving.includes(chave(id, campo)),
      [saving],
    ),
    errorFor: useCallback((id: string) => errors[id] ?? null, [errors]),
  };
}
