/**
 * ============================================================================
 * O FUNIL — a leitura, os diagnósticos e o prazo
 * ============================================================================
 *
 * A TELA NÃO É UM GRÁFICO DE FUNIL. É a tela que diz ONDE ESTÁ O VAZAMENTO, e
 * a razão de os cinco degraus existirem é que cada um separa DOIS DIAGNÓSTICOS
 * OPOSTOS — não completude. Fundir dois degraus produziria uma métrica bonita
 * que não diz o que fazer na segunda-feira.
 *
 * O que mora aqui é o que o `npm run typecheck` não pega: o dicionário de
 * degraus, o diagnóstico de cada queda, a regra que separa "não mediu" de
 * "ninguém entrou", e o prazo de 90 dias que impede a tela de pedir o que o
 * banco já apagou.
 *
 * TUDO É DETERMINÍSTICO, como em `performance/insights.ts` e pelas mesmas três
 * regras: nada é inferido ou estimado, condição que não bate não vira frase, e
 * todo limiar tem nome em `LIMIARES_FUNIL`.
 */
import { daysAgoInOperationTimezone, todayInOperationTimezone } from '../orders/format';
import { toNumber } from '../performance/report-model';
import type { FunnelReport, FunnelSource, FunnelStep } from '../api/types';

/* ==========================================================================
 * 1. OS CINCO DEGRAUS, E O QUE CADA QUEDA SIGNIFICA
 * ======================================================================= */

/**
 * As chaves são as do backend (`MENU_EVENT_TYPES` mais `FUNNEL_ORDER_STEP`), e
 * NÃO um enum do contrato: `FunnelStepItem.step` é `string` no OpenAPI, então
 * não há tipo gerado para estreitar. É a única lista escrita à mão desta
 * frente, e ela falha VISÍVEL — degrau desconhecido aparece com a própria
 * chave em vez de sumir da tela.
 */
export const FUNNEL_STEP_IDS = [
  'menu_view',
  'product_view',
  'cart_add',
  'checkout_start',
  'order',
] as const;

export type FunnelStepId = (typeof FUNNEL_STEP_IDS)[number];

/**
 * A UNIDADE É PARTE DO RÓTULO, e não um detalhe de formatação.
 *
 * Os quatro primeiros degraus contam SESSÕES e o quinto conta PEDIDOS — o
 * contrato diz isso com todas as letras, e a troca é real: uma sessão que fecha
 * dois pedidos vira dois no último degrau e um em todos os anteriores.
 * Escrever "pessoas" nos cinco esconderia a troca atrás de uma palavra única, e
 * quem tentasse somar as colunas acharia outro número.
 */
export const STEP_LABELS: Record<FunnelStepId, { nome: string; unidade: 'sessao' | 'pedido' }> = {
  menu_view: { nome: 'Abriu o cardápio', unidade: 'sessao' },
  product_view: { nome: 'Abriu um produto', unidade: 'sessao' },
  cart_add: { nome: 'Pôs item no carrinho', unidade: 'sessao' },
  checkout_start: { nome: 'Foi fechar o pedido', unidade: 'sessao' },
  order: { nome: 'Terminou o pedido', unidade: 'pedido' },
};

/**
 * O DIAGNÓSTICO DE CADA QUEDA — a razão de a tela existir.
 *
 * `perda` é o que aconteceu, `area` é de quem é o problema e `oQueOlhar` é o
 * que se faz na segunda-feira. Os três juntos são o que separa esta tela de um
 * gráfico: "38% seguiram" é um número; "entrou e não abriu nada — é cardápio:
 * foto, preço de vitrine" é uma instrução.
 *
 * A chave é o degrau de DESTINO da queda (quem chegou), porque é assim que a
 * resposta vem: `conversion_from_previous_percent` é do degrau que recebe.
 */
export const QUEDA_DIAGNOSTICO: Record<
  Exclude<FunnelStepId, 'menu_view'>,
  { perda: string; area: string; oQueOlhar: string }
