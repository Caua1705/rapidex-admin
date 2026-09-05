/**
 * O modelo do gráfico de linha — a série no tempo, com o período anterior.
 *
 * Tudo aqui é aritmética pura sobre `SalesByDayItem`, sem DOM e sem React, e
 * por isso tem teste próprio: o gráfico é a peça em que um número errado é o
 * mais difícil de ver (a linha continua parecendo uma linha).
 *
 * TRÊS DECISÕES, E CADA UMA É UMA ARMADILHA EVITADA:
 *
 * 1. **Os dois períodos se alinham pela POSIÇÃO, não pela data.** O 1º dia
 *    deste período fica sobre o 1º do anterior. É a única comparação que faz
 *    sentido para "estou vendendo mais que antes": segunda sobre segunda,
 *    sábado sobre sábado — o backend monta o anterior com o mesmo tamanho,
 *    terminando na véspera do atual, então as posições coincidem no dia da
 *    semana. Alinhar por data sobreporia nada com nada.
 *
 * 2. **Dinheiro vira número ANTES de qualquer comparação.** `revenue_total` é
 *    string no contrato, e `'9' > '10'` é verdade em string. O teto da escala
 *    sairia do dia errado e a linha inteira ficaria achatada sem nada quebrar
 *    — a mesma armadilha de `maxRevenue`, em `report-model.ts`.
 *
 * 3. **Dia sem par é um BURACO na linha, não um zero.** O período anterior
 *    pode não ter chegado (a segunda chamada falhou) ou ser mais curto
 *    (borda de calendário). Puxar a linha para o chão diria "não vendeu
 *    nada naquele dia", que é outra afirmação.
 */
import type { SalesByDayItem } from '../api/types';
import { formatCurrency } from '../orders/format';
import { toNumberOrZero } from './report-model';

/** O que a linha mede. As duas vêm do MESMO `sales-by-day`. */
export type Medida = 'faturamento' | 'pedidos';

export type PontoDaLinha = {
  day: string;
  atual: number;
  /** Nulo = sem par no período anterior. Não é zero. */
  anterior: number | null;
  diaAnterior: string | null;
};

function valorDe(item: SalesByDayItem, medida: Medida): number {
  return medida === 'pedidos' ? item.orders_count : toNumberOrZero(item.revenue_total);
}

/** Os pontos dos dois períodos, alinhados pela posição (ver o cabeçalho). */
export function pontosDaLinha(
  atual: readonly SalesByDayItem[],
  anterior: readonly SalesByDayItem[] | null,
  medida: Medida,
): PontoDaLinha[] {
  return atual.map((item, index) => {
    const par = anterior?.[index] ?? null;
    return {
      day: item.day,
      atual: valorDe(item, medida),
      anterior: par ? valorDe(par, medida) : null,
      diaAnterior: par ? par.day : null,
    };
  });
}

/**
 * O teto do eixo: o maior valor entre as DUAS séries.
 *
 * O anterior também segura a escala. Se só o atual contasse, um período
 * anterior maior sairia pelo topo do gráfico — e o que está fora do quadro
 * não se compara.
 */
export function tetoDaEscala(pontos: readonly PontoDaLinha[]): number {
  return pontos.reduce((maior, ponto) => Math.max(maior, ponto.atual, ponto.anterior ?? 0), 0);
}

/** Coordenadas em 0–100 nos dois eixos; `y` cresce para baixo, como no SVG. */
function coordenadas(
  pontos: readonly PontoDaLinha[],
  teto: number,
  serie: 'atual' | 'anterior',
): ({ x: number; y: number } | null)[] {
  const ultimo = pontos.length - 1;
  return pontos.map((ponto, index) => {
    const valor = ponto[serie];
    if (valor === null) return null;
    // Um ponto só fica no meio: `index / 0` seria NaN e o SVG não desenharia.
    const x = ultimo === 0 ? 50 : (index / ultimo) * 100;
    const y = 100 - (valor / teto) * 100;
    return { x: arredonda(x), y: arredonda(y) };
  });
}

