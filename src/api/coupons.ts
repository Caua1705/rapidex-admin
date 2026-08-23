/**
 * Chamadas da tela de Cupons.
 *
 * QUATRO ROTAS, E A ASSIMETRIA DE PAPEL É A MESMA DO CASHBACK:
 *
 *   GET   /admin/coupon-templates   GERENCIA      o catálogo de ARTE da plataforma
 *   GET   /admin/coupons            GERENCIA      as campanhas desta loja
 *   POST  /admin/coupons            SOMENTE_DONO  criar
 *   PATCH /admin/coupons/{id}       SOMENTE_DONO  editar — e desligar
 *
 * Ler é da gerência porque quem toca a loja precisa saber qual campanha está no
 * ar para responder ao cliente que ligou; escrever é do dono porque um cupom de
 * 99% pela porta ao lado vale o mesmo que o preço do cardápio. É o que o
 * próprio router do backend diz, e é o mesmo raciocínio de `api/cashback.ts`.
 *
 * NÃO EXISTE DELETE, e não é lacuna. Cupom não se apaga: `coupon_redemptions`
 * referencia a linha, e o pedido de ontem precisa continuar sabendo qual
 * campanha o descontou. Desligar é `PATCH { is_active: false }`.
 *
 * NENHUMA DAS DUAS LEITURAS ACEITA QUERY. Filtro de situação e de tipo é da
 * TELA, sobre a lista inteira que já está na mão — ver `coupons/coupon-model.ts`.
 * Também não há `branch_id` em lugar nenhum: cupom é do restaurante inteiro e
 * vale em todas as lojas (`coupons.py`: "cupom nao tem filial").
 */
import { apiClient, unwrap } from './client';
import type { Coupon, CouponCreate, CouponTemplate, CouponUpdate } from './types';

/**
 * O catálogo de artes da plataforma — SÓ AS ATIVAS.
 *
 * `list_active_templates` filtra por `is_active`, e essa ausência é o que a
 * tela usa para descobrir que a arte de uma campanha saiu do ar: um
 * `coupon_template_id` sem par nesta lista não é dado faltando, é a arte
 * desativada pela plataforma. Ver `arteDesativada` em `coupons/coupon-model.ts`.
 *
 * A lista vem inteira, sem recorte: os templates são da PLATAFORMA, não do
 * restaurante — não há coluna `restaurant_id` neles.
 */
export async function listCouponTemplates(): Promise<CouponTemplate[]> {
  return unwrap(await apiClient.GET('/admin/coupon-templates'));
}

/** As campanhas deste restaurante, ativas e desligadas, sem recorte nenhum. */
export async function listCoupons(): Promise<Coupon[]> {
  return unwrap(await apiClient.GET('/admin/coupons'));
}

/**
 * Cria a campanha.
 *
 * `discount_type` e `discount_value` VÃO NO CORPO e não são escolha do lojista:
 * eles saem da arte. Ver `bodyFrom` em `coupons/coupon-model.ts`, que é o único
 * lugar que os monta — o backend confere o TIPO contra o template, mas não
 * confere o VALOR, e é por isso que a trava mora do nosso lado.
 */
export async function createCoupon(body: CouponCreate): Promise<Coupon> {
  return unwrap(await apiClient.POST('/admin/coupons', { body }));
}

/**
 * Edita a campanha — e é também a única forma de desligá-la.
 *
 * O PATCH é parcial no contrato, mas o backend REVALIDA A MESCLA inteira
 * (`update_admin`: `CouponCampaignFields.model_validate(merged)`). Duas
 * consequências que a tela não pode ignorar:
 *
 *   - um corpo de um campo só pode ser recusado por um campo que ele nem
 *     tocou — daí `bodyFrom` mandar a campanha inteira, sempre;
 *   - a arte é conferida no RESULTADO da mescla, então um cupom pendurado numa
 *     arte que a plataforma desativou responde 400 a QUALQUER patch, inclusive
 *     `{ is_active: false }`. A saída é mandar a arte nova junto, na mesma
 *     chamada — que é o que o diálogo obriga a fazer.
 */
export async function updateCoupon(couponId: string, body: CouponUpdate): Promise<Coupon> {
  return unwrap(
    await apiClient.PATCH('/admin/coupons/{coupon_id}', {
      params: { path: { coupon_id: couponId } },
      body,
    }),
  );
}
