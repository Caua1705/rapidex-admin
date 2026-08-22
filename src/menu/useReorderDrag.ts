import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

/**
 * ============================================================================
 * ARRASTAR PARA REORDENAR — o gesto, sem biblioteca e com o teclado inteiro
 * ============================================================================
 *
 * A ORDEM DO CARDÁPIO É DECISÃO COMERCIAL: o que aparece primeiro vende mais.
 * Até aqui ela se mexia por setas de "sobe um / desce um", e mover um item do
 * fim para o topo eram vinte cliques — o lojista simplesmente não fazia.
 *
 * ----------------------------------------------------------------------------
 * AS SETAS NÃO SAÍRAM, E NÃO É COMPATIBILIDADE: É REQUISITO
 * ----------------------------------------------------------------------------
 *
 * A WCAG 2.2 trata disto pelo nome — **2.5.7 Dragging Movements (AA)**: toda
 * funcionalidade operada por arrastar precisa de uma alternativa por ponteiro
 * único. E o comentário que já estava em `CategoryRail` dizia o mesmo por outro
 * caminho, a partir do balcão: "o painel é usado no balcão, às vezes com touch
 * e a mão ocupada, e arrastar exige precisão que ali não existe".
 *
 * As duas coisas apontam para o mesmo desenho: **arrastar é o atalho, as setas
 * são o caminho**. Quem tem mouse e as duas mãos arrasta; quem está com uma mão
 * na comanda aperta a seta; quem usa teclado ou leitor de tela usa a seta, que
 * é um `<button>` de verdade com nome acessível. Os dois caminhos chamam a
 * MESMA função de reordenar — é isso que garante que não produzam ordens
 * diferentes.
 *
 * ----------------------------------------------------------------------------
 * POR QUE PONTEIRO, E NÃO O ARRASTAR NATIVO DO HTML
 * ----------------------------------------------------------------------------
 *
 * `draggable` + `dragstart` não existe no toque. É a API de arrastar arquivo
 * entre janelas, e no celular — que é onde esta tela mais é usada — ela
 * simplesmente não dispara. Pointer Events cobre mouse, caneta e dedo com o
 * mesmo código, e `setPointerCapture` mantém o gesto vivo mesmo quando o dedo
 * sai de cima da linha.
 *
 * `touch-action: none` NO PUNHO é obrigatório e não é detalhe: sem ele o
 * navegador entende o arrastar como rolagem, cancela o gesto no meio e o item
 * volta para o lugar sem nada explicar. Ele fica só no punho, e não na linha
 * inteira, para a lista continuar rolando com o dedo em qualquer outro ponto.
 *
 * ----------------------------------------------------------------------------
 * AS MEDIDAS SÃO TIRADAS UMA VEZ, NO COMEÇO DO GESTO
 * ----------------------------------------------------------------------------
 *
 * A lista não se reordena enquanto o dedo anda: o que se move é uma LINHA DE
 * DESTINO entre os itens. Reordenar ao vivo obrigaria a remedir tudo a cada
 * quadro — e como as linhas desta tela têm alturas diferentes (a descrição
 * quebra), o item debaixo do dedo mudaria de tamanho no meio do movimento e o
 * destino ficaria piscando entre duas posições.
 *
 * Medir uma vez tem um preço, e ele é pago aqui: as medidas envelheceriam se a
 * lista rolasse durante o gesto. Por isso tudo é calculado em coordenada de
 * DOCUMENTO (posição na tela + o quanto o contêiner já rolou), e não de
 * viewport — assim a rolagem automática das bordas não desloca o destino.
 *
 * ----------------------------------------------------------------------------
 * O EIXO SAI DA GEOMETRIA, NÃO DE UMA PROPRIEDADE
 * ----------------------------------------------------------------------------
 *
 * A barra de categorias é uma COLUNA no desktop e uma FITA DEITADA abaixo de
 * 1024px — a mesma lista, outro eixo, decidido por uma consulta de mídia no
 * CSS. Um `eixo="vertical"` vindo de quem chama seria essa consulta escrita uma
 * segunda vez em JavaScript, com os dois lados livres para divergir no dia em
 * que o ponto de quebra mudar.
 *
 * Aqui o eixo é MEDIDO no começo do gesto: se o segundo item está mais ao lado
 * do que abaixo do primeiro, a lista é deitada. Uma lista de um item só não tem
 * eixo e também não tem para onde arrastar.
 */

/** Onde a linha de destino está, enquanto o dedo anda. */
export type ReorderDragState = {
  /** De onde o item saiu. */
  from: number;
  /** Para onde ele vai se soltar agora. */
  to: number;
};

