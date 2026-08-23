import { describe, expect, it } from 'vitest';

import {
  customerHistoryLine,
  customerKey,
  customerName,
  daysSince,
  formatPhone,
  formatSince,
  phoneDigits,
  phoneHref,
} from './customer-model';
import type { CustomerListItem } from '../api/types';

function customer(overrides: Partial<CustomerListItem> = {}): CustomerListItem {
  return {
    customer_name: 'Ana Paula',
    customer_phone: '85999990000',
    orders_count: 3,
    billable_orders_count: 3,
    total_spent: 120.5,
    average_ticket: 40.17,
    first_order_at: '2026-03-12T20:00:00Z',
    last_order_at: '2026-08-15T20:00:00Z',
    days_since_last_order: 5,
    cadence_days: 12,
    segment: 'fiel',
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

describe('phoneDigits', () => {
  /*
   * ELE É A CHAVE DE COMPARAÇÃO entre duas telas: o pedido guarda
   * `customer_phone_snapshot` e a lista de clientes guarda `customer_phone`, e
   * a mesma pessoa chega nos dois em formatos diferentes. Se estes casos
   * quebrarem, o detalhe do pedido passa a mostrar o histórico de outra pessoa
   * — ou de nenhuma.
   */
  it('reduz formatos diferentes do mesmo número à mesma forma', () => {
    expect(phoneDigits('(85) 99999-0000')).toBe('85999990000');
    expect(phoneDigits('85999990000')).toBe('85999990000');
    expect(phoneDigits('+55 85 99999-0000')).toBe('85999990000');
    expect(phoneDigits('5585999990000')).toBe('85999990000');
  });

  it('tira o 55 do país só quando o que SOBRA é um número brasileiro inteiro', () => {
    // 12 dígitos: 55 + 10 (fixo). Sai.
    expect(phoneDigits('558532224444')).toBe('8532224444');
    // 11 dígitos que POR ACASO começam com 55: não é código de país.
    expect(phoneDigits('55987654321')).toBe('55987654321');
  });

  it('devolve o que não é número brasileiro sem mutilar', () => {
    expect(phoneDigits('+1 415 555 0100')).toBe('14155550100');
    expect(phoneDigits('')).toBe('');
  });
});

describe('phoneHref', () => {
  /*
   * ELE É PARA DISCAR, NÃO PARA LER. `formatPhone` escreve o que aparece na
   * tela; isto escreve o que o aparelho recebe. Se as duas coisas se
   * confundirem, o link sai com parênteses e traço e o discador do telefone
   * erra o número — que é pior do que não oferecer link nenhum.
   */
  it('monta o `tel:` em formato de discagem, com o país', () => {
    expect(phoneHref('(85) 99999-0000')).toBe('tel:+5585999990000');
    expect(phoneHref('85999990000')).toBe('tel:+5585999990000');
    expect(phoneHref('(85) 3222-4444')).toBe('tel:+558532224444');
  });

  it('não repete o 55 de quem já veio com ele', () => {
    expect(phoneHref('5585999990000')).toBe('tel:+5585999990000');
    expect(phoneHref('+55 85 99999-0000')).toBe('tel:+5585999990000');
  });

  /*
   * O CASO QUE FAZ DISCAR ERRADO. "+1 415 555 0100" tem onze dígitos, igual a
   * um celular brasileiro — a contagem sozinha diria "é do Brasil" e o link
   * sairia como +55 1415555010. O `+` escrito no cadastro é o que impede.
   */
  it('respeita o país que o cadastro já afirma', () => {
    expect(phoneHref('+1 415 555 0100')).toBe('tel:+14155550100');
  });

  it('entrega os dígitos crus quando não sabe ler o formato', () => {
    expect(phoneHref('0800 111 2233')).toBe('tel:08001112233');
  });

  /* Sem número não há link: um `<a href>` morto é pior que texto. */
  it('devolve nulo quando não há o que discar', () => {
    expect(phoneHref('')).toBeNull();
    expect(phoneHref('1234')).toBeNull();
    expect(phoneHref('sem telefone')).toBeNull();
  });
});

describe('customerHistoryLine', () => {
  /*
   * A LINHA QUE O LOJISTA LÊ ANTES DE ACEITAR. Ela responde "esta pessoa volta
   * sempre?", e cada caso tem uma frase própria — inclusive o caso em que o
   * contrato não dá a data.
   */
  const agora = Date.parse('2026-08-20T15:00:00Z');

  it('quem estreia ganha a frase curta, não "há 0 dias · 1 pedido"', () => {
    const linha = customerHistoryLine(
      customer({ orders_count: 1, first_order_at: '2026-08-20T14:00:00Z' }),
      agora,
    );
    expect(linha).toBe('Primeiro pedido');
  });

  it('quem volta ganha a distância e a contagem, nessa ordem', () => {
    const linha = customerHistoryLine(
      customer({ orders_count: 12, first_order_at: '2025-08-20T14:00:00Z' }),
      agora,
    );
    expect(linha).toBe('Cliente há 1 ano · 12 pedidos');
  });

  it('"desde hoje" e "desde ontem", porque "Cliente hoje" não é português', () => {
    expect(
      customerHistoryLine(
        customer({ orders_count: 3, first_order_at: '2026-08-20T09:00:00Z' }),
        agora,
      ),
    ).toBe('Cliente desde hoje · 3 pedidos');

    expect(
      customerHistoryLine(
        customer({ orders_count: 2, first_order_at: '2026-08-19T09:00:00Z' }),
        agora,
      ),
    ).toBe('Cliente desde ontem · 2 pedidos');
  });

  it('sem data no contrato, sobra a contagem — nada é estimado', () => {
    const linha = customerHistoryLine(customer({ orders_count: 7, first_order_at: null }), agora);
    expect(linha).toBe('7 pedidos');
  });
});
