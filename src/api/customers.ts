/** Chamadas da tela de clientes. */
import { apiClient, unwrap } from './client';
import type { CustomerListResponse, CustomerSegment } from './types';

/**
 * Filtros da tela.
 *
 * `branchId` vazio = todas as filiais que o lojista enxerga — o backend já
 * limita pelo escopo do token (§4.3 da skill de API), então "todas" nunca
 * alcança outro restaurante.
 *
 * `search` é uma coisa só no contrato: "Telefone (só dígitos) ou parte do
 * nome". Não são dois campos.
 *
 * ----------------------------------------------------------------------------
 * OS CINCO CRITÉRIOS, E A COISA QUE NÃO SE PODE ESQUECER SOBRE ELES
 * ----------------------------------------------------------------------------
 *
 * Eles valem **antes do `LIMIT`**, no SQL, e o `total` do envelope conta o que
 * sobrou depois deles. Uma base com trinta clientes em risco e `limit=50`
 * devolve `total: 30`; com `limit=2`, devolve `total: 30` e dois itens. É
 * paginação de verdade sobre o recorte filtrado.
 *
 * Por isso a tela **não repete a peneira**: filtrar o array recebido daria "os
 * em risco das 50 linhas baixadas" com cara de resposta sobre a base inteira, e
 * um `total` que não bate com nada. Ver `customers/customer-filters.ts`.
 *
 * `segment` recebe UM código, nunca uma lista — o contrato não aceita mais de
 * uma classe por vez.
 *
 * As duas datas são AAAA-MM-DD no dia da OPERAÇÃO (`America/Fortaleza`) e
 * `lastOrderTo` é INCLUSIVO: quem pediu hoje às 23h entra num recorte que
 * termina hoje.
 *
 * Os dois tickets vão como STRING de duas casas, e não como `number`: do outro
 * lado é `Decimal`, e um 50,10 que atravessa como `float` pode chegar
 * 50,099999 e recortar uma linha de menos sem nada acender.
 *
 * INTERVALO INVERTIDO — data ou ticket — responde **400**, não lista vazia. A
 * tela confere antes de chamar (`filterProblem`), e o 400 continua tratado como
 * qualquer erro: ele é a rede, não o caminho.
 */
export type CustomerFilters = {
  branchId?: string;
  search?: string;
  segment?: CustomerSegment;
  lastOrderFrom?: string;
  lastOrderTo?: string;
  minTicket?: string;
  maxTicket?: string;
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
          /*
           * CADA CRITÉRIO OU VAI PREENCHIDO OU NÃO VAI. Mandar `segment: ''` ou
           * `min_ticket: null` não é o mesmo que omitir: o primeiro é 422 (não
           * está entre os cinco códigos) e o segundo faz o endereço carregar um
           * parâmetro que só diz "nada aqui". Ausência é como o contrato
           * escreve "sem recorte".
           */
          ...(filters.branchId ? { branch_id: filters.branchId } : {}),
          ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
          ...(filters.segment ? { segment: filters.segment } : {}),
          ...(filters.lastOrderFrom ? { last_order_from: filters.lastOrderFrom } : {}),
          ...(filters.lastOrderTo ? { last_order_to: filters.lastOrderTo } : {}),
          ...(filters.minTicket ? { min_ticket: filters.minTicket } : {}),
          ...(filters.maxTicket ? { max_ticket: filters.maxTicket } : {}),
          limit,
          offset,
        },
      },
    }),
  );
}
