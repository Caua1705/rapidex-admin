/**
 * ============================================================================
 * AS FRASES — a tela responde, não exibe
 * ============================================================================
 *
 * O dono de restaurante não abre painel para estudar: abre para saber se a
 * semana foi boa e o que fazer amanhã. Por isso a primeira coisa da tela é uma
 * FRASE, e cada seção termina apontando uma ação — quando os dados sustentam
 * uma.
 *
 * TRÊS REGRAS VALEM PARA TODAS AS FUNÇÕES DAQUI:
 *
 * 1. **Determinístico, sem IA.** Toda frase sai de uma comparação entre campos
 *    que as seis rotas já devolvem. Nada é inferido, estimado ou suavizado.
 *
 * 2. **Condição que não bate não vira frase.** Toda função devolve `null`
 *    quando não tem o que afirmar. Não existe frase neutra de preenchimento
 *    ("o período foi estável") para tapar buraco: uma frase que aparece sempre
 *    deixa de ser lida, e leva junto a credibilidade das que importam.
 *
 * 3. **Todo limiar tem nome em `LIMIARES`.** Nenhum número mágico no meio de
 *    um `if`. Ajustar "a partir de quantos por cento uma queda merece frase" é
 *    editar uma linha nomeada, não caçar um `> 5` dentro de uma expressão.
 */
import type {
  Cancellations,
  ProductSales,
  ReportPaymentMethods,
  SalesByDay,
  SalesByDayItem,
  SalesSummary,
} from '../api/types';
import { formatCurrency, labelFor, PAYMENT_METHOD_LABELS } from '../orders/format';
import { STATUS_LABELS } from '../orders/order-status';
import { paymentMethodLabel, toNumber, toNumberOrZero } from './report-model';

/* ==========================================================================
 * OS LIMIARES, TODOS COM NOME
 * ======================================================================= */

/**
 * Cada valor aqui é uma decisão de produto, não uma constante técnica — e é
 * por isso que eles moram juntos, num objeto só, em vez de espalhados pelas
 * funções que os usam.
 */
export const LIMIARES = {
  /**
   * Abaixo disto, em módulo, o período não subiu nem caiu: ficou no mesmo
   * patamar. Sem esta faixa, +0,4% viraria "cresceu" e o lojista comemoraria
   * ruído de uma terça chuvosa.
   */
  variacaoEstavelPct: 3,

  /**
   * Quanto da variação total os dias apontados como causa precisam explicar
   * para que a frase seja honesta. Com 0,5, dizer "puxada por terça e sábado"
   * significa que terça e sábado respondem por metade ou mais do que mudou.
   */
  causaCoberturaMinima: 0.5,

  /**
   * Quantos dias a frase de causa pode nomear. Uma causa com cinco dias não é
   * causa — é o período inteiro, e aí a resposta certa é "subiu no geral".
   */
  causaMaxDias: 3,

  /**
   * O dia da semana só é chamado de fraco se faturar no máximo esta fração da
   * média diária do período. A 0,6, terça precisa render 40% menos que um dia
   * comum para merecer a frase.
   */
  diaFracoRazaoMaxima: 0.6,

  /**
   * E precisa ter aparecido pelo menos este tanto de vezes no período: um
   * único domingo fraco é um domingo, dois é um padrão.
   */
  diaFracoOcorrenciasMinimas: 2,

  /** A partir daqui, um produto sozinho é risco de concentração. */
  concentracaoTopPct: 25,

  /** A partir daqui, o cancelamento deixa de ser rotina e vira pergunta. */
  cancelamentoAltoPct: 5,

  /** Desconto concedido acima desta fatia do faturamento merece ser dito. */
  descontoPesadoPct: 5,

  /** Retirada acima desta fatia deixa de ser exceção e vira canal. */
  retiradaRelevantePct: 25,

  /** Uma forma de pagamento acima disto concentra o risco de indisponibilidade. */
  pagamentoDominantePct: 70,

  /** Dinheiro acima disto é troco no caixa, e isso é operação, não relatório. */
  dinheiroAltoPct: 30,
} as const;

