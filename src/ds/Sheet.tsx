import { useEffect, useRef, type ReactNode } from 'react';

import { useFocusTrap } from './use-focus-trap';
import { XIcon } from './icons';
import './Sheet.css';

/**
 * Folha inferior — a caixa que sobe do rodapé no celular.
 *
 *   <Sheet open={aberta} title="Mudar o status" onClose={fechar}>
 *     <ul>…</ul>
 *   </Sheet>
 *
 * QUANDO USAR: no celular, para uma escolha curta que interrompe o que a pessoa
 * está fazendo — mudar o status de um pedido, abrir o resto da navegação. Ela
 * sobe do lado do polegar, que é onde a mão já está; um diálogo centralizado
 * obriga a pessoa a esticar o dedo até o meio da tela.
 *
 * QUANDO NÃO USAR: no desktop. Lá a mesma escolha cabe num popover ao lado do
 * gatilho, sem cobrir a tela inteira.
 *
 * Ela é `role="dialog"` modal: prende o foco, fecha no Esc e no toque fora, e
 * devolve o foco a quem a abriu.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  'data-testid': testId,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);
  useFocusTrap(caixaRef, open, onClose);

  /*
   * Com a folha aberta, a página de baixo não rola. Sem isto, o dedo que
   * arrasta a folha arrasta a lista atrás dela e a pessoa perde o lugar.
   */
  useEffect(() => {
    if (!open) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="ds-sheet__veu" onPointerDown={onClose} data-testid={testId}>
      <div
        className="ds-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={caixaRef}
        tabIndex={-1}
        /* O clique de dentro não fecha: só o véu fecha. */
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="ds-sheet__cab">
          {/* A alça é desenho: quem opera é o botão de fechar e o Esc. */}
          <span className="ds-sheet__alca" aria-hidden="true" />
          <h2 className="ds-sheet__titulo t-card">{title}</h2>
          <button type="button" className="ds-sheet__fechar" aria-label="Fechar" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="ds-sheet__corpo">{children}</div>
      </div>
    </div>
  );
}
