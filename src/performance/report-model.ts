/**
 * A leitura dos relatórios — e é aqui que moram as armadilhas do contrato.
 *
 * Nenhuma delas o `npm run typecheck` pega: os tipos batem, a tela monta, e o
 * número sai errado. Por isso cada uma tem função nomeada e teste próprio em
 * vez de virar uma expressão solta dentro do JSX.
 */
import type { MetricComparison } from '../api/types';
import { daysAgoInOperationTimezone, todayInOperationTimezone } from '../orders/format';

/* ==========================================================================
 * 1. DINHEIRO VEM COMO STRING
 * ======================================================================= */

/**
 * O `Number()` explícito, num lugar só.
 *
 * Quase todo valor monetário dos relatórios é `string` no contrato
 * (`revenue_total`, `average_ticket`, `commission_total`, …) — decimal
 * serializado como texto para não perder precisão no JSON. `formatCurrency`
 * já aceita string, mas QUALQUER outra coisa que se faça com o valor —
 * comparar, somar, achar o máximo para a escala do gráfico — precisa do
 * número.
 *
 * O perigo é silencioso e específico: com strings, `'9' > '10'` é `true`, e a
 * barra mais alta do gráfico seria a do dia errado sem nada quebrar.
 *
 * Devolve `null` no que não é número, para que a tela mostre "—" em vez de
 * `NaN`.
 */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  /*
   * A STRING VAZIA SAI ANTES DO `Number()`, e este é o ponto da conferência:
   * `Number('')` é **0**, não `NaN`. Sem esta linha, um campo que chegasse
   * vazio viraria "R$ 0,00" na tela — um faturamento de zero reais, afirmado
   * com todas as letras, no lugar de "não sei". `Number.isFinite` não pega:
   * zero é finito. O mesmo vale para " " e para "\n".
   */
  if (typeof value === 'string' && value.trim() === '') return null;

  const numeric = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
}

/** O mesmo, para quando a tela precisa de um número e zero é resposta válida. */
export function toNumberOrZero(value: string | number | null | undefined): number {
  return toNumber(value) ?? 0;
}

/* ==========================================================================
 * 2. `change_percent` NULO É "SEM COMPARAÇÃO", NUNCA 0%
 * ======================================================================= */

export type ChangeReading = {
  /** O que se escreve na tela. */
  text: string;
  /**
   * Para onde a variação aponta. `none` cobre os dois casos em que não há
   * seta: sem comparação possível, e variação exatamente zero.
   */
  direction: 'up' | 'down' | 'none';
  /** Não há período anterior contra o que comparar. */
  isMissing: boolean;
};

/**
 * A leitura de uma `MetricComparison`.
 *
 * `change_percent` NULO TEM SIGNIFICADO, e a descrição da rota o diz com todas
 * as letras: "vem nulo quando o período anterior foi zero; não existe variação
 * percentual a partir de zero".
 *
 * Escrever "0%" ali é afirmar que o faturamento ficou igual ao da semana
 * passada — quando a verdade é que na semana passada não houve faturamento
 * nenhum. É a diferença entre "estagnou" e "é a primeira semana da loja", e as
 * duas frases levam o lojista a decisões opostas.
 *
 * Um `??  0` nessa linha compila, passa no teste de tipo e mente.
 */