> = {
  product_view: {
    perda: 'entrou e não abriu nada',
    area: 'cardápio',
    oQueOlhar: 'foto, preço de vitrine, categoria errada no topo',
  },
  cart_add: {
    perda: 'abriu o produto e não pôs no carrinho',
    area: 'produto',
    oQueOlhar: 'preço do item, adicional obrigatório caro',
  },
  checkout_start: {
    perda: 'montou o carrinho e não foi fechar',
    area: 'regra comercial',
    oQueOlhar: 'taxa de entrega, pedido mínimo',
  },
  order: {
    perda: 'chegou no fechamento e desistiu',
    area: 'operação',
    oQueOlhar: 'forma de pagamento, loja fechada, gateway',
  },
};

/**
 * O DIAGNÓSTICO DO DEGRAU ZERO — o único que não é uma queda.
 *
 * Ninguém abriu o cardápio não é um problema de cardápio: é de divulgação. Ele
 * mora fora do mapa acima porque não tem degrau anterior de onde cair, e
 * confundi-lo com a primeira queda faria a tela mandar o lojista trocar a foto
 * de um cardápio que ninguém viu.
 */
export const SEM_VISITA_DIAGNOSTICO = {
  area: 'divulgação',
  oQueOlhar: 'onde o link e o QR estão, e se alguém sabe que a loja tem cardápio digital',
};

/* ==========================================================================
 * 2. OS LIMIARES
 * ======================================================================= */

export const LIMIARES_FUNIL = {
  /**
   * Abaixo de quantas sessões no degrau ANTERIOR uma queda deixa de ser
   * apontável. Com 8 sessões virando 2, "25%" é aritmética verdadeira e leitura
   * falsa — seis pessoas num período não são um padrão de comportamento, e
   * mandar o lojista mexer no preço por causa delas é pior que não dizer nada.
   */
  amostraMinima: 10,

  /**
   * A partir de quanta RETENÇÃO uma queda deixa de ser vazamento.
   *
   * Meia-meia: um degrau que segura mais da metade das pessoas está fazendo o
   * trabalho dele. Sem este corte, a tela nomearia um "vazamento" em toda loja,
   * inclusive nas que convertem bem — e uma frase que aparece sempre deixa de
   * ser lida, levando junto a credibilidade das que importam.
   */
  vazamentoRetencaoMaximaPct: 50,
} as const;

/* ==========================================================================
 * 3. O PRAZO — 90 dias, e a tela não oferece mais que isso
 * ======================================================================= */

/**
 * QUANTOS DIAS DE EVENTO O BANCO GUARDA.
 *
 * O teto do relatório é 92 dias (`MAX_REPORT_DAYS`), o mesmo dos outros seis, e
 * a rota aceita 92 aqui também. Mas o evento de funil é apagado aos 90
 * (`menu_event_retention_cutoff`), e a diferença não é acadêmica: um recorte
 * que comece antes disso responde 200, com os quatro primeiros degraus vazios e
 * o quinto cheio — porque o pedido fica para sempre e o evento não. A tela
 * leria isso como "ninguém entrou e mesmo assim alguém pediu", que é uma
 * afirmação falsa sobre o negócio.
 *
 * Por isso o teto desta tela é o do DADO, e não o da rota.
 */
export const RETENCAO_DIAS = 90;

/** O primeiro dia que ainda tem evento gravado, no fuso da operação. */
export function primeiroDiaComEvento(): string {
  // `RETENCAO_DIAS - 1` porque o período inclui hoje: 90 dias são hoje mais os
  // 89 anteriores. Com 90, a janela teria 91 dias e o primeiro deles já estaria
  // sendo apagado enquanto o lojista o lê.
  return daysAgoInOperationTimezone(RETENCAO_DIAS - 1);
}

export type FunnelPreset = 'last7' | 'last30' | 'custom';

export type FunnelRange = {
  preset: FunnelPreset;
  startDate: string; // AAAA-MM-DD
  endDate: string; // AAAA-MM-DD
  /** Vazio = todas as origens. Nunca "as sem origem" — essas são `direct`. */
  source: string;
};

