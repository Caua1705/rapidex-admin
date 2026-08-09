import { describe, expect, it } from 'vitest';

import {
  checkEstimatedRange,
  formatCoordinateInput,
  formatDecimalInput,
  formatIntegerInput,
  parseCoordinate,
  parseDecimal,
  parseInteger,
} from './settings-model';

describe('parseDecimal', () => {
  it('aceita a vírgula decimal e o ponto de milhar', () => {
    expect(parseDecimal('12,50')).toEqual({ ok: true, value: 12.5 });
    expect(parseDecimal('1.234,50')).toEqual({ ok: true, value: 1234.5 });
    expect(parseDecimal('  8  ')).toEqual({ ok: true, value: 8 });
  });

  /*
   * A diferença que motiva este módulo existir: vazio é um valor legítimo —
   * é assim que se apaga uma taxa máxima — e texto inválido tem que travar o
   * salvamento. Um `null` para os dois casos não distinguiria as duas coisas.
   */
  it('campo vazio vira null, e não erro', () => {
    expect(parseDecimal('')).toEqual({ ok: true, value: null });
    expect(parseDecimal('   ')).toEqual({ ok: true, value: null });
  });

  it('campo obrigatório recusa o vazio', () => {
    expect(parseDecimal('', { allowEmpty: false }).ok).toBe(false);
  });

  it('texto que não é número é recusado, não virado em null', () => {
    expect(parseDecimal('abc').ok).toBe(false);
    expect(parseDecimal('12,,5').ok).toBe(false);
  });

  it('negativo é recusado', () => {
    expect(parseDecimal('-3').ok).toBe(false);
  });

  it('zero é um valor de verdade', () => {
    expect(parseDecimal('0')).toEqual({ ok: true, value: 0 });
  });
});

describe('parseInteger', () => {
  it('aceita inteiro e recusa fração', () => {
    expect(parseInteger('25')).toEqual({ ok: true, value: 25 });
    expect(parseInteger('25,5').ok).toBe(false);
    expect(parseInteger('25.5').ok).toBe(false);
  });

  it('vazio continua sendo null', () => {
    expect(parseInteger('')).toEqual({ ok: true, value: null });
  });
});

describe('parseCoordinate', () => {
  // O Brasil inteiro é latitude negativa: recusar o sinal colocaria a loja no
  // hemisfério errado.
  it('aceita negativo', () => {
    expect(parseCoordinate('-3.7319', 'latitude')).toEqual({ ok: true, value: -3.7319 });
    expect(parseCoordinate('-38,5267', 'longitude')).toEqual({ ok: true, value: -38.5267 });
  });

  it('recusa fora da faixa do planeta', () => {
    expect(parseCoordinate('100', 'latitude').ok).toBe(false);
    expect(parseCoordinate('-200', 'longitude').ok).toBe(false);
    expect(parseCoordinate('100', 'longitude').ok).toBe(true);
  });

  it('vazio é null: coordenada não preenchida é caso normal', () => {
    expect(parseCoordinate('', 'latitude')).toEqual({ ok: true, value: null });
  });
});

describe('formatação de volta para o campo', () => {
  it('dinheiro sai com vírgula e dois dígitos', () => {
    expect(formatDecimalInput(12.5)).toBe('12,50');
    expect(formatDecimalInput(null)).toBe('');
    expect(formatDecimalInput('7.25')).toBe('7,25');
  });

  it('minuto sai inteiro', () => {
    expect(formatIntegerInput(25)).toBe('25');
    expect(formatIntegerInput(null)).toBe('');
  });

  // Arredondar coordenada move a loja no mapa — e o frete sai do lugar errado.
  it('coordenada mantém todas as casas que vieram', () => {
    expect(formatCoordinateInput(-3.731862)).toBe('-3.731862');
    expect(formatCoordinateInput(null)).toBe('');
  });
});

describe('checkEstimatedRange', () => {
  it('faixa completa e coerente passa', () => {
    expect(checkEstimatedRange(20, 35)).toBeNull();
  });

  it('nenhum dos dois preenchido é aceitável: a faixa é opcional', () => {
    expect(checkEstimatedRange(null, null)).toBeNull();
  });

  // "25 a ?" é o que o cliente veria no app.
  it('só um lado preenchido é meio caminho', () => {
    expect(checkEstimatedRange(25, null)).toBeTruthy();
    expect(checkEstimatedRange(null, 40)).toBeTruthy();
  });

  it('máximo abaixo do mínimo inverte a faixa', () => {
    expect(checkEstimatedRange(40, 20)).toBeTruthy();
  });
});
