import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { HelpIcon } from './icons';
import './HelpPopover.css';

/**
 * A AJUDA DE UMA TELA — um ícone ao lado do título, e a explicação atrás dele.
 *
 *   <PageBar
 *     title="Clientes"
 *     aside={
 *       <HelpPopover label="Como ler a classificação" title="Como ler a classificação">
 *         <p>…</p>
 *       </HelpPopover>
 *     }
 *   />
 *
 * ----------------------------------------------------------------------------
 * POR QUE ELE EXISTE, E O QUE ELE NÃO É
 * ----------------------------------------------------------------------------
 *
 * O sistema não tem subtítulo explicando a tela, e essa regra vale. O que ele
 * TEM é a ressalva: a frase que diz o que a tela não mostra, ou até onde a
 * leitura dela alcança. A ressalva curta continua em prosa acima da lista —
 * ela se lê de passagem e não custa nada.
 *
 * O que este componente resolve é a ressalva que CRESCEU. Em Clientes eram
 * dois parágrafos e sete linhas antes da primeira linha da tabela: a explicação
 * é necessária uma vez na vida do lojista e ficava cobrando uma dobra de tela
 * de quem já a leu. A informação não pode sumir — ela só não pode ser o que
 * abre a tela todo dia.
 *
 * ELE NÃO É UM `title`. Um `title` não sobrevive ao toque, não se copia e não
 * se lê com calma; ele serve para o APOIO que ninguém precisa (o porquê de um
 * rótulo, em `SEGMENT_HINT`), não para o que muda a leitura de uma tela
 * inteira. Aqui a explicação é conteúdo de verdade: abre, fica aberta, e o
 * teclado a alcança.
 *
 * ELE NÃO É UM DIÁLOGO. Nada é decidido dentro dele e nada fica atrás dele —
 * um modal para ler três frases obriga a fechar antes de olhar a lista que a
 * frase explica. É uma DIVULGAÇÃO: o botão diz se está aberta
 * (`aria-expanded`), o painel vem logo depois dele na ordem do documento, e o
 * leitor de tela anda de um para o outro sem narração nossa.
 *
 * ----------------------------------------------------------------------------
 * O TECLADO
 * ----------------------------------------------------------------------------
 *
 *   Enter/Espaço  abrem e fecham
 *   Esc           fecha e DEVOLVE o foco ao ícone — sem isso quem fechou é
 *                 largado no fim do documento, como no `ds/Select`
 *   Tab           anda para dentro do painel; ao sair dele, fecha
 *   clique fora   fecha
 */
export function HelpPopover({
  label,
  title,
  children,
  'data-testid': testId,
}: {
  /** O nome acessível do ícone. Um ícone nunca é o nome de nada. */
  label: string;
  /** O título dentro do painel — nível 2, como todo título dentro de um bloco. */
  title: string;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const generated = useId();
  const paneId = `${generated}-ajuda`;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((devolverFoco: boolean) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  // Escape e clique fora, e só enquanto está aberta — a mesma dupla do
  // `ds/Select`, pelo mesmo motivo: escutar o documento o tempo todo por causa
  // de um painel que quase sempre está fechado.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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

  /*
   * SAIR COM TAB FECHA. Sem isto, o painel fica aberto atrás de quem já andou
   * para o campo de busca — e um bloco flutuante sobre a lista que ninguém
   * pediu lê como defeito, não como ajuda.
   *
   * `relatedTarget` nulo é o foco saindo da janela (trocou de aba, clicou na
   * barra do navegador): ali o painel FICA, porque quem volta espera encontrar
   * a tela como deixou.
   */
  function onFocusOut(event: React.FocusEvent<HTMLDivElement>) {
    const proximo = event.relatedTarget as Node | null;
    if (!proximo) return;
    if (rootRef.current?.contains(proximo)) return;
    setOpen(false);
  }

  return (
    <div
      className={`ds-help${open ? ' ds-help--aberta' : ''}`}
      ref={rootRef}
      onBlur={onFocusOut}
    >
      <button
        type="button"
        ref={triggerRef}
        className="btn btn--ghost btn--sm icon-btn ds-help__gatilho"
        aria-label={label}
        aria-expanded={open}
        aria-controls={paneId}
        data-testid={testId}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <HelpIcon />
      </button>

      {open ? (
        <div className="ds-help__balao" id={paneId} role="group" aria-label={label}>
          <p className="t-section ds-help__titulo">{title}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
