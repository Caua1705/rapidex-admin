/**
 * Os grupos de produto.
 *
 * O QUE ESTES TESTES PROTEGEM: o grupo é uma INSTRUÇÃO ("repense este item"),
 * não uma classificação decorativa. Um corte errado aqui tira um prato do
 * cardápio de um restaurante de verdade, e o lojista não tem como saber que
 * quem errou foi a tela.
 *
 * Dois casos valem por todos os outros: o denominador (a fatia é sobre a lista
 * devolvida, não sobre o faturamento do resumo) e a AUSÊNCIA do quarto grupo.
 */
import { describe, expect, it } from 'vitest';

import {
  legendaDosQuadrantes,
  QUADRANTE_LIMIARES,
  quadrantesDeProduto,
  type Quadrante,
  type QuadranteId,
} from './product-quadrants';
import type { ProductSales } from '../api/types';

const PERIODO = { start_date: '2026-08-10', end_date: '2026-08-16', days: 7 };

function productsOf(
  itens: readonly { nome: string; receita: string; unidades?: number }[],
  overrides: Partial<ProductSales> = {},
): ProductSales {
  return {
    restaurant_id: 'r1',
    period: PERIODO,
    products: itens.map((item, index) => ({
      product_id: `p${index}`,
      product_name: item.nome,
      orders_count: 10,
      quantity_total: item.unidades ?? 10,
      revenue_total: item.receita,
    })),
    listed_revenue_total: String(itens.reduce((soma, item) => soma + Number(item.receita), 0)),
    revenue_note: 'não fecha com o faturamento do resumo',
    ...overrides,
  };
}

function grupo(grupos: Quadrante[] | null, id: QuadranteId): Quadrante | undefined {
  return grupos?.find((item) => item.id === id);
}

describe('quadrantesDeProduto', () => {
  it('separa campeão, promissor e repensável pelos limiares nomeados', () => {
    /* 1000 no total: 600 = 60% (campeão), 30 = 3% (promissor), 10 = 1%. */
    const grupos = quadrantesDeProduto(
      productsOf([
        { nome: 'Costela', receita: '600' },
        { nome: 'Pizza', receita: '360' },
        { nome: 'Suco', receita: '30' },
        { nome: 'Bala', receita: '10' },
      ]),
    );

    expect(grupo(grupos, 'campeoes')?.produtos.map((p) => p.nome)).toEqual(['Costela', 'Pizza']);
    expect(grupo(grupos, 'promissores')?.produtos.map((p) => p.nome)).toEqual(['Suco']);
    expect(grupo(grupos, 'repensaveis')?.produtos.map((p) => p.nome)).toEqual(['Bala']);
  });

  /*
   * O LIMIAR É INCLUSIVO NA BORDA DE BAIXO, e o teste fixa isso: 5,0% é
   * campeão, 4,9% é promissor. Sem esta asserção, uma troca de `>=` por `>`
   * passaria despercebida e moveria um item de grupo — que é uma instrução
   * diferente para o lojista.
   */
  it('a borda exata do limiar cai no grupo de cima', () => {
    const grupos = quadrantesDeProduto(
      productsOf([
        { nome: 'Exato', receita: '5' },
        { nome: 'Quase', receita: '4.9' },
        { nome: 'Resto', receita: '90.1' },
      ]),
    );

    expect(grupo(grupos, 'campeoes')?.produtos.map((p) => p.nome)).toContain('Exato');
    expect(grupo(grupos, 'promissores')?.produtos.map((p) => p.nome)).toContain('Quase');
  });

  it('a fatia sai da lista devolvida, não de um total inventado', () => {
    const grupos = quadrantesDeProduto(
      productsOf([
        { nome: 'Único', receita: '80' },
        { nome: 'Outro', receita: '20' },
      ]),
    );

    expect(grupo(grupos, 'campeoes')?.fatiaPct).toBeCloseTo(100, 5);
  });

  /*
   * O GRUPO VAZIO NÃO É DESENHADO. É a mesma regra do agrupamento vazio da
   * lista de pedidos: um "Repensáveis · 0 itens" gasta uma linha para anunciar
   * o nada.
   */
  it('grupo sem nenhum item sai da lista', () => {
    const grupos = quadrantesDeProduto(
      productsOf([
        { nome: 'A', receita: '50' },
        { nome: 'B', receita: '50' },
      ]),
    );

    expect(grupos?.map((item) => item.id)).toEqual(['campeoes']);
  });

  /*
   * SEM DENOMINADOR NÃO HÁ FATIA, e este é o caso em que um `?? 0` mandaria o
   * cardápio inteiro para "repensáveis": dividir por zero dá `Infinity` ou
   * `NaN`, e `NaN < 2` é falso — a comparação silenciosamente engoliria tudo.
   */
  it('sem total legível não classifica nada', () => {
    expect(
      quadrantesDeProduto(productsOf([{ nome: 'A', receita: '10' }], { listed_revenue_total: '0' })),
    ).toBeNull();

    expect(
      quadrantesDeProduto(productsOf([{ nome: 'A', receita: '10' }], { listed_revenue_total: '' })),
    ).toBeNull();

    expect(quadrantesDeProduto(productsOf([]))).toBeNull();
    expect(quadrantesDeProduto(null)).toBeNull();
  });

  /*
   * ============================================================================
   * O QUARTO GRUPO NÃO EXISTE — e este teste é a fechadura
   * ============================================================================
   *
   * "Sazonais" é o quarto nome do padrão de mercado, e ele não é detectável com
   * o que o contrato devolve: `/reports/products` traz um período agregado por
   * vez, sem recorte de tempo dentro dele. Uma variação entre duas janelas não
   * separa sazonalidade de crescimento, de promoção, de item em falta nem de
   * produto que estreou.
   *
   * A asserção existe para que a próxima pessoa que for "completar os quatro
   * quadrantes" quebre um teste em vez de publicar um chute — e leia aqui o
   * porquê.
   */
  it('não inventa o grupo de sazonais', () => {
    const grupos = quadrantesDeProduto(
      productsOf([
        { nome: 'Costela', receita: '600' },
        { nome: 'Suco', receita: '30' },
        { nome: 'Bala', receita: '370' },
      ]),
    );

    expect(grupos?.map((item) => item.id)).not.toContain('sazonais');
    expect(grupos?.length).toBeLessThanOrEqual(3);
  });
});

/*
 * A LEGENDA É DERIVADA DOS LIMIARES, e não uma frase escrita à mão que
 * continuaria dizendo "5%" depois de alguém mudar o corte para 8%.
 *
 * É o defeito mais perigoso deste arquivo, porque ele PARECE certo: a tela
 * classificaria por um número e explicaria o corte com outro, e quem lesse a
 * legenda concluiria que a classificação está errada.
 */
describe('legendaDosQuadrantes', () => {
  it('escreve os dois cortes que a classificação usa', () => {
    const legenda = legendaDosQuadrantes();
    expect(legenda).toContain(String(QUADRANTE_LIMIARES.campeaoPct).replace('.', ','));
    expect(legenda).toContain(String(QUADRANTE_LIMIARES.promissorPct).replace('.', ','));
  });

  it('nomeia os três grupos, e só os três', () => {
    const legenda = legendaDosQuadrantes().toLowerCase();
    expect(legenda).toContain('campeão');
    expect(legenda).toContain('promissor');
    expect(legenda).toContain('repensável');
    expect(legenda).not.toContain('sazona');
  });
});
