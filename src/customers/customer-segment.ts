/**
 * ============================================================================
 * A CLASSIFICAÇÃO RFV — o que o backend manda em código, e o painel escreve
 * ============================================================================
 *
 * `GET /admin/customers` devolve `segment` como CÓDIGO (`em_risco`), nunca
 * como rótulo. É decisão do backend, e uma boa: rótulo em português vindo da
 * API transformaria "trocar Em risco por Sumido" em deploy de backend. O texto
 * visível é daqui.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ, E É O PONTO MAIS IMPORTANTE DELE: ele não
 * CALCULA classificação nenhuma. A fórmula (cadência de cada cliente, grampeada
 * entre 7 e 60 dias, comparada com o silêncio atual) roda no backend, sobre a
 * base inteira e sobre o recorte da consulta. Reimplementá-la aqui daria uma
 * segunda resposta para a mesma pergunta, calculada sobre as 50 linhas que por
 * acaso estão na mão — e as duas divergiriam sem ninguém ver.
 */
import { formatCurrency } from '../orders/format';
import type { CustomerListItem, CustomerSegment } from '../api/types';

/**
 * O rótulo de cada classe. Substantivo curto, como o dos estágios de pedido
 * (`ds/status.ts`) — nunca uma frase, porque ele vive numa célula de tabela.
 *
 * `Record<CustomerSegment, string>` é o que trava a lista: o tipo sai do enum
 * GERADO, então um sexto valor no contrato vira erro de compilação aqui, e não
 * uma linha sem rótulo na tela do lojista.
 */
export const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  novo: 'Novo',
  ocasional: 'Ocasional',
  fiel: 'Fiel',
  em_risco: 'Em risco',
  perdido: 'Perdido',
};

/**
 * COMO SE LÊ CADA RÓTULO — a resposta para "por que ele e não o vizinho".
 *
 * Vai no `title` da etiqueta: é APOIO, não a informação. O que precisa estar
 * visível é o rótulo, e ele está. Um `title` não sobrevive ao toque, então
 * nada essencial mora aqui — o que explica a REGRA (o ritmo é de cada cliente)
 * está escrito na ressalva da tela, uma vez, em prosa.
 *
 * A armadilha de leitura é `novo`: ele conta do PRIMEIRO pedido, não do último.
 * Quem tem dois pedidos espaçados em dez meses e pediu semana passada é
 * `ocasional` — e a frase abaixo é o que impede alguém de "consertar" isso.
 */
export const SEGMENT_HINT: Record<CustomerSegment, string> = {
  novo: 'Relacionamento recente: o PRIMEIRO pedido foi nos últimos 30 dias.',
  ocasional: 'Poucos pedidos e relacionamento antigo, mas em dia com o ritmo dele.',
  fiel: 'Três pedidos ou mais, e dentro do ritmo dele.',
  em_risco: 'Passou o dobro do intervalo habitual dele sem aparecer.',
  perdido: 'Passou o quádruplo do intervalo habitual dele sem aparecer.',
};

/**
 * O TICKET MÉDIO, e o buraco que ele tem.
 *
 * `average_ticket` é `total_spent / billable_orders_count` e vale **0.0**
 * quando não há pedido faturável — o que acontece com quem só tem pedido
 * cancelado ou recusado. Escrever "R$ 0,00" ali seria afirmar que a pessoa
 * gastou zero por pedido, quando o certo é que não houve pedido a dividir.
 *
 * O travessão é a mesma convenção de `formatDate`/`formatSince` para "não dá
 * para saber", e a linha auxiliar embaixo diz por quê.
 */
export function formatAverageTicket(customer: CustomerListItem): string {
  if (customer.billable_orders_count <= 0) return '—';
  return formatCurrency(customer.average_ticket);
}

/**
 * A LINHA QUE FAZ A CONTA FECHAR — e ela existe por causa de um chamado.
 *
 * "5 pedidos, R$ 160 gastos, ticket médio R$ 40: a conta não bate." Bate: dois
 * dos cinco foram cancelados, e nem `total_spent` nem o ticket os contam. Sem
 * o denominador escrito, os três números da linha se contradizem à vista.
 *
 * Ela só aparece quando os dois contadores DIVERGEM. Quando são iguais, a
 * coluna "Pedidos" já é o denominador e a divisão fecha sozinha — repetir o
 * número em cinquenta linhas seria ruído para explicar o que já está explicado.
 *
 * A coluna "Pedidos" continua sendo `orders_count`, o TOTAL, e isso é de
 * propósito: é o mesmo número que o detalhe do pedido escreve em "Cliente há 3
 * meses · 12 pedidos" (`customerHistoryLine`). Duas telas com dois totais para
 * a mesma pessoa é pior do que uma nota de rodapé.
 */
export function billableNote(customer: CustomerListItem): string | null {
  if (customer.orders_count <= customer.billable_orders_count) return null;
  if (customer.billable_orders_count <= 0) return 'nenhum faturável';
  return `${customer.billable_orders_count} de ${customer.orders_count} pedidos`;
}
