import { describe, expect, it } from 'vitest';

import type { BusinessHour } from '../api/types';
import {
  backendWeekday,
  formatDayRange,
  hasMultiplePeriods,
  prepTimeForDay,
  validateWeek,
  weekFromResponse,
  weekdayDaOperacao,
  weekPayload,
  WEEKDAYS,
  type DayDraft,
} from './business-hours';

function hour(overrides: Partial<BusinessHour> & { weekday: number }): BusinessHour {
  return {
    id: `h-${overrides.weekday}`,
    is_closed: false,
    sort_order: 0,
    ...overrides,
  };
}

function openDay(weekday: number, opensAt = '09:00', closesAt = '18:00'): DayDraft {
  return { weekday, isClosed: false, opensAt, closesAt };
}

describe('weekFromResponse', () => {
  it('devolve sempre as sete linhas, na ordem da grade', () => {
    const week = weekFromResponse([
      hour({ weekday: 2, opens_at: '11:00:00', closes_at: '23:00:00' }),
    ]);

    expect(week).toHaveLength(7);
    expect(week.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  // Dia ausente da resposta significa fechado do outro lado. Deixar a linha em
  // branco faria o lojista achar que o horário se perdeu.
  it('dia ausente entra como fechado, não como linha vazia', () => {
    const week = weekFromResponse([
      hour({ weekday: 0, opens_at: '09:00:00', closes_at: '18:00:00' }),
    ]);

    expect(week[0]).toMatchObject({ isClosed: false, opensAt: '09:00', closesAt: '18:00' });
    expect(week[1]).toMatchObject({ weekday: 1, isClosed: true, opensAt: '', closesAt: '' });
  });

  it('corta o segundo que o backend manda', () => {
    const week = weekFromResponse([
      hour({ weekday: 5, opens_at: '18:30:00', closes_at: '02:00:00' }),
    ]);

    expect(week[5]).toMatchObject({ opensAt: '18:30', closesAt: '02:00' });
  });

  it('dia marcado como fechado ignora o horário que veio junto', () => {
    const week = weekFromResponse([
      hour({ weekday: 3, is_closed: true, opens_at: '09:00:00', closes_at: '18:00:00' }),
    ]);

    expect(week[3]).toMatchObject({ isClosed: true, opensAt: '', closesAt: '' });
  });
});

describe('hasMultiplePeriods', () => {
  // A grade é uma linha por dia. Se o backend tem almoço E jantar no mesmo dia,
  // salvar por esta tela apagaria a segunda faixa — o lojista tem que saber.
  it('detecta dia com duas faixas', () => {
    expect(
      hasMultiplePeriods([
        hour({ weekday: 1, opens_at: '11:00:00', closes_at: '15:00:00' }),
        hour({ weekday: 1, opens_at: '18:00:00', closes_at: '23:00:00' }),
      ]),
    ).toBe(true);
  });

  it('uma faixa por dia não dispara o aviso', () => {
    expect(
      hasMultiplePeriods([
        hour({ weekday: 1, opens_at: '11:00:00', closes_at: '15:00:00' }),
        hour({ weekday: 2, opens_at: '11:00:00', closes_at: '15:00:00' }),
      ]),
    ).toBe(false);
  });
});

describe('weekPayload', () => {
  // O teste que protege a regra mais cara desta tela: o PUT substitui a semana
  // inteira, então um corpo com 2 dias fecha os outros 5.
  it('manda SEMPRE os sete dias, mesmo com um só aberto', () => {
    const payload = weekPayload([openDay(0)]);

    expect(payload).toHaveLength(7);
    expect(payload.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(payload[0]).toMatchObject({ is_closed: false, opens_at: '09:00:00' });
    expect(payload[6]).toMatchObject({ weekday: 6, is_closed: true });
  });

  it('dia fechado vai marcado como fechado, e não simplesmente omitido', () => {
    const payload = weekPayload(WEEKDAYS.map(({ weekday }) => openDay(weekday)));
    expect(payload.every((day) => day.is_closed === false)).toBe(true);

    const nenhum = weekPayload([]);
    expect(nenhum.every((day) => day.is_closed === true)).toBe(true);
  });

  it('completa o segundo no horário que vai para a API', () => {
    const payload = weekPayload([openDay(4, '8:00', '17:45')]);

    expect(payload[4]).toMatchObject({ opens_at: '08:00:00', closes_at: '17:45:00' });
  });
});

describe('validateWeek', () => {
  it('dia aberto sem uma das pontas vira problema', () => {
    const problems = validateWeek([openDay(0, '09:00', ''), openDay(1)]);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.weekday).toBe(0);
  });

  it('dia fechado nunca é problema, mesmo sem horário', () => {
    expect(validateWeek([{ weekday: 0, isClosed: true, opensAt: '', closesAt: '' }])).toEqual([]);
  });

  // Loja que abre 18:00 e fecha 02:00 é o caso comum de pizzaria. Barrar isso
  // quebraria justamente quem trabalha à noite.
  it('faixa que vira a noite é válida', () => {
    expect(validateWeek([openDay(5, '18:00', '02:00')])).toEqual([]);
  });

  it('abrir e fechar no mesmo horário é recusado', () => {
    expect(validateWeek([openDay(2, '12:00', '12:00')])).toHaveLength(1);
  });
});

describe('formatDayRange', () => {
  it('resume a linha para leitura de relance', () => {
    expect(formatDayRange(openDay(0, '11:00', '23:00'))).toBe('11:00 às 23:00');
    expect(formatDayRange({ weekday: 1, isClosed: true, opensAt: '', closesAt: '' })).toBe(
      'Fechado',
    );
    expect(formatDayRange(openDay(2, '11:00', ''))).toBe('Incompleto');
  });
});

/*
 * A conversão de dia da semana é o tipo de erro que não aparece em revisão: os
 * dois lados usam 0..6, ninguém reclama, e a loja lê o prazo de ontem.
 */
describe('backendWeekday', () => {
  it('converte o domingo do JavaScript no domingo do backend', () => {
    // 2026-08-09 é um domingo. JS diz 0; o backend conta 0 = segunda, então 6.
    expect(backendWeekday(new Date(2026, 7, 9))).toBe(6);
  });

  it('segunda é 0 nos dois lados, e é o único dia em que coincidem por acaso', () => {
    expect(backendWeekday(new Date(2026, 7, 10))).toBe(0);
  });

  it('percorre a semana inteira sem pular nem repetir', () => {
    // 2026-08-10 é segunda: sete dias seguidos têm que dar 0..6 na ordem.
    const semana = Array.from({ length: 7 }, (_, offset) =>
      backendWeekday(new Date(2026, 7, 10 + offset)),
    );
    expect(semana).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('bate com os rótulos da grade', () => {
    // Sábado, 2026-08-15.
    const sabado = backendWeekday(new Date(2026, 7, 15));
    expect(WEEKDAYS.find((day) => day.weekday === sabado)?.short).toBe('Sáb');
  });
});

/*
 * ============================================================================
 * QUE DIA É HOJE PARA A LOJA — e por que "hoje" tem dois donos
 * ============================================================================
 *
 * `backendWeekday(new Date())` responde no fuso do APARELHO, e era assim que a
 * barra de pedidos lia o prazo de preparo do dia. Num tablet de balcão em modo
 * quiosque com o fuso errado, o painel lê a linha de horário do dia errado — e
 * o erro é silencioso, porque os dois dias existem e nenhum dos dois reclama.
 *
 * Os casos abaixo escrevem o instante em UTC de propósito: só assim eles medem
 * a CONVERSÃO, e não o fuso em que o processo de teste por acaso está rodando.
 */
describe('weekdayDaOperacao', () => {
  it('meio-dia é o mesmo dia nos dois fusos, e serve de âncora', () => {
    // 2026-08-09 é domingo. Meio-dia UTC é 09:00 em Fortaleza: domingo lá também.
    expect(weekdayDaOperacao(new Date('2026-08-09T12:00:00Z'))).toBe(6);
  });

  /*
   * A HORA QUE SEPARA OS DOIS DONOS DE "HOJE".
   *
   * 02:00 UTC de segunda ainda é 23:00 de DOMINGO em Fortaleza (UTC-3). A loja
   * está no domingo — o turno de domingo à noite não acabou — e o aparelho em
   * UTC já virou a segunda.
   */
  it('às 2h UTC de segunda, a loja ainda está no domingo', () => {
    const instante = new Date('2026-08-10T02:00:00Z');
    expect(weekdayDaOperacao(instante)).toBe(6); // domingo, para a loja
    // E é isto que a leitura antiga respondia num aparelho em UTC:
    expect((instante.getUTCDay() + 6) % 7).toBe(0); // segunda, para o aparelho
  });

  it('percorre a semana inteira sem pular nem repetir', () => {
    const semana = Array.from({ length: 7 }, (_, offset) =>
      weekdayDaOperacao(new Date(`2026-08-${10 + offset}T12:00:00Z`)),
    );
    expect(semana).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('prepTimeForDay', () => {
  it('lê a faixa do dia pedido, e não a do primeiro dia da lista', () => {
    const hours = [
      hour({ weekday: 0, prep_time_min: 20, prep_time_max: 30 }),
      hour({ weekday: 3, prep_time_min: 40, prep_time_max: 55 }),
    ];

    expect(prepTimeForDay(hours, 3)).toEqual({ prep_time_min: 40, prep_time_max: 55 });
  });

  it('dia sem linha na semana não tem faixa', () => {
    expect(prepTimeForDay([hour({ weekday: 0, prep_time_min: 20, prep_time_max: 30 })], 4)).toBe(
      null,
    );
  });

  // Meia faixa não é faixa: mostrar só o mínimo faria "25 min" parecer promessa
  // fechada, quando o que existe é metade de um cadastro.
  it('linha com só uma das pontas não vira faixa', () => {
    expect(prepTimeForDay([hour({ weekday: 1, prep_time_min: 25 })], 1)).toBe(null);
    expect(prepTimeForDay([hour({ weekday: 1, prep_time_max: 40 })], 1)).toBe(null);
    expect(prepTimeForDay([hour({ weekday: 1 })], 1)).toBe(null);
  });

  // Zero é um valor gravado, não um campo vazio — e `typeof` é o que separa os
  // dois. Com um teste de veracidade, "0 min" viraria "não definido".
  it('zero minutos é uma faixa gravada', () => {
    const hours = [hour({ weekday: 2, prep_time_min: 0, prep_time_max: 0 })];
    expect(prepTimeForDay(hours, 2)).toEqual({ prep_time_min: 0, prep_time_max: 0 });
  });

  it('dia fechado ainda informa o prazo gravado', () => {
    // A loja fechada hoje continua tendo prazo cadastrado; quem decide o que
    // fazer com isso é a tela, não esta leitura.
    const hours = [hour({ weekday: 5, is_closed: true, prep_time_min: 30, prep_time_max: 45 })];
    expect(prepTimeForDay(hours, 5)).toEqual({ prep_time_min: 30, prep_time_max: 45 });
  });
});
