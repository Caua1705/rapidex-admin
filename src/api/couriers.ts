/**
 * ============================================================================
 * O ENTREGADOR — cadastro, acesso, atribuição, e o que a loja paga por corrida
 * ============================================================================
 *
 * Arquivo próprio, e a taxa por corrida entra nele apesar de a rota ser
 * `/admin/branches/{id}/courier-fee`: o que separa os domínios aqui não é o
 * prefixo do caminho, é de que lado do balcão está o dinheiro. `store.ts`
 * cuida do que o CLIENTE vê e paga; isto é o que a LOJA paga ao motoboy, e
 * juntar os dois num arquivo é o primeiro passo para alguém somar um no outro.
 */
import { apiClient, unwrap, unwrapEmpty } from './client';
import type {
  Assignment,
  AssignmentBatch,
  Courier,
  CourierAccess,
  CourierCreate,
  CourierFee,
  CourierFeeUpdate,
  CourierReport,
  CourierUpdate,
  OrderCourier,
} from './types';

/**
 * Quanto esta filial paga ao entregador por corrida.
 *
 * Nunca 404: filial sem taxa responde 200 com os dois campos nulos, e nulo é
 * "sem taxa" — não zero. Ver `couriers/courier-fee.ts`.
 */
export async function fetchCourierFee(branchId: string): Promise<CourierFee> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/courier-fee', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

/**
 * Grava a taxa. Três estados por campo: ausente não mexe, valor grava, `null`
 * explícito apaga.
 *
 * NÃO MEXE EM NENHUMA CORRIDA JÁ ATRIBUÍDA — a taxa é congelada no momento da
 * atribuição (`courier_fee_snapshot`), como `unit_price_snapshot` faz com o
 * preço. A tela diz isso ao lado do botão, porque é a pergunta que o dono faz
 * ao mudar o valor no meio do turno.
 */
export async function updateCourierFee(
  branchId: string,
  body: CourierFeeUpdate,
): Promise<CourierFee> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/courier-fee', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

/**
 * Os entregadores do restaurante, INATIVOS INCLUSIVE — é assim que se religa
 * quem foi desativado. Excluído não aparece.
 *
 * A ORDEM É A DO BACKEND (`ORDER BY name ASC, id ASC`) e a tela não reordena.
 * Refazer a ordenação aqui com `localeCompare` daria uma segunda resposta para
 * a mesma pergunta, e a divergência entre duas telas sobre o mesmo dado é o
 * defeito que a rodada passada passou inteira caçando.
 */
export async function listCouriers(branchId?: string): Promise<Courier[]> {
  return unwrap(
    await apiClient.GET('/admin/couriers', {
      params: { query: branchId ? { branch_id: branchId } : {} },
    }),
  );
}

export async function createCourier(body: CourierCreate): Promise<Courier> {
  return unwrap(await apiClient.POST('/admin/couriers', { body }));
}

/**
 * PATCH parcial: nome, telefone, ativo/inativo.
 *
 * `is_active: false` NÃO É SÓ UM RÓTULO — tira o acesso na hora e devolve à
 * fila os pedidos abertos dele. `true` de volta não reabre nada e não recria o
 * acesso: o par gerado antes continua valendo. A tela diz as duas coisas antes
 * de o lojista clicar.
 */
export async function updateCourier(courierId: string, body: CourierUpdate): Promise<Courier> {
  return unwrap(
    await apiClient.PATCH('/admin/couriers/{courier_id}', {
      params: { path: { courier_id: courierId } },
      body,
    }),
  );
}

/**
 * Exclui: some das listas, perde o acesso na hora, os pedidos abertos voltam
 * para a fila. O HISTÓRICO DE CORRIDAS CONTINUA existindo — é o que o dono usa
 * para pagar —, e o telefone fica livre para um cadastro novo.
 */
export async function deleteCourier(courierId: string): Promise<void> {
  await unwrapEmpty(
    await apiClient.DELETE('/admin/couriers/{courier_id}', {
      params: { path: { courier_id: courierId } },
    }),
  );
}

