/**
 * ============================================================================
 * OS GRUPOS DE PRODUTO — o ranking diz o que VENDE, o grupo diz o que FAZER
 * ============================================================================
 *
 * Um ranking por unidades responde "quem vendeu mais". É uma pergunta legítima
 * e ela continua respondida na tabela — mas ela não diz o que o dono faz na
 * segunda-feira. "Pizza Calabresa em primeiro" não é uma instrução; "estes
 * quatro itens pagam metade do período, não deixe faltar" é.
 *
 * O CORTE É A FATIA DA RECEITA DE ITENS, e é o padrão que o mercado usa:
 * campeões, promissores e repensáveis. Os dois percentuais que separam os três
 * moram em `QUADRANTE_LIMIARES`, com nome — como todo limiar desta tela.
 *
 * ----------------------------------------------------------------------------
 * NÃO EXISTE O QUARTO GRUPO, "SAZONAIS", E ISSO NÃO É UM RECORTE DE ESCOPO
 * ----------------------------------------------------------------------------
 *
 * É uma impossibilidade do dado, e ela precisa estar escrita aqui para que
 * ninguém a "resolva" depois com uma heurística.
 *
 * Sazonalidade é um produto que SOBE E DESCE COM A ÉPOCA e volta a subir na
 * próxima — o que exige o mesmo item medido em vários períodos comparáveis.
 * `/admin/reports/products` devolve UM período por vez, agregado, sem nenhum
 * recorte de tempo dentro dele: não há dia, não há semana, não há série.
 *
 * E o atalho tentador — pedir o mesmo relatório no período anterior e chamar de
 * sazonal quem variou muito — não funciona: uma única variação entre duas
 * janelas não separa sazonalidade de crescimento, de uma promoção que rodou,
 * de um item que ficou em falta na cozinha, nem de um produto que estreou. As
 * quatro produzem exatamente o mesmo par de números.
 *
 * Chutar aqui seria pior do que não ter o grupo: o lojista tiraria um item do
 * cardápio porque a tela o chamou de "de época".
 */
import type { ProductSales } from '../api/types';
import { toNumber, toNumberOrZero } from './report-model';

/**
 * Quantos produtos a análise pede ao backend.
 *
 * ELE É O DENOMINADOR, e é por isso que é maior que o ranking. `listed_revenue_total`
 * é a soma da PRÓPRIA LISTA devolvida — pedir 10 produtos e dizer que um deles
 * é "12% da receita de itens" seria dizer 12% de um total que exclui tudo o que
 * ficou em 11º. Quanto mais longa a lista, mais perto o denominador chega da
 * receita de item do período, e mais honesto fica o corte.
 *
 * 40 e não 200: é uma requisição só, cabe em qualquer cardápio de restaurante
 * pequeno inteiro, e a tela DIZ quantos itens entraram na conta.
 */
export const PRODUTOS_ANALISADOS = 40;

/** Quantos nomes um grupo escreve antes de virar "e mais N". */
export const QUADRANTE_NOMES_MAX = 4;

/**
 * Os dois cortes, com nome — nenhum número mágico dentro de um `if`.
 *
 * São decisão de produto, não constante técnica: mudar "campeão" de 5% para 8%
 * é editar esta linha, e a tela se reescreve sozinha porque o critério é
 * derivado daqui (ver `criterio`).
 */
export const QUADRANTE_LIMIARES = {
  /** A partir daqui, sozinho, o item é campeão. */
  campeaoPct: 5,
  /** A partir daqui (e abaixo de campeão), o item é promissor. */
  promissorPct: 2,
} as const;

export type QuadranteId = 'campeoes' | 'promissores' | 'repensaveis';

export type ProdutoDoQuadrante = {
  /** Chave estável de lista: o nome pode repetir, o índice desempata. */
  id: string;
  nome: string;
  /** Fatia da receita dos itens listados, em pontos percentuais. */
  fatiaPct: number;
  unidades: number;
};

export type Quadrante = {
  id: QuadranteId;
  nome: string;
  /** O que fazer com este grupo. É a razão de o grupo existir. */
  acao: string;
  produtos: ProdutoDoQuadrante[];
  /** Quanto os itens do grupo somam, junto, da receita listada. */
  fatiaPct: number;
};