/**
 * NÃO EXISTE ATALHO DE 90 DIAS, e a ausência é a decisão.
 *
 * Ele caberia no teto — 90 é exatamente a retenção. Mas o primeiro dia dessa
 * janela é o dia que o expurgo está apagando enquanto a tela carrega: o
 * relatório sairia com o começo da série mordido, e a mordida apareceria como
 * uma subida no gráfico que nunca aconteceu. Quem quiser uma janela longa a
 * escolhe em "Escolher…", onde a tela diz o limite em vez de fingir que ele não
 * existe.
 */
export const FUNNEL_PERIODOS: readonly { value: FunnelPreset; label: string }[] = [
  { value: 'last7', label: '7 dias' },
  { value: 'last30', label: '30 dias' },
  { value: 'custom', label: 'Escolher…' },
];

export function datesForFunnelPreset(
  preset: FunnelPreset,
  current: { startDate: string; endDate: string },
): { startDate: string; endDate: string } {
  if (preset === 'last7') {
    return { startDate: daysAgoInOperationTimezone(6), endDate: todayInOperationTimezone() };
  }
  if (preset === 'last30') {
    return { startDate: daysAgoInOperationTimezone(29), endDate: todayInOperationTimezone() };
  }
  /*
   * Um objeto NOVO com as duas chaves, e não `current` inteiro — a mesma
   * armadilha que `datesForPreset` documenta em Desempenho: com `return
   * current`, o spread traz junto o `preset` antigo e sobrescreve o novo, o
   * atalho "Escolher…" grava `last7` de volta e os campos de data nunca
   * aparecem. Nada quebra, porque o tipo declarado é um subconjunto.
   */
  return { startDate: current.startDate, endDate: current.endDate };
}

export function defaultFunnelRange(): FunnelRange {
  return {
    preset: 'last7',
    source: '',
    ...datesForFunnelPreset('last7', { startDate: '', endDate: '' }),
  };
}

/**
 * O período escolhido faz sentido — E EXISTE NO BANCO?
 *
 * As duas primeiras conferências são as de Desempenho. A terceira é só desta
 * tela, e é a que importa: pedir um começo anterior à retenção devolveria 200
 * com os degraus do cardápio vazios, e a tela afirmaria uma queda que nunca
 * aconteceu.
 */
export function funnelRangeProblem(range: FunnelRange): string | null {
  if (!range.startDate || !range.endDate) return 'Escolha as duas datas do período.';
  if (range.startDate > range.endDate) return 'A data inicial é depois da final.';
  if (range.startDate < primeiroDiaComEvento()) {
    return `O funil só existe nos últimos ${RETENCAO_DIAS} dias — os eventos mais antigos já foram apagados. Escolha um começo a partir de ${diaBr(primeiroDiaComEvento())}.`;
  }
  return null;
}

/** "16/08/2026" a partir do AAAA-MM-DD, sem passar por `Date` (ver `dayLabel`). */
export function diaBr(day: string): string {
  const [ano, mes, dia] = day.split('-');
  if (!ano || !mes || !dia) return day;
  return `${dia}/${mes}/${ano}`;
}

/* ==========================================================================
 * 4. A LEITURA DOS DEGRAUS
 * ======================================================================= */

export type DegrauLido = {
  id: string;
  nome: string;
  unidade: 'sessao' | 'pedido';
  count: number;
  /** Quanto do degrau anterior chegou aqui. Nulo no primeiro e sem denominador. */
  retencaoPct: number | null;
  /** A fatia da largura da barra, contra o primeiro degrau. Nulo sem base. */
  fatiaPct: number | null;
  /** O que a queda ATÉ este degrau significa. Nulo no primeiro. */
  diagnostico: { perda: string; area: string; oQueOlhar: string } | null;
};

/**
 * Os degraus prontos para desenhar.
 *
 * A ORDEM É A DA RESPOSTA, e não uma reordenação nossa: o backend já a monta a
 * partir de `MENU_EVENT_TYPES` justamente para que um degrau com zero sessões
 * apareça com zero em vez de sumir da consulta — e o degrau zerado é o mais
 * importante da tela.
 *
 * A BARRA É CONTRA O PRIMEIRO DEGRAU, não contra o maior. Normalmente são a
 * mesma coisa; quando não são (a sessão que fecha dois pedidos), usar o maior
 * faria a base do funil aparecer mais larga que o topo, que é um desenho que
 * não descreve nada.
 */
