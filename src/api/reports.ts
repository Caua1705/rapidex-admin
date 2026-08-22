/**
 * Chamadas das telas de relatório — Desempenho e Funil.
 *
 * SÃO SETE ROTAS, E A SÉTIMA É DE OUTRA NATUREZA. As seis primeiras medem
 * DINHEIRO de quem comprou, e é literalmente o que existe: não há relatório por
 * hora — o mais fino é o dia. A sétima (`/reports/funnel`) é a única que
 * enxerga quem NÃO comprou, não tem um número de dinheiro dentro e por isso não
 * passa pela regra de escopo das outras — ver o bloco dela lá embaixo.
 *
 * AS SEIS PASSARAM A ACEITAR `branch_id`, e este arquivo dizia o contrário até
 * agora ("NENHUMA delas aceita"). Era verdade quando foi escrito e deixou de
 * ser na revisão `20260820_0026` do backend. A diferença não é conforto de
 * filtro: sem o parâmetro, `ensure_pode_ler_dinheiro` responde **403 ao
 * gerente**, porque sem recorte "ler o faturamento" significa ler o do
 * restaurante inteiro — e o resultado da Aldeota não é do gerente do Centro.
 *
 * Vazio continua sendo "todas as filiais que o token alcança", e é o que o dono
 * lê. O filtro só RESTRINGE, nunca amplia.
 *
 * O PERÍODO É OBRIGATÓRIO nas seis (`start_date` e `end_date` não são
 * opcionais no contrato), e as datas são AAAA-MM-DD no dia da OPERAÇÃO
 * (America/Fortaleza), não no do navegador. Quem monta o par é
 * `performance/report-model.ts`.
 */
import { apiClient, unwrap } from './client';
import type {
  Cancellations,
  CommissionReport,
  FunnelReport,
  ProductSales,
  ReportPaymentMethods,
  SalesByDay,
  SalesSummary,
} from './types';

/** O período e o recorte que toda rota daqui recebe. */
export type ReportRange = {
  startDate: string; // AAAA-MM-DD
  endDate: string; // AAAA-MM-DD
  /** Vazio = todas as filiais que o token alcança. Só o dono lê assim. */
  branchId: string;
  /**
   * O identificador de origem — o rótulo do QR ou do link por onde a pessoa
   * chegou (`qr-mesa-04`, `imã-geladeira`).
   *
   * VAZIO É "TODAS AS ORIGENS", E NUNCA "as sem origem": quem chega sem
   * identificador tem `direct` GRAVADO no pedido, não nulo, e quem quiser só
   * esses passa `source: 'direct'`. O contrato descreve as duas coisas com
   * palavras diferentes de propósito — a distinção entre "veio direto" e "não
   * sabemos" é a que o nulo apagaria.
   *
   * AS SETE ROTAS DAQUI ACEITAM O CAMPO desde a revisão `20260822_0031`. Só o
   * funil o usa hoje, porque só ele tem uma tela que oferece a escolha; as
   * outras seis passam a aceitá-lo no dia em que alguém desenhar esse filtro.
   */
  source?: string;
};

function toQuery(range: ReportRange) {
  return {
    start_date: range.startDate,
    end_date: range.endDate,
    // Omitido, e não `null`: campo ausente é "todas", e é o que o contrato
    // descreve. Mandar nulo explícito seria pedir a mesma coisa por um caminho
    // que a rota não documenta.
    ...(range.branchId ? { branch_id: range.branchId } : {}),
    // Mesma regra do recorte de filial, e pelo mesmo motivo: ausente é
    // "todas", e `null` explícito seria pedir isso por um caminho que a rota
    // não documenta.
    ...(range.source ? { source: range.source } : {}),
  };
}

/**
 * Faturamento, pedidos e ticket médio — com o período anterior de igual
 * tamanho já comparado pelo backend.
 *
 * A tela NÃO recalcula a variação: as três `MetricComparison` vêm prontas, e
 * `change_percent` nulo é informação ("o período anterior foi zero"), não
 * ausência de dado.
 */
export async function fetchSalesSummary(range: ReportRange): Promise<SalesSummary> {
  return unwrap(
    await apiClient.GET('/admin/reports/summary', { params: { query: toQuery(range) } }),
  );
}

/**
 * Faturamento e pedidos dia a dia.
 *
 * Devolve TODOS os dias do período, inclusive os sem venda, com zero — a tela
 * não preenche buraco nenhum, porque não há buraco a preencher.
 */
