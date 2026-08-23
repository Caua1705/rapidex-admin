/**
 * Chamadas da tela de Cashback.
 *
 * CINCO ROTAS, E O FORMATO DELAS É DITADO PELA HERANÇA POR LINHA:
 *
 *   GET    /admin/cashback-rules                      GERENCIA      a regra da rede
 *   PUT    /admin/cashback-rules                      SOMENTE_DONO  cria ou substitui
 *   GET    /admin/branches/{id}/cashback-rules        GERENCIA      a que VALE, com `source`
 *   PUT    /admin/branches/{id}/cashback-rules        SOMENTE_DONO  cria a sobrescrita
 *   DELETE /admin/branches/{id}/cashback-rules        SOMENTE_DONO  volta a herdar
 *
 * LER É GERENCIA, ESCREVER É SOMENTE_DONO — o mesmo do cupom, e pelo mesmo
 * motivo: desconto é preço por outra porta. O percentual é termo comercial, não
 * alavanca de balcão, e a senha do balcão é a que mais circula.
 *
 * NÃO EXISTE `DELETE` DA REGRA DO RESTAURANTE, e isso não é lacuna. Apagar a
 * linha da rede PARECE "desligar o cashback de tudo" e não é: a filial com
 * sobrescrita própria e `enabled: true` continua creditando, porque
 * `resolve_cashback_terms` nem olha a linha do restaurante quando a da filial
 * existe. O lojista teria desligado a campanha na tela e continuaria pagando
 * cashback numa loja. Desligar é `enabled: false` no PUT.
 *
 * DINHEIRO E PERCENTUAL SÃO STRING DE DUAS CASAS na resposta (`"10.00"`), e o
 * corpo aceita `number | string`. Quem escreve manda STRING — `Numeric(5,2)`
 * promete duas casas e `10.00` só sobrevive como `"10.00"`: como número JSON
 * ele vira `10.0`. Ver §4.6 da skill de revisão e `cashback/cashback-model.ts`.
 */
import { apiClient, unwrap, unwrapEmpty } from './client';
import type { CashbackRule, CashbackRuleView, CashbackRuleWrite } from './types';

/**
 * A regra padrão da rede — a que toda filial sem sobrescrita herda.
 *
 * Devolve o MESMO envelope da leitura por filial, com `source`, e não 404
 * quando não há regra: aqui ele só pode ser `restaurant` (existe) ou `none`
 * (ninguém configurou). `branch` nunca sai desta rota.
 */
export async function fetchRestaurantCashbackRule(): Promise<CashbackRuleView> {
  return unwrap(await apiClient.GET('/admin/cashback-rules'));
}

export async function replaceRestaurantCashbackRule(
  body: CashbackRuleWrite,
): Promise<CashbackRule> {
  return unwrap(await apiClient.PUT('/admin/cashback-rules', { body }));
}

/**
 * A regra que VALE nesta filial, com `source` dizendo de onde ela veio.
 *
 * É a única leitura que responde "salvar aqui edita ou CRIA?" — ver
 * `CashbackRuleView` em `types.ts`.
 */
export async function fetchBranchCashbackRule(branchId: string): Promise<CashbackRuleView> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/cashback-rules', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

/**
 * Cria ou substitui a sobrescrita desta filial.
 *
 * A PARTIR DAQUI A LOJA PARA DE HERDAR: mudança na regra da rede não a alcança
 * mais, até alguém apagar a sobrescrita. É também como uma loja sai da campanha
 * sozinha — sobrescrita própria com `enabled: false`.
 */
export async function replaceBranchCashbackRule(
  branchId: string,
  body: CashbackRuleWrite,
): Promise<CashbackRule> {
  return unwrap(
    await apiClient.PUT('/admin/branches/{branch_id}/cashback-rules', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

/**
 * Apaga a sobrescrita: a filial volta a herdar a regra da rede.
 *
 * O backend responde 404 quando a filial não tem regra própria — "voltou a
 * herdar agora" e "já herdava" são estados diferentes, e a tela só oferece o
 * botão no primeiro (`source === 'branch'`).
 */
export async function deleteBranchCashbackRule(branchId: string): Promise<void> {
  return unwrapEmpty(
    await apiClient.DELETE('/admin/branches/{branch_id}/cashback-rules', {
      params: { path: { branch_id: branchId } },
    }),
  );
}