export function lerDegraus(steps: readonly FunnelStep[]): DegrauLido[] {
  const base = steps[0]?.count ?? 0;

  return steps.map((step, indice) => {
    const conhecido = (FUNNEL_STEP_IDS as readonly string[]).includes(step.step)
      ? (step.step as FunnelStepId)
      : null;

    return {
      id: step.step,
      // Degrau desconhecido aparece com a própria chave: some da tela seria
      // pior, porque é assim que um degrau novo do backend passaria despercebido.
      nome: conhecido ? STEP_LABELS[conhecido].nome : step.step,
      unidade: conhecido ? STEP_LABELS[conhecido].unidade : 'sessao',
      count: step.count,
      retencaoPct: toNumber(step.conversion_from_previous_percent),
      fatiaPct: base > 0 ? Math.min(100, (step.count / base) * 100) : null,
      diagnostico:
        indice === 0 || !conhecido || conhecido === 'menu_view'
          ? null
          : QUEDA_DIAGNOSTICO[conhecido],
    };
  });
}

/**
 * O DEGRAU QUE VAZA — o índice do degrau que RECEBE a maior queda.
 *
 * Três conferências, e cada uma tira uma frase errada da tela:
 *
 * 1. **só quedas com denominador** — retenção nula é "o anterior foi zero", e
 *    não "perdeu todo mundo";
 * 2. **só com amostra** (`amostraMinima`) — 8 sessões virando 2 é aritmética
 *    verdadeira e leitura falsa;
 * 3. **só quando perde mais da metade** (`vazamentoRetencaoMaximaPct`) — num
 *    funil saudável não há vazamento a nomear, e nomear um mesmo assim é a
 *    frase de preenchimento que a tela recusa.
 *
 * Devolve `null` quando nenhuma queda passa nas três. A tela tem uma frase
 * própria para esse caso, e ela diz outra coisa.
 */
export function degrauQueVaza(degraus: readonly DegrauLido[]): DegrauLido | null {
  let pior: DegrauLido | null = null;

  degraus.forEach((degrau, indice) => {
    if (degrau.retencaoPct === null || degrau.diagnostico === null) return;

    const anterior = degraus[indice - 1];
    if (!anterior || anterior.count < LIMIARES_FUNIL.amostraMinima) return;
    if (degrau.retencaoPct > LIMIARES_FUNIL.vazamentoRetencaoMaximaPct) return;

    if (pior === null || degrau.retencaoPct < (pior.retencaoPct ?? Infinity)) pior = degrau;
  });

  return pior;
}

/**
 * A MAIOR QUEDA, valha ela uma frase ou não.
 *
 * Serve à frase do funil saudável ("nenhum degrau perde mais da metade; a maior
 * queda é X"), que precisa nomear o degrau sem afirmar que ele é um problema.
 * Passa pela amostra mínima, e não pelo corte de metade.
 */
export function maiorQueda(degraus: readonly DegrauLido[]): DegrauLido | null {
  let pior: DegrauLido | null = null;

  degraus.forEach((degrau, indice) => {
    if (degrau.retencaoPct === null) return;
    const anterior = degraus[indice - 1];
    if (!anterior || anterior.count < LIMIARES_FUNIL.amostraMinima) return;
    if (pior === null || degrau.retencaoPct < (pior.retencaoPct ?? Infinity)) pior = degrau;
  });

  return pior;
}

/* ==========================================================================
 * 5. "NÃO MEDIU" E "NINGUÉM ENTROU" SÃO COISAS OPOSTAS
 * ======================================================================= */

