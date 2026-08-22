/**
 * A leitura do funil.
 *
 * O QUE ESTES TESTES PROTEGEM, em uma frase: que a tela nunca confunda "não
 * mediu" com "ninguém entrou".
 *
 * São duas afirmações opostas sobre o negócio, e o dado que as separa é o
 * mesmo zero. Um `count: 0` desenhado como "0 sessões" manda o lojista
 * divulgar mais; o mesmo zero lido como "a medição não está ligada" manda ligar
 * o evento. Nenhuma ferramenta pega a troca — o tipo é `number` dos dois lados,
 * a tela monta e o número aparece.
 *
 * O resto dos casos protege a segunda regra da tela: condição que não bate não
 * vira frase. Um diagnóstico pendurado num degrau saudável, ou num degrau com
 * seis sessões, é a frase de preenchimento que faz as outras deixarem de ser
 * lidas.
 */
import { describe, expect, it } from 'vitest';

import {
  conversaoTotalPct,
  degrauQueVaza,
  estadoDaMedicao,
  funnelRangeProblem,
  lerDegraus,
  lerOrigens,
  maiorQueda,
  origemLabel,
  percentInteiro,
  primeiroDiaComEvento,
  readOrigem,
  readVazamento,
  RETENCAO_DIAS,
  type FunnelRange,
} from './funnel-model';
import { daysAgoInOperationTimezone, todayInOperationTimezone } from '../orders/format';
import type { FunnelReport, FunnelSource, FunnelStep } from '../api/types';

const PERIODO = { start_date: '2026-08-16', end_date: '2026-08-22', days: 7 };

/**
 * Os cinco degraus na ordem do backend, a partir das contagens.
 *
 * A conversão é calculada aqui como o backend a calcula (nula no primeiro e
 * quando o anterior é zero) para que os testes exercitem o formato REAL da
 * resposta — inclusive a string, que é como o decimal viaja no JSON.
 */
function stepsDe(counts: [number, number, number, number, number]): FunnelStep[] {
  const nomes = ['menu_view', 'product_view', 'cart_add', 'checkout_start', 'order'];
  return counts.map((count, indice) => {
    const anterior = indice > 0 ? counts[indice - 1]! : null;
    return {
      step: nomes[indice]!,
      count,
      conversion_from_previous_percent:
        anterior === null || anterior === 0 ? null : ((count / anterior) * 100).toFixed(2),
    };
  });
}

function origem(
  source: string,
  sessions_count: number,
  orders_count: number,
): FunnelSource {
  return {
    source,
    sessions_count,
    orders_count,
    conversion_percent:
      sessions_count === 0 ? null : ((orders_count / sessions_count) * 100).toFixed(2),
  };
}

function funnelDe(
  counts: [number, number, number, number, number],
  sources: FunnelSource[] = [],
  source: string | null = null,
): FunnelReport {
  return {
    restaurant_id: 'r1',
    branch_id: null,
    source,
    period: PERIODO,
    steps: stepsDe(counts),
    orders_count: counts[4],
    sources,
    orders_note: 'Todo pedido feito no periodo, cancelados e recusados inclusive.',
  };
}

/* ==========================================================================
 * A LEITURA DOS DEGRAUS
 * ======================================================================= */

