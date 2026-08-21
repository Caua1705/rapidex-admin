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
 * ============================================================================
 * O RITMO — o número que faz a etiqueta parar de parecer arbitrária
 * ============================================================================
 *
 * `cadence_days` é o intervalo médio DESTE cliente, em dias, já grampeado entre
 * 7 e 60 pelo backend. Com `days_since_last_order` ele forma o par que explica
 * o rótulo: **"23 dias sem pedir, ritmo de 7"** diz sozinho por que esta pessoa
 * está em risco e a vizinha da lista, com os mesmos 23 dias, não está.
 *
 * Era a pergunta que a tela não conseguia responder. A ressalva dizia a REGRA
 * ("o ritmo é de cada cliente"), e a regra não fecha o caso: quem olha duas
 * linhas com o mesmo "há 23 dias" e dois rótulos diferentes precisa dos dois
 * números daquelas duas pessoas, não da frase.
 *
 * OS TRÊS SAEM DA MESMA EXPRESSÃO NO BANCO. Isso é o que dá valor a mostrá-los:
 * o número na tela não consegue discordar da etiqueta ao lado dele. Se a conta
 * fosse refeita aqui, poderia.
 */

/**
 * "ritmo de 7 dias" — a linha auxiliar embaixo da classe.
 *
 * ELA CALA PARA QUEM TEM UM PEDIDO SÓ, e é a única regra desta função. Sem dois
 * pedidos não há intervalo a medir, e o backend usa 30 como valor de partida
 * (§3 do contrato). Escrever "ritmo de 30 dias" ao lado de "1 pedido" seria a
 * tela afirmando um hábito que ninguém observou — e "Novo", que é o rótulo de
 * quem estreia, já se explica pela coluna "Cliente desde".
 *
 * O número sai arredondado: a diferença entre 7,4 e 7 dias não muda decisão
 * nenhuma, e "ritmo de 7,43 dias" lê como saída de depurador.
 */
export function cadenceNote(customer: CustomerListItem): string | null {
  if (customer.orders_count <= 1) return null;

  const dias = Math.round(customer.cadence_days);
  if (!Number.isFinite(dias) || dias <= 0) return null;
  return dias === 1 ? 'ritmo de 1 dia' : `ritmo de ${dias} dias`;
}

/**
 * A FRASE COMPLETA, no `title` da etiqueta: "23 dias sem pedir, e o ritmo dele
 * é de 7 dias."
 *
 * É o par inteiro num lugar só, para quem quer a conta escrita em vez de
 * montada de duas colunas. Continua sendo APOIO — um `title` não sobrevive ao
 * toque —, e é por isso que o ritmo TAMBÉM aparece visível na linha. O que está
 * aqui e não lá é a distância, que já é a coluna "Último pedido".
 *
 * Sem os números, cai no `SEGMENT_HINT`, que explica a REGRA da classe. A frase
 * genérica é o piso; a específica é o ganho.
 */
export function segmentAudit(customer: CustomerListItem): string {
  const generica = SEGMENT_HINT[customer.segment] ?? '';

  const dias = customer.days_since_last_order;
  const ritmo = Math.round(customer.cadence_days);
  if (typeof dias !== 'number' || !Number.isFinite(ritmo) || customer.orders_count <= 1) {
    return generica;
  }

  const semPedir =
    dias === 0 ? 'Pediu hoje' : dias === 1 ? '1 dia sem pedir' : `${dias} dias sem pedir`;
  const cadencia = ritmo === 1 ? 'de 1 dia' : `de ${ritmo} dias`;
  return `${semPedir}, e o ritmo dele é ${cadencia}. ${generica}`.trim();
}