/* ==========================================================================
 * O TIPO DE UMA FRASE
 * ======================================================================= */

export type Insight = {
  /** Chave estável, para `key` de lista e para o teste nomear o caso. */
  id: string;
  /** A frase inteira, pronta para a tela. Já inclui a ação, quando há uma. */
  text: string;
};

/* ==========================================================================
 * FERRAMENTAS INTERNAS
 * ======================================================================= */

/**
 * O nome do dia da semana, a partir do `AAAA-MM-DD` do contrato.
 *
 * ÂNCORA AO MEIO-DIA UTC, LIDA EM UTC — os dois lados no mesmo fuso, então
 * nenhum deslocamento é possível. É a mesma decisão de `dayFullLabel`, e pelo
 * mesmo motivo: `new Date('2026-08-16')` é meia-noite UTC, que em
 * America/Fortaleza é 21h do dia 15 — o dia da semana sairia errado, e um
 * "puxada por sábado" apontaria para a sexta.
 */
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });

export function weekdayName(day: string): string | null {
  const anchor = Date.parse(`${day}T12:00:00Z`);
  if (Number.isNaN(anchor)) return null;
  return weekdayFormatter.format(new Date(anchor)).replace('-feira', '');
}

/** O índice do dia da semana (0 = domingo), para agrupar. Nulo no ilegível. */
function weekdayIndex(day: string): number | null {
  const anchor = Date.parse(`${day}T12:00:00Z`);
  if (Number.isNaN(anchor)) return null;
  return new Date(anchor).getUTCDay();
}

/** "terça e sábado", "terça, quinta e sábado" — a vírgula e o "e" do português. */
function listOf(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const inicio = items.slice(0, -1).join(', ');
  return `${inicio} e ${items[items.length - 1]}`;
}

/**
 * "os 7 dias anteriores" → "dos 7 dias anteriores".
 *
 * O rótulo do período anterior é escrito para caber depois de "que" ("rendeu
 * 62% mais QUE os 7 dias anteriores"), e a frase de estabilidade precisa dele
 * depois de "de". Sem a contração a tela escreveria "no mesmo patamar de os 7
 * dias anteriores", que é português errado no meio da única frase que o
 * lojista lê inteira.
 */
function contrair(previousLabel: string): string {
  if (previousLabel.startsWith('os ')) return `dos ${previousLabel.slice(3)}`;
  if (previousLabel.startsWith('o ')) return `do ${previousLabel.slice(2)}`;
  return `de ${previousLabel}`;
}

/** Percentual com uma casa, do jeito que o pt-BR escreve. */
function pct(value: number): string {
  return `${(Math.round(Math.abs(value) * 10) / 10).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`;
}

/* ==========================================================================
 * 1. O VEREDITO — e a causa por dia, quando ela existe
 * ======================================================================= */

export type VereditoDirecao = 'alta' | 'queda' | 'estavel' | 'sem-comparacao';

/**
 * A direção do período, já com a faixa de estabilidade aplicada.
 *
 * Separada da frase porque a tela também usa a direção para escolher o verbo da
 * causa ("puxada por" vs. "puxada para baixo por"), e refazer o `if` lá seria
 * a mesma regra escrita duas vezes.
 */
export function vereditoDirecao(summary: SalesSummary): VereditoDirecao {
  const percent = toNumber(summary.revenue_comparison.change_percent);
  if (percent === null) return 'sem-comparacao';
  if (Math.abs(percent) < LIMIARES.variacaoEstavelPct) return 'estavel';
  return percent > 0 ? 'alta' : 'queda';
}

/**
 * Os dias que explicam a variação do período.
 *
 * COMO A CONTA É FEITA: cada dia do período atual é comparado com o dia de
 * mesma POSIÇÃO no período anterior (o backend devolve os dois com todos os
 * dias preenchidos, inclusive os sem venda). Os dias cuja diferença aponta na
 * mesma direção da variação total são ordenados por tamanho, e a frase nomeia
 * os maiores até que eles cubram `causaCoberturaMinima` do total.
 *
 * DEVOLVE `null` — e a tela fica sem a frase de causa — quando:
 * - falta um dos dois períodos (a segunda chamada pode ter falhado, e ela é
 *   enfeite: a tela não quebra por causa dela);
 * - os dois períodos têm quantidades de dias diferentes, e aí a comparação
 *   posição a posição compararia coisas diferentes;
 * - a variação total é zero, e não há o que explicar;
 * - precisou de mais de `causaMaxDias` dias para chegar à cobertura — o que
 *   significa que a causa não são dias específicos, é o período inteiro.
 */
