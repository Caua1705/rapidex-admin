/**
 * Chamadas da tela de Desempenho.
 *
 * As seis rotas de relatório do contrato, e é literalmente o que existe: não há
 * relatório por hora (o mais fino é o dia) e NENHUMA delas aceita `branch_id`.
 * Quem lê estes números está lendo todas as filiais que o token alcança — a
 * tela diz isso por escrito, porque o seletor do topo continua visível e não
 * teria efeito aqui.
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
  ProductSales,
  ReportPaymentMethods,
  SalesByDay,
  SalesSummary,
} from './types';

/** O par de datas que toda rota daqui recebe. */
export type ReportRange = {
  startDate: string; // AAAA-MM-DD
  endDate: string; // AAAA-MM-DD
};

function toQuery(range: ReportRange) {
  return { start_date: range.startDate, end_date: range.endDate };
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
