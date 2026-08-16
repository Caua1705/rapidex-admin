import { describe, expect, it } from 'vitest';

import { customerKey, customerName, daysSince, formatPhone, formatSince } from './customer-model';
import type { CustomerListItem } from '../api/types';

function customer(overrides: Partial<CustomerListItem> = {}): CustomerListItem {
  return {
    customer_name: 'Ana Paula',
    customer_phone: '85999990000',
    orders_count: 3,
    total_spent: 120.5,
    first_order_at: '2026-03-12T20:00:00Z',
    last_order_at: '2026-08-15T20:00:00Z',
    ...overrides,
  };
}

describe('customerKey', () => {
  it('usa o telefone, que é a chave do agrupamento no backend', () => {
    expect(customerKey(customer())).toBe('85999990000');
  });
});

describe('daysSince', () => {
  /*
   * O CASO QUE JUSTIFICA A FUNÇÃO EXISTIR: 23h de ontem contra 01h de hoje.
   * Duas horas de diferença, e dois dias de operação distintos — uma divisão
   * por 86.400.000 diria "0 dias" e a coluna mostraria "hoje" para quem não
   * compra desde ontem.
   *
   * 03:00Z é meia-noite em Fortaleza (UTC−3), então 2026-08-16T02:00:00Z ainda
   * é dia 15 lá, e 2026-08-16T04:00:00Z já é dia 16.
   */
  it('conta dias da operação, não intervalos de 24h', () => {
    const ontemTarde = '2026-08-16T02:00:00Z'; // 23h de 15/08 em Fortaleza
    const agora = Date.parse('2026-08-16T04:00:00Z'); // 01h de 16/08 em Fortaleza
    expect(daysSince(ontemTarde, agora)).toBe(1);
  });

  it('devolve 0 no mesmo dia da operação', () => {
    const cedo = '2026-08-16T13:00:00Z';
    const agora = Date.parse('2026-08-16T23:00:00Z');
    expect(daysSince(cedo, agora)).toBe(0);
  });

  it('devolve null sem data — o campo é nulável no contrato', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
  });

  it('devolve null com data ilegível em vez de NaN na tela', () => {
    expect(daysSince('nem-data-nem-nada')).toBeNull();
  });

  it('nunca é negativo: carimbo à frente do relógio vira 0', () => {
    const futuro = '2026-08-20T12:00:00Z';
    const agora = Date.parse('2026-08-16T12:00:00Z');
    expect(daysSince(futuro, agora)).toBe(0);
  });
});

describe('formatSince', () => {
  const agora = Date.parse('2026-08-16T15:00:00Z');

  it.each([
    ['2026-08-16T13:00:00Z', 'hoje'],
    ['2026-08-15T13:00:00Z', 'ontem'],
    ['2026-08-04T13:00:00Z', 'há 12 dias'],
    ['2026-07-16T13:00:00Z', 'há 1 mês'],
    ['2026-05-16T13:00:00Z', 'há 3 meses'],
    ['2025-05-16T13:00:00Z', 'há 1 ano'],
    ['2024-05-16T13:00:00Z', 'há 2 anos'],
  ])('%s → %s', (iso, esperado) => {
    expect(formatSince(iso, agora)).toBe(esperado);
  });

  it('sem data vira travessão, não frase inventada', () => {
    expect(formatSince(null, agora)).toBe('—');
  });
});

describe('formatPhone', () => {
  it('agrupa celular de 11 dígitos', () => {
    expect(formatPhone('85999990000')).toBe('(85) 99999-0000');
  });

  it('agrupa fixo de 10 dígitos', () => {
    expect(formatPhone('8532224444')).toBe('(85) 3222-4444');
  });

  it('limpa a pontuação que já vem no cadastro', () => {
    expect(formatPhone('(85) 99999-0000')).toBe('(85) 99999-0000');
  });

  it('tira o 55 do país quando o que sobra é um número brasileiro inteiro', () => {
    expect(formatPhone('+55 (85) 99999-0000')).toBe('(85) 99999-0000');
    expect(formatPhone('5585999990000')).toBe('(85) 99999-0000');
    expect(formatPhone('558532224444')).toBe('(85) 3222-4444');
  });

  /* O DDD 55 é de Santa Cruz do Sul (RS). Sem a conferência do que sobra, a
     regra do país comeria o DDD e o número sairia com dois dígitos a menos. */
  it('não confunde o DDD 55 com o código do país', () => {
    expect(formatPhone('55999998888')).toBe('(55) 99999-8888');
  });

  it('devolve cru o que não tem 10 nem 11 dígitos, em vez de remontar errado', () => {
    expect(formatPhone('12345')).toBe('12345');
    expect(formatPhone('')).toBe('');
  });
});

describe('customerName', () => {
  it('nomeia a ausência em vez de deixar a linha em branco', () => {
    expect(customerName(customer({ customer_name: '   ' }))).toBe('Sem nome');
  });

  it('não mexe no nome que existe', () => {
    expect(customerName(customer())).toBe('Ana Paula');
  });
});
