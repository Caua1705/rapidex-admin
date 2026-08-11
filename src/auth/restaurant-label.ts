import type { Branch } from '../api/types';

/**
 * A FILIAL QUE REPRESENTA O RESTAURANTE: a principal (`is_main`) e, na falta
 * dela, a primeira que o lojista enxerga.
 *
 * Este critério nasceu para o rótulo do topo (abaixo), mas ele não é sobre
 * rótulo: é a resposta do painel para "qual filial, quando ninguém escolheu
 * uma". Por isso ele mora aqui sozinho e `auth/branch-scope.ts` o importa em
 * vez de reescrevê-lo — duas cópias divergiriam no dia em que o backend
 * passasse a mandar mais de uma `is_main`, e divergiriam em silêncio.
 */
export function mainBranch(branches: readonly Branch[]): Branch | null {
  return branches.find((branch) => branch.is_main) ?? branches[0] ?? null;
}

/**
 * Como o painel descobre o nome do estabelecimento.
 *
 * NENHUMA rota /admin devolve o nome do restaurante: nem o JWT, nem
 * /admin/auth/me (que só traz restaurant_id), nem /admin/settings. O que
 * existe com nome legível é a filial. Então usamos a filial principal
 * (is_main) e, na falta dela, a primeira que o lojista enxerga.
 *
 * Se o backend um dia expuser `restaurant_name` em /admin/auth/me, este
 * arquivo inteiro sai e o topo passa a ler o campo direto.
 */
export function restaurantLabelFromBranches(branches: Branch[]): string {
  const main = mainBranch(branches);
  if (!main) return '—';

  return main.display_name?.trim() || main.name;
}
