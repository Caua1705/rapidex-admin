/**
 * Os dois jeitos de uma tela pedir a filial sobre a qual ela grava.
 *
 * Ficam fora de `branch-scope.ts` porque aquele arquivo é a TABELA — dado puro,
 * sem React — e é importado por testes que não montam componente nenhum.
 */
import { useEffect } from 'react';

import { resolveBranch } from './branch-scope';
import { useSession } from './session-context';
import type { Branch } from '../api/types';

export type ResolvedBranch = {
  /** O id para mandar no path. Vazio só quando o lojista não enxerga filial. */
  branchId: string;
  branch: Branch | null;
  /** O lojista não escolheu esta filial: o painel resolveu por ele. */
  isAutoResolved: boolean;
  /**
   * Há mais de uma filial no escopo, então dizer QUAL acrescenta informação.
   *
   * Com uma filial só não há escolha a fazer, e nomeá-la seria escrever na
   * tela uma coisa que não distingue nada — a mesma regra do "DISPONÍVEL" ao
   * lado de um interruptor ligado (§8 da skill de design).
   */
  hasChoice: boolean;
};

/**
 * A filial de UM CONTROLE que grava por filial, dentro de uma tela que lê
 * várias.
 *
 * É o caso do ajuste de preparo no quadro de pedidos: o quadro mostra as duas
 * lojas, e o controle empurra dez minutos numa. Ele resolve a filial para si e
 * DIZ QUAL É, sem tocar no seletor do topo — adotá-la ali filtraria o quadro
 * inteiro para uma loja, que é o oposto do que o lojista pediu ao deixar
 * "todas" escolhida.
 */
export function useResolvedBranch(): ResolvedBranch {
  const { branches, activeBranchId } = useSession();
  const branch = resolveBranch(branches, activeBranchId);

  return {
    branchId: branch?.id ?? '',
    branch,
    isAutoResolved: activeBranchId === '' && branch !== null,
    hasChoice: branches.length > 1,
  };
}

/**
 * A filial de uma TELA INTEIRA que grava por filial — as seções de Minha loja.
 *
 * Aqui a resolução é ADOTADA no seletor do topo, e é essa a diferença para o
 * hook acima: a tela inteira passou a falar de uma filial, então o cabeçalho
 * precisa dizer a mesma coisa. Duas afirmações opostas na mesma tela ("Todas
 * as filiais (2)" em cima de um formulário que grava só na Matriz) é o defeito
 * que `layout/branch-heading.ts` já existiu para matar de outro jeito.
 *
 * A adoção é reversível pelo caminho normal: o seletor do topo continua
 * trocando de filial, e ele deixa de oferecer "Todas as filiais" enquanto uma
 * destas telas está aberta (ver `branchScopeForPath`).
 *
 * `adotar` existe para a tela que mostra TODAS as filiais dentro deste mesmo
 * layout — a Operação de Minha loja. Lá a adoção seria a contradição que este
 * hook existe para evitar, ao contrário: o cabeçalho diria "Matriz Aldeota" em
 * cima de uma lista com as cinco lojas. A filial resolvida continua vindo (as
 * outras seções do layout dependem dela); o que não acontece é a escrita no
 * seletor do topo.
 */
export function useAdoptedBranch(adotar = true): ResolvedBranch {
  const { activeBranchId, selectBranch } = useSession();
  const resolved = useResolvedBranch();
  const { branchId } = resolved;

  useEffect(() => {
    if (adotar && activeBranchId === '' && branchId !== '') selectBranch(branchId);
  }, [adotar, activeBranchId, branchId, selectBranch]);

  return resolved;
}
