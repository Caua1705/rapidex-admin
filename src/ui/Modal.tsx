import { useEffect, type ReactNode } from 'react';

import { XIcon } from '../ds/icons';
import './Modal.css';

/**
 * O diálogo do painel. Um só, com uma variante.
 *
 * Fecha no Esc e no clique fora porque o lojista abre e fecha dezenas de
 * pedidos por turno e mirar o "x" com o mouse custa tempo.
 *
 * ----------------------------------------------------------------------------
 * `dismissible={false}`: O DIÁLOGO QUE NÃO SE FECHA SOZINHO
 * ----------------------------------------------------------------------------
 *
 * Existe um caso, e ele é o oposto de todos os outros: o diálogo que mostra a
 * senha temporária de alguém que acabou de ser cadastrado. Aquele valor existe
 * uma vez — `POST /admin/users` o devolve em claro e o banco só guarda o bcrypt
 * dele. Fechar sem copiar não perde um formulário que dá para reabrir: perde a
 * credencial, e a segunda via é gerar OUTRA senha, que mata a primeira na mão
 * de quem já a recebeu.
 *
 * Esc, clique no fundo e o "x" do cabeçalho são os três jeitos de fechar um
 * diálogo sem querer, e os três somem juntos — deixar um deles de pé seria
 * fechar duas portas e esquecer a terceira. Quem fecha é o rodapé, e só depois
 * de a pessoa dizer que copiou.
 *
 * A VARIANTE ENTRA NO COMPONENTE, e não numa cópia dentro da tela de Usuários:
 * é a mesma regra que trouxe `SearchField variant="barra"` e `Tabs
 * variant="barra"` para cá. Um segundo diálogo escrito à mão numa página é como
 * o sistema ganha dois cabeçalhos, dois raios e dois comportamentos de foco.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  dismissible = true,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * `false` tira as três saídas acidentais: Esc, clique no fundo e o "x".
   * Só para o diálogo cujo conteúdo não volta a existir — ver o bloco acima.
   */
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!dismissible) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, dismissible]);

  return (
    <div className="modal__backdrop" onClick={dismissible ? onClose : undefined}>
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
          {/*
            O X SAI DE `ds/icons`, como todo ícone do sistema. Ele já foi o
            caractere "✕" escrito aqui dentro — que é o mesmo defeito do sol e
            da lua desenhados dentro do ThemeToggle: um segundo conjunto de
            ícones começando. E como caractere ele nem seguia o traço do
            sistema, porque quem o desenhava era a fonte.

            SEM ELE quando o diálogo não é dispensável: um "x" que não fecha
            seria pior que a ausência dele, e um que fechasse seria a porta que
            as outras duas acabaram de trancar.
          */}
          {dismissible ? (
            <button
              type="button"
              className="btn btn--sm icon-btn"
              onClick={onClose}
              aria-label="Fechar"
              title="Fechar"
            >
              <XIcon size={14} />
            </button>
          ) : null}
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
