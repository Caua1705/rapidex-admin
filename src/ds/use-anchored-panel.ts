import { useCallback, useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';

/**
 * A MECÂNICA DE UM PAINEL ANCORADO NUM BOTÃO — abrir, fechar, e as três formas
 * de fechar que ninguém lembra de escrever.
 *
 *   const painel = useAnchoredPanel();
 *
 *   <div className="meu" ref={painel.rootRef} onBlur={painel.onBlur}>
 *     <button ref={painel.triggerRef} aria-expanded={painel.open} onClick={painel.toggle}>…</button>
 *     {painel.open ? <div className="meu__balao">…</div> : null}
 *   </div>
 *
 * POR QUE ELA É UM HOOK E NÃO UM COMPONENTE: o que se repete entre a ajuda de
 * tela e o painel de filtros é o COMPORTAMENTO, não a forma. Um deles carrega
 * prosa e alinha pela esquerda do título; o outro carrega um formulário com
 * rodapé de ações e alinha pela margem direita da faixa. Um componente que
 * fizesse os dois teria uma propriedade para cada diferença — e é assim que um
 * primitivo deixa de ser primitivo.
 *
 * O QUE ELA GARANTE, IGUAL NOS DOIS:
 *
 *   Esc           fecha e DEVOLVE o foco ao gatilho. Sem a devolução, quem
 *                 fechou pelo teclado é largado no fim do documento e o próximo
 *                 Tab começa a página de novo. É a regra do `ds/Select`.
 *   clique fora   fecha, sem mexer no foco — o clique já levou o foco para onde
 *                 a pessoa quis.
 *   Tab para fora fecha. Sem isto, o painel fica aberto atrás de quem já andou
 *                 para o campo seguinte, e um bloco flutuante que ninguém pediu
 *                 lê como defeito.
 *
 * E O CASO QUE NÃO FECHA: `relatedTarget` nulo é o foco saindo da JANELA
 * (trocou de aba, clicou na barra do navegador, abriu o calendário nativo de um
 * `input type=date`). Ali o painel FICA — quem volta espera encontrar a tela
 * como deixou, e fechar um formulário meio preenchido porque o calendário do
 * sistema roubou o foco é perder o que a pessoa digitou.
 *
 * Os dois escutadores de documento só existem enquanto o painel está aberto.
 * Um painel quase sempre fechado não precisa de duas assinaturas no documento.
 */
export function useAnchoredPanel<T extends HTMLElement = HTMLDivElement>(): {
  open: boolean;
  rootRef: RefObject<T | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  toggle: () => void;
  close: (devolverFoco: boolean) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
} {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<T | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  /*
   * ELE NÃO TEM `onClose`, E A AUSÊNCIA É DELIBERADA.
   *
   * O painel de filtros precisa descartar o rascunho quando fecha sem aplicar —
   * e a forma certa disso não é um aviso de fechamento, é SEMEAR o rascunho na
   * ABERTURA. Com um `onClose`, "Aplicar" fecharia o painel antes de o pai
   * receber o valor novo, e o rascunho voltaria para o critério ANTIGO enquanto
   * a lista já mostrava o novo. Semear na abertura não tem esse intervalo: o
   * que o painel mostra é sempre o que está aplicado agora.
   */
  const close = useCallback((devolverFoco: boolean) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpen((estava) => !estava);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Um `ds/Select` aberto dentro do painel já tratou o Esc e o parou:
        // a primeira tecla fecha a lista, a segunda fecha o painel.
        event.stopPropagation();
        close(true);
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      close(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const onBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const proximo = event.relatedTarget as Node | null;
      if (!proximo) return;
      if (rootRef.current?.contains(proximo)) return;
      close(false);
    },
    [close],
  );

  return { open, rootRef, triggerRef, toggle, close, onBlur };
}