/**
 * A CLASSE, QUANDO ELA VEIO — a mesma peneira do denominador, uma linha acima.
 *
 * `segment` é obrigatório no contrato e o tipo gerado o dá como enum, então
 * `SEGMENT_LABEL[segment]` é `string` para o compilador e nada aqui pode
 * acender. Na rede é outra história: enquanto o deploy esteve atrás da entrega
 * do RFV, `segment` chegou ausente e o índice devolveu `undefined` — a etiqueta
 * saía com o ponto sem matiz e a palavra em branco, e **célula vazia lê como
 * falha de carregamento**. Foi assim que a ausência de dado foi confundida com
 * bug de tela.
 *
 * Ela devolve `null` em dois casos, e os dois são a mesma pergunta sem
 * resposta: o campo que não chegou, e o valor que chegou fora das cinco classes
 * (uma sexta classe no backend antes de a tela conhecê-la). Quem chama escreve
 * o travessão, que é a convenção do painel para "não dá para saber".
 *
 * O `Record` continua sendo a trava de compilação que ele sempre foi: uma
 * classe nova no contrato ainda quebra o `npm run typecheck` aqui, e é assim
 * que se descobre a sexta classe no lugar certo. Esta função é a rede embaixo,
 * não a substituta da trava.
 */
export function segmentLabel(segment: CustomerSegment): string | null {
  const rotulo: string | undefined = SEGMENT_LABEL[segment];
  return typeof rotulo === 'string' && rotulo !== '' ? rotulo : null;
}

/**
 * O DENOMINADOR DO TICKET, QUANDO ELE VEIO.
 *
 * `billable_orders_count` é obrigatório no contrato, e o tipo gerado o promete
 * como `number` — mas o contrato é o que a API PROMETE, não o que a API no ar
 * está devolvendo hoje. Enquanto o deploy estiver atrás da entrega do RFV
 * (20/08/2026), os quatro campos novos chegam ausentes, e `undefined` passa
 * pelos dois `<=` daqui sem que nada acenda: `35 <= undefined` e
 * `undefined <= 0` são ambos falsos, e o que sobrava era a palavra "undefined"
 * escrita na tela do lojista, embaixo de um travessão.
 *
 * Esta função é o único lugar que faz a pergunta. Ela NÃO opcionaliza o tipo
 * gerado nem descreve o contrato à mão (§2 da skill de API): o contrato
 * continua dizendo que o campo vem, e o dia em que ele vier isto vira um
 * `if` que nunca dispara. O que ela garante é a única coisa que não se
 * negocia — a tela não escreve `undefined` para ninguém.
 *
 * `Number.isFinite` é a mesma peneira de `formatCurrency`, e pelo mesmo
 * motivo: campo ausente e `NaN` são a mesma pergunta sem resposta.
 */
function faturaveis(customer: CustomerListItem): number | null {
  const count = customer.billable_orders_count;
  return Number.isFinite(count) ? count : null;
}

/**
 * O TICKET MÉDIO, e o buraco que ele tem.
 *
 * `average_ticket` é `total_spent / billable_orders_count` e vale **0.0**
 * quando não há pedido faturável — o que acontece com quem só tem pedido
 * cancelado ou recusado. Escrever "R$ 0,00" ali seria afirmar que a pessoa
 * gastou zero por pedido, quando o certo é que não houve pedido a dividir.
 *
 * O travessão é a mesma convenção de `formatDate`/`formatSince` para "não dá
 * para saber", e a linha auxiliar embaixo diz por quê. Ele cobre os dois casos
 * em que não há divisão a mostrar: nenhum pedido faturável, e o denominador
 * que não chegou.
 */
export function formatAverageTicket(customer: CustomerListItem): string {
  const count = faturaveis(customer);
  if (count === null || count <= 0) return '—';
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
  const count = faturaveis(customer);
  // Sem denominador não há conta a fechar, e a nota some inteira: uma linha
  // auxiliar que existe para explicar uma divisão não pode ser o lugar onde a
  // ausência do divisor aparece.
  if (count === null) return null;
  if (customer.orders_count <= count) return null;
  if (count <= 0) return 'nenhum faturável';
  return `${count} de ${customer.orders_count} pedidos`;
}
