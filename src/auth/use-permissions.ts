import { useMemo } from 'react';

import { pode, podeDefinirPreco, podeLerDinheiro, type Acao, type Papel } from './permissions';
import { useSession } from './session-context';

export type Permissoes = {
  papel: Papel | null;
  /** `pode('cardapio.criarProduto')` — a pergunta que a tela faz. */
  pode: (acao: Acao) => boolean;
  /** O campo de preço do cardápio. Regra de CORPO, não de rota. */
  podeDefinirPreco: boolean;
  /** Faturamento: o dono sempre; a gerência só com uma filial escolhida. */
  podeLerDinheiro: (branchId: string) => boolean;
};

/**
 * O QUE ESTE LOJISTA PODE APERTAR.
 *
 *   const { pode } = usePermissoes();
 *   {pode('cardapio.criarProduto') ? <button>Novo item</button> : null}
 *
 * Fica fora de `permissions.ts` pelo mesmo motivo de `use-branch-scope.ts`
 * estar fora de `branch-scope.ts`: aquele arquivo é a TABELA — dado puro, sem
 * React — e é importado por testes que não montam componente nenhum.
 *
 * O PAPEL SAI DA SESSÃO, e a sessão o recarrega a cada `/admin/auth/me`. É a
 * mesma garantia que o backend dá do lado dele: rebaixar alguém no banco vale
 * na hora, sem esperar as 12 horas do token expirarem.
 */
export function usePermissoes(): Permissoes {
  const { papel } = useSession();

  return useMemo(
    () => ({
      papel,
      pode: (acao: Acao) => pode(papel, acao),
      podeDefinirPreco: podeDefinirPreco(papel),
      podeLerDinheiro: (branchId: string) => podeLerDinheiro(papel, branchId),
    }),
    [papel],
  );
}
