import type { Branch } from '../api/types';

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
  if (branches.length === 0) return '—';

  const main = branches.find((branch) => branch.is_main) ?? branches[0];
  if (!main) return '—';

  return main.display_name?.trim() || main.name;
}
