import { describe, expect, it } from 'vitest';

import type { BusinessHour } from '../api/types';
import {
  formatDayRange,
  hasMultiplePeriods,
  validateWeek,
  weekFromResponse,
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
