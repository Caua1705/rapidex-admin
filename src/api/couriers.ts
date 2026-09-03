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
import { apiClient, unwrap } from './client';
import type { CourierFee, CourierFeeUpdate } from './types';

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