export function diasQueExplicam(
  atual: SalesByDay | null,
  anterior: SalesByDay | null,
): { dias: string[]; direcao: 'alta' | 'queda' } | null {
  if (!atual || !anterior) return null;
  if (atual.days.length === 0 || atual.days.length !== anterior.days.length) return null;

  const variacaoTotal =
    toNumberOrZero(atual.revenue_total) - toNumberOrZero(anterior.revenue_total);
  if (variacaoTotal === 0) return null;

  const direcao = variacaoTotal > 0 ? 'alta' : 'queda';

  const contribuicoes = atual.days
    .map((day, index) => {
      const par = anterior.days[index];
      const delta = toNumberOrZero(day.revenue_total) - toNumberOrZero(par?.revenue_total ?? '0');
      return { day: day.day, delta };
    })
    // Só os dias que empurram para o MESMO lado da variação total. Um sábado
    // que caiu não "explica" uma semana que subiu.
    .filter((item) => (direcao === 'alta' ? item.delta > 0 : item.delta < 0))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const alvo = Math.abs(variacaoTotal) * LIMIARES.causaCoberturaMinima;
  const escolhidos: string[] = [];
  let acumulado = 0;

  for (const item of contribuicoes) {
    if (acumulado >= alvo) break;
    if (escolhidos.length >= LIMIARES.causaMaxDias) return null;
    const nome = weekdayName(item.day);
    if (!nome) return null;
    escolhidos.push(nome);
    acumulado += Math.abs(item.delta);
  }

  if (escolhidos.length === 0 || acumulado < alvo) return null;

  /*
   * NOMES REPETIDOS VIRAM UM SÓ. Num período de 30 dias há quatro sábados, e
   * "puxada por sábado, sábado e terça" é uma frase quebrada. Com a repetição
   * removida a frase continua verdadeira: o dia da semana é o padrão que ela
   * aponta.
   */
  return { dias: [...new Set(escolhidos)], direcao };
}

/**
 * A FRASE DO TOPO — a primeira coisa da tela.
 *
 * Ela sempre existe quando há resumo, porque é a resposta da pergunta que fez o
 * lojista abrir a tela. O que varia é o quanto ela consegue afirmar: com o
 * período anterior zerado não há variação a citar, e a frase diz isso em vez de
 * escrever "0%", que seria mentira (ver `readChange`).
 */
export function readVeredito(
  summary: SalesSummary,
  byDay: SalesByDay | null,
  byDayAnterior: SalesByDay | null,
  previousLabel: string,
): Insight {
  const direcao = vereditoDirecao(summary);
  const percent = toNumber(summary.revenue_comparison.change_percent);

  /*
   * A FRASE NÃO REPETE O FATURAMENTO EM REAIS, e isso é a regra de não dizer a
   * mesma coisa duas vezes na mesma dobra (§8 da skill de design): o número
   * está logo abaixo dela, em `.numeros`. O que a frase carrega é o que o
   * número sozinho não diz — a direção, o tamanho da variação e a causa.
   */
  if (direcao === 'sem-comparacao') {
    return {
      id: 'veredito',
      text: `Não há com o que comparar este período: ${previousLabel} não teve movimento.`,
    };
  }

  if (direcao === 'estavel') {
    return {
      id: 'veredito',
      text: `O período ficou no mesmo patamar ${contrair(previousLabel)}.`,
    };
  }

  const verbo = direcao === 'alta' ? 'mais' : 'menos';
  const base = `O período rendeu ${pct(percent ?? 0)} ${verbo} que ${previousLabel}`;

  const causa = diasQueExplicam(byDay, byDayAnterior);
  /*
   * A CAUSA SÓ ENTRA SE APONTAR PARA O MESMO LADO DO VEREDITO. As duas contas
   * têm fontes diferentes — o percentual vem do `summary`, a diferença por dia
   * vem de duas chamadas de `sales-by-day` — e discordar é possível numa borda
   * de arredondamento. Quando discordam, a frase fica sem a causa em vez de
   * dizer "rendeu mais, puxada para baixo por terça".
   */
  if (causa && causa.direcao === direcao) {
    const ligacao = direcao === 'alta' ? 'puxado por' : 'puxado para baixo por';
    return { id: 'veredito', text: `${base}, ${ligacao} ${listOf(causa.dias)}.` };
  }

  return { id: 'veredito', text: `${base}.` };
}

