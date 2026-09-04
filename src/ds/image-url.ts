/**
 * A FOTO NO TAMANHO EM QUE A TELA A MOSTRA — e não no tamanho em que ela subiu.
 *
 * POR QUE ISTO EXISTE
 *
 * Toda `image_url` que a API devolve aponta para o OBJETO CRU do bucket: o
 * backend monta `.../storage/v1/object/public/<bucket>/<caminho>`
 * (`build_storage_url`, em `src/utils/storage.py`) e o Storage entrega o
 * arquivo exatamente como ele foi gravado. Para o painel, isso significava
 * baixar 1024×1024 para desenhar 44×44.
 *
 * Medido no cardápio do piloto em 04/09/2026, na maior categoria (Entradas, 26
 * fotos): **2.440 KB de miniaturas por carregamento da lista**, contra 70 KB
 * nas mesmas 26 fotos em 88×88. O catálogo inteiro são 12,0 MB contra 349 KB.
 * A cota de banda do Supabase estourou (14,19 GB contra 5 GB do plano) e este
 * era o pior sítio dos quinze medidos pelo backend.
 *
 * O Storage já sabe redimensionar: a mesma pilha responde em
 * `/storage/v1/render/image/public/...` com `width`, `height` e `resize`. Então
 * a correção é uma REESCRITA de URL, feita na borda, no momento de desenhar.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, E É DE PROPÓSITO
 *
 * **Ele não MONTA URL de bucket.** Não conhece o host do Supabase, não conhece
 * o nome do bucket, não sabe o caminho de nenhum objeto. Ele recebe a URL que o
 * backend mandou e troca um pedaço do caminho dela. É a diferença entre
 * reescrever e reimplementar: no dia em que o backend servir de outro lugar,
 * tudo o que não tiver a forma de `build_storage_url` passa INTEIRO e a foto
 * continua aparecendo (ver `src/api/types.ts`, onde a regra está anotada).
 *
 * A CONTA DE VARIANTES É UM CUSTO, NÃO UM DETALHE
 *
 * Cada par (largura, altura) distinto é um objeto NOVO no cache do Supabase, e
 * a transformação pode ser cobrada à parte do plano. Por isso as caixas abaixo
 * são as quatro que a tela de fato exibe — copiadas do CSS, com o arquivo
 * nomeado ao lado —, e não larguras redondas escolhidas de cabeça.
 */

/** O que `build_storage_url` monta. É a única forma que este módulo reescreve. */
const OBJETO_PUBLICO = '/storage/v1/object/public/';

/** A mesma pilha, com o redimensionador na frente. */
const RENDER_PUBLICO = '/storage/v1/render/image/public/';

/**
 * A caixa em que a imagem é desenhada, em PIXELS DE CSS — o número que está na
 * folha de estilo, não o que vai na URL.
 */
export type Caixa = { largura: number; altura: number };

/**
 * QUANTOS PIXELS DE IMAGEM POR PIXEL DE CSS.
 *
 * Dois, fixo, e sem `srcset`: o painel é operado em notebook e tablet, que são
 * retina quase sem exceção, e uma segunda densidade DOBRARIA a conta de
 * variantes para poupar ~1,5 KB por foto na minoria de telas 1×. Numa
 * miniatura de 3 KB isso não paga o objeto extra no cache.
 */
export const DENSIDADE = 2;

/**
 * AS QUATRO CAIXAS DO PAINEL — os quatro sítios que mostram imagem de bucket.
 *
 * Cada uma é o retângulo do CSS, com o arquivo onde ele está escrito. Se o CSS
 * mudar de tamanho e isto não mudar junto, a foto passa a chegar em outra
 * proporção do que a tela recorta — e é o `image-url.test.ts` que cobra os dois
 * números serem os mesmos.
 */
export const CAIXAS = {
  /**
   * `item__thumb` — 44×44 em `menu/MenuPage.css`.
   *
   * A LISTA DO CARDÁPIO, e é o sítio mais caro do painel: até 50 fotos por
   * carregamento (o `PAGE_SIZE` de `useMenu`), tantas vezes por dia quantas o
   * lojista abrir o cardápio.
   */
  itemDoCardapio: { largura: 44, altura: 44 },

  /**
   * `foto__atual` — 56×56 em `menu/ProductImageField.css`.
   *
   * A foto que já está no item, dentro do "Editar item". Uma por diálogo.
   */
  fotoDoProduto: { largura: 56, altura: 56 },

  /**
   * `cupons__miniatura` — 56×36 em `coupons/CouponsPage.css`.
   *
   * Retangular porque a arte É retangular: ela é um banner da vitrine, e o
   * quadrado cortaria justamente o valor impresso.
   */
  miniaturaDaArte: { largura: 56, altura: 36 },

  /**
   * `arte__imagem` — largura da coluna da grade, 16/9, em `coupons/CouponsPage.css`.
   *
   * A grade é `auto-fill` com mínimo de 148px: no diálogo de 680px dá quatro
   * colunas de ~133px, e na folha do celular duas de ~157px. 160 cobre as duas.
   * Numa janela de exatamente 720px a folha estica a coluna para ~322px e a
   * arte cai para 1× — é a única largura em que ela não é retina, e um banner
   * de texto grande aguenta.
   */
  arteNoEscolhedor: { largura: 160, altura: 90 },
} as const satisfies Record<string, Caixa>;

/** Os pixels que a URL pede: a caixa vezes a densidade. */
export function larguraDeSaida(caixa: Caixa): Caixa {
  return {
    largura: Math.round(caixa.largura * DENSIDADE),
    altura: Math.round(caixa.altura * DENSIDADE),
  };
}

/**
 * A URL da imagem recortada para esta caixa.
 *
 * `resize=cover` porque os quatro sítios declaram `object-fit: cover` no CSS —
 * o recorte que o Storage faz é o mesmo que o navegador faria, só que sobre
 * bytes que não trafegaram.
 *
 * **AS DUAS DIMENSÕES VÃO SEMPRE**, e isso não é redundância. Medido contra o
 * bucket de produção: `?width=112` sozinho devolve 112×1024 — o Supabase
 * reescala a largura e deixa a altura como estava. O `object-fit` do CSS
 * esconderia a deformação na tela, e o defeito viveria como três vezes mais
 * banda (12.344 bytes contra 4.090), calado.
 */
export function imagemNaCaixa(url: string, caixa: Caixa): string {
  const corte = url.indexOf(OBJETO_PUBLICO);
  if (corte < 0) return url;

  const saida = larguraDeSaida(caixa);
  const caminho = url.slice(corte + OBJETO_PUBLICO.length);
  // `build_storage_url` nunca devolve query, mas quem chegasse aqui com uma
  // perderia os parâmetros dela num `?` colado — e um `&` não custa nada.
  const junta = url.includes('?') ? '&' : '?';

  return `${url.slice(0, corte)}${RENDER_PUBLICO}${caminho}${junta}width=${saida.largura}&height=${saida.altura}&resize=cover`;
}