describe('lerDegraus', () => {
  it('escreve a unidade de cada degrau, e o quinto NÃO conta sessão', () => {
    const degraus = lerDegraus(stepsDe([100, 40, 20, 12, 9]));

    expect(degraus.map((degrau) => degrau.unidade)).toEqual([
      'sessao',
      'sessao',
      'sessao',
      'sessao',
      'pedido',
    ]);
  });

  it('mede a barra contra o PRIMEIRO degrau, não contra o maior', () => {
    /*
     * O caso raro que justifica a regra: uma sessão que fecha dois pedidos faz
     * o último degrau passar do penúltimo. Medindo contra o maior, a base do
     * funil apareceria mais larga que o topo — um desenho que não descreve
     * nada.
     */
    const degraus = lerDegraus(stepsDe([100, 40, 30, 20, 22]));

    expect(degraus[0]?.fatiaPct).toBe(100);
    expect(degraus[4]?.fatiaPct).toBe(22);
  });

  it('não dá diagnóstico ao primeiro degrau — não há queda até ele', () => {
    const degraus = lerDegraus(stepsDe([100, 40, 20, 12, 9]));

    expect(degraus[0]?.diagnostico).toBeNull();
    expect(degraus[1]?.diagnostico?.area).toBe('cardápio');
    expect(degraus[2]?.diagnostico?.area).toBe('produto');
    expect(degraus[3]?.diagnostico?.area).toBe('regra comercial');
    expect(degraus[4]?.diagnostico?.area).toBe('operação');
  });

  it('mostra um degrau desconhecido com a própria chave, em vez de sumir com ele', () => {
    const degraus = lerDegraus([{ step: 'wishlist_add', count: 3 }]);

    expect(degraus[0]?.nome).toBe('wishlist_add');
  });
});

/* ==========================================================================
 * "NÃO MEDIU" × "NINGUÉM ENTROU" — o coração da tela
 * ======================================================================= */

describe('estadoDaMedicao', () => {
  it('é "desligada" quando nenhuma sessão foi registrada em lugar nenhum', () => {
    expect(estadoDaMedicao(funnelDe([0, 0, 0, 0, 0]))).toBe('desligada');
  });

  it('continua "desligada" mesmo com pedido no período — o pedido não vem de evento', () => {
    /*
     * É O ESTADO DE HOJE: o app ainda não dispara evento nenhum, mas o quinto
     * degrau é contado em `orders` e vem cheio. Se esta linha passasse a
     * devolver "medindo", a tela desenharia "0 sessões" ao lado de "12 pedidos"
     * e afirmaria que doze pessoas pediram sem abrir o cardápio.
     */
    expect(estadoDaMedicao(funnelDe([0, 0, 0, 0, 12], [origem('direct', 0, 12)]))).toBe(
      'desligada',
    );
  });

  it('é "medindo" quando alguma ORIGEM tem sessão, mesmo com os degraus zerados', () => {
    /*
     * O caso do filtro de origem ligado: os degraus estão recortados por um QR
     * que não trouxe ninguém, e `sources` — que vem sempre com todas — prova
     * que a medição está de pé. Sem esta metade da regra, filtrar por um QR sem
     * movimento faria a tela anunciar que a medição caiu.
     */
    const funnel = funnelDe([0, 0, 0, 0, 0], [origem('qr-mesa-04', 0, 0), origem('direct', 80, 6)], 'qr-mesa-04');

    expect(estadoDaMedicao(funnel)).toBe('medindo');
  });
});

/* ==========================================================================
 * A FRASE DO TOPO
 * ======================================================================= */

