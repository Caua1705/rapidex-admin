import { describe, expect, it } from 'vitest';

import {
  barRatio,
  datesForPreset,
  dayFullLabel,
  dayLabel,
  maxRevenue,
  MIN_BAR_RATIO,
  paymentMethodLabel,
  previousRange,
  rangeProblem,
  BASE_MINIMA_PARA_VARIACAO,
  readChange,
  readChangeComBase,
  readRateChange,
  VARIACAO_MAXIMA_PCT,
  taxaTemBase,
  toNumber,
  toNumberOrZero,
} from './report-model';
import { PAYMENT_METHOD_LABELS } from '../orders/format';
import type { MetricComparison } from '../api/types';

function comparison(overrides: Partial<MetricComparison> = {}): MetricComparison {
  return {
    current: '1000.00',
    previous: '800.00',
    change: '200.00',
    change_percent: '25.0',
    ...overrides,
  };
}

describe('toNumber', () => {
  it('converte a string decimal que o contrato manda', () => {
    expect(toNumber('1234.56')).toBe(1234.56);
  });

  it('deixa passar o número que já é número', () => {
    expect(toNumber(42)).toBe(42);
  });

  it('devolve null no nulo e no ilegível, para a tela mostrar "—" e não NaN', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('não é número')).toBeNull();
  });

  /*
   * `Number('')` é 0, não NaN — e `Number.isFinite(0)` é true. Sem a
   * conferência da string vazia, um campo que chegasse em branco viraria
   * "R$ 0,00" na tela: um faturamento de zero reais afirmado no lugar de
   * "não sei".
   */
  it('string vazia é ausência, não zero', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('   ')).toBeNull();
  });

  it('toNumberOrZero devolve 0 onde zero é resposta válida', () => {
    expect(toNumberOrZero(null)).toBe(0);
    expect(toNumberOrZero('0.00')).toBe(0);
  });
});

describe('readRateChange', () => {
  /*
   * TAXA SE COMPARA EM PONTOS PERCENTUAIS, não em variação percentual.
   *
   * De 6,5% para 10% de cancelamento o `readChange` diria "+53,8%", que é
   * verdade aritmética e mentira de leitura: o dono entende que perdeu metade
   * a mais dos pedidos. +3,5 p.p. é o que ele consegue conferir de cabeça.
   */
  it('escreve a diferença em p.p., com sinal', () => {
    const leitura = readRateChange('10.0', '6.5', 'os 7 dias anteriores');

    expect(leitura.text).toBe('+3,5 p.p. vs. os 7 dias anteriores');
    expect(leitura.direction).toBe('up');
    expect(leitura.isMissing).toBe(false);
  });

  it('queda vem com sinal de menos e direção para baixo', () => {
    const leitura = readRateChange('4.0', '6.5', 'os 7 dias anteriores');

    expect(leitura.text).toBe('-2,5 p.p. vs. os 7 dias anteriores');
    expect(leitura.direction).toBe('down');
  });

  it('diferença que arredonda a zero é "none", sem sinal', () => {
    const leitura = readRateChange('6.54', '6.5', 'os 7 dias anteriores');

    expect(leitura.direction).toBe('none');
    expect(leitura.text).toBe('0 p.p. vs. os 7 dias anteriores');
  });

  /*
   * `cancellation_rate_percent` NULO é "sem denominador": não houve pedido
   * nenhum no período anterior. Não é zero por cento de cancelamento.
   */
  it('anterior nulo é "sem comparação", nunca 0 p.p.', () => {
    const leitura = readRateChange('10.0', null, 'os 7 dias anteriores');

    expect(leitura.isMissing).toBe(true);
    expect(leitura.direction).toBe('none');
    expect(leitura.text).toContain('sem comparação');
    expect(leitura.text).toContain('não houve pedido no período anterior');
  });

  /* A segunda chamada falhou: a tela não sabe, e diz que não sabe. */
  it('anterior indisponível diz que não deu para ler, sem inventar direção', () => {
    const leitura = readRateChange('10.0', undefined, 'os 7 dias anteriores');

    expect(leitura.isMissing).toBe(true);
    expect(leitura.text).toContain('não deu para ler');
  });

  it('taxa atual nula também é sem comparação', () => {
    expect(readRateChange(null, '6.5', 'os 7 dias anteriores').isMissing).toBe(true);
  });
});

