/**
 * As frases da tela de Avaliações.
 *
 * O QUE ESTES TESTES PROTEGEM: uma frase errada é pior que um número errado. O
 * número o lojista confere; a frase ele obedece — "3 das 5 notas baixas
 * apontaram Atrasou" vira uma conversa com o entregador na segunda-feira.
 *
 * Cada caso aqui é uma AFIRMAÇÃO que a tela faz, e cada `null` é uma afirmação
 * que ela se recusa a fazer.
 */
import { describe, expect, it } from 'vitest';

import {
  LIMIARES,
  readSemEtiqueta,
  readVeredito,
  readVolumeBaixo,
  semAvaliacao,
} from './review-insights';
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

describe('o período sem avaliação', () => {
  it('é reconhecido pelo total do agregado', () => {
    expect(semAvaliacao(summaryOf({}))).toBe(true);
    expect(semAvaliacao(summaryOf({ '5': 1 }))).toBe(false);
  });
});

describe('o veredito', () => {
  /*
   * A SEMANA SEM RECLAMAÇÃO É NOTÍCIA BOA, e precisa ler como notícia boa. Uma
   * tela chamada "Avaliações" que abre sem nada escrito no período em que
   * ninguém reclamou lê como defeito, não como elogio.
   */
  it('diz quando não houve nota baixa nenhuma', () => {
    const frase = readVeredito(summaryOf({ '5': 18, '4': 2 }));
    expect(frase.id).toBe('sem-baixas');
    expect(frase.text).toBe(
      'Nenhuma nota baixa neste período — 20 avaliações foram de 4 ou 5 estrelas.',
    );
  });

  it('concorda o singular quando a única avaliação foi alta', () => {
    expect(readVeredito(summaryOf({ '5': 1 })).text).toBe(
      'Nenhuma nota baixa neste período — 1 avaliação foi de 4 ou 5 estrelas.',
    );
  });

  /*
   * A FRASE QUE O BACKEND DESENHOU A ETIQUETA FECHADA PARA PODER ESCREVER — e
   * a razão de a etiqueta não ser texto livre: texto livre não soma.
   */
  it('aponta a etiqueta que se repetiu, com o denominador de notas baixas', () => {
    const frase = readVeredito(
      summaryOf({ '1': 3, '2': 4, '3': 5, '4': 10 }, { atrasou: 7, veio_frio: 2 }),
    );
    expect(frase.id).toBe('etiqueta-dominante');
    expect(frase.text).toBe('7 das 12 notas baixas apontaram “Atrasou”.');
  });

  /*
   * UMA RECLAMAÇÃO É UM CASO; DUAS É REPETIÇÃO. Com o limiar em 1, a manchete
   * mudaria de assunto a cada avaliação nova e deixaria de ser lida.
   */
  it('não promove uma etiqueta que apareceu uma vez só', () => {
    const frase = readVeredito(summaryOf({ '2': 1, '3': 2, '5': 5 }, { atrasou: 1 }));
    expect(frase.id).toBe('baixas-espalhadas');
    expect(frase.text).toBe('3 avaliações de 8 foram nota baixa — 3 estrelas ou menos.');
    expect(LIMIARES.etiquetaDominanteMinima).toBe(2);
  });

  it('cai na frase geral quando houve nota baixa e nenhuma etiqueta', () => {
    expect(readVeredito(summaryOf({ '1': 1, '5': 3 })).text).toBe(
      '1 avaliação de 4 foi nota baixa — 3 estrelas ou menos.',
    );
  });
});

describe('as ressalvas', () => {
  /*
   * Com três respostas, a média balança meia estrela por avaliação. Sem a
   * frase, o dono compara a média de uma semana de 3 com a de uma semana de 40
   * e conclui que a loja piorou.
   */
  it('avisa quando são poucas avaliações para a média significar algo', () => {
    expect(readVolumeBaixo(summaryOf({ '5': 3 }))?.id).toBe('volume-baixo');
    expect(readVolumeBaixo(summaryOf({ '5': LIMIARES.volumeBaixoTotal }))).toBeNull();
  });

  it('não avisa nada num período vazio — quem fala ali é o estado vazio', () => {
    expect(readVolumeBaixo(summaryOf({}))).toBeNull();
  });

  /*
   * ELA FECHA UMA SOMA QUE NÃO FECHA: "5 notas baixas" logo acima de uma lista
   * de etiquetas que soma 3. Duas contagens que discordam na mesma dobra lêem
   * como defeito de tela.
   */
  it('explica as notas baixas que não apontaram etiqueta', () => {
    const frase = readSemEtiqueta(summaryOf({ '1': 2, '3': 3 }, { atrasou: 2 }));
    expect(frase?.text).toBe(
      '3 notas baixas não apontaram etiqueta — escolhê-la é opcional para quem avalia.',
    );
  });

  it('concorda o singular', () => {
    expect(readSemEtiqueta(summaryOf({ '2': 2 }, { atrasou: 1 }))?.text).toBe(
      '1 nota baixa não apontou etiqueta — escolhê-la é opcional para quem avalia.',
    );
  });

  it('some quando todas as notas baixas apontaram etiqueta', () => {
    expect(readSemEtiqueta(summaryOf({ '2': 2 }, { atrasou: 2 }))).toBeNull();
  });

  it('some quando não houve nota baixa', () => {
    expect(readSemEtiqueta(summaryOf({ '5': 9 }))).toBeNull();
  });
});