/**
 * Gera (ou REGENERA) o par link+código do entregador.
 *
 * A RESPOSTA É A ÚNICA VEZ EM QUE OS DOIS EXISTEM EM CLARO. Não há rota que os
 * mostre de novo, e chamar esta de novo mata o par anterior na hora — não há
 * sessão nem token derivado que sobreviva.
 *
 * 409 é entregador INATIVO: seria um par que a porta recusaria de qualquer
 * jeito, e o dono veria "funcionou" numa tela e "não entra" na outra.
 */
export async function generateCourierAccess(courierId: string): Promise<CourierAccess> {
  return unwrap(
    await apiClient.POST('/admin/couriers/{courier_id}/access', {
      params: { path: { courier_id: courierId } },
    }),
  );
}

/**
 * Põe um ou mais pedidos nas mãos deste entregador.
 *
 * A RESPOSTA É POR ITEM, NA ORDEM DO CORPO, e vem 200 mesmo com recusas: um
 * pedido de retirada no meio do lote não pode derrubar os outros quatro que o
 * atendente selecionou. Os `ok` são gravados juntos; os outros não são
 * gravados. Ver `couriers/assignment-model.ts`.
 *
 * REATRIBUIR É CHAMAR ESTA ROTA com outro entregador — a atribuição anterior é
 * fechada e a nova aberta, com a taxa de agora. Atribuir ao mesmo de novo não
 * muda nada, então o clique duplo é inofensivo.
 *
 * Os erros HTTP são do ENTREGADOR, não dos pedidos: 404 fora do escopo, 409
 * inativo, 422 no corpo.
 */
export async function assignOrders(
  courierId: string,
  orderIds: readonly string[],
): Promise<AssignmentBatch> {
  return unwrap(
    await apiClient.POST('/admin/couriers/{courier_id}/assignments', {
      params: { path: { courier_id: courierId } },
      body: { order_ids: [...orderIds] },
    }),
  );
}

/** Os pedidos que estão com este entregador AGORA, do mais antigo ao mais novo. */
export async function listOpenAssignments(courierId: string): Promise<Assignment[]> {
  return unwrap(
    await apiClient.GET('/admin/couriers/{courier_id}/assignments', {
      params: { path: { courier_id: courierId } },
    }),
  );
}

/**
 * Quem está com este pedido.
 *
 * NUNCA 404 PARA "NINGUÉM": os dois campos nulos são 200, e é o estado normal
 * de um pedido que ainda não saiu. O 404 aqui é o pedido que este lojista não
 * alcança — e confundir os dois faria a tela dizer "não encontrado" sobre o
 * pedido que está aberto na frente dela.
 */
export async function fetchOrderCourier(orderId: string): Promise<OrderCourier> {
  return unwrap(
    await apiClient.GET('/admin/orders/{order_id}/courier', {
      params: { path: { order_id: orderId } },
    }),
  );
}

/**
 * Tira o pedido das mãos de quem estiver com ele.
 *
 * 409 SE NINGUÉM ESTIVER, e o contrato explica: é clique repetido ou tela
 * desatualizada, e as duas merecem saber. A linha da atribuição não é apagada —
 * fica fechada, com quem e quando, no histórico que o dono usa para pagar.
 */
export async function unassignOrder(orderId: string): Promise<void> {
  await unwrapEmpty(
    await apiClient.DELETE('/admin/orders/{order_id}/courier', {
      params: { path: { order_id: orderId } },
    }),
  );
}

/**
 * Quanto o restaurante deve a cada entregador no período.
 *
 * OS NÚMEROS BATEM COM O QUE O MOTOBOY VÊ no link dele — é a mesma conta de
 * `GET /courier/{link}/history`, agrupada. Refazê-la aqui daria duas respostas
 * para a mesma pergunta, e a divergência apareceria no balcão.
 *
 * `branch_id` OMITIDO soma o restaurante inteiro; ele só restringe. Quem não é
 * dono precisa mandá-lo (403 sem ele) — `podeLerDinheiro` é quem sabe disso do
 * lado da tela.
 *
 * Até 92 dias: acima, 400 com uma frase. A tela recusa antes.
 */
export async function fetchCourierReport(params: {
  startDate: string;
  endDate: string;
  branchId?: string;
}): Promise<CourierReport> {
  return unwrap(
    await apiClient.GET('/admin/reports/couriers', {
      params: {
        query: {
          start_date: params.startDate,
          end_date: params.endDate,
          ...(params.branchId ? { branch_id: params.branchId } : {}),
        },
      },
    }),
  );
}
