/**
 * O que o cabeçalho diz sobre a filial, a partir do estado real da sessão.
 *
 * Fica fora do `.tsx` pelo mesmo motivo do `session-context`: o Fast Refresh do
 * Vite só preserva estado num arquivo que exporta apenas componentes.
 *
 * O DEFEITO QUE ESTE ARQUIVO EXISTE PARA MATAR: o nome no topo vinha de
 * `restaurantLabel`, que é o nome da filial PRINCIPAL (ver
 * `auth/restaurant-label.ts` — nenhuma rota devolve o nome do restaurante). Com
 * "todas as filiais" escolhidas, o cabeçalho mostrava "Matriz" em cima de
 * "Todas as filiais · 2": duas afirmações opostas, e a de cima era a errada.
 */
import type { Branch } from '../api/types';

/** Endereço em uma linha, pulando o que o backend não mandou. */
export function branchAddressLine(branch: Branch): string {
  return [branch.address, branch.neighborhood, branch.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
}

export function branchName(branch: Branch): string {
  return branch.display_name?.trim() || branch.name;
}

export type BranchHeading = { name: string; detail: string };

/**
 * São só três estados, e cada um afirma uma coisa só:
 *
 *   - uma filial escolhida → nome dela e endereço dela;
 *   - nenhuma escolhida, várias existem → "Todas as filiais (N)", sem nome de
 *     filial embaixo, porque não há uma;
 *   - uma filial só no escopo → ela mesma, escolhida ou não: "todas" e "a
 *     única" são o mesmo lugar, e "Todas as filiais (1)" seria pedante.
 */
export function branchHeading(branches: readonly Branch[], activeBranchId: string): BranchHeading {
  const active = branches.find((branch) => branch.id === activeBranchId) ?? null;
  const shown = active ?? (branches.length === 1 ? branches[0]! : null);

  if (shown) return { name: branchName(shown), detail: branchAddressLine(shown) };
  if (branches.length === 0) return { name: '—', detail: '' };
  return { name: `Todas as filiais (${branches.length})`, detail: '' };
}