/**
 * O estado da medição — e esta é a peça mais importante da tela hoje.
 *
 * O app do cliente AINDA NÃO DISPARA EVENTO NENHUM: os quatro primeiros degraus
 * nascem em zero, e o quinto — que é o pedido, contado em `orders` — nasce
 * cheio. Um zero desenhado como zero afirmaria que NINGUÉM ENTROU no cardápio,
 * e o lojista concluiria que não tem movimento quando o que não tem é medição.
 * São diagnósticos opostos: um manda divulgar, o outro manda ligar o evento.
 *
 * COMO SE SEPARAM, sem nenhum interruptor escrito na tela:
 *
 * - **`medindo`** — alguma sessão foi registrada no período, seja num degrau,
 *   seja em alguma origem. Aí zero é zero, e a tela pode afirmar o que vê.
 * - **`desligada`** — nenhuma sessão em lugar nenhum. A tela não tem como saber
 *   se o cardápio ficou vazio ou se ninguém contou, e diz isso.
 *
 * `sources` ENTRA NA CONTA de propósito, e não é detalhe: ela vem SEMPRE com
 * todas as origens, mesmo quando o relatório está filtrado por uma. Com um
 * filtro de origem ligado, os degraus podem estar zerados porque AQUELA origem
 * não trouxe ninguém — e aí a medição está ligadíssima. Sem esta metade da
 * regra, filtrar por um QR sem movimento faria a tela anunciar que a medição
 * caiu.
 */
export type EstadoDaMedicao = 'medindo' | 'desligada';

export function estadoDaMedicao(funnel: FunnelReport): EstadoDaMedicao {
  const temSessaoNosDegraus = funnel.steps.some(
    (step) => step.step !== 'order' && step.count > 0,
  );
  const temSessaoEmAlgumaOrigem = funnel.sources.some((origem) => origem.sessions_count > 0);
  return temSessaoNosDegraus || temSessaoEmAlgumaOrigem ? 'medindo' : 'desligada';
}

/* ==========================================================================
 * 6. A FRASE DO TOPO
 * ======================================================================= */

export type FunilVeredito = {
  /** Chave estável, para o teste nomear o caso e a tela dar `data-testid`. */
  id: string;
  text: string;
};

/**
 * A CONVERSÃO DE PONTA A PONTA — pedidos sobre sessões.
 *
 * A conta é a MESMA que o backend faz em `conversion_percent` de cada origem,
 * e é por isso que ela pode ser feita aqui: não é uma segunda definição
 * inventada na tela, é a definição do contrato aplicada ao total.
 *
 * Ela mistura unidades (pedido ÷ sessão) e a tela diz isso — é a leitura que
 * todo mundo espera de um funil, e escondê-la para evitar a ressalva seria
 * tirar a resposta para não ter de explicá-la.
 */
export function conversaoTotalPct(degraus: readonly DegrauLido[]): number | null {
  const primeiro = degraus[0];
  const ultimo = degraus[degraus.length - 1];
  if (!primeiro || !ultimo || primeiro.count <= 0) return null;
  return (ultimo.count / primeiro.count) * 100;
}

/**
 * A resposta da tela, em uma frase.
 *
 * Cinco casos, e nenhum deles é de preenchimento — cada um leva a uma ação
 * diferente na segunda-feira:
 *
 *   1. medição desligada COM pedido no período — a prova de que o que falta é o
 *      evento: ninguém pede sem abrir o cardápio;
 *   2. medição desligada e nada no período — não dá para separar as duas
 *      leituras, e a tela diz isso em vez de escolher uma;
 *   3. medindo e ninguém abriu o cardápio — divulgação;
 *   4. medindo e um degrau perde mais da metade — o vazamento, com nome e ação;
 *   5. medindo e nenhum degrau perde mais da metade — a maior queda, dita sem
 *      ser chamada de problema.
 */
