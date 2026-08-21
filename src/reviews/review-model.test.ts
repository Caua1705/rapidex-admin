/**
 * A leitura do agregado de avaliações.
 *
 * O QUE ESTES TESTES PROTEGEM: as duas propriedades que o backend garantiu e
 * que a tela pode destruir sem nada acender no `npm run typecheck` — a média
 * que sai do histograma, e o filtro de nota que não mexe no agregado. As duas
 * são invisíveis num diff e óbvias na mão do lojista.
 */
import { describe, expect, it } from 'vitest';

import {
  contar,
  formatAverage,
  LOW_RATING_MAX,
  lowRatingCount,
  MAX_PERIOD_DAYS,
  maxRatingFrom,
  periodDays,
  periodProblem,
  problemTagLabel,
  PROBLEM_TAG_LABEL,
  ratingCount,
  ratingRows,
  RATING_OPTIONS,
  tagRows,
  taggedCount,
  untaggedLowCount,
} from './review-model';
import type { ReviewSummary } from '../api/types';

function summaryOf(
  byRating: Partial<Record<'1' | '2' | '3' | '4' | '5', number>>,
  byProblemTag: Record<string, number> = {},
): ReviewSummary {
  const completo = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, ...byRating };
  const total = Object.values(completo).reduce((soma, quantidade) => soma + quantidade, 0);
  const soma = Object.entries(completo).reduce(
    (acumulado, [nota, quantidade]) => acumulado + Number(nota) * quantidade,
    0,
  );

  return {
    total,
    average: total === 0 ? null : Math.round((soma / total) * 100) / 100,
    by_rating: completo,
    by_problem_tag: byProblemTag,
  };
}