export function readChange(comparison: MetricComparison, previousLabel: string): ChangeReading {
  const percent = toNumber(comparison.change_percent);

  if (percent === null) {
    return {
      /*
       * A FRASE NÃO CONCORDA COM O RÓTULO, e por isso não o usa.
       *
       * `previousLabel` tanto é "os 7 dias anteriores" quanto "o período
       * anterior", e qualquer verbo colado nele erra a concordância num dos
       * dois: "os 7 dias anteriores não TEVE movimento". A frase fixa é
       * gramatical sempre, e o rótulo continua aparecendo onde ele importa —
       * no texto da variação que existe ("+25% vs. os 7 dias anteriores").
       */
      text: `sem comparação — não houve movimento no período anterior`,
      direction: 'none',
      isMissing: true,
    };
  }

  const arredondado = Math.round(percent * 10) / 10;
  const sinal = arredondado > 0 ? '+' : '';
  const formatado = `${sinal}${arredondado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  return {
    text: `${formatado} vs. ${previousLabel}`,
    direction: arredondado > 0 ? 'up' : arredondado < 0 ? 'down' : 'none',
    isMissing: false,
  };
}

/* ==========================================================================
 * 3. FORMA DE PAGAMENTO NULA NÃO É "OUTRO"
 * ======================================================================= */

/**
 * O rótulo de uma forma de pagamento no relatório.
 *
 * `null` é "pedido sem forma registrada" — e a descrição da rota avisa que ele
 * "continua nulo na resposta — não vira 'other', que é uma forma de pagamento
 * de verdade".
 *
 * `PAYMENT_METHOD_LABELS` tem uma entrada `other: 'Outro'`, então cair no
 * `labelFor` com `null` daria "—" e cair nela com a string `'other'` daria
 * "Outro". Nenhum dos dois é o que aconteceu: o pedido existe, o dinheiro
 * entrou, e ninguém registrou como. É isso que a linha precisa dizer, porque é
 * isso que o lojista vai investigar.
 */
export function paymentMethodLabel(
  method: string | null | undefined,
  dictionary: Record<string, string>,
): string {
  if (method === null || method === undefined) return 'Sem forma registrada';
  return dictionary[method] ?? method;
}

/* ==========================================================================
 * 4. O PERÍODO, EM DATAS DA OPERAÇÃO
 * ======================================================================= */

export type PerformancePreset = 'last7' | 'last30' | 'custom';

export type PerformanceRange = {
  preset: PerformancePreset;
  startDate: string; // AAAA-MM-DD
  endDate: string; // AAAA-MM-DD
};

/**
 * O nome do período anterior, para a frase da comparação.
 *
 * Vem do PRESET e não da contagem de dias porque é assim que o lojista pensa no
 * que está vendo: "vs. os 7 dias anteriores". Em "Escolher…" não há nome curto
 * honesto — o período tem o tamanho que ele escolheu —, então a frase diz o
 * genérico.
 */
export function previousLabelFor(preset: PerformancePreset): string {
  if (preset === 'last7') return 'os 7 dias anteriores';
  if (preset === 'last30') return 'os 30 dias anteriores';
  return 'o período anterior';
}

/**
 * A tela abre em 7 dias.
 *
 * Não em "hoje": um relatório de um dia só compara com ontem, e a pergunta que
 * Desempenho responde ("como a loja está indo") não se responde com a diferença
 * entre uma terça e uma segunda.
 */
export function defaultRange(): PerformanceRange {
  return { preset: 'last7', ...datesForPreset('last7', { startDate: '', endDate: '' }) };
}

/**
 * Traduz o atalho em datas concretas, no fuso da OPERAÇÃO.
 *
 * `daysAgoInOperationTimezone(6)` e não `(7)`: o período inclui hoje, então
 * sete dias são hoje mais os seis anteriores. Com `(7)` o relatório teria oito
 * dias e a comparação com "os 7 anteriores" deixaria de bater.
 */
export function datesForPreset(
  preset: PerformancePreset,
  current: { startDate: string; endDate: string },
): { startDate: string; endDate: string } {
  if (preset === 'last7') {
    return { startDate: daysAgoInOperationTimezone(6), endDate: todayInOperationTimezone() };
  }
  if (preset === 'last30') {
    return { startDate: daysAgoInOperationTimezone(29), endDate: todayInOperationTimezone() };
  }

  /*
   * "Escolher…" DEVOLVE UM OBJETO NOVO COM AS DUAS CHAVES, e não `current`
   * inteiro — foi por isso que o atalho não funcionava.
   *
   * Quem chama escreve `{ preset, ...datesForPreset(preset, current) }`. Com
   * `return current`, o spread vinha DEPOIS de `preset` e trazia junto todas as
   * outras chaves do objeto recebido, inclusive o `preset` ANTIGO — que
   * sobrescrevia o novo. Clicar em "Escolher…" gravava `preset: 'last7'` de
   * volta, os campos de data nunca apareciam, e nada quebrava: o tipo de
   * retorno declarado (`{startDate, endDate}`) é um subconjunto do que era
   * devolvido, então o TypeScript concordava.
   */
  return { startDate: current.startDate, endDate: current.endDate };
}

/**
 * O período escolhido faz sentido?
 *
 * A rota devolve 422 com data invertida, e o 422 chega na tela como uma frase
 * de validação do Pydantic — pior de ler que a frase daqui. Só vale para
 * "Escolher…": os atalhos montam o par sozinhos.
 */
export function rangeProblem(range: PerformanceRange): string | null {
  if (!range.startDate || !range.endDate) return 'Escolha as duas datas do período.';
  if (range.startDate > range.endDate) return 'A data inicial é depois da final.';
  return null;
}

/**
 * O período imediatamente anterior, do mesmo tamanho.
 *
 * PARA QUE ELE EXISTE: a frase de causa ("puxado por terça e sábado") compara
 * o dia a dia do período atual com o do anterior, e `/reports/sales-by-day` só
 * responde pelo intervalo que recebe — é preciso pedir duas vezes. O `summary`
 * devolve `previous_period`, mas ele chega junto com os outros relatórios; usar
 * aquele valor obrigaria a segunda chamada a esperar a primeira, em série, para
 * uma frase que é enfeite. A conta é a mesma do backend: mesmo tamanho,
 * terminando no dia anterior ao início.
 *
 * A ARITMÉTICA É EM UTC de propósito, e não no fuso da operação. Estas são
 * datas de CALENDÁRIO (AAAA-MM-DD), não instantes: somar 86.400.000 ms num
 * fuso com horário de verão pularia ou repetiria um dia. Em UTC não há salto,
 * e o resultado volta a ser texto antes de qualquer outra coisa tocar nele.
 */
export function previousRange(range: { startDate: string; endDate: string }): {
  startDate: string;
  endDate: string;
} | null {
  const inicio = Date.parse(`${range.startDate}T12:00:00Z`);
  const fim = Date.parse(`${range.endDate}T12:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) return null;

  const dia = 86_400_000;
  const dias = Math.round((fim - inicio) / dia) + 1;
  const fimAnterior = inicio - dia;
  const inicioAnterior = fimAnterior - (dias - 1) * dia;

  return { startDate: isoDay(inicioAnterior), endDate: isoDay(fimAnterior) };
}