/* ==========================================================================
 * 2. VEIO MAIS GENTE, OU CADA UM GASTOU MAIS?
 * ======================================================================= */

/**
 * A segunda frase do topo: qual dos dois lados do faturamento se mexeu.
 *
 * É a diferença entre "apareceu mais gente" e "cada pessoa gastou mais", e as
 * duas levam a decisões opostas — a primeira pede capacidade de produção, a
 * segunda pede cardápio. O faturamento sozinho não distingue as duas.
 *
 * `null` quando os dois se mexeram na mesma direção (aí não há o que separar:
 * cresceu tudo) ou quando falta comparação em algum dos dois.
 */
export function readTicketOuVolume(summary: SalesSummary): Insight | null {
  const pedidos = toNumber(summary.orders_count_comparison.change_percent);
  const ticket = toNumber(summary.average_ticket_comparison.change_percent);
  if (pedidos === null || ticket === null) return null;

  const pedidosMexeu = Math.abs(pedidos) >= LIMIARES.variacaoEstavelPct;
  const ticketMexeu = Math.abs(ticket) >= LIMIARES.variacaoEstavelPct;

  if (pedidosMexeu && !ticketMexeu) {
    const verbo = pedidos > 0 ? 'Veio mais gente' : 'Veio menos gente';
    return {
      id: 'ticket-ou-volume',
      text: `${verbo} (${pct(pedidos)} ${pedidos > 0 ? 'a mais' : 'a menos'} em pedidos), e cada pessoa gastou o mesmo de antes.`,
    };
  }

  if (ticketMexeu && !pedidosMexeu) {
    const verbo = ticket > 0 ? 'subiu' : 'caiu';
    return {
      id: 'ticket-ou-volume',
      text: `Veio a mesma quantidade de gente, mas o ticket médio ${verbo} ${pct(ticket)} — a mudança está no que cada pessoa leva, não em quantas apareceram.`,
    };
  }

  return null;
}

/* ==========================================================================
 * 3. O DIA DA SEMANA QUE NÃO APARECE
 * ======================================================================= */

/**
 * O dia da semana fraco recorrente — a frase que mais vira decisão, porque ela
 * aponta um dia específico da semana que vem.
 *
 * A conta agrupa os dias do período por dia da semana, tira a média de cada
 * grupo e compara com a média diária do período inteiro. Exige
 * `diaFracoOcorrenciasMinimas` para não chamar de padrão o que foi um dia.
 */
