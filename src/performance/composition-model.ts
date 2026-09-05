/**
 * A COMPOSIÇÃO DO FATURAMENTO — para onde o dinheiro foi.
 *
 * Aritmética pura sobre `SalesBreakdown` e sobre o extrato de comissão, com
 * teste próprio: aqui um número errado não quebra nada, só faz o lojista
 * acreditar que sobrou mais (ou menos) do que sobrou.
 *
 * ============================================================================
 * UM DENOMINADOR SÓ NO CARTÃO INTEIRO
 * ============================================================================
 *
 * A identidade que o contrato declara em `SalesBreakdown` é:
 *
 *     revenue_total = subtotal + delivery_fee + service_fee - discount
 *
 * Ou seja, o desconto é uma SUBTRAÇÃO, não uma fatia — e desenhá-lo como uma
 * fatia ao lado das outras três somaria 130% de um todo de 100. Por isso o
 * cartão tem duas metades com o MESMO denominador:
 *
 * 1. **o bruto** (`subtotal + entrega + serviço`), que é o que a rosca divide;
 * 2. **o que sai dele** — desconto, comissão e cashback resgatado —, cada um
 *    escrito como valor e como fatia DO MESMO bruto.
 *
 * Duas fatias na mesma seção com denominadores diferentes é como a tela passa
 * a discordar de si mesma sem que nada quebre.
 *
 * ============================================================================
 * O QUE ESTE MÓDULO NÃO CALCULA: "quanto sobrou"
 * ============================================================================
 *
 * É a linha que todo painel de restaurante quer ter, e ela exigiria saber se o
 * `cashback_redeemed_amount` de cada pedido JÁ ESTÁ dentro do `discount_total`
 * do resumo. O contrato não diz — `SalesBreakdown` descreve a identidade acima
 * e para por aí, e os dois números saem de rotas diferentes.
 *
 * Somar os três e chamar de "sobrou" pode contar o cashback duas vezes. Uma
 * linha de resultado errada nesta tela é pior que a ausência dela: o lojista
 * decide preço em cima dela.
 */
import type { CommissionReport, SalesSummary } from '../api/types';
import { toNumberOrZero } from './report-model';

/** Uma parte do bruto, ou uma saída dele. */
export type FatiaDaComposicao = {
  id: string;
  rotulo: string;
  valor: number;
  /** Fatia do BRUTO, de 0 a 100. Nula quando não há bruto do qual ser fatia. */
  fatiaPct: number | null;
};

/**
 * O BRUTO: a soma das três partes que o cliente pagou.
 *
 * É o denominador do cartão inteiro, e ele é somado aqui e não lido de
 * `revenue_total` de propósito: `revenue_total` já vem com o desconto abatido,
 * e usar os dois faria as três fatias da rosca somarem mais de 100%.
 */
export function brutoDoPeriodo(summary: SalesSummary): number {
  const { subtotal_total, delivery_fee_total, service_fee_total } = summary.breakdown;
  return (
    toNumberOrZero(subtotal_total) +
    toNumberOrZero(delivery_fee_total) +
    toNumberOrZero(service_fee_total)
  );
}

function fatia(id: string, rotulo: string, valor: number, bruto: number): FatiaDaComposicao {
  return { id, rotulo, valor, fatiaPct: bruto > 0 ? (valor / bruto) * 100 : null };
}

/**
 * AS PARTES DO BRUTO — o que a rosca desenha.
 *
 * A ORDEM É POR TAMANHO, maior primeiro, e é ela que faz a rosca ser lida sem
 * legenda numerada: o arco começa no topo e as fatias descem de tamanho no
 * sentido do relógio, então a lista ao lado está na mesma ordem do desenho.
 *
 * FATIA ZERO NÃO É DESENHADA. Uma loja que não cobra taxa de serviço não tem
 * uma fatia de 0% — ela não tem taxa de serviço, e um rótulo com "R$ 0,00" ao
 * lado de um arco invisível é uma linha gasta para dizer o nada. A ausência
 * fica dita na soma, que continua fechando.
 */