/**
 * O dia AAAA-MM-DD de um instante ancorado ao MEIO-DIA UTC.
 *
 * Os únicos `timestamp` que chegam aqui saem de `Date.parse(`${dia}T12:00:00Z`)`
 * mais um número inteiro de dias — e meio-dia UTC ± N dias continua sendo
 * meio-dia UTC, longe das duas bordas. Passar `Date.now()` para cá daria o dia
 * UTC, que às 22h em Fortaleza já é o de amanhã.
 */
function isoDay(timestamp: number): string {
  // fuso-ok: a entrada é sempre meio-dia UTC — ver o bloco acima.
  return new Date(timestamp).toISOString().slice(0, 10);
}

/* ==========================================================================
 * 5. O RÓTULO DO DIA — E A ARMADILHA DE FUSO QUE ELE EVITA
 * ======================================================================= */

/**
 * "16/08" a partir do `2026-08-16` que o contrato manda.
 *
 * ELE NÃO USA `Date`, E É O PONTO DA FUNÇÃO.
 *
 * `new Date('2026-08-16')` é interpretado como MEIA-NOITE UTC — que em
 * America/Fortaleza (UTC−3) é 21h do dia 15. Formatar isso no fuso da operação
 * devolveria "15/08": o gráfico inteiro deslocado um dia, com o pico do sábado
 * aparecendo na sexta, e nada quebrando.
 *
 * O campo `day` já É o dia da operação, resolvido pelo backend ("o dia é o dia
 * local: um pedido das 22h de sexta conta na sexta"). Ele não precisa de
 * conversão nenhuma — precisa ser lido como texto.
 */
export function dayLabel(day: string): string {
  const [, mes, dia] = day.split('-');
  if (!mes || !dia) return day;
  return `${dia}/${mes}`;
}

/*
 * O dia da semana pede um `Date`, e aí a âncora é meio-dia UTC lido em UTC —
 * os dois lados no mesmo fuso, então nenhum deslocamento é possível. Usar o
 * fuso da operação aqui traria de volta exatamente o bug que `dayLabel` evita.
 */
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

/** "sáb, 16/08" — o dia da semana é o que faz um pico virar padrão. */
export function dayFullLabel(day: string): string {
  const anchor = Date.parse(`${day}T12:00:00Z`);
  if (Number.isNaN(anchor)) return dayLabel(day);
  const semana = weekdayFormatter.format(new Date(anchor)).replace('.', '');
  return `${semana}, ${dayLabel(day)}`;
}

/* ==========================================================================
 * 6. A ESCALA DO GRÁFICO
 * ======================================================================= */

