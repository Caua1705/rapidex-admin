/**
 * ============================================================================
 * AS FRASES DE AVALIAÇÕES — a tela responde "o que deu errado"
 * ============================================================================
 *
 * Mesmas três regras das frases de Desempenho, e pelos mesmos motivos:
 *
 * 1. **Determinístico, sem IA.** Tudo sai de comparações entre os campos do
 *    agregado que a rota já devolve. Nada é inferido nem suavizado.
 * 2. **Condição que não bate não vira frase.** Cada função devolve `null`
 *    quando não tem o que afirmar — exceto o veredito, que é a razão de a tela
 *    existir e sempre tem uma resposta quando houve avaliação.
 * 3. **Todo limiar tem nome.** Nenhum número mágico dentro de um `if`.
 *
 * E uma quarta, que é desta tela: **nenhuma frase daqui olha para `items`.**
 * A lista é uma página e pode estar recortada por nota; o agregado fala do
 * período inteiro. Uma frase montada a partir da lista mudaria de texto quando
 * o lojista mexesse no filtro — que é exatamente a contradição que o backend
 * evitou ao manter `max_rating` fora do agregado.
 */
import type { ReviewSummary } from '../api/types';
import { contar, LOW_RATING_MAX, lowRatingCount, tagRows, untaggedLowCount } from './review-model';

export type Insight = { id: string; text: string };

export const LIMIARES = {
  /**
   * A partir de quantas repetições uma etiqueta vira a manchete da tela.
   *
   * Duas, e não uma: uma reclamação é um caso: pode ter sido o trânsito
   * daquela noite. Duas é repetição, e repetição é o que se conserta na
   * operação. Com o limiar em 1, a manchete mudaria de assunto a cada
   * avaliação nova e deixaria de ser lida.
   */
  etiquetaDominanteMinima: 2,

  /**
   * Abaixo disto, o período tem poucas avaliações para a média significar
   * alguma coisa — e a tela diz isso em vez de deixar o dono tirar conclusão
   * de três respostas. Cinco é onde uma nota isolada deixa de mover a média em
   * mais de meia estrela.
   */
  volumeBaixoTotal: 5,
} as const;

/**
 * Não houve avaliação nenhuma no período.
 *
 * É a pergunta que decide se a tela desenha as seções ou o estado vazio, e ela
 * sai de `total` — não de `items.length`. Com o filtro em "até 3 estrelas",
 * uma semana de vinte cincos devolve lista VAZIA e `total: 20`: são dois
 * estados diferentes, e chamar os dois de "nenhuma avaliação" apagaria da tela
 * a semana em que tudo deu certo.
 */
export function semAvaliacao(summary: ReviewSummary): boolean {
  return summary.total <= 0;
}

/**
 * O VEREDITO — a primeira coisa da tela, e a única que fala em frase inteira.
 *
 * Três respostas possíveis, nesta ordem de prioridade:
 *
 * 1. **Nenhuma nota baixa.** É notícia boa e precisa ler como notícia boa: uma
 *    tela chamada "Avaliações" que abre sem nada escrito na semana em que
 *    ninguém reclamou lê como defeito, não como elogio.
 * 2. **Uma etiqueta se repetiu.** É a frase que o backend desenhou a etiqueta
 *    fechada para poder escrever — "7 das 12 notas baixas desta semana foram
 *    atraso" —, e é a informação mais acionável do painel inteiro.
 * 3. **Houve notas baixas, espalhadas.** Sem etiqueta dominante não há o que
 *    apontar, então a frase diz o tamanho do problema e deixa a lista de
 *    etiquetas logo abaixo mostrar a divisão.
 *
 * A ETIQUETA VAI ENTRE ASPAS, com o rótulo exato da lista. "Foram sobre
 * atraso" exigiria um segundo dicionário (o substantivo de cada etiqueta) que
 * ninguém manteria — e uma etiqueta nova do backend cairia nele sem forma.
 */
export function readVeredito(summary: ReviewSummary): Insight {
  const baixas = lowRatingCount(summary);

  if (baixas === 0) {
    return {
      id: 'sem-baixas',
      text: `Nenhuma nota baixa neste período — ${contar(summary.total, 'avaliação foi', 'avaliações foram')} de 4 ou 5 estrelas.`,
    };
  }

  const topo = tagRows(summary)[0];
  if (topo && topo.count >= LIMIARES.etiquetaDominanteMinima) {
    return {
      id: 'etiqueta-dominante',
      text: `${topo.count} das ${contar(baixas, 'nota baixa', 'notas baixas')} apontaram “${topo.label}”.`,
    };
  }

  return {
    id: 'baixas-espalhadas',
    text: `${contar(baixas, 'avaliação', 'avaliações')} de ${summary.total} ${baixas === 1 ? 'foi' : 'foram'} nota baixa — ${LOW_RATING_MAX} estrelas ou menos.`,
  };
}

/**
 * Poucas avaliações no período.
 *
 * A ressalva existe porque a média é o número de corpo maior da tela, e com
 * três respostas ela balança meia estrela por avaliação. Sem a frase, o dono
 * compara a média de uma semana de 3 com a de uma semana de 40 e conclui que a
 * loja piorou.
 */
export function readVolumeBaixo(summary: ReviewSummary): Insight | null {
  if (summary.total <= 0 || summary.total >= LIMIARES.volumeBaixoTotal) return null;
  return {
    id: 'volume-baixo',
    text: 'São poucas avaliações no período: uma nota a mais ou a menos ainda mexe muito na média.',
  };
}

/**
 * As notas baixas que não apontaram etiqueta.
 *
 * ELA FECHA UMA SOMA QUE NÃO FECHA. A tela escreve "5 notas baixas" logo acima
 * de uma lista de etiquetas que soma 3, e duas contagens que discordam na
 * mesma dobra lêem como defeito de tela — quando a explicação é simples: a
 * etiqueta é opcional para quem avalia.
 */
export function readSemEtiqueta(summary: ReviewSummary): Insight | null {
  const semEtiqueta = untaggedLowCount(summary);
  if (semEtiqueta <= 0) return null;

  return {
    id: 'sem-etiqueta',
    text: `${contar(semEtiqueta, 'nota baixa não apontou', 'notas baixas não apontaram')} etiqueta — escolhê-la é opcional para quem avalia.`,
  };
}
