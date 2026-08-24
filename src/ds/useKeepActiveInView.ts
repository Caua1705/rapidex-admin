import { useEffect, useRef } from 'react';

/**
 * ============================================================================
 * A FITA ROLA ATÉ O ITEM ABERTO
 * ============================================================================
 *
 * O DIAGNÓSTICO, medido em 390px. As listas que no desktop são uma COLUNA
 * viram uma FITA horizontal no telefone — as categorias do Cardápio e as oito
 * seções de Loja. A fita transborda (271px em Loja, 418px no
 * Cardápio com três categorias) e nasce em `scrollLeft: 0`. Resultado: quem
 * abre /loja/impressao vê uma fita com cinco OUTRAS seções e nenhuma
 * marcada — a seção aberta está fora da tela, à direita. O painel deixa de
 * responder "onde eu estou".
 *
 * POR QUE NÃO `scrollIntoView()`. Ele é a chamada óbvia e está errada aqui:
 * ele rola TODOS os ancestrais roláveis até enquadrar o elemento, inclusive o
 * documento. No telefone quem rola é a página, então enquadrar a fita levaria
 * a página junto — abrir uma seção passaria a dar um salto vertical no
 * conteúdo. Aqui a conta é feita à mão e escrita na própria fita: quem rola é
 * a fita, e só ela.
 *
 * NA COLUNA ISTO NÃO FAZ NADA. `scrollWidth <= clientWidth` no desktop, onde a
 * lista é vertical e cabe inteira — a função sai antes de escrever qualquer
 * coisa. Não há consulta de mídia aqui de propósito: o gatilho é a fita
 * TRANSBORDAR, que é o mesmo fato que a media query tentaria adivinhar.
 */
export function useKeepActiveInView<T extends HTMLElement>(
  /**
   * O que identifica o item aberto. Muda de valor → a fita reenquadra. É o id
   * da categoria ou da seção; qualquer coisa estável serve.
   */
  activeKey: string | null,
) {
  /** Vai na fita — o elemento que rola. */
  const fitaRef = useRef<T | null>(null);
  /** Vai no item aberto. */
  const ativoRef = useRef<HTMLElement | null>(null);
  /**
   * Já enquadramos alguma vez nesta montagem? É o que separa "a tela abriu" de
   * "o lojista trocou de seção" — ver o `behavior` lá embaixo.
   */
  const jaEnquadrou = useRef(false);

  useEffect(() => {
    const fita = fitaRef.current;
    const ativo = ativoRef.current;
    if (!fita || !ativo) return;

    /*
     * SEM ANIMAÇÃO NA PRIMEIRA VEZ. Ao abrir a tela, deslizar a fita é uma
     * animação que ninguém pediu e que chega no meio da leitura; trocando de
     * seção, o deslize é justamente o que mostra que a fita se moveu. E
     * `smooth` cede para quem pediu menos movimento no sistema.
     */
    const primeira = !jaEnquadrou.current;
    jaEnquadrou.current = true;

    // A fita cabe inteira: não há o que enquadrar. É o caso do desktop.
    if (fita.scrollWidth - fita.clientWidth <= 0) return;

    const caixaFita = fita.getBoundingClientRect();
    const caixaAtivo = ativo.getBoundingClientRect();

    /*
     * UMA MARGEM DE UM DEDO em cada lado. Sem ela o item aberto encosta na
     * beirada e some a única pista de que a fita continua — e o gesto de
     * arrastar a fita precisa de onde pegar.
     */
    const margem = 24;
    const sobraEsquerda = caixaAtivo.left - caixaFita.left - margem;
    const sobraDireita = caixaAtivo.right - caixaFita.right + margem;

    /*
     * JÁ ESTÁ ENQUADRADO: as duas sobras têm o sinal que diz "dentro". Sair
     * aqui é o que impede a fita de se mexer a cada rerrenderização.
     */
    if (sobraEsquerda >= 0 && sobraDireita <= 0) return;

    // Fora pela esquerda puxa para a esquerda; fora pela direita, para a
    // direita. Nunca as duas: um item mais largo que a fita cai no primeiro.
    const passo = sobraEsquerda < 0 ? sobraEsquerda : sobraDireita;
    const querMenosMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    fita.scrollBy({
      left: passo,
      behavior: primeira || querMenosMovimento ? 'auto' : 'smooth',
    });
  }, [activeKey]);

  return { fitaRef, ativoRef };
}