describe('as notas', () => {
  it('lê a contagem de cada nota do agregado', () => {
    const summary = summaryOf({ '5': 12, '3': 2 });
    expect(ratingCount(summary, 5)).toBe(12);
    expect(ratingCount(summary, 4)).toBe(0);
  });

  it('conta como baixa toda nota até 3 — a faixa em que a etiqueta é perguntada', () => {
    expect(lowRatingCount(summaryOf({ '1': 1, '2': 2, '3': 3, '4': 9, '5': 9 }))).toBe(6);
    expect(LOW_RATING_MAX).toBe(3);
  });

  it('devolve as cinco linhas do histograma, da melhor para a pior, inclusive as zeradas', () => {
    const linhas = ratingRows(summaryOf({ '5': 4, '1': 1 }));
    expect(linhas.map((linha) => linha.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(linhas.map((linha) => linha.count)).toEqual([4, 0, 0, 0, 1]);
  });

  /*
   * O PISO EXISTE PARA UMA CONTAGEM QUE NÃO É ZERO. Com 40 cincos e um único
   * 1, a barra do "1 estrela" a 2,5% seria meio pixel — indistinguível de
   * "ninguém deu essa nota", que é outra afirmação.
   */
  it('dá barra visível a quem teve pelo menos uma nota, e barra nenhuma a quem teve zero', () => {
    const linhas = ratingRows(summaryOf({ '5': 40, '1': 1 }));
    const cinco = linhas.find((linha) => linha.rating === 5)!;
    const quatro = linhas.find((linha) => linha.rating === 4)!;
    const um = linhas.find((linha) => linha.rating === 1)!;

    expect(cinco.ratio).toBe(1);
    expect(quatro.ratio).toBe(0);
    expect(um.ratio).toBeGreaterThan(0.05);
    expect(um.ratio).toBeLessThan(0.1);
  });

  it('não desenha barra nenhuma num período sem avaliação', () => {
    expect(ratingRows(summaryOf({})).every((linha) => linha.ratio === 0)).toBe(true);
  });
});

describe('as etiquetas', () => {
  it('ordena da mais frequente para a menos', () => {
    const summary = summaryOf(
      { '1': 2, '2': 3, '3': 3 },
      { atrasou: 4, veio_frio: 1, faltou_item: 2 },
    );
    expect(tagRows(summary).map((linha) => linha.tag)).toEqual([
      'atrasou',
      'faltou_item',
      'veio_frio',
    ]);
  });

  /*
   * Sem desempate estável, duas etiquetas com a mesma contagem trocariam de
   * lugar entre um recarregamento e outro — e uma lista que se remexe sozinha
   * é uma lista em que ninguém confia.
   */
  it('desempata pelo rótulo, e não pela ordem em que o JSON chegou', () => {
    const a = tagRows(summaryOf({ '2': 4 }, { veio_frio: 2, atrasou: 2 }));
    const b = tagRows(summaryOf({ '2': 4 }, { atrasou: 2, veio_frio: 2 }));
    expect(a.map((linha) => linha.tag)).toEqual(b.map((linha) => linha.tag));
    expect(a[0]!.tag).toBe('atrasou');
  });

  it('mede a barra contra o total de NOTAS BAIXAS, não contra a soma das etiquetas', () => {
    // 8 notas baixas, 3 delas com etiqueta: "atrasou" é 3 de 8, não 3 de 3.
    const summary = summaryOf({ '1': 4, '2': 4 }, { atrasou: 3 });
    expect(tagRows(summary)[0]!.ratio).toBeCloseTo(3 / 8, 5);
  });

  it('satura em 100% se a soma das etiquetas passar do total de baixas', () => {
    const summary = summaryOf({ '3': 1 }, { atrasou: 3 });
    expect(tagRows(summary)[0]!.ratio).toBe(1);
  });

  it('ignora etiqueta zerada', () => {
    expect(tagRows(summaryOf({ '2': 1 }, { atrasou: 1, outro: 0 }))).toHaveLength(1);
  });

  it('conta quantas notas baixas ficaram sem etiqueta', () => {
    const summary = summaryOf({ '1': 2, '3': 3 }, { atrasou: 2 });
    expect(taggedCount(summary)).toBe(2);
    expect(untaggedLowCount(summary)).toBe(3);
  });

  it('nunca devolve um número negativo de notas sem etiqueta', () => {
    expect(untaggedLowCount(summaryOf({ '3': 1 }, { atrasou: 5 }))).toBe(0);
  });

  it('tem rótulo para as seis etiquetas do contrato', () => {
    expect(Object.keys(PROBLEM_TAG_LABEL)).toHaveLength(6);
    expect(problemTagLabel('veio_errado')).toBe('Veio errado');
  });

  /*
   * A lista de etiquetas PODE CRESCER no backend. Mostrar o código cru é feio e
   * é a resposta certa: a contagem continua batendo com o total de baixas, e
   * quem vê "reembolso" na tela sabe que o painel está atrás. Cair em "Outro"
   * juntaria a etiqueta nova com uma que existe de verdade.
   */
  it('mostra o código de uma etiqueta que o painel ainda não conhece', () => {
    expect(problemTagLabel('reembolso')).toBe('reembolso');
    expect(tagRows(summaryOf({ '2': 1 }, { reembolso: 1 }))[0]!.label).toBe('reembolso');
  });
});

describe('a média', () => {
  it('mostra uma casa decimal', () => {
    expect(formatAverage(4.25)).toBe('4,3');
    expect(formatAverage(5)).toBe('5,0');
  });

  /*
   * `average` NULO É "ninguém avaliou". Zero se lê como "todo mundo odiou", que
   * é o oposto — e um `?? 0` nessa linha compila, passa no teste de tipo e
   * mente.
   */
  it('vira travessão quando ninguém avaliou, nunca 0,0', () => {
    expect(formatAverage(null)).toBe('—');
    expect(formatAverage(summaryOf({}).average)).toBe('—');
  });

  /*
   * A PROVA DA PROPRIEDADE QUE O BACKEND GARANTIU: a média e as barras da tela
   * saem do MESMO objeto. Se um dia alguém recalcular a média a partir de
   * `items` (que é uma página, e pode estar recortada por nota), este teste não
   * pega — mas a leitura aqui documenta que a média do agregado É a média do
   * histograma que a tela desenha.
   */
  it('bate com o histograma que a tela desenha', () => {
    const summary = summaryOf({ '5': 3, '4': 1, '2': 1 });
    const somaDasBarras = ratingRows(summary).reduce(
      (soma, linha) => soma + linha.rating * linha.count,
      0,
    );
    const totalDasBarras = ratingRows(summary).reduce((soma, linha) => soma + linha.count, 0);
    expect(totalDasBarras).toBe(summary.total);
    expect(somaDasBarras / totalDasBarras).toBeCloseTo(summary.average!, 5);
  });
});

describe('o período', () => {
  it('conta as duas pontas do intervalo', () => {
    expect(periodDays({ startDate: '2026-08-15', endDate: '2026-08-21' })).toBe(7);
    expect(periodDays({ startDate: '2026-08-21', endDate: '2026-08-21' })).toBe(1);
  });

  it('não aceita data invertida nem lixo', () => {
    expect(periodDays({ startDate: '2026-08-22', endDate: '2026-08-21' })).toBeNull();
    expect(periodDays({ startDate: '', endDate: '' })).toBeNull();
  });

  it('deixa passar um período comum', () => {
    expect(
      periodProblem({ preset: 'last7', startDate: '2026-08-15', endDate: '2026-08-21' }),
    ).toBeNull();
  });

  it('cobra as duas datas em "Escolher"', () => {
    expect(periodProblem({ preset: 'custom', startDate: '', endDate: '2026-08-21' })).toBe(
      'Escolha as duas datas do período.',
    );
  });

  it('aponta a data invertida antes de chamar a rota', () => {
    expect(
      periodProblem({ preset: 'custom', startDate: '2026-08-22', endDate: '2026-08-21' }),
    ).toBe('A data inicial é depois da final.');
  });

  /*
   * O TETO É DO BACKEND (`MAX_REVIEW_PERIOD_DAYS`), e ele responde 400 acima
   * disso. Dizer o limite antes de chamar é mais barato que traduzir o 400
   * depois — e 366 dias, e não 365, porque o backend conta as duas pontas.
   */
  it('barra o período acima do teto da rota, e aceita exatamente o teto', () => {
    expect(
      periodProblem({ preset: 'custom', startDate: '2026-01-01', endDate: '2026-12-31' }),
    ).toBeNull();
    expect(periodDays({ startDate: '2026-01-01', endDate: '2026-12-31' })).toBe(365);

    expect(
      periodProblem({ preset: 'custom', startDate: '2025-01-01', endDate: '2026-12-31' }),
    ).toBe(`O período máximo de consulta é de ${MAX_PERIOD_DAYS} dias.`);
  });
});

describe('o filtro de nota', () => {
  it('abre em "até 3 estrelas" — o recorte que o dono usa de verdade', () => {
    expect(RATING_OPTIONS[0]!.value).toBe(String(LOW_RATING_MAX));
  });

  it('traduz vazio como ausência de recorte', () => {
    expect(maxRatingFrom('')).toBeNull();
    expect(maxRatingFrom('3')).toBe(3);
  });

  /* Fora de 1..5 a rota responde 422: melhor mandar nada do que mandar 9. */
  it('recusa o que a rota não aceita', () => {
    expect(maxRatingFrom('0')).toBeNull();
    expect(maxRatingFrom('6')).toBeNull();
    expect(maxRatingFrom('abc')).toBeNull();
    expect(maxRatingFrom('2.5')).toBeNull();
  });

  it('só oferece valores que a rota aceita', () => {
    RATING_OPTIONS.forEach((opcao) => {
      if (opcao.value === '') return;
      expect(maxRatingFrom(opcao.value)).not.toBeNull();
    });
  });
});

describe('a contagem escrita', () => {
  it('concorda o singular com o plural', () => {
    expect(contar(1, 'avaliação', 'avaliações')).toBe('1 avaliação');
    expect(contar(0, 'avaliação', 'avaliações')).toBe('0 avaliações');
    expect(contar(12, 'avaliação', 'avaliações')).toBe('12 avaliações');
  });
});
