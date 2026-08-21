import { describe, expect, it } from 'vitest';

import {
  NO_FILTERS,
  SEGMENT_OPTIONS,
  activeFilterCount,
  filterProblem,
  hasActiveFilters,
  toQuery,
  type CustomerFilterState,
} from './customer-filters';

function draft(overrides: Partial<CustomerFilterState> = {}): CustomerFilterState {
  return { ...NO_FILTERS, ...overrides };
}

describe('SEGMENT_OPTIONS', () => {
  /*
   * "Todas as classes" é a AUSÊNCIA de recorte, e o valor dela é a string vazia
   * — que `toQuery` traduz em parâmetro omitido. Um sexto código enviado ao
   * backend responderia 422, como qualquer enum.
   */
  it('abre com "todas" e depois as cinco classes do contrato', () => {
    expect(SEGMENT_OPTIONS.map((option) => option.value)).toEqual([
      '',
      'novo',
      'ocasional',
      'fiel',
      'em_risco',
      'perdido',
    ]);
  });
});

describe('activeFilterCount', () => {
  it('sem critério nenhum, zero', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  /*
   * A FAIXA CONTA COMO UM. O número no botão é o de CRITÉRIOS que a pessoa
   * ligou, não o de campos que ela preencheu: "Filtros · 4" para duas faixas
   * faria o contador deixar de corresponder ao que ela lembra de ter feito.
   */
  it('a faixa de datas preenchida dos dois lados conta como um critério', () => {
    expect(
      activeFilterCount(draft({ lastOrderFrom: '2026-08-01', lastOrderTo: '2026-08-21' })),
    ).toBe(1);
  });

  it('a faixa de ticket preenchida dos dois lados conta como um critério', () => {
    expect(activeFilterCount(draft({ minTicket: '20', maxTicket: '80' }))).toBe(1);
  });

  it('meia faixa também conta — o recorte existe', () => {
    expect(activeFilterCount(draft({ minTicket: '20' }))).toBe(1);
    expect(activeFilterCount(draft({ lastOrderTo: '2026-08-21' }))).toBe(1);
  });

  it('os três juntos somam três', () => {
    const tudo = draft({
      segment: 'em_risco',
      lastOrderFrom: '2026-08-01',
      minTicket: '20',
      maxTicket: '80',
    });
    expect(activeFilterCount(tudo)).toBe(3);
    expect(hasActiveFilters(tudo)).toBe(true);
  });
});

/*
 * ============================================================================
 * O QUE NÃO PODE SER APLICADO — e é por isso que não chega a virar 400
 * ============================================================================
 *
 * O backend responde 400 a intervalo invertido, não lista vazia. A tela confere
 * antes: um 400 apaga a lista e a troca por uma tarja, quando o conserto é uma
 * data que a pessoa acabou de digitar.
 */
describe('filterProblem', () => {
  it('rascunho vazio pode ser aplicado', () => {
    expect(filterProblem(NO_FILTERS)).toBeNull();
  });

  it('data inicial depois da final é barrada, e o erro é do período', () => {
    const problema = filterProblem(
      draft({ lastOrderFrom: '2026-08-21', lastOrderTo: '2026-08-01' }),
    );
    expect(problema?.campo).toBe('periodo');
    expect(problema?.message).toMatch(/depois da final/);
  });

  /*
   * A comparação é de STRING, e funciona porque AAAA-MM-DD tem ordem
   * lexicográfica igual à cronológica. Este caso trava a propriedade: dois dias
   * do mesmo mês, e a virada de ano, que é onde um formato com o dia na frente
   * quebraria.
   */
  it('a mesma data nas duas pontas é um recorte de um dia, e vale', () => {
    expect(
      filterProblem(draft({ lastOrderFrom: '2026-08-21', lastOrderTo: '2026-08-21' })),
    ).toBeNull();
  });

  it('dezembro para janeiro do ano seguinte é ordem crescente', () => {
    expect(
      filterProblem(draft({ lastOrderFrom: '2025-12-30', lastOrderTo: '2026-01-02' })),
    ).toBeNull();
  });

  it('meia faixa nunca é invertida', () => {
    expect(filterProblem(draft({ lastOrderFrom: '2026-08-21' }))).toBeNull();
    expect(filterProblem(draft({ lastOrderTo: '2026-08-01' }))).toBeNull();
  });

  it('ticket mínimo maior que o máximo é barrado, e o erro é do ticket', () => {
    const problema = filterProblem(draft({ minTicket: '80', maxTicket: '20' }));
    expect(problema?.campo).toBe('ticket');
    expect(problema?.message).toMatch(/mínimo é maior/);
  });

  /*
   * A VÍRGULA É A DECIMAL DO BRASIL, e o campo aceita o que o lojista digita.
   * Sem isto, "19,90" a "20,10" leria como 1990 > 2010 e a faixa passaria; ou
   * pior, passaria como válida e recortaria a base inteira.
   */
  it('compara com a vírgula decimal, e não como texto', () => {
    expect(filterProblem(draft({ minTicket: '19,90', maxTicket: '20,10' }))).toBeNull();
    expect(filterProblem(draft({ minTicket: '20,10', maxTicket: '19,90' }))?.campo).toBe('ticket');
  });

  it('texto que não é número no ticket também trava', () => {
    expect(filterProblem(draft({ minTicket: 'abc' }))?.campo).toBe('ticket');
  });

  it('ticket negativo trava: o contrato exige zero ou mais', () => {
    expect(filterProblem(draft({ minTicket: '-5' }))?.campo).toBe('ticket');
  });
});

describe('toQuery', () => {
  it('rascunho vazio não manda parâmetro nenhum', () => {
    expect(toQuery(NO_FILTERS)).toEqual({});
  });

  it('só o que está preenchido entra', () => {
    expect(toQuery(draft({ segment: 'em_risco' }))).toEqual({ segment: 'em_risco' });
  });

  /*
   * O TICKET VAI COM DUAS CASAS, COMO STRING. Do outro lado é `Decimal`: um
   * 50,10 que atravessa como `float` pode chegar 50,099999 e recortar uma linha
   * de menos sem nada acender.
   */
  it('o ticket vira string de duas casas', () => {
    expect(toQuery(draft({ minTicket: '50,1', maxTicket: '1.234,5' }))).toEqual({
      minTicket: '50.10',
      maxTicket: '1234.50',
    });
  });

  it('ticket zero é um recorte legítimo, e não some por ser falsy', () => {
    expect(toQuery(draft({ minTicket: '0' }))).toEqual({ minTicket: '0.00' });
  });

  /*
   * AS DATAS VÃO CRUAS. Elas já são o dia da OPERAÇÃO — saem de um
   * `input type="date"`, que devolve AAAA-MM-DD sem fuso, e o backend as lê em
   * `America/Fortaleza`. Um `Date` no meio do caminho reintroduziria o fuso do
   * navegador e mandaria o dia vizinho.
   */
  it('as datas atravessam sem conversão', () => {
    expect(toQuery(draft({ lastOrderFrom: '2026-08-01', lastOrderTo: '2026-08-21' }))).toEqual({
      lastOrderFrom: '2026-08-01',
      lastOrderTo: '2026-08-21',
    });
  });

  it('os três critérios juntos viram cinco parâmetros', () => {
    expect(
      toQuery(
        draft({
          segment: 'fiel',
          lastOrderFrom: '2026-08-01',
          lastOrderTo: '2026-08-21',
          minTicket: '20',
          maxTicket: '80',
        }),
      ),
    ).toEqual({
      segment: 'fiel',
      lastOrderFrom: '2026-08-01',
      lastOrderTo: '2026-08-21',
      minTicket: '20.00',
      maxTicket: '80.00',
    });
  });
});