function pctLegivel(value: number): string {
  return `${(Math.round(value * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/**
 * O CORTE DOS TRÊS, DITO UMA VEZ — e não uma vez por grupo.
 *
 * Ele já morou dentro de cada `Quadrante`, como um `criterio` por bloco. O nome
 * do grupo sem o corte é uma opinião ("campeão" segundo quem?), então dizer o
 * corte é obrigatório — mas dizê-lo três vezes, em três frases quase iguais e
 * empilhadas, gastava três linhas para explicar UMA régua (§8). Como legenda,
 * ele é uma linha e lê melhor: as três faixas aparecem juntas, e é assim que se
 * entende que elas são uma escala e não três rótulos soltos.
 *
 * É DERIVADO DOS LIMIARES, e não uma string escrita à mão: mudar `campeaoPct`
 * para 8 reescreve a legenda junto. Uma frase fixa continuaria dizendo "5%"
 * enquanto o código classificaria por outro número — a pior espécie de defeito
 * nesta tela, porque ele parece certo.
 */
export function legendaDosQuadrantes(): string {
  const campeao = pctLegivel(QUADRANTE_LIMIARES.campeaoPct);
  const promissor = pctLegivel(QUADRANTE_LIMIARES.promissorPct);
  return `O corte é a fatia da receita destes itens, por item: campeão a partir de ${campeao}, promissor de ${promissor} a ${campeao}, repensável abaixo de ${promissor}.`;
}

/**
 * Os três grupos, a partir do relatório de produtos.
 *
 * DEVOLVE `null` quando não há denominador — lista vazia ou
 * `listed_revenue_total` zerado/ilegível. Sem total não existe fatia, e um
 * grupo com todos os itens em "repensáveis" porque a divisão deu zero seria a
 * tela acusando o cardápio inteiro por um campo ausente.
 *
 * GRUPO VAZIO NÃO É DESENHADO — ele sai da lista aqui, e não com um `if` na
 * página: um "Campeões · 0 itens" custa uma linha para anunciar o nada, que é a
 * mesma regra do agrupamento vazio da lista de pedidos.
 */
export function quadrantesDeProduto(products: ProductSales | null): Quadrante[] | null {
  if (!products || products.products.length === 0) return null;

  const total = toNumber(products.listed_revenue_total);
  if (total === null || total <= 0) return null;

  const classificados = products.products.map((item, index) => ({
    id: `${item.product_id ?? 'sem-id'}-${index}`,
    nome: item.product_name,
    fatiaPct: (toNumberOrZero(item.revenue_total) / total) * 100,
    unidades: item.quantity_total,
  }));

  const campeoes = classificados.filter((item) => item.fatiaPct >= QUADRANTE_LIMIARES.campeaoPct);
  const promissores = classificados.filter(
    (item) =>
      item.fatiaPct >= QUADRANTE_LIMIARES.promissorPct &&
      item.fatiaPct < QUADRANTE_LIMIARES.campeaoPct,
  );
  const repensaveis = classificados.filter(
    (item) => item.fatiaPct < QUADRANTE_LIMIARES.promissorPct,
  );

  const grupos: readonly Quadrante[] = [
    {
      id: 'campeoes',
      nome: 'Campeões',
      acao: 'São eles que pagam o período — o que não pode faltar na cozinha nem sair do cardápio.',
      produtos: campeoes,
      fatiaPct: campeoes.reduce((soma, item) => soma + item.fatiaPct, 0),
    },
    {
      id: 'promissores',
      nome: 'Promissores',
      acao: 'Os candidatos a campeão: é aqui que destaque no cardápio, foto ou combo tem para onde crescer.',
      produtos: promissores,
      fatiaPct: promissores.reduce((soma, item) => soma + item.fatiaPct, 0),
    },
    {
      id: 'repensaveis',
      nome: 'Repensáveis',
      acao: 'Ocupam linha no cardápio e insumo na cozinha sem devolver receita — repensar preço, ficha ou presença.',
      produtos: repensaveis,
      fatiaPct: repensaveis.reduce((soma, item) => soma + item.fatiaPct, 0),
    },
  ];

  return grupos.filter((grupo) => grupo.produtos.length > 0);
}
