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
import type { Courier, CourierCreate, CourierFee, CourierFeeUpdate, CourierUpdate } from './types';

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