/**
 * A quantos pixels da borda do contêiner a rolagem automática começa.
 *
 * Sem ela, arrastar do item 40 para o item 2 é impossível: o dedo chega à borda
 * da área visível e não há para onde ir.
 */
const BORDA_DE_ROLAGEM = 56;

/** Pixels por quadro na rolagem automática. Devagar o bastante para mirar. */
const VELOCIDADE_DE_ROLAGEM = 12;

/**
 * Quantos pixels o dedo precisa andar antes de o arrastar começar a valer.
 *
 * Um toque tem sempre algum tremor. Sem esta folga, encostar no punho já
 * desenharia a linha de destino e piscaria a lista no dedo de quem só queria
 * rolar.
 */
const FOLGA_DO_TOQUE = 4;

export function useReorderDrag({
  count,
  onReorder,
  disabled = false,
}: {
  /** Quantos itens a lista tem AGORA. Entra em toda conta de destino. */
  count: number;
  /** Sai da posição `from` e entra na `to`. Só é chamado se as duas diferem. */
  onReorder: (from: number, to: number) => void;
  /** Sem permissão, ou lista que não pode ser reordenada agora. */
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<ReorderDragState | null>(null);

  /** Os elementos de cada posição, para medir no começo do gesto. */
  const itensRef = useRef<(HTMLElement | null)[]>([]);
  /** A borda inicial de cada item no eixo, em coordenada de documento. */
  const bordasRef = useRef<number[]>([]);
  /** Medido no começo do gesto — ver o bloco do topo. */
  const deitadaRef = useRef(false);
  /** O que rola: o contêiner com overflow, achado subindo pelo DOM. */
  const roladorRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef(0);
  const passouDaFolgaRef = useRef(false);
  const inicioRef = useRef(0);
  /** O estado atual, para o `pointerup` ler sem depender de re-render. */
  const dragRef = useRef<ReorderDragState | null>(null);
  dragRef.current = drag;

  const registrar = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itensRef.current[index] = el;
    },
    [],
  );

  const pararRolagem = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const encerrar = useCallback(() => {
    pararRolagem();
    passouDaFolgaRef.current = false;
    roladorRef.current = null;
    setDrag(null);
  }, [pararRolagem]);

  /*
   * O GESTO MORRE COM O COMPONENTE. Sem isto, desmontar a lista no meio de um
   * arrastar — trocar de categoria com o dedo na tela — deixaria o laço de
   * rolagem automática rodando para sempre contra um elemento que já saiu.
   */
  useEffect(() => encerrar, [encerrar]);

  /** O destino, a partir de uma posição no eixo em coordenada de documento. */
  const destinoPara = useCallback(
    (posicao: number, from: number): number => {
      const bordas = bordasRef.current;
      /*
       * O DESTINO É QUANTOS ITENS COMEÇAM ANTES DO DEDO. A comparação é contra
       * o MEIO de cada item, e não contra a borda: é o que faz o destino trocar
       * quando o dedo passa da metade do vizinho, em vez de só quando ele o
       * ultrapassa inteiro — a diferença entre um alvo que responde e um que
       * parece travado.
       */
      let destino = 0;
      for (let i = 0; i < bordas.length; i += 1) {
        const borda = bordas[i];
        const proxima = bordas[i + 1] ?? borda;
        if (borda === undefined || proxima === undefined) continue;
        if (posicao > (borda + proxima) / 2) destino = i + 1;
      }
      /*
       * O ITEM ARRASTADO NÃO OCUPA MAIS A PRÓPRIA POSIÇÃO na lista de destino:
       * ele foi tirado dela. Sem este desconto, arrastar uma casa para a frente
       * não sairia do lugar — o índice 3 solto no vão 4 volta a ser 3 depois do
       * `splice`, e o lojista arrastaria sem nada acontecer.
       */
      if (destino > from) destino -= 1;
      return Math.max(0, Math.min(count - 1, destino));
    },
    [count],
  );

  const aoMover = useCallback(
    (event: PointerEvent<HTMLElement>, from: number) => {
      const atual = dragRef.current;
      if (!atual) return;

      const deitada = deitadaRef.current;
      const naTela = deitada ? event.clientX : event.clientY;

      if (!passouDaFolgaRef.current) {
        if (Math.abs(naTela - inicioRef.current) < FOLGA_DO_TOQUE) return;
        passouDaFolgaRef.current = true;
      }

      const rolador = roladorRef.current;
      const rolado = deitada ? (rolador?.scrollLeft ?? 0) : (rolador?.scrollTop ?? 0);
      const destino = destinoPara(naTela + rolado, from);
      if (destino !== atual.to) setDrag({ from, to: destino });

      /*
       * ROLAGEM AUTOMÁTICA NAS BORDAS, num laço próprio: `pointermove` só
       * dispara quando o dedo ANDA, e quem segura parado na borda esperando a
       * lista rolar não geraria evento nenhum.
       */
      pararRolagem();
      if (!rolador) return;

      const caixa = rolador.getBoundingClientRect();
      const antes = naTela - (deitada ? caixa.left : caixa.top) < BORDA_DE_ROLAGEM;
      const depois = (deitada ? caixa.right : caixa.bottom) - naTela < BORDA_DE_ROLAGEM;
      if (!antes && !depois) return;

      const passo = antes ? -VELOCIDADE_DE_ROLAGEM : VELOCIDADE_DE_ROLAGEM;
      const rolar = () => {
        if (deitada) rolador.scrollLeft += passo;
        else rolador.scrollTop += passo;
        rafRef.current = window.requestAnimationFrame(rolar);
      };
      rafRef.current = window.requestAnimationFrame(rolar);
    },
    [destinoPara, pararRolagem],
  );

  const aoSoltar = useCallback(() => {
    const atual = dragRef.current;
    encerrar();
    if (!atual) return;
    if (atual.from !== atual.to) onReorder(atual.from, atual.to);
  }, [encerrar, onReorder]);

  /**
   * As propriedades do PUNHO de uma posição.
   *
   * O punho é um elemento próprio, e não a linha inteira: a linha do item já
   * tem interruptor, caixa de seleção e botão de editar dentro, e uma linha
   * arrastável engoliria o primeiro toque de todos eles.
   */
  const punho = useCallback(
    (index: number) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        // Só o botão principal do mouse: capturar o ponteiro do botão do meio
        // ou do direito trava o menu de contexto e a colagem do X11.
        if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();

        const alvo = event.currentTarget;
        alvo.setPointerCapture(event.pointerId);

        const rolador = acharRolador(alvo);
        roladorRef.current = rolador;

        const caixas = itensRef.current
          .slice(0, count)
          .map((el) => el?.getBoundingClientRect() ?? null);

        // O eixo, medido: o segundo item está mais ao LADO ou mais ABAIXO?
        const primeira = caixas[0];
        const segunda = caixas[1];
        const deitada =
          !!primeira &&
          !!segunda &&
          Math.abs(segunda.left - primeira.left) > Math.abs(segunda.top - primeira.top);
        deitadaRef.current = deitada;

        const rolado = deitada ? (rolador?.scrollLeft ?? 0) : (rolador?.scrollTop ?? 0);
        bordasRef.current = caixas.map((caixa) =>
          caixa ? (deitada ? caixa.left : caixa.top) + rolado : 0,
        );

        inicioRef.current = deitada ? event.clientX : event.clientY;
        passouDaFolgaRef.current = false;
        setDrag({ from: index, to: index });
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => aoMover(event, index),
      onPointerUp: aoSoltar,
      /*
       * CANCELAR É DESISTIR, NÃO SOLTAR. O navegador cancela o ponteiro quando
       * assume o gesto (uma rolagem que escapou, um menu de contexto), e aí o
       * dedo não escolheu destino nenhum — gravar a posição em que ele estava
       * seria reordenar o cardápio por um gesto que nem chegou a acontecer.
       */
      onPointerCancel: encerrar,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') encerrar();
      },
    }),
    [aoMover, aoSoltar, count, disabled, encerrar],
  );

  return {
    /** `null` fora do gesto. Quem desenha usa para a linha de destino. */
    drag,
    /** `ref` do elemento de cada posição, para medir. */
    registrar,
    /** As propriedades do punho de cada posição. */
    punho,
  };
}

/**
 * O ancestral que ROLA — e o gesto precisa dele por dois motivos: converter a
 * posição do dedo em coordenada de documento e rolar sozinho nas bordas.
 *
 * Sobe pelo DOM procurando `overflow` que não seja `visible`, em vez de receber
 * uma `ref` de quem chama: nesta tela quem rola é `.rail__list` numa lista e
 * `.menu__panel` na outra, e nos dois casos o elemento fica a uma distância
 * diferente do punho. Achar é mais curto que passar, e não erra quando o
 * enquadramento muda no celular — onde a fita de categorias troca de eixo e
 * passa a rolar de lado.
 */
function acharRolador(from: HTMLElement): HTMLElement | null {
  let atual: HTMLElement | null = from.parentElement;
  while (atual) {
    const estilo = window.getComputedStyle(atual);
    if (/(auto|scroll|overlay)/.test(`${estilo.overflowY} ${estilo.overflowX}`)) return atual;
    atual = atual.parentElement;
  }
  return null;
}
