import { useEffect, type ReactNode } from 'react';

import './Modal.css';

/**
 * Janela do detalhe do pedido.
 *
 * Fecha no Esc e no clique fora porque o lojista abre e fecha dezenas de
 * pedidos por turno e mirar o "x" com o mouse custa tempo.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Detalhe do pedido'}
        // Sem isto, o clique dentro da janela borbulha até o fundo e fecha.
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div className="modal__title">{title}</div>
          <button type="button" className="btn btn--sm" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
