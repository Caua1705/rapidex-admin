import { describe, expect, it } from 'vitest';

import {
  daysAgoInOperationTimezone,
  formatCurrency,
  formatElapsed,
  formatTime,
  labelFor,
  todayInOperationTimezone,
} from './format';

describe('formatCurrency', () => {
  it('formata número e string em reais', () => {
    // O Intl separa "R$" do valor com espaco fixo (U+00A0), que \s cobre.
    expect(formatCurrency(42.5).replace(/\s/g, ' ')).toBe('R$ 42,50');
    expect(formatCurrency('10').replace(/\s/g, ' ')).toBe('R$ 10,00');
  });

  it('não quebra com valor inválido', () => {
    expect(formatCurrency('abc')).toBe('—');
  });
});

describe('formatTime', () => {
  // 18:00Z = 15:00 em America/Fortaleza. O horário na tela é o da operação.
  it('mostra a hora no fuso da operação', () => {
    expect(formatTime('2026-08-07T18:00:00Z')).toBe('15:00');
  });

  it('devolve travessão quando não há data', () => {
    expect(formatTime(null)).toBe('—');
    expect(formatTime('data-errada')).toBe('—');
  });
});

describe('formatElapsed', () => {
  const agora = Date.parse('2026-08-07T12:00:00Z');

  it('conta minutos, horas e dias', () => {
    expect(formatElapsed('2026-08-07T11:59:30Z', agora)).toBe('agora');
    expect(formatElapsed('2026-08-07T11:48:00Z', agora)).toBe('12 min');
    expect(formatElapsed('2026-08-07T09:30:00Z', agora)).toBe('2h30');
    expect(formatElapsed('2026-08-05T12:00:00Z', agora)).toBe('2d');
  });
});

describe('datas no fuso da operação', () => {
  it('02:00Z do dia 8 ainda é o dia 7 para o lojista', () => {
    expect(todayInOperationTimezone(new Date('2026-08-08T02:00:00Z'))).toBe('2026-08-07');
  });

  it('conta dias para trás a partir do dia da operação', () => {
    expect(daysAgoInOperationTimezone(1, new Date('2026-08-08T12:00:00Z'))).toBe('2026-08-07');
  });
});

describe('labelFor', () => {
  it('traduz o que conhece e devolve o valor cru para o resto', () => {
    expect(labelFor({ pix: 'Pix' }, 'pix')).toBe('Pix');
    expect(labelFor({ pix: 'Pix' }, 'cripto')).toBe('cripto');
    expect(labelFor({ pix: 'Pix' }, null)).toBe('—');
  });
});
