/**
 * ============================================================================
 * A HORA DOS CANCELAMENTOS — e de onde ela vem, já que o relatório não a tem
 * ============================================================================
 *
 * A PERGUNTA: cancelamento concentrado às 20h e cancelamento espalhado pelo dia
 * são dois problemas diferentes. O primeiro é operação no pico — entregador que
 * não apareceu, cozinha que estourou o tempo, forma de pagamento que caiu na
 * hora do movimento. O segundo é cardápio, preço ou área de entrega. A seção
 * "O que não virou venda" sabia dizer O QUÊ (situação e pagamento) e não sabia
 * dizer QUANDO, que é onde o padrão aparece.
 *
 * ----------------------------------------------------------------------------
 * O DADO NÃO VEM DO RELATÓRIO DE CANCELAMENTOS, E ISSO É PARTE DO CONTRATO
 * ----------------------------------------------------------------------------
 *
 * `/admin/reports/cancellations` devolve `breakdown[]` cruzando SITUAÇÃO com
 * SITUAÇÃO DE PAGAMENTO, e mais nada: não há hora, não há dia, não há série.
 * Nenhuma das seis rotas de relatório tem recorte mais fino que o dia.
 *
 * Quem tem hora é `GET /admin/orders`: cada `AdminOrderListItem` carrega
 * `created_at`, e a rota aceita `branch_id`, `start_date`, `end_date` e UM
 * `status`. Então a hora se monta aqui, com o mesmo período e o mesmo recorte
 * de filial dos relatórios, e sem rota nova.
 *
 * DUAS RESSALVAS QUE A TELA PRECISA DIZER, porque nenhuma some sozinha:
 *
 * 1. **`created_at` é a hora em que o pedido ENTROU, não a hora em que ele foi
 *    cancelado.** O contrato não devolve o instante do cancelamento na
 *    listagem. Para a pergunta que a seção faz — "o que acontece no meu pico?"
 *    — a hora de entrada é a certa, porque é ela que localiza o pedido no
 *    movimento da loja. Mas ela NÃO é a hora do cancelamento, e chamá-la assim
 *    na tela seria uma mentira barata.
 *
 * 2. **A listagem é paginada e o teto é 100.** Um período longo pode ter mais
 *    cancelamentos do que `HORAS_MAX_PAGINAS` alcança. Quando isso acontece a
 *    leitura sai de uma AMOSTRA, e a tela escreve de quantos ela saiu — em vez
 *    de apresentar um recorte silencioso como se fosse o período inteiro.
 *
 * A HORA É A DA OPERAÇÃO (America/Fortaleza), não a do navegador — o mesmo
 * fuso que o backend usa para fechar o dia. Um painel aberto em Lisboa
 * apontaria o pico das 20h para meia-noite.
 */
import type { OrderListItem } from '../api/types';
import { OPERATION_TIMEZONE } from '../orders/format';

/** O teto de `limit` da rota de pedidos. O mesmo de Pedidos e da Cozinha. */
export const HORAS_PAGINA = 100;

/**
 * Quantas páginas a leitura busca, por situação, antes de declarar amostra.
 *
 * TRÊS, e não "até acabar": a leitura da hora é uma seção secundária de uma
 * tela de seis, e um período de 90 dias numa rede movimentada viraria dezenas
 * de requisições enfileiradas na frente de nada. Com 3 páginas por situação, um
 * mês de cancelamentos cabe inteiro em praticamente qualquer loja — e quando
 * não cabe, a tela diz.
 */
export const HORAS_MAX_PAGINAS = 3;

export const HORA_LIMIARES = {
  /**
   * Abaixo disto não se lê padrão nenhum, e o gráfico não é desenhado.
   *
   * Três cancelamentos num período não têm "hora de concentração": têm três
   * horas. Um gráfico de barras com três riscos convidaria o lojista a mudar a
   * operação por causa de um acaso, que é o oposto do que esta tela faz.
   */
  amostraMinima: 5,

  /** Uma hora sozinha que carregue esta fatia já é a resposta. */
  picoPct: 40,

  /** Quantas horas seguidas a janela de concentração cobre. */
  janelaHoras: 3,

  /** A janela só vira frase se carregar esta fatia dos cancelamentos. */
  janelaPct: 50,
} as const;

/* ==========================================================================
 * A HORA, NO FUSO DA OPERAÇÃO
 * ======================================================================= */

/**
 * `hourCycle: 'h23'` E NÃO `hour12: false`.
 *
 * Com `hour12: false` e `hour: '2-digit'`, boa parte das combinações de locale
 * escreve a meia-noite como **24**, não como 00 — e um balde de índice 24 num
 * vetor de 24 posições some sem erro nenhum. `h23` fixa a escala em 00–23.
 */
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hourCycle: 'h23',
  timeZone: OPERATION_TIMEZONE,
});

/** A hora da operação em que o pedido entrou. `null` no que não é data. */
export function operationHour(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const instante = Date.parse(isoDate);
  if (Number.isNaN(instante)) return null;

  const parte = hourFormatter.formatToParts(new Date(instante)).find((p) => p.type === 'hour');
  if (!parte) return null;

  const hora = Number(parte.value);
  return Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : null;
}