export function readDiaFraco(byDay: SalesByDay | null): Insight | null {
  if (!byDay || byDay.days.length === 0) return null;

  const total = toNumberOrZero(byDay.revenue_total);
  if (total <= 0) return null;

  const mediaDiaria = total / byDay.days.length;
  if (mediaDiaria <= 0) return null;

  const grupos = new Map<number, { soma: number; vezes: number; dia: string }>();
  for (const day of byDay.days as readonly SalesByDayItem[]) {
    const indice = weekdayIndex(day.day);
    if (indice === null) continue;
    const atual = grupos.get(indice) ?? { soma: 0, vezes: 0, dia: day.day };
    grupos.set(indice, {
      soma: atual.soma + toNumberOrZero(day.revenue_total),
      vezes: atual.vezes + 1,
      dia: atual.dia,
    });
  }

  let pior: { media: number; dia: string } | null = null;
  for (const grupo of grupos.values()) {
    if (grupo.vezes < LIMIARES.diaFracoOcorrenciasMinimas) continue;
    const media = grupo.soma / grupo.vezes;
    if (!pior || media < pior.media) pior = { media, dia: grupo.dia };
  }

  if (!pior) return null;
  if (pior.media > mediaDiaria * LIMIARES.diaFracoRazaoMaxima) return null;

  const nome = weekdayName(pior.dia);
  if (!nome) return null;

  const quanto = pct((1 - pior.media / mediaDiaria) * 100);
  return {
    id: 'dia-fraco',
    text: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} rende ${quanto} menos que um dia comum do período — é o dia com espaço para um cupom ou uma promoção de cardápio.`,
  };
}

/* ==========================================================================
 * 4. UM PRODUTO SEGURANDO O FATURAMENTO
 * ======================================================================= */

/**
 * O risco de concentração no primeiro do ranking.
 *
 * A fatia é sobre `listed_revenue_total`, que é a soma da própria lista — NÃO
 * sobre o faturamento do resumo. Os dois não fecham (a resposta traz a ressalva
 * em `revenue_note`), e dividir um pelo outro produziria um percentual que não
 * é fatia de nada.
 */
export function readConcentracao(products: ProductSales | null): Insight | null {
  if (!products || products.products.length === 0) return null;

  const primeiro = products.products[0];
  if (!primeiro) return null;

  const total = toNumber(products.listed_revenue_total);
  if (total === null || total <= 0) return null;

  const fatia = (toNumberOrZero(primeiro.revenue_total) / total) * 100;
  if (fatia < LIMIARES.concentracaoTopPct) return null;

  return {
    id: 'concentracao',
    text: `${primeiro.product_name} sozinho é ${pct(fatia)} da receita destes itens — vale conferir o estoque dele antes do fim de semana.`,
  };
}

/* ==========================================================================
 * 5. CANCELAMENTO ACIMA DO NORMAL
 * ======================================================================= */

/**
 * A taxa de cancelamento com a situação que mais pesa dentro dela.
 *
 * A situação dominante sai do `breakdown` por CONTAGEM DE PEDIDOS, não por
 * valor: a pergunta é "o que mais acontece", e um único pedido caro estornado
 * não é o padrão a corrigir.
 */
export function readCancelamento(cancellations: Cancellations | null): Insight | null {
  if (!cancellations) return null;

  const taxa = toNumber(cancellations.cancellation_rate_percent);
  if (taxa === null || taxa < LIMIARES.cancelamentoAltoPct) return null;

  const dominante = [...cancellations.breakdown].sort((a, b) => b.orders_count - a.orders_count)[0];
  const perdido = formatCurrency(cancellations.amount_total);

  if (!dominante) {
    return {
      id: 'cancelamento',
      text: `${pct(taxa)} dos pedidos do período não fecharam, ${perdido} que não entraram.`,
    };
  }

  return {
    id: 'cancelamento',
    text: `${pct(taxa)} dos pedidos do período não fecharam — ${perdido} que não entraram, a maior parte em "${labelFor(STATUS_LABELS, dominante.status)}".`,
  };
}

/* ==========================================================================
 * 6. O DESCONTO QUE SAIU
 * ======================================================================= */

/** Quanto do faturamento saiu em desconto, quando isso passa de ser detalhe. */
export function readDesconto(summary: SalesSummary): Insight | null {
  const desconto = toNumber(summary.breakdown.discount_total);
  const faturamento = toNumber(summary.revenue_total);
  if (desconto === null || faturamento === null || faturamento <= 0) return null;
  if (desconto <= 0) return null;

  const fatia = (desconto / faturamento) * 100;
  if (fatia < LIMIARES.descontoPesadoPct) return null;

  /*
   * SEM REPETIR O VALOR EM REAIS: ele está na linha "Descontos" da composição,
   * três linhas acima. O que a frase acrescenta é a PROPORÇÃO — R$ 158,50 não
   * diz nada sozinho, 5% do faturamento diz.
   */
  return {
    id: 'desconto',
    text: `O desconto concedido foi ${pct(fatia)} do faturamento do período.`,
  };
}

/* ==========================================================================
 * 7. RETIRADA VIROU CANAL
 * ======================================================================= */

/**
 * A fatia da retirada, quando ela deixa de ser exceção.
 *
 * Vale a frase porque retirada e entrega não custam a mesma coisa: o que sai em
 * taxa de entrega está no `breakdown`, e um terço dos pedidos sem esse custo
 * muda a conta do que sobra.
 */
export function readRetirada(summary: SalesSummary): Insight | null {
  const pickup = summary.order_types.find((item) => item.order_type === 'pickup');
  if (!pickup) return null;

  const fatia = toNumber(pickup.revenue_share_percent);
  if (fatia === null || fatia < LIMIARES.retiradaRelevantePct) return null;

  return {
    id: 'retirada',
    text: `${pct(fatia)} do faturamento veio de retirada, sem custo de entrega — é o canal a apontar para quem mora perto.`,
  };
}

/* ==========================================================================
 * 8. A FORMA DE PAGAMENTO QUE CONCENTRA
 * ======================================================================= */

/**
 * A ÚNICA COISA QUE A TELA DIZ SOBRE FORMA DE PAGAMENTO — e só quando há o que
 * dizer.
 *
 * A rota existe e devolve a tabela inteira, mas "58% em cartão de crédito" não
 * muda decisão nenhuma do lojista: vira gráfico decorativo. Há dois casos em que
 * o número vira ação, e são estes:
 *
 * - uma forma sozinha acima de `pagamentoDominantePct`: se o gateway dela cair
 *   numa sexta, cai o faturamento junto;
 * - dinheiro acima de `dinheiroAltoPct`: é troco a separar e caixa a conferir,
 *   que é operação de amanhã, não relatório.
 *
 * Fora desses dois, a seção não escreve nada sobre pagamento.
 */
export function readPagamento(payments: ReportPaymentMethods | null): Insight | null {
  if (!payments || payments.payment_methods.length === 0) return null;

  const ordenadas = [...payments.payment_methods].sort(
    (a, b) => toNumberOrZero(b.revenue_share_percent) - toNumberOrZero(a.revenue_share_percent),
  );

  const dinheiro = ordenadas.find((item) => item.payment_method === 'cash');
  const fatiaDinheiro = toNumber(dinheiro?.revenue_share_percent);
  if (fatiaDinheiro !== null && fatiaDinheiro >= LIMIARES.dinheiroAltoPct) {
    return {
      id: 'pagamento-dinheiro',
      text: `${pct(fatiaDinheiro)} do faturamento entra em dinheiro — é troco a separar antes do turno.`,
    };
  }

  const maior = ordenadas[0];
  const fatiaMaior = toNumber(maior?.revenue_share_percent);
  if (!maior || fatiaMaior === null || fatiaMaior < LIMIARES.pagamentoDominantePct) return null;

  /*
   * A forma NULA não vira "Outro" (ver `paymentMethodLabel`): "Outro" é uma
   * forma de pagamento de verdade, escolhível na configuração da filial. Nulo é
   * pedido cuja forma ninguém registrou — e concentrar 70% do faturamento em
   * pedidos sem forma registrada é uma frase bem diferente de "70% em Pix".
   */
  const rotulo = paymentMethodLabel(maior.payment_method, PAYMENT_METHOD_LABELS);

  return {
    id: 'pagamento-dominante',
    text: `${pct(fatiaMaior)} do faturamento entra por ${rotulo} — se ela sair do ar, sai o faturamento junto.`,
  };
}

/* ==========================================================================
 * A TELA TEM O QUE MOSTRAR?
 * ======================================================================= */

/**
 * Não houve venda nenhuma no período.
 *
 * Seis seções zeradas não dizem "não vendeu": dizem "a tela quebrou". Com esta
 * conferência a página escreve a frase e para — e ainda assim mostra os pedidos
 * excluídos, porque um período com zero faturado e três cancelados é
 * exatamente o caso em que o lojista precisa saber que os três existem.
 */
export function semMovimento(summary: SalesSummary | null): boolean {
  if (!summary) return false;
  return summary.orders_count === 0;
}