describe('readChange', () => {
  /*
   * O CASO QUE JUSTIFICA A FUNÇÃO.
   *
   * `change_percent` nulo significa "o período anterior foi zero". Um `?? 0`
   * nessa linha compila e escreve "0% vs. os 7 dias anteriores" — que diz que
   * a loja ficou parada, quando o que houve é que ela não tinha movimento
   * nenhum antes. As duas frases levam a decisões opostas.
   */
  it('nulo vira "sem comparação", nunca 0%', () => {
    const leitura = readChange(
      comparison({ change_percent: null, previous: '0.00' }),
      'os 7 dias anteriores',
    );

    expect(leitura.isMissing).toBe(true);
    expect(leitura.direction).toBe('none');
    expect(leitura.text).toContain('sem comparação');
    expect(leitura.text).not.toContain('0%');
  });

  it('alta leva sinal e seta para cima', () => {
    const leitura = readChange(comparison({ change_percent: '25.0' }), 'os 7 dias anteriores');
    expect(leitura.text).toBe('+25% vs. os 7 dias anteriores');
    expect(leitura.direction).toBe('up');
  });

  it('queda leva o sinal negativo que já vem no valor', () => {
    const leitura = readChange(comparison({ change_percent: '-12.4' }), 'os 30 dias anteriores');
    expect(leitura.text).toBe('-12,4% vs. os 30 dias anteriores');
    expect(leitura.direction).toBe('down');
  });

  /* Zero MEDIDO é diferente de zero por falta de comparação: aqui houve
     período anterior, e ele empatou. A frase existe, a seta não. */
  it('zero medido é uma comparação de verdade, e não vira "sem comparação"', () => {
    const leitura = readChange(comparison({ change_percent: '0.0' }), 'os 7 dias anteriores');
    expect(leitura.isMissing).toBe(false);
    expect(leitura.direction).toBe('none');
    expect(leitura.text).toBe('0% vs. os 7 dias anteriores');
  });
});

describe('paymentMethodLabel', () => {
  /*
   * `PAYMENT_METHOD_LABELS` tem `other: 'Outro'` — uma forma de pagamento de
   * verdade, escolhível no cardápio de opções. Nulo não é ela: é pedido cuja
   * forma ninguém registrou, e é isso que o lojista vai investigar.
   */
  it('nulo não vira "Outro"', () => {
    const rotulo = paymentMethodLabel(null, PAYMENT_METHOD_LABELS);
    expect(rotulo).toBe('Sem forma registrada');
    expect(rotulo).not.toBe('Outro');
  });

  it('"other" continua sendo "Outro" — é uma forma escolhida de verdade', () => {
    expect(paymentMethodLabel('other', PAYMENT_METHOD_LABELS)).toBe('Outro');
  });

  it('traduz o que o dicionário conhece', () => {
    expect(paymentMethodLabel('pix', PAYMENT_METHOD_LABELS)).toBe('Pix');
  });

  it('deixa passar o que o dicionário não conhece, em vez de esconder', () => {
    expect(paymentMethodLabel('cripto', PAYMENT_METHOD_LABELS)).toBe('cripto');
  });
});