/** "20h" — como o lojista escreve, e como Pedidos e a Cozinha já escrevem. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}h`;
}

/* ==========================================================================
 * A LEITURA
 * ======================================================================= */

export type BaldeDeHora = { hour: number; count: number };

export type ConcentracaoDeHora = {
  /** `pico` é uma hora sozinha; `janela` são horas seguidas. */
  tipo: 'pico' | 'janela';
  inicio: number;
  fim: number;
  count: number;
  fatiaPct: number;
};

export type LeituraDeHoras = {
  /**
   * As horas que o gráfico desenha: da primeira à última COM movimento, sem
   * buraco no meio.
   *
   * Não são as 24: uma loja que abre às 18h teria dezoito colunas rentes ao
   * chão antes da primeira barra, e o olho leria "cancelou pouco" onde está
   * escrito "estava fechado". Mas as horas VAZIAS DE DENTRO da faixa ficam, com
   * zero — elas são a diferença entre concentrado e espalhado.
   */
  horas: BaldeDeHora[];
  /** Quantos cancelamentos entraram nesta leitura. */
  total: number;
  /** A hora ou a faixa que concentra, quando existe uma. `null` = espalhado. */
  concentracao: ConcentracaoDeHora | null;
};

/**
 * Os baldes de hora a partir dos pedidos que não viraram venda.
 *
 * DEVOLVE `null` — e a tela não desenha nada — quando a amostra é pequena
 * demais para ter padrão (`amostraMinima`) ou quando nenhum pedido trouxe hora
 * legível. Um gráfico de quatro barras não é uma leitura: é um enfeite com
 * aparência de evidência.
 */
export function lerHorasDeCancelamento(
  orders: readonly OrderListItem[] | null,
): LeituraDeHoras | null {
  if (!orders || orders.length === 0) return null;

  const baldes = new Array<number>(24).fill(0);
  let total = 0;

  for (const pedido of orders) {
    const hora = operationHour(pedido.created_at);
    if (hora === null) continue;
    baldes[hora] = (baldes[hora] ?? 0) + 1;
    total += 1;
  }

  if (total < HORA_LIMIARES.amostraMinima) return null;

  const comMovimento = baldes.flatMap((count, hour) => (count > 0 ? [hour] : []));
  const primeira = comMovimento[0];
  const ultima = comMovimento[comMovimento.length - 1];
  if (primeira === undefined || ultima === undefined) return null;

  const horas: BaldeDeHora[] = [];
  for (let hour = primeira; hour <= ultima; hour += 1) {
    horas.push({ hour, count: baldes[hour] ?? 0 });
  }

  return { horas, total, concentracao: concentracaoDe(baldes, total) };
}

/**
 * Onde os cancelamentos se juntam — e `null` quando eles não se juntam.
 *
 * DUAS LEITURAS, NESTA ORDEM, e a ordem é a decisão: uma hora sozinha é uma
 * resposta mais afiada que uma faixa de três, então ela ganha quando as duas
 * batem. Se nem uma nem outra chega ao limiar, a resposta é "espalhado" — e
 * espalhado NÃO vira frase, ele vira o desenho plano do gráfico. Uma frase que
 * aparece sempre deixa de ser lida (regra 2 de `insights.ts`).
 *
 * A JANELA NÃO DÁ A VOLTA NA MEIA-NOITE. Uma loja que fecha às 2h teria a
 * faixa 23h–01h partida em duas — e é o certo aqui: o dia da operação fecha à
 * meia-noite no backend, então 23h e 00h são de DIAS diferentes, e uma janela
 * que os juntasse somaria pedidos de dias distintos numa faixa só.
 */
function concentracaoDe(baldes: readonly number[], total: number): ConcentracaoDeHora | null {
  let melhorHora = -1;
  let melhorCount = 0;
  baldes.forEach((count, hour) => {
    if (count > melhorCount) {
      melhorCount = count;
      melhorHora = hour;
    }
  });

  if (melhorHora >= 0) {
    const fatia = (melhorCount / total) * 100;
    if (fatia >= HORA_LIMIARES.picoPct) {
      return {
        tipo: 'pico',
        inicio: melhorHora,
        fim: melhorHora,
        count: melhorCount,
        fatiaPct: fatia,
      };
    }
  }

  const largura = HORA_LIMIARES.janelaHoras;
  let melhorInicio = -1;
  let melhorSoma = 0;
  for (let inicio = 0; inicio + largura - 1 <= 23; inicio += 1) {
    let soma = 0;
    for (let offset = 0; offset < largura; offset += 1) soma += baldes[inicio + offset] ?? 0;
    if (soma > melhorSoma) {
      melhorSoma = soma;
      melhorInicio = inicio;
    }
  }

  if (melhorInicio < 0) return null;
  const fatiaJanela = (melhorSoma / total) * 100;
  if (fatiaJanela < HORA_LIMIARES.janelaPct) return null;

  return {
    tipo: 'janela',
    inicio: melhorInicio,
    fim: melhorInicio + largura - 1,
    count: melhorSoma,
    fatiaPct: fatiaJanela,
  };
}
