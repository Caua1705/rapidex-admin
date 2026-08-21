import { useId, type ReactNode } from 'react';

import { HelpIcon } from './icons';
import { useAnchoredPanel } from './use-anchored-panel';
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
 * O TECLADO mora em `ds/use-anchored-panel`, junto do painel de filtros de
 * Clientes: Esc fecha e devolve o foco ao ícone, clique fora fecha, Tab para
 * fora fecha. Ver o hook para o porquê de cada um.
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

  /*
   * Abrir, fechar, Esc, clique fora e Tab para fora saem de
   * `ds/use-anchored-panel` — os mesmos cinco comportamentos do painel de
   * filtros de Clientes. Eles moravam aqui, escritos à mão; um segundo painel
   * ancorado no painel os copiaria linha por linha, e é assim que dois objetos
   * do sistema passam a fechar de dois jeitos diferentes.
   */
  const painel = useAnchoredPanel();

  return (
    <div
      className={`ds-help${painel.open ? ' ds-help--aberta' : ''}`}
      ref={painel.rootRef}
      onBlur={painel.onBlur}
    >
      <button
        type="button"
        ref={painel.triggerRef}
        className="btn btn--ghost btn--sm icon-btn ds-help__gatilho"
        aria-label={label}
        aria-expanded={painel.open}
        aria-controls={paneId}
        data-testid={testId}
        onClick={painel.toggle}
      >
        <HelpIcon />
      </button>

      {painel.open ? (
        <div className="ds-help__balao" id={paneId} role="group" aria-label={label}>
          <p className="t-section ds-help__titulo">{title}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
