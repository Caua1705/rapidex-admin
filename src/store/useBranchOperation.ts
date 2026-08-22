import { useCallback, useEffect, useState } from 'react';

import { ApiError, messageFromUnknownError } from '../api/errors';
import {
  fetchBranchOperation,
  pauseDelivery,
  setBranchOpen,
  setBranchOrderTypes,
  updateBranchSettings,
} from '../api/store';
import type { BranchOperation, BranchSettingsUpdate } from '../api/types';

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

/**
 * O que se grava numa filial por aqui.
 *
 * Os três primeiros são os interruptores da linha de Operação; `settings` é o
 * formulário de valores, que é outra rota e outra tela mas responde a MESMA
 * linha — por isso ele atualiza este mesmo estado em vez de ter cópia própria.
 */
export type OperationField =
  | 'is_open'
  | 'accepts_delivery'
  | 'accepts_pickup'
  | 'settings'
  /** A pausa temporária da entrega — rota própria, e não um dos interruptores. */
  | 'pause';

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

  /**
   * PAUSA (ou RETOMA) A ENTREGA DE UMA FILIAL.
   *
   * `minutos: 0` retoma na hora — é o botão de quem parou por 60 minutos e
   * resolveu em 20. A resposta é a linha inteira, com `accepts_delivery_now` já
   * recalculado: a tela adota o que o backend devolveu em vez de deduzir o novo
   * estado do que mandou.
   *
   * Ela NÃO mexe em `accepts_delivery`. As duas coisas convivem de propósito: a
   * chave é estrutural e espera alguém religar, a pausa vence no relógio.
   */
  const pause = useCallback(
    async (alvo: string, minutos: number, motivo: string): Promise<boolean> => {
      if (alvo === '') return false;

      setSaving((atuais) => [...atuais, chave(alvo, 'pause')]);
      setErrors(({ [alvo]: _descartado, ...resto }) => resto);
      try {
        const gravada = await pauseDelivery(alvo, {
          minutes: minutos,
          ...(motivo.trim() ? { reason: motivo.trim() } : {}),
        });
        setBranches((atuais) =>
          (atuais ?? []).map((linha) => (linha.branch_id === alvo ? gravada : linha)),
        );
        return true;
      } catch (error) {
        setErrors((atuais) => ({ ...atuais, [alvo]: messageFromUnknownError(error) }));
        return false;
      } finally {
        setSaving((atuais) => atuais.filter((id) => id !== chave(alvo, 'pause')));
      }
    },
    [],
  );

  /**
   * As sobrescritas comerciais de uma filial.
   *
   * Mora no mesmo hook que os interruptores porque a resposta é a mesma linha
   * de operação: gravar o valor mínimo aqui e ver o `effective` velho na tela
   * de Operação seria a divergência que duas cópias de estado sempre produzem.
   */
  const saveSettings = useCallback(
    async (alvo: string, body: BranchSettingsUpdate): Promise<boolean> => {
      if (alvo === '') return false;

      setSaving((atuais) => [...atuais, chave(alvo, 'settings')]);
      setErrors(({ [alvo]: _descartado, ...resto }) => resto);
      try {
        const gravada = await updateBranchSettings(alvo, body);
        setBranches((atuais) =>
          (atuais ?? []).map((linha) => (linha.branch_id === alvo ? gravada : linha)),
        );
        return true;
      } catch (error) {
        /*
         * O 403 AQUI É RESPOSTA ESPERADA, não falha. A rota é SOMENTE_DONO: são
         * os mesmos números com que a rede negocia, e deixá-los na gerência
         * daria por filial a permissão que se recusou dar no restaurante. O
         * gerente precisa ler por que o botão não funcionou, não um "erro".
         */
        const mensagem =
          error instanceof ApiError && error.status === 403
            ? 'Só o dono do restaurante muda estes valores.'
            : messageFromUnknownError(error);
        setErrors((atuais) => ({ ...atuais, [alvo]: mensagem }));
        return false;
      } finally {
        setSaving((atuais) => atuais.filter((id) => id !== chave(alvo, 'settings')));
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
    saveSettings,
    pause,
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