describe('readVazamento', () => {
  it('com medição desligada e pedido no período, aponta a MEDIÇÃO e não o movimento', () => {
    const funnel = funnelDe([0, 0, 0, 0, 12], [origem('direct', 0, 12)]);
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'desligada');

    expect(veredito.id).toBe('sem-medicao-com-pedido');
    expect(veredito.text).toContain('12 pedidos');
    expect(veredito.text).toContain('a medição, não o movimento');
  });

  it('com medição desligada e nada no período, RECUSA escolher entre as duas leituras', () => {
    const funnel = funnelDe([0, 0, 0, 0, 0]);
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'desligada');

    expect(veredito.id).toBe('sem-medicao-sem-pedido');
    expect(veredito.text).toContain('não quer dizer que ninguém entrou');
  });

  it('medindo e sem nenhuma visita, o diagnóstico é DIVULGAÇÃO', () => {
    const funnel = funnelDe([0, 0, 0, 0, 0], [origem('qr-mesa-04', 0, 0), origem('direct', 40, 3)]);
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'medindo');

    expect(veredito.id).toBe('sem-visita');
    expect(veredito.text).toContain('divulgação');
  });

  it('nomeia o degrau que vaza, com o que fazer a respeito', () => {
    // 200 → 60: o cardápio perde 70% logo na primeira queda.
    const funnel = funnelDe([200, 60, 48, 40, 34]);
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'medindo');

    expect(veredito.id).toBe('vazamento');
    expect(veredito.text).toContain('Abriu um produto');
    expect(veredito.text).toContain('problema de cardápio');
    // A conversão de ponta a ponta: 34 de 200.
    expect(veredito.text).toContain('17 terminaram um pedido');
  });

  it('num funil saudável NÃO inventa vazamento — diz que não há', () => {
    const funnel = funnelDe([200, 160, 120, 100, 90]);
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'medindo');

    expect(veredito.id).toBe('sem-vazamento');
    expect(veredito.text).toContain('Nenhum degrau perde mais da metade');
  });

  it('com amostra curta, recusa apontar um degrau', () => {
    const funnel = funnelDe([8, 2, 1, 1, 1]);
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'medindo');

    expect(veredito.id).toBe('amostra-curta');
  });

  it('escreve o recorte de origem quando o relatório está filtrado', () => {
    const funnel = funnelDe([200, 60, 48, 40, 34], [origem('qr-mesa-04', 200, 34)], 'qr-mesa-04');
    const veredito = readVazamento(funnel, lerDegraus(funnel.steps), 'medindo');

    expect(veredito.text).toContain('qr-mesa-04');
  });
});

/* ==========================================================================
 * QUAL DEGRAU VAZA
 * ======================================================================= */

describe('degrauQueVaza', () => {
  it('ignora a queda cujo degrau anterior não tem amostra', () => {
    /*
     * O ÚLTIMO DEGRAU É A MENOR TAXA DA ESCADA — 9 pessoas foram fechar e
     * nenhuma terminou, 0% — e é leitura nenhuma: nove pessoas num período não
     * são um padrão de comportamento. Sem a amostra mínima, a tela mandaria o
     * lojista mexer no meio de pagamento por causa delas.
     *
     * A queda que sustenta uma conclusão é a primeira: 150 abriram o cardápio e
     * 12 abriram um produto.
     */
    const degraus = lerDegraus(stepsDe([150, 12, 11, 9, 0]));

    expect(degrauQueVaza(degraus)?.id).toBe('product_view');
  });

  it('não aponta nada quando nenhum degrau perde mais da metade', () => {
    expect(degrauQueVaza(lerDegraus(stepsDe([200, 160, 120, 100, 90])))).toBeNull();
  });

  it('ignora conversão nula — "o anterior foi zero" não é "perdeu todo mundo"', () => {
    const degraus = lerDegraus(stepsDe([0, 0, 0, 0, 5]));

    expect(degrauQueVaza(degraus)).toBeNull();
  });

  it('maiorQueda nomeia o degrau mesmo num funil saudável, sem chamá-lo de problema', () => {
    expect(maiorQueda(lerDegraus(stepsDe([200, 160, 120, 100, 90])))?.id).toBe('cart_add');
  });
});

describe('conversaoTotalPct', () => {
  it('é pedidos sobre sessões — a mesma conta que o backend faz por origem', () => {
    expect(conversaoTotalPct(lerDegraus(stepsDe([200, 60, 48, 40, 34])))).toBeCloseTo(17, 5);
  });

  it('é nula sem sessão nenhuma: não existe fatia a partir de zero', () => {
    expect(conversaoTotalPct(lerDegraus(stepsDe([0, 0, 0, 0, 12])))).toBeNull();
  });
});

/* ==========================================================================
 * O PRAZO DE 90 DIAS
 * ======================================================================= */