export function readVazamento(
  funnel: FunnelReport,
  degraus: readonly DegrauLido[],
  medicao: EstadoDaMedicao,
): FunilVeredito {
  const filtrada = !!funnel.source;
  const recorte = filtrada ? ` de ${origemLabel(funnel.source ?? '')}` : '';

  if (medicao === 'desligada') {
    if (funnel.orders_count > 0) {
      return {
        id: 'sem-medicao-com-pedido',
        text: `Nenhuma etapa do cardápio foi registrada neste período — e ${
          funnel.orders_count === 1 ? '1 pedido entrou' : `${funnel.orders_count} pedidos entraram`
        }. Ninguém pede sem abrir o cardápio: o que falta aqui é a medição, não o movimento.`,
      };
    }
    return {
      id: 'sem-medicao-sem-pedido',
      text: 'Nenhuma etapa do cardápio foi registrada neste período. Isso não quer dizer que ninguém entrou — quer dizer que ninguém contou, e as duas coisas não têm como ser separadas enquanto a medição não estiver ligada.',
    };
  }

  const primeiro = degraus[0];
  if (!primeiro || primeiro.count === 0) {
    return {
      id: 'sem-visita',
      text: `Ninguém abriu o cardápio${recorte} neste período. Não é problema de cardápio nem de preço — é de ${SEM_VISITA_DIAGNOSTICO.area}: ${SEM_VISITA_DIAGNOSTICO.oQueOlhar}.`,
    };
  }

  const conversao = conversaoTotalPct(degraus);
  const abertura =
    conversao === null
      ? ''
      : `De cada 100 que abriram o cardápio${recorte}, ${Math.round(conversao)} terminaram um pedido. `;

  const vaza = degrauQueVaza(degraus);
  if (vaza && vaza.diagnostico) {
    return {
      id: 'vazamento',
      text: `${abertura}A maior perda é em “${vaza.nome}”: ${percentInteiro(
        vaza.retencaoPct,
      )} do degrau anterior chegam aí. É gente que ${vaza.diagnostico.perda} — problema de ${
        vaza.diagnostico.area
      }: ${vaza.diagnostico.oQueOlhar}.`,
    };
  }

  const maior = maiorQueda(degraus);
  if (maior) {
    return {
      id: 'sem-vazamento',
      text: `${abertura}Nenhum degrau perde mais da metade das pessoas. A maior queda é em “${maior.nome}”, que ainda segura ${percentInteiro(maior.retencaoPct)} de quem veio do degrau anterior.`,
    };
  }

  /*
   * AMOSTRA PEQUENA DEMAIS PARA APONTAR DEGRAU — e a frase diz isso, em vez de
   * eleger o pior de quatro números que não sustentam eleição nenhuma. É o
   * período de uma loja que acabou de ligar a medição, e o conselho honesto é
   * esperar.
   */
  return {
    id: 'amostra-curta',
    text: `${abertura}São poucas visitas para apontar um degrau: com menos de ${LIMIARES_FUNIL.amostraMinima} sessões num degrau, a queda seguinte é acaso, não padrão. Os números abaixo valem; a conclusão sobre qual deles consertar ainda não.`,
  };
}

/* ==========================================================================
 * 7. AS ORIGENS
 * ======================================================================= */

/** `direct` NÃO É "sem origem": é quem chegou sem QR e sem link de campanha. */
export const ORIGEM_DIRETA = 'direct';

/**
 * O rótulo de uma origem.
 *
 * SÓ `direct` É TRADUZIDO. Os outros rótulos são escritos pelo próprio lojista
 * no QR e no link (`qr-mesa-04`, `ima-geladeira`) — traduzir, encurtar ou
 * embelezar um deles seria a tela mostrando um nome que não existe no adesivo
 * que ele mandou imprimir.
 */
export function origemLabel(source: string): string {
  if (source === ORIGEM_DIRETA) return 'Direto (sem QR nem link)';
  return source;
}

export type OrigemLida = {
  source: string;
  nome: string;
  sessoes: number;
  pedidos: number;
  conversaoPct: number | null;
  /** Trouxe gente e não vendeu nada — a linha mais importante desta seção. */
  trazENaoConverte: boolean;
  /** Vendeu sem nenhuma sessão registrada: medição desligada, ou evento vencido. */
  pedidoSemSessao: boolean;
};

export function lerOrigens(sources: readonly FunnelSource[]): OrigemLida[] {
  return sources.map((origem) => ({
    source: origem.source,
    nome: origemLabel(origem.source),
    sessoes: origem.sessions_count,
    pedidos: origem.orders_count,
    conversaoPct: toNumber(origem.conversion_percent),
    trazENaoConverte: origem.sessions_count > 0 && origem.orders_count === 0,
    pedidoSemSessao: origem.sessions_count === 0 && origem.orders_count > 0,
  }));
}

