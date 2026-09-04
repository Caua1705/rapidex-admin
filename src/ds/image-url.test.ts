import { describe, expect, it } from 'vitest';

import { CAIXAS, DENSIDADE, imagemNaCaixa, larguraDeSaida } from './image-url';

const BUCKET =
  'https://exemplo.supabase.co/storage/v1/object/public/restaurant-assets/junior-da-picanha/products/picanha-suina.webp';

describe('imagemNaCaixa · a URL que o painel pede', () => {
  it('troca o objeto cru pelo render, e mantém bucket e caminho intactos', () => {
    const url = new URL(imagemNaCaixa(BUCKET, CAIXAS.itemDoCardapio));

    expect(url.origin).toBe('https://exemplo.supabase.co');
    expect(url.pathname).toBe(
      '/storage/v1/render/image/public/restaurant-assets/junior-da-picanha/products/picanha-suina.webp',
    );
  });

  /*
   * A ALTURA É OBRIGATÓRIA, e este é o teste mais importante do arquivo.
   *
   * Medido contra o bucket de produção em 04/09/2026: `?width=112` SOZINHO
   * devolve 112×1024 — o Supabase reescala a largura e deixa a altura no
   * original. São 12.344 bytes de uma imagem espremida, contra 4.090 do
   * 112×112 correto. O `object-fit: cover` do CSS esconderia a deformação na
   * tela e o defeito viveria como três vezes mais banda, calado.
   */
  it('manda largura E altura — largura sozinha não recorta, ela espreme', () => {
    const url = new URL(imagemNaCaixa(BUCKET, CAIXAS.itemDoCardapio));

    expect(url.searchParams.get('width')).toBe('88');
    expect(url.searchParams.get('height')).toBe('88');
    expect(url.searchParams.get('resize')).toBe('cover');
  });

  it('pede o dobro da caixa, porque a tela do lojista é retina', () => {
    expect(DENSIDADE).toBe(2);
    expect(larguraDeSaida(CAIXAS.fotoDoProduto)).toEqual({ largura: 112, altura: 112 });
    expect(larguraDeSaida(CAIXAS.miniaturaDaArte)).toEqual({ largura: 112, altura: 72 });
    expect(larguraDeSaida(CAIXAS.arteNoEscolhedor)).toEqual({ largura: 320, altura: 180 });
  });

  /*
   * CADA TAMANHO NOVO É UM OBJETO NOVO NO CACHE DO SUPABASE — e a transformação
   * pode ser cobrada à parte. Este teste é o que impede uma quinta caixa de
   * entrar sem alguém decidir que ela vale.
   */
  it('são quatro caixas, e não mais — cada variante é um objeto novo no bucket', () => {
    const variantes = new Set(
      Object.values(CAIXAS).map((caixa) => {
        const saida = larguraDeSaida(caixa);
        return `${saida.largura}x${saida.altura}`;
      }),
    );

    expect([...variantes].sort()).toEqual(['112x112', '112x72', '320x180', '88x88']);
  });

  it('a caixa vale a MESMA proporção do CSS, senão o recorte discorda da tela', () => {
    // `cupons__miniatura` é 56×36 em CouponsPage.css: retangular de propósito.
    expect(CAIXAS.miniaturaDaArte).toEqual({ largura: 56, altura: 36 });
    // `item__thumb` e `foto__atual` são quadrados.
    expect(CAIXAS.itemDoCardapio).toEqual({ largura: 44, altura: 44 });
    expect(CAIXAS.fotoDoProduto).toEqual({ largura: 56, altura: 56 });
  });
});

describe('imagemNaCaixa · o que ela NÃO toca', () => {
  /*
   * O painel não sabe montar URL de bucket, e continua não sabendo: ele
   * REESCREVE a que o backend mandou. Tudo que não tenha a forma de
   * `build_storage_url` passa inteiro — se um dia o backend servir de outro
   * lugar, a foto continua aparecendo em vez de virar imagem quebrada.
   */
  it('deixa passar o que não veio do Storage do Supabase', () => {
    const alheias = [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      '/media/produtos/prod-1-1.webp',
      'https://cdn.outro.com/foto.webp',
      'https://exemplo.supabase.co/storage/v1/object/sign/restaurant-assets/foto.webp',
      '',
    ];

    for (const url of alheias) {
      expect(imagemNaCaixa(url, CAIXAS.itemDoCardapio)).toBe(url);
    }
  });

  it('não reescreve duas vezes uma URL que já é de render', () => {
    const jaTransformada = imagemNaCaixa(BUCKET, CAIXAS.itemDoCardapio);

    expect(imagemNaCaixa(jaTransformada, CAIXAS.arteNoEscolhedor)).toBe(jaTransformada);
  });
});