function arredonda(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/**
 * O `d` do `<path>` de uma série.
 *
 * Um ponto sem valor QUEBRA o traço: o próximo ponto com valor recomeça com
 * `M`. Ligar por cima do buraco desenharia uma reta entre dois dias que não
 * são vizinhos, e puxar para zero afirmaria uma venda de zero.
 */
export function caminhoDaSerie(
  pontos: readonly PontoDaLinha[],
  teto: number,
  serie: 'atual' | 'anterior',
): string {
  if (teto <= 0) return '';

  let caminho = '';
  let aberto = false;
  for (const ponto of coordenadas(pontos, teto, serie)) {
    if (!ponto) {
      aberto = false;
      continue;
    }
    caminho += `${caminho ? ' ' : ''}${aberto ? 'L' : 'M'}${ponto.x} ${ponto.y}`;
    aberto = true;
  }
  return caminho;
}

/**
 * A área sob a linha DESTE período, fechada na base — o preenchimento tonal
 * que separa "este período" do tracejado do anterior sem cor nova.
 *
 * Só desenha quando a série não tem buraco: a série atual vem inteira do
 * backend ("todos os dias do período, inclusive os sem venda"), então o buraco
 * aqui seria defeito, e uma área com furo desenharia o defeito como forma.
 */
export function areaDaSerieAtual(pontos: readonly PontoDaLinha[], teto: number): string {
  if (teto <= 0 || pontos.length === 0) return '';

  const pontosXY = coordenadas(pontos, teto, 'atual');
  const primeiro = pontosXY[0];
  const ultimo = pontosXY[pontosXY.length - 1];
  if (!primeiro || !ultimo || pontosXY.some((ponto) => ponto === null)) return '';

  const linha = caminhoDaSerie(pontos, teto, 'atual');
  return `${linha} L${ultimo.x} 100 L${primeiro.x} 100 Z`;
}

/** As coordenadas de um ponto deste período, para posicionar o marcador em HTML. */
export function posicaoDoPonto(
  pontos: readonly PontoDaLinha[],
  teto: number,
  index: number,
): { x: number; y: number } | null {
  return coordenadas(pontos, teto, 'atual')[index] ?? null;
}

/**
 * O dia de pico DESTE período — o extremo é o que o olho procura primeiro.
 * Nulo sem movimento: um pico de zero não é pico, e rotulá-lo diria "vendeu
 * pouco" sobre um período em que não se vendeu.
 */
export function indiceDoPico(pontos: readonly PontoDaLinha[]): number | null {
  let melhor: number | null = null;
  pontos.forEach((ponto, index) => {
    if (ponto.atual <= 0) return;
    if (melhor === null || ponto.atual > (pontos[melhor]?.atual ?? 0)) melhor = index;
  });
  return melhor;
}

/** O valor escrito na medida certa: reais, ou a contagem com a palavra. */
export function rotuloDaMedida(medida: Medida, valor: number): string {
  if (medida === 'faturamento') return formatCurrency(valor);
  return valor === 1 ? '1 pedido' : `${valor} pedidos`;
}

/* ==========================================================================
 * O AGRUPAMENTO — dia ou semana, conforme o tamanho do período
 * ======================================================================= */

/** Como a série é balde a balde. `hora` NÃO existe: ver `agrupamentoDoPeriodo`. */
export type Agrupamento = 'dia' | 'semana';

/**
 * ATÉ QUANTOS DIAS A SÉRIE CONTINUA SENDO DIÁRIA.
 *
 * Trinta e um pontos numa faixa de 1200px dão 38px por ponto — cabe. Noventa
 * dão 13px, e aí a linha deixa de ter forma legível: o olho vê ruído, e o
 * lojista não consegue apontar um dia. Acima do corte, a semana vira o balde.
 */
export const DIAS_ATE_AGRUPAR_POR_SEMANA = 31;

/**
 * O agrupamento de um período.
 *
 * **A HORA NÃO ESTÁ AQUI, e não é esquecimento.** Nenhuma das seis rotas de
 * relatório desce abaixo do dia — `admin_report_service.py` não tem `extract
 * (hour)` nem `date_trunc` em lugar nenhum. Um agrupamento por hora só poderia
 * sair de estimativa, e estimativa nesta tela é proibida. O pedido ao backend
 * está em `scratchpad/pedido-backend-desempenho.md`.
 */
export function agrupamentoDoPeriodo(dias: number): Agrupamento {
  return dias > DIAS_ATE_AGRUPAR_POR_SEMANA ? 'semana' : 'dia';
}

/**
 * A série somada de sete em sete, a partir do PRIMEIRO dia do período.
 *
 * O corte é por POSIÇÃO na série, não por segunda-feira do calendário, e é a
 * mesma decisão do alinhamento entre os dois períodos (ver o cabeçalho): o que
 * se compara é "os sete primeiros dias contra os sete primeiros dias", e um
 * corte de calendário deixaria o primeiro balde com dois dias num período que
 * começou numa sexta.
 *
 * O rótulo do balde é o dia em que ele COMEÇA — e o balde final pode ter menos
 * de sete dias, o que é verdade e não defeito: ele é a semana em curso.
 */
export function agruparPorSemana(dias: readonly SalesByDayItem[]): SalesByDayItem[] {
  const baldes: SalesByDayItem[] = [];

  for (let i = 0; i < dias.length; i += 7) {
    const semana = dias.slice(i, i + 7);
    const primeiro = semana[0];
    if (!primeiro) continue;

    baldes.push({
      day: primeiro.day,
      revenue_total: semana
        .reduce((soma, dia) => soma + toNumberOrZero(dia.revenue_total), 0)
        .toFixed(2),
      orders_count: semana.reduce((soma, dia) => soma + dia.orders_count, 0),
    });
  }

  return baldes;
}

/** A série já no balde certo para o período — o único ponto que decide isso. */
export function serieAgrupada(
  dias: readonly SalesByDayItem[],
  agrupamento: Agrupamento,
): SalesByDayItem[] {
  return agrupamento === 'semana' ? agruparPorSemana(dias) : [...dias];
}

/* ==========================================================================
 * O EIXO — poucos rótulos, e nenhum deles inventado
 * ======================================================================= */

export type MarcaDoEixo = { valor: number; y: number; rotulo: string };

/**
 * As marcas do eixo Y: o teto, o meio e o chão.
 *
 * TRÊS, E NÃO CINCO OU DEZ. O eixo aqui não existe para se ler um valor exato
 * — quem dá o valor exato é o balão e a tabela equivalente. Ele existe para
 * dar ESCALA: "a linha está na metade" é a leitura que ele serve, e três
 * marcas bastam. Dez viram uma grade de papel milimetrado por cima do dado.
 *
 * Sem teto (período sem venda nenhuma) devolve vazio: uma régua de zero a zero
 * mediria o nada, e desenhá-la faria a tela afirmar uma escala que não existe.
 */
export function marcasDoEixo(teto: number, medida: Medida): MarcaDoEixo[] {
  if (teto <= 0) return [];

  return [1, 0.5, 0].map((fracao) => ({
    valor: teto * fracao,
    y: (1 - fracao) * 100,
    rotulo: rotuloCurto(medida, teto * fracao),
  }));
}

/**
 * O rótulo do eixo, curto.
 *
 * `formatCurrency` de R$ 1.240,00 mede 78px, e três deles empilhados na margem
 * esquerda comem a largura da série. Na escala de dinheiro o eixo abrevia o
 * milhar ("1,2 mil") — e ele PODE abreviar porque não é a leitura precisa:
 * quem quer o valor exato tem o balão e a tabela.
 */
export function rotuloCurto(medida: Medida, valor: number): string {
  if (medida === 'pedidos') return String(Math.round(valor));
  if (valor >= 1000) {
    const milhares = Math.round((valor / 1000) * 10) / 10;
    return `${milhares.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return formatCurrency(valor);
}

/* ==========================================================================
 * O BALÃO — o valor, e a diferença contra o mesmo ponto do período anterior
 * ======================================================================= */

export type DiferencaDoPonto = {
  texto: string;
  direcao: 'up' | 'down' | 'none';
};

/**
 * A diferença de um ponto contra o par dele no período anterior.
 *
 * ELA É EM VALOR ABSOLUTO, e não em percentual, e é de propósito: um dia é a
 * unidade em que o percentual mais mente — R$ 9 contra R$ 3 é "+200%" e são
 * seis reais. O balão de um ponto responde "quanto a mais que naquele dia", e
 * a resposta é dinheiro (ou pedidos), não taxa.
 *
 * Sem par no período anterior devolve `null`: o balão fica com o valor do dia,
 * sem uma linha de comparação com nada.
 */
export function diferencaDoPonto(ponto: PontoDaLinha, medida: Medida): DiferencaDoPonto | null {
  if (ponto.anterior === null) return null;

  const delta = ponto.atual - ponto.anterior;
  const arredondado = medida === 'pedidos' ? Math.round(delta) : Math.round(delta * 100) / 100;

  if (arredondado === 0) {
    return { texto: `igual ao mesmo ponto do período anterior`, direcao: 'none' };
  }

  const sinal = arredondado > 0 ? '+' : '−';
  const magnitude = rotuloDaMedida(medida, Math.abs(arredondado));
  return {
    texto: `${sinal}${magnitude} vs. o período anterior`,
    direcao: arredondado > 0 ? 'up' : 'down',
  };
}