describe('datesForPreset', () => {
  const vazio = { startDate: '', endDate: '' };

  /* Sete dias são hoje MAIS os seis anteriores. Com `daysAgo(7)` o período
     teria oito dias e a comparação do backend deixaria de bater. */
  it('7 dias inclui hoje, então volta 6', () => {
    const { startDate, endDate } = datesForPreset('last7', vazio);
    const dias =
      (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000;
    expect(dias).toBe(6);
  });

  it('30 dias volta 29, pela mesma conta', () => {
    const { startDate, endDate } = datesForPreset('last30', vazio);
    const dias =
      (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000;
    expect(dias).toBe(29);
  });

  it('"Escolher…" não mexe nas datas que o lojista digitou', () => {
    const escolhido = { startDate: '2026-01-01', endDate: '2026-01-31' };
    expect(datesForPreset('custom', escolhido)).toEqual(escolhido);
  });

  /*
   * A tela chama com o estado inteiro e faz `{ preset, ...datesForPreset(…) }`.
   * Se a função devolvesse `current` verbatim, o `preset` antigo voltaria no
   * spread e sobrescreveria o novo — clicar em "Escolher…" não abriria os
   * campos de data, e o TypeScript não veria nada de errado.
   */
  it('devolve SÓ as duas datas, sem carregar de volta o preset antigo', () => {
    const estadoInteiro = {
      preset: 'last30' as const,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };

    const devolvido = datesForPreset('custom', estadoInteiro);

    expect(Object.keys(devolvido).sort()).toEqual(['endDate', 'startDate']);
    expect(devolvido).not.toHaveProperty('preset');
  });
});

describe('rangeProblem', () => {
  it('data invertida é barrada antes do 422 do backend', () => {
    expect(rangeProblem({ preset: 'custom', startDate: '2026-08-16', endDate: '2026-08-01' })).toBe(
      'A data inicial é depois da final.',
    );
  });

  it('data faltando é barrada', () => {
    expect(rangeProblem({ preset: 'custom', startDate: '', endDate: '2026-08-01' })).not.toBeNull();
  });

  it('período válido passa', () => {
    expect(
      rangeProblem({ preset: 'custom', startDate: '2026-08-01', endDate: '2026-08-16' }),
    ).toBeNull();
  });
});

describe('dayLabel', () => {
  /*
   * A ARMADILHA: `new Date('2026-08-16')` é meia-noite UTC, que em
   * America/Fortaleza é 21h do dia 15. Formatar no fuso da operação devolveria
   * "15/08" e deslocaria o gráfico inteiro um dia — o pico do sábado
   * aparecendo na sexta, sem nada quebrar.
   */
  it('lê o dia como texto, sem passar por Date', () => {
    expect(dayLabel('2026-08-16')).toBe('16/08');
    expect(dayLabel('2026-01-01')).toBe('01/01');
    expect(dayLabel('2026-12-31')).toBe('31/12');
  });

  it('devolve o que veio quando não é uma data do contrato', () => {
    expect(dayLabel('nem-data')).toBe('nem-data');
  });

  it('o dia da semana bate com o dia, sem deslocar', () => {
    // 16/08/2026 é um domingo.
    expect(dayFullLabel('2026-08-16')).toBe('dom, 16/08');
    // 15/08/2026 é um sábado — o dia que o bug de fuso roubaria.
    expect(dayFullLabel('2026-08-15')).toBe('sáb, 15/08');
  });
});

describe('maxRevenue e barRatio', () => {
  /*
   * O BUG SILENCIOSO QUE ISTO PREVINE: comparando as strings do contrato,
   * '9.00' > '10.00' é verdade, e a barra mais alta do gráfico seria a do dia
   * errado — sem erro, sem exceção, sem nada quebrando na tela.
   */
  it('compara como número, não como texto', () => {
    const dias = [{ revenue_total: '9.00' }, { revenue_total: '10.00' }];
    expect(maxRevenue(dias)).toBe(10);
  });

  it('período sem venda nenhuma tem teto zero', () => {
    expect(maxRevenue([{ revenue_total: '0.00' }, { revenue_total: '0.00' }])).toBe(0);
  });

  it('teto zero não vira divisão por zero', () => {
    expect(barRatio('0.00', 0)).toBe(0);
    expect(Number.isNaN(barRatio('0.00', 0))).toBe(false);
  });

  /* Dia sem venda é uma informação. Uma barra mínima "para aparecer" diria
     que vendeu pouco, que é outra coisa. */
  it('dia sem venda tem altura zero, não um mínimo decorativo', () => {
    expect(barRatio('0.00', 500)).toBe(0);
  });

  it('a proporção sai entre 0 e 1', () => {
    expect(barRatio('250.00', 500)).toBe(0.5);
    expect(barRatio('500.00', 500)).toBe(1);
  });

  /*
   * O PISO DA COLUNA. Numa série em que um dia domina, o dia de R$ 9,00 fica em
   * 0,7% da altura — meio pixel, igual a um dia fechado. O piso separa "vendeu
   * pouquíssimo" de "não vendeu", sem mexer na escala de quem se compara.
   */
  it('dia que vendeu pouquíssimo ainda aparece', () => {
    expect(barRatio('9.00', 1240)).toBe(MIN_BAR_RATIO);
    expect(barRatio('9.00', 1240)).toBeGreaterThan(0);
  });

  it('o piso não alcança quem já está acima dele', () => {
    expect(barRatio('620.00', 1240)).toBe(0.5);
  });
});

/*
 * O PERÍODO ANTERIOR — o par de datas da segunda chamada de `sales-by-day`,
 * que é o que permite a frase de causa ("puxado por terça e sábado").
 */
describe('previousRange', () => {
  it('devolve o mesmo tamanho, terminando na véspera do início', () => {
    expect(previousRange({ startDate: '2026-08-10', endDate: '2026-08-16' })).toEqual({
      startDate: '2026-08-03',
      endDate: '2026-08-09',
    });
  });

  it('atravessa a virada do mês sem perder um dia', () => {
    expect(previousRange({ startDate: '2026-03-01', endDate: '2026-03-07' })).toEqual({
      startDate: '2026-02-22',
      endDate: '2026-02-28',
    });
  });

  it('funciona no período de um dia só', () => {
    expect(previousRange({ startDate: '2026-08-16', endDate: '2026-08-16' })).toEqual({
      startDate: '2026-08-15',
      endDate: '2026-08-15',
    });
  });

  /* Data ilegível não vira requisição: a promessa nem é criada, e a tela fica
     sem a frase de causa em vez de pedir um intervalo sem sentido. */
  it('devolve null no par ilegível ou invertido', () => {
    expect(previousRange({ startDate: '', endDate: '2026-08-16' })).toBeNull();
    expect(previousRange({ startDate: '2026-08-20', endDate: '2026-08-10' })).toBeNull();
  });
});

/* ==========================================================================
 * A VARIAÇÃO QUE NÃO SE DEVE MOSTRAR — a loja que acabou de abrir
 * ======================================================================= */

/*
 * ESTES TESTES SÃO SOBRE QUEM ABRE A TELA COM UM PEDIDO, e é esse caso que
 * quebra a tela de desempenho de todo painel: com 1 pedido no período
 * anterior, a aritmética do backend está certa e a leitura na tela é lixo.
 * "-99,5%" em vermelho gigante não descreve a loja — descreve o denominador.
 */
describe('readChangeComBase', () => {
  it('esconde a variação quando o período anterior teve menos de 5 pedidos', () => {
    const leitura = readChangeComBase(
      comparison({ change_percent: '-99.5' }),
      'a semana passada',
      1,
    );

    expect(leitura.text).toBe('sem comparação — 1 pedido no período anterior');
    expect(leitura.direction).toBe('none');
    expect(leitura.isMissing).toBe(true);
  });

  it('escreve a base no plural, porque ela é a resposta e não um travessão', () => {
    expect(readChangeComBase(comparison(), 'os 7 dias anteriores', 4).text).toBe(
      'sem comparação — 4 pedidos no período anterior',
    );
  });

  /* O corte é `< 5`, não `<= 5`: cinco pedidos JÁ comparam. O teste está no
     limite porque é ali que um `<=` distraído passaria despercebido. */
  it('mostra a variação a partir da base mínima', () => {
    expect(readChangeComBase(comparison(), 'antes', BASE_MINIMA_PARA_VARIACAO).text).toBe(
      '+25% vs. antes',
    );
  });

  /*
   * BASE DESCONHECIDA NÃO É BASE PEQUENA. Sem a contagem, a guarda não roda —
   * inventar um número para poder escondê-lo seria trocar um defeito por outro.
   */
  it('não esconde nada quando a base é desconhecida', () => {
    expect(readChangeComBase(comparison(), 'antes', null).text).toBe('+25% vs. antes');
  });

  /*
   * O TETO. "+19.900%" ocupa a largura de um cartão e diz menos que "cresceu
   * muito" — e a direção continua sendo dita, porque ela é verdadeira.
   */
  it('corta o percentual absurdo no teto, dizendo que cortou', () => {
    const leitura = readChangeComBase(comparison({ change_percent: '19900.0' }), 'antes', 40);

    expect(leitura.text).toBe(`mais de +${VARIACAO_MAXIMA_PCT}% vs. antes`);
    expect(leitura.direction).toBe('up');
    expect(leitura.isMissing).toBe(false);
  });

  it('corta o percentual absurdo para baixo também', () => {
    const leitura = readChangeComBase(comparison({ change_percent: '-1500.0' }), 'antes', 40);

    expect(leitura.text).toBe(`mais de −${VARIACAO_MAXIMA_PCT}% vs. antes`);
    expect(leitura.direction).toBe('down');
  });

  it('deixa passar o que está dentro do teto', () => {
    expect(readChangeComBase(comparison({ change_percent: '999.0' }), 'antes', 40).text).toBe(
      '+999% vs. antes',
    );
  });

  /* A regra de sempre continua valendo por baixo: nulo é "sem comparação",
     nunca 0% — e uma base grande não pode reintroduzir aquele defeito. */
  it('mantém "sem comparação" do change_percent nulo', () => {
    expect(readChangeComBase(comparison({ change_percent: null }), 'antes', 40).isMissing).toBe(
      true,
    );
  });
});

/*
 * A TAXA TAMBÉM TEM PISO DE BASE, e o caso é o do período sem venda: dois
 * pedidos, os dois cancelados, e o backend responde "100.0" com toda a razão.
 * Como manchete de 28px isso diz "a operação parou".
 */
describe('taxaTemBase', () => {
  it('recusa a taxa quando o período teve menos de cinco pedidos', () => {
    expect(taxaTemBase(0)).toBe(false);
    expect(taxaTemBase(2)).toBe(false);
    expect(taxaTemBase(BASE_MINIMA_PARA_VARIACAO - 1)).toBe(false);
  });

  it('aceita a partir da mesma base mínima da variação', () => {
    expect(taxaTemBase(BASE_MINIMA_PARA_VARIACAO)).toBe(true);
    expect(taxaTemBase(60)).toBe(true);
  });
});