/**
 * A leitura da divisão por origem — e ela responde "o QR da mesa funciona?".
 *
 * A ORDEM DOS CASOS É A ORDEM DA UTILIDADE, não a da abundância:
 *
 * 1. **uma origem traz gente e não vende** — o canal que enche o cardápio de
 *    quem não compra. É a linha que muda onde o lojista gasta, e por isso ela
 *    ganha a frase mesmo quando não é a maior;
 * 2. **tudo caiu em `direct`** — nenhum pedido chegou com identificador. Com a
 *    medição desligada isso é esperado e a frase diz por quê; com ela ligada, é
 *    QR que ninguém escaneou ou link publicado sem o parâmetro;
 * 3. **a origem que mais converte** — a resposta positiva, quando há duas ou
 *    mais origens com sessão para comparar.
 */
export function readOrigem(
  origens: readonly OrigemLida[],
  medicao: EstadoDaMedicao,
): FunilVeredito | null {
  if (origens.length === 0) return null;

  const desperdicio = [...origens]
    .filter((origem) => origem.trazENaoConverte)
    .sort((a, b) => b.sessoes - a.sessoes)[0];

  if (desperdicio && desperdicio.sessoes >= LIMIARES_FUNIL.amostraMinima) {
    return {
      id: 'origem-sem-conversao',
      text: `“${desperdicio.nome}” trouxe ${desperdicio.sessoes} ${
        desperdicio.sessoes === 1 ? 'sessão' : 'sessões'
      } e nenhum pedido. É o canal que traz gente que não compra — antes de gastar mais nele, vale ver o que essa gente encontra ao chegar.`,
    };
  }

  const soDireta = origens.every((origem) => origem.source === ORIGEM_DIRETA);
  if (soDireta) {
    return {
      id: 'so-direta',
      text:
        medicao === 'desligada'
          ? 'Todo pedido do período chegou sem identificador de origem, e é o esperado enquanto o app não devolver a origem no pedido: sem isso, tudo cai em “direto”.'
          : 'Todo pedido do período chegou sem identificador de origem. Ou os QRs não estão sendo escaneados, ou o link publicado saiu sem o parâmetro de origem.',
    };
  }

  const comSessao = origens.filter((origem) => origem.sessoes >= LIMIARES_FUNIL.amostraMinima);
  if (comSessao.length >= 2) {
    const melhor = [...comSessao].sort(
      (a, b) => (b.conversaoPct ?? 0) - (a.conversaoPct ?? 0),
    )[0];
    if (melhor && melhor.conversaoPct !== null && melhor.pedidos > 0) {
      return {
        id: 'origem-que-converte',
        text: `Quem chega por “${melhor.nome}” é quem mais compra: ${percentInteiro(
          melhor.conversaoPct,
        )} dessas sessões viraram pedido.`,
      };
    }
  }

  return null;
}

/* ==========================================================================
 * 8. FORMATAÇÃO
 * ======================================================================= */

/**
 * A porcentagem, inteira.
 *
 * SEM CASA DECIMAL, ao contrário de Desempenho: aqui o número é uma taxa de
 * comportamento de gente, não dinheiro. "38,4% chegaram" promete uma precisão
 * que uma amostra de algumas centenas de sessões não tem, e a decisão que ela
 * apoia é a mesma com 38 ou com 38,4.
 */
export function percentInteiro(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value).toLocaleString('pt-BR')}%`;
}

/** Um número de contagem, com o separador de milhar do pt-BR. */
export function contagem(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** "1.240 sessões" / "18 pedidos" — a unidade escrita, sempre (ver `STEP_LABELS`). */
export function contagemComUnidade(value: number, unidade: 'sessao' | 'pedido'): string {
  if (unidade === 'pedido') return `${contagem(value)} ${value === 1 ? 'pedido' : 'pedidos'}`;
  return `${contagem(value)} ${value === 1 ? 'sessão' : 'sessões'}`;
}