export function partesDoBruto(summary: SalesSummary): FatiaDaComposicao[] {
  const bruto = brutoDoPeriodo(summary);
  const { subtotal_total, delivery_fee_total, service_fee_total } = summary.breakdown;

  return [
    fatia('itens', 'Produtos', toNumberOrZero(subtotal_total), bruto),
    fatia('entrega', 'Taxa de entrega', toNumberOrZero(delivery_fee_total), bruto),
    fatia('servico', 'Taxa de serviço', toNumberOrZero(service_fee_total), bruto),
  ]
    .filter((parte) => parte.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

/**
 * O CASHBACK RESGATADO NO PERÍODO, somado do extrato de comissão.
 *
 * ELE É O ÚNICO CASHBACK QUE O PAINEL ALCANÇA, e o nome importa: é o que o
 * cliente GASTOU do saldo dele em pedidos deste período — não o que a loja
 * concedeu. "Concedido" (o crédito gerado na venda) não existe em resposta
 * nenhuma de `/admin`, e o pedido ao backend está em
 * `scratchpad/pedido-backend-desempenho.md`.
 *
 * A soma é feita no painel porque `CommissionReportItem.cashback_redeemed_amount`
 * é por pedido e não há agregado. Ela é COMPLETA e não uma amostra: a rota
 * devolve `orders[]` inteiro, sem paginação, com todos os pedidos faturados do
 * período (a descrição da rota diz isso).
 *
 * SOMENTE_DONO, como a rota. Para a gerência o relatório nem é pedido, e a
 * linha não é desenhada — ver `usePerformance`.
 */
export function cashbackResgatado(commission: CommissionReport): number {
  return commission.orders.reduce(
    (soma, pedido) => soma + toNumberOrZero(pedido.cashback_redeemed_amount),
    0,
  );
}

/**
 * O QUE SAI DO BRUTO: desconto, comissão e cashback resgatado.
 *
 * `commission` nulo é a gerência (a rota é SOMENTE_DONO e nem foi pedida), e aí
 * as duas últimas linhas não existem — não são zero. Um "Comissão R$ 0,00" na
 * tela de quem não pode lê-la seria uma afirmação falsa sobre o contrato da
 * loja com a plataforma.
 */
export function saidasDoBruto(
  summary: SalesSummary,
  commission: CommissionReport | null,
): FatiaDaComposicao[] {
  const bruto = brutoDoPeriodo(summary);
  const saidas = [
    fatia('desconto', 'Descontos', toNumberOrZero(summary.breakdown.discount_total), bruto),
  ];

  if (commission) {
    saidas.push(
      fatia(
        'comissao',
        'Comissão da plataforma',
        toNumberOrZero(commission.commission_total),
        bruto,
      ),
      fatia('cashback', 'Cashback resgatado', cashbackResgatado(commission), bruto),
    );
  }

  return saidas.filter((saida) => saida.valor > 0);
}

/* ==========================================================================
 * A ROSCA — a geometria, para que o componente só desenhe
 * ======================================================================= */

/** O raio do círculo no `viewBox` de 100×100 da rosca. */
export const DONUT_RAIO = 40;

/** O perímetro em que os arcos são medidos. */
export const DONUT_PERIMETRO = 2 * Math.PI * DONUT_RAIO;

export type ArcoDoDonut = {
  id: string;
  /** `stroke-dasharray`: o comprimento do arco, e o resto do perímetro. */
  dash: string;
  /** `stroke-dashoffset`: onde o arco começa, já com o giro acumulado. */
  offset: number;
};

/**
 * Os arcos da rosca, na ordem das fatias.
 *
 * O ACÚMULO É NEGATIVO no `dashoffset` porque o SVG anda o traço no sentido
 * contrário ao do relógio a partir da origem; com o `-90°` que o componente
 * aplica no grupo, a primeira fatia começa às 12 horas. É a única conta do
 * módulo que não se confere de cabeça, e é por isso que ela mora aqui com
 * teste em vez de dentro do JSX.
 *
 * Sem fatias devolve vazio: uma rosca sem arco nenhum é um anel cinza, e um
 * anel cinza afirma "cem por cento de alguma coisa".
 */
export function arcosDoDonut(fatias: readonly FatiaDaComposicao[]): ArcoDoDonut[] {
  const total = fatias.reduce((soma, item) => soma + item.valor, 0);
  if (total <= 0) return [];

  let acumulado = 0;
  return fatias.map((item) => {
    const comprimento = (item.valor / total) * DONUT_PERIMETRO;
    const arco = {
      id: item.id,
      dash: `${arredonda(comprimento)} ${arredonda(DONUT_PERIMETRO - comprimento)}`,
      offset: arredonda(-acumulado),
    };
    acumulado += comprimento;
    return arco;
  });
}

/*
 * O `+ 0` NO FIM MATA O `-0`.
 *
 * O primeiro arco tem acúmulo zero, e `-acumulado` dá `-0` — que o SVG desenha
 * igual, mas que faz `toBe(0)` falhar e, pior, sai como `stroke-dashoffset="-0"`
 * no atributo. É meio segundo de conta e meia hora de confusão na revisão.
 */
function arredonda(valor: number): number {
  return Math.round(valor * 1000) / 1000 + 0;
}
