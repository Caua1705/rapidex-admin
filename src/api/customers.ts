/** Chamadas da tela de clientes. */
import { apiClient, unwrap } from './client';
import type { CustomerListResponse } from './types';

/**
 * Filtros da tela.
 *
 * `branchId` vazio = todas as filiais que o lojista enxerga — o backend já
 * limita pelo escopo do token (§4.3 da skill de API), então "todas" nunca
 * alcança outro restaurante.
 *
 * `search` é uma coisa só no contrato: "Telefone (só dígitos) ou parte do
 * nome". Não são dois campos, e não existe um terceiro critério.
 */
export type CustomerFilters = {
  branchId?: string;
  search?: string;
};

/**
 * A lista de quem já comprou nesta loja.
 *
 * É a ÚNICA rota de cliente que o painel tem. Não existe
 * `/admin/customers/{id}` — nem haveria o que passar nele, porque o
 * agrupamento é por telefone e o item não carrega id.
 *
 * A ordem vem pronta do backend (do pedido mais recente para o mais antigo) e
 * a tela não reordena: com paginação, ordenar no cliente ordenaria só a página
 * carregada e o topo da tela deixaria de ser o topo da lista.
 */
export async function listCustomers(
  filters: CustomerFilters,
  limit: number,
  offset: number,
): Promise<CustomerListResponse> {
  return unwrap(
    await apiClient.GET('/admin/customers', {
      params: {
        query: {
          ...(filters.branchId ? { branch_id: filters.branchId } : {}),
          ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
          limit,
          offset,
        },
      },
    }),
  );
}