describe('funnelRangeProblem', () => {
  function range(startDate: string, endDate: string): FunnelRange {
    return { preset: 'custom', startDate, endDate, source: '' };
  }

  it('recusa um começo anterior à retenção, e diz a partir de quando dá', () => {
    const problema = funnelRangeProblem(
      range(daysAgoInOperationTimezone(RETENCAO_DIAS + 5), todayInOperationTimezone()),
    );

    expect(problema).toContain(`${RETENCAO_DIAS} dias`);
  });

  it('aceita a janela inteira da retenção', () => {
    expect(funnelRangeProblem(range(primeiroDiaComEvento(), todayInOperationTimezone()))).toBeNull();
  });

  it('continua recusando data invertida e período pela metade', () => {
    expect(funnelRangeProblem(range('2026-08-22', '2026-08-16'))).toBeTruthy();
    expect(funnelRangeProblem(range('', ''))).toBeTruthy();
  });
});

/* ==========================================================================
 * AS ORIGENS
 * ======================================================================= */

describe('lerOrigens', () => {
  it('marca a origem que traz gente e não vende', () => {
    const [linha] = lerOrigens([origem('instagram-bio', 120, 0)]);

    expect(linha?.trazENaoConverte).toBe(true);
    expect(linha?.pedidoSemSessao).toBe(false);
  });

  it('marca a origem que vendeu sem nenhuma sessão registrada', () => {
    const [linha] = lerOrigens([origem('direct', 0, 12)]);

    expect(linha?.pedidoSemSessao).toBe(true);
    expect(linha?.conversaoPct).toBeNull();
  });
});

describe('origemLabel', () => {
  it('traduz `direct`, que não é "sem origem"', () => {
    expect(origemLabel('direct')).toBe('Direto (sem QR nem link)');
  });

  it('NÃO mexe no rótulo que o lojista mandou imprimir no adesivo', () => {
    expect(origemLabel('qr-mesa-04')).toBe('qr-mesa-04');
  });
});

describe('readOrigem', () => {
  it('a origem que traz gente e não vende ganha a frase, mesmo sem ser a maior', () => {
    const origens = lerOrigens([origem('direct', 400, 30), origem('panfleto', 60, 0)]);
    const leitura = readOrigem(origens, 'medindo');

    expect(leitura?.id).toBe('origem-sem-conversao');
    expect(leitura?.text).toContain('panfleto');
  });

  it('com tudo em "direto" e medição desligada, EXPLICA por que está tudo ali', () => {
    const leitura = readOrigem(lerOrigens([origem('direct', 0, 12)]), 'desligada');

    expect(leitura?.id).toBe('so-direta');
    expect(leitura?.text).toContain('enquanto o app não devolver a origem');
  });

  it('com tudo em "direto" e medição ligada, a leitura vira conserto de QR/link', () => {
    const leitura = readOrigem(lerOrigens([origem('direct', 300, 20)]), 'medindo');

    expect(leitura?.id).toBe('so-direta');
    expect(leitura?.text).toContain('QRs');
  });

  it('com duas origens saudáveis, aponta a que mais converte', () => {
    const origens = lerOrigens([origem('direct', 400, 20), origem('qr-mesa-04', 100, 25)]);
    const leitura = readOrigem(origens, 'medindo');

    expect(leitura?.id).toBe('origem-que-converte');
    expect(leitura?.text).toContain('qr-mesa-04');
  });

  it('não escreve nada quando não há nada a afirmar', () => {
    expect(readOrigem([], 'medindo')).toBeNull();
  });
});

/* ==========================================================================
 * FORMATAÇÃO
 * ======================================================================= */

describe('percentInteiro', () => {
  it('arredonda: a decisão é a mesma com 38 ou com 38,4', () => {
    expect(percentInteiro(38.4)).toBe('38%');
  });

  it('nulo vira travessão, nunca 0% — não existe fatia a partir de zero', () => {
    expect(percentInteiro(null)).toBe('—');
  });
});
