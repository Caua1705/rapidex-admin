import { useEffect, useRef, useState } from 'react';

import { MoreIcon } from '../ui/icons';

export type CategoryAction = {
  id: string;
  label: string;
  /** Por que a ação está travada. Vira `title` e desabilita o item. */
  disabledReason?: string;
  onSelect: () => void;
  testId?: string;
};

/**
 * As ações de categoria que NÃO são a ação do dia a dia.
 *
 * POR QUE ESTE MENU EXISTE: "Aplicar setor à categoria" ficava ao lado de "Novo
 * item", com peso visual parecido. Só que um cria um item e o outro
 * SOBRESCREVE o setor de todos os produtos da categoria, inclusive os que
 * alguém configurou à mão. Dois botões lado a lado dizem ao olho que as duas
 * coisas custam o mesmo — e o clique errado aqui só aparece no primeiro pedido
 * que sai na impressora errada.
 *
 * Fica ao lado do NOME da categoria porque é dali que a ação fala: ela age
 * sobre a categoria aberta, não sobre a lista que está à direita.
 *
 * Sem biblioteca de menu: um <button> que abre uma lista de <button>. O que
 * isso precisa entregar à mão é o fechamento — Escape, clique fora e escolha
 * — e a volta do foco para o gatilho, senão quem usa teclado é largado no fim
 * do documento.
 */
export function CategoryActionsMenu({
  actions,
  label = 'Ações da categoria',
}: {
  actions: readonly CategoryAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Escape devolve o foco a quem abriu: sem isto o teclado volta para o
      // começo do documento e a pessoa se perde na tela.
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="actions-menu" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="btn btn--sm icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((current) => !current)}
        data-testid="category-actions-open"
      >
        <MoreIcon />
      </button>

      {open ? (
        <div className="actions-menu__list" role="menu" aria-label={label}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className="actions-menu__item"
              disabled={action.disabledReason !== undefined}
              title={action.disabledReason}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              data-testid={action.testId}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