/**
 * O teto do eixo do gráfico de dias.
 *
 * Sai de `toNumber` em cada dia, e não de uma comparação entre as strings do
 * contrato — ver o comentário de `toNumber`.
 *
 * Devolve 0 quando não houve faturamento nenhum, e quem desenha trata esse
 * caso: dividir por zero daria barra de altura `NaN`, que o SVG desenha como
 * nada e ninguém percebe que quebrou.
 */
export function maxRevenue(days: readonly { revenue_total: string }[]): number {
  return days.reduce((maior, day) => Math.max(maior, toNumberOrZero(day.revenue_total)), 0);
}

/**
 * O piso da coluna de um dia QUE VENDEU.
 *
 * Ele existe porque a escala linear tem um defeito real quando um dia domina: com
 * R$ 1.240 no sábado e R$ 9 na terça, a terça vira 0,7% da altura — meio pixel,
 * indistinguível de um dia fechado. A escala continua linear e verdadeira em
 * tudo o que se compara; o piso só garante que "vendeu pouquíssimo" não seja
 * desenhado como "não vendeu", que é outra afirmação.
 */
export const MIN_BAR_RATIO = 0.06;

/**
 * A altura da barra de um dia, de 0 a 1.
 *
 * ZERO CONTINUA ZERO — e é justamente por isso que o piso acima só se aplica
 * a quem faturou alguma coisa. Um dia sem venda é uma informação, e desenhá-lo
 * com dois pixels seria dizer que vendeu pouco.
 */
export function barRatio(revenue: string, max: number): number {
  if (max <= 0) return 0;

  const valor = toNumberOrZero(revenue);
  if (valor <= 0) return 0;

  const razao = Math.min(1, Math.max(0, valor / max));
  return Math.max(MIN_BAR_RATIO, razao);
}

/* ==========================================================================
 * 7. TAXA SE COMPARA EM PONTOS PERCENTUAIS
 * ======================================================================= */

/**
 * A variação de uma TAXA (cancelamento) entre dois períodos.
 *
 * NÃO É `readChange`. De 6,5% para 10% de cancelamento, a variação percentual
 * seria "+53,8%" — verdade aritmética e mentira de leitura: o dono entende
 * que perdeu metade a mais dos pedidos. A diferença em pontos percentuais
 * ("+3,5 p.p.") é o que ele confere de cabeça, e é como taxa se compara.
 *
 * O período anterior vem de uma SEGUNDA chamada de `/reports/cancellations`
 * (o relatório não traz comparação própria), então há dois jeitos de não
 * haver comparação, e a frase separa os dois:
 * - `null`: a rota respondeu, e `cancellation_rate_percent` veio nulo — não
 *   houve pedido nenhum no período anterior. Não é 0% de cancelamento.
 * - `undefined`: a chamada falhou. A tela não sabe, e diz que não sabe.
 */