export async function fetchSalesByDay(range: ReportRange): Promise<SalesByDay> {
  return unwrap(
    await apiClient.GET('/admin/reports/sales-by-day', { params: { query: toQuery(range) } }),
  );
}

/**
 * Quanto entrou por forma de pagamento.
 *
 * `payment_method` nulo é "pedido sem forma registrada" e continua nulo aqui:
 * virar "Outro" seria inventar uma forma de pagamento que existe de verdade no
 * cardápio de opções (ver `PAYMENT_METHOD_LABELS`).
 */
export async function fetchPaymentMethodsReport(range: ReportRange): Promise<ReportPaymentMethods> {
  return unwrap(
    await apiClient.GET('/admin/reports/payment-methods', { params: { query: toQuery(range) } }),
  );
}

/**
 * Ranking de produtos por unidades vendidas.
 *
 * `limit` é o tamanho do ranking, e a tela o escreve na própria seção: um "top
 * 10" que não diz que é top 10 é uma lista que parece completa.
 *
 * `listed_revenue_total` NÃO fecha com o faturamento do resumo — é receita
 * bruta de item, sem cupom, cashback nem taxas. A resposta carrega a ressalva
 * em `revenue_note`, e a tela mostra as duas juntas.
 */
export async function fetchProductSales(range: ReportRange, limit: number): Promise<ProductSales> {
  return unwrap(
    await apiClient.GET('/admin/reports/products', {
      params: { query: { ...toQuery(range), limit } },
    }),
  );
}

/**
 * O outro lado do faturamento: cancelados, recusados e estornados.
 *
 * A taxa é sobre TODOS os pedidos do período (faturados + excluídos), não só
 * sobre os faturados — quem quiser recalcular na tela vai achar outro número.
 */
export async function fetchCancellations(range: ReportRange): Promise<Cancellations> {
  return unwrap(
    await apiClient.GET('/admin/reports/cancellations', { params: { query: toQuery(range) } }),
  );
}

/**
 * OS CINCO DEGRAUS DO CARDÁPIO, e a divisão por origem.
 *
 * A ÚNICA ROTA DE RELATÓRIO QUE ENXERGA QUEM NÃO COMPROU, e a única que NÃO
 * passa por `ensure_pode_ler_dinheiro`: não há um número de dinheiro na
 * resposta, e por isso a gerência a lê sem escolher filial antes — ao
 * contrário das seis acima. Quem toca o balcão de uma loja é quem consegue
 * agir sobre "o carrinho enche e o checkout esvazia".
 *
 * DUAS PROPRIEDADES DA RESPOSTA QUE A TELA NÃO PODE CONTRARIAR:
 *
 * 1. **`orders_count` NÃO fecha com o de `/reports/summary`**, e é de
 *    propósito: o funil conta pedido cancelado e recusado, porque ele mede se
 *    a PESSOA terminou de pedir — a loja recusar meia hora depois é outro
 *    problema, com outra solução. A ressalva vem pronta em `orders_note`, na
 *    mesma forma do `revenue_note` de `/reports/products`, e a tela a escreve.
 *
 * 2. **`sources` lista TODAS as origens do período mesmo com `source`
 *    preenchido.** Filtrada, ela teria uma linha só e não responderia nada. O
 *    filtro recorta os DEGRAUS; a divisão por origem continua inteira — e é o
 *    que permite ao seletor de origem da tela sair da própria resposta.
 *
 * O PERÍODO ÚTIL É MENOR QUE O DAS OUTRAS SEIS. O teto de 92 dias vale igual,
 * mas o evento de funil é apagado aos 90 (retenção): um recorte que comece
 * antes disso devolve degraus vazios com o quinto cheio, porque o pedido fica
 * para sempre e o evento não. Quem monta o par é `funnel/funnel-model.ts`, e é
 * ele que impede a tela de pedir o que o banco já apagou.
 */
export async function fetchFunnelReport(range: ReportRange): Promise<FunnelReport> {
  return unwrap(
    await apiClient.GET('/admin/reports/funnel', { params: { query: toQuery(range) } }),
  );
}

/**
 * A comissão da plataforma no período, com extrato pedido a pedido.
 *
 * SEM PAGINAÇÃO NO CONTRATO: `orders[]` vem inteiro, e num período de 30 dias
 * isso são todos os pedidos faturados. Quem exibe decide quantas linhas põe na
 * tela — e diz quantas ficaram de fora.
 */
export async function fetchCommissionReport(range: ReportRange): Promise<CommissionReport> {
  return unwrap(
    await apiClient.GET('/admin/reports/commission', { params: { query: toQuery(range) } }),
  );
}