export function readRateChange(
  atual: string | number | null | undefined,
  anterior: string | number | null | undefined,
  previousLabel: string,
): ChangeReading {
  const taxaAtual = toNumber(atual);

  if (anterior === undefined) {
    return {
      text: `sem comparação — não deu para ler ${previousLabel}`,
      direction: 'none',
      isMissing: true,
    };
  }

  const taxaAnterior = toNumber(anterior);
  if (taxaAtual === null || taxaAnterior === null) {
    return {
      text: `sem comparação — não houve pedido no período anterior`,
      direction: 'none',
      isMissing: true,
    };
  }

  const diferenca = Math.round((taxaAtual - taxaAnterior) * 10) / 10;
  const sinal = diferenca > 0 ? '+' : '';
  const formatada = `${sinal}${diferenca.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;

  return {
    text: `${formatada} p.p. vs. ${previousLabel}`,
    direction: diferenca > 0 ? 'up' : diferenca < 0 ? 'down' : 'none',
    isMissing: false,
  };
}

/* ==========================================================================
 * 8. A VARIAÇÃO QUE NÃO SE DEVE MOSTRAR
 * ======================================================================= */

/**
 * QUANTOS PEDIDOS O PERÍODO ANTERIOR PRECISA TER para que a variação
 * percentual signifique alguma coisa.
 *
 * O caso real: o Júnior abre a tela com 1 pedido na semana passada e 200 nesta.
 * `change_percent` chega correto — `+19.900%` — e a tela pinta um número que
 * não é informação nenhuma: ele mede o tamanho da base, não o desempenho da
 * loja. O inverso é pior: 1 pedido antes e 0 agora vira `-100%` em vermelho
 * numa loja que simplesmente ainda não vendeu hoje.
 *
 * CINCO É UM CORTE ESCOLHIDO, não medido, e é por isso que ele tem nome e mora
 * aqui em vez de virar um `< 5` solto dentro do JSX. A régua: abaixo de cinco
 * pedidos, um único pedido a mais ou a menos move a variação em vinte pontos
 * percentuais ou mais — e nenhuma decisão de restaurante se toma sobre isso.
 *
 * O que a tela mostra no lugar NÃO é um travessão mudo: é a base ("1 pedido no
 * período anterior"), que é a resposta verdadeira para "por que não tem
 * variação aqui".
 */
export const BASE_MINIMA_PARA_VARIACAO = 5;

/**
 * O TETO DA VARIAÇÃO EXIBIDA.
 *
 * Acima disto o número deixa de ser lido como número e vira ruído tipográfico:
 * "+19.900%" ocupa a largura de um cartão inteiro e diz menos que "cresceu
 * muito". O corte é dito com o sinal de maior, não escondido — quem quiser o
 * valor exato tem a base e o atual escritos no mesmo cartão.
 */
export const VARIACAO_MAXIMA_PCT = 999;

/**
 * A leitura de uma `MetricComparison` COM O TAMANHO DA BASE NA CONTA.
 *
 * É esta que a tela usa, e não `readChange` direto: as duas armadilhas que ela
 * fecha (base minúscula e percentual estratosférico) não aparecem em nenhum
 * teste de tipo e só se manifestam na loja que acabou de abrir — que é
 * exatamente quem mais precisa que o painel não pareça quebrado.
 *
 * `pedidosAnteriores` NULO é "não sei quantos foram", e aí a guarda não roda:
 * inventar uma base para poder escondê-la seria trocar um defeito por outro.
 * Quem tem o número é `orders_count_comparison.previous`, e ele qualifica os
 * TRÊS números do resumo — faturamento, pedidos e ticket saem todos da mesma
 * contagem de pedidos.
 */
export function readChangeComBase(
  comparison: MetricComparison,
  previousLabel: string,
  pedidosAnteriores: number | null,
): ChangeReading {
  if (pedidosAnteriores !== null && pedidosAnteriores < BASE_MINIMA_PARA_VARIACAO) {
    return {
      // Frase fixa, pelo mesmo motivo de `readChange`: "1 pedido em os 7 dias
      // anteriores" é o que sai ao colar o rótulo numa preposição.
      text:
        pedidosAnteriores === 1
          ? `sem comparação — 1 pedido no período anterior`
          : `sem comparação — ${pedidosAnteriores} pedidos no período anterior`,
      direction: 'none',
      isMissing: true,
    };
  }

  const leitura = readChange(comparison, previousLabel);
  const percent = toNumber(comparison.change_percent);
  if (percent === null || Math.abs(percent) <= VARIACAO_MAXIMA_PCT) return leitura;

  const sinal = percent > 0 ? '+' : '−';
  return {
    ...leitura,
    text: `mais de ${sinal}${VARIACAO_MAXIMA_PCT}% vs. ${previousLabel}`,
  };
}

/**
 * A TAXA TEM BASE PARA SER LIDA COMO TAXA?
 *
 * O mesmo corte de `BASE_MINIMA_PARA_VARIACAO`, aplicado ao VALOR e não à
 * variação. O caso que o obrigou: num período sem venda nenhuma com dois
 * pedidos cancelados, `cancellation_rate_percent` vem `"100.0"` — certo, e
 * ilegível como manchete de 28px. "100% de cancelamento" faz o lojista pensar
 * que a operação parou; o que houve foi que entraram dois pedidos.
 *
 * O denominador é TODOS os pedidos do período (faturados mais excluídos), que é
 * o mesmo que o backend usa — recalcular só sobre os faturados daria outro
 * número, e é a armadilha que a ressalva do rodapé já existe para desarmar.
 *
 * Sem base, a tela mostra travessão E a contagem: "2 pedidos · R$ 96,00" é a
 * informação de verdade, e ela cabe inteira sem inventar uma taxa.
 */
export function taxaTemBase(pedidosNoPeriodo: number): boolean {
  return pedidosNoPeriodo >= BASE_MINIMA_PARA_VARIACAO;
}
