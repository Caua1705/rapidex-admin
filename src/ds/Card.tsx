import type { ReactNode } from 'react';

import './Card.css';

/**
 * A superfície de trabalho.
 *
 *   <Card title="Pedido" hint="O que o cliente vê antes de fechar.">
 *     <FieldRow>…</FieldRow>
 *   </Card>
 *
 *   <Card title="Faturamento" actions={<span className="t-aux">7 dias</span>}>…</Card>
 *
 *   <Card denso>…</Card>   // sem cabeçalho, respiro curto: o cartão de métrica
 *
 * ============================================================================
 * ELE VOLTOU A TER RELEVO, E ESTA É A DECISÃO
 * ============================================================================
 *
 * Este cartão passou uma direção inteira sem borda e sem sombra, e o motivo
 * estava escrito aqui: `--surface` sobre `--bg` já era começo e fim de bloco, e
 * contornar tudo é o que faz uma tela parecer wireframe. Continua verdade nas
 * telas OPERACIONAIS — Pedidos, Cardápio, Minha loja são folhas, e nenhuma usa
 * este componente.
 *
 * O que mudou é que a folha deixou de servir a UMA tela: Desempenho é um
 * painel de leitura, com oito blocos de naturezas diferentes na mesma página, e
 * ali o tom sozinho não separa nada — no tema claro `--surface` e
 * `--surface-raised` são o mesmo branco. Sem um limite desenhado, os blocos
 * viram uma coluna contínua de texto, que é o defeito que a rodada existiu para
 * consertar.
 *
 * O relevo é o MENOR possível, e é feito de três coisas somadas, nenhuma delas
 * suficiente sozinha: um degrau de plano (`--surface-raised`, que só existe no
 * escuro), um fio de 1px (`--line`, que só se vê no claro) e `--shadow-lift` —
 * a sombra curta que o segmento ativo do segmentado já usa, e não
 * `--shadow-raised`, que é para o que passa POR CIMA de outro conteúdo.
 *
 * O `title` é `<h2>` por padrão. Quem tem mais de um nível na tela passa `as`.
 */
export function Card({
  title,
  hint,
  actions,
  as: Heading = 'h2',
  denso = false,
  testId,
  children,
  className,
}: {
  title?: string;
  hint?: ReactNode;
  /** O que vive à direita do título: a nota do recorte, um segmentado curto. */
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  /**
   * Respiro curto no corpo — o cartão de métrica, em que rótulo, número e
   * variação são um bloco só e não três blocos empilhados.
   */
  denso?: boolean;
  /**
   * O `data-testid` do cartão INTEIRO.
   *
   * Ele existe porque um teste que precisa do cartão todo (o número E o rodapé)
   * não tem por onde pegá-lo: pendurar o id num filho deixa metade do conteúdo
   * fora do alcance, e filtrar por texto quebra na primeira palavra que mudar.
   */
  testId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={['ds-card', denso ? 'ds-card--denso' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
    >
      {title ? (
        <header className="ds-card__cab">
          <div className="ds-card__titulo-bloco">
            <Heading className="t-section">{title}</Heading>
            {hint ? <p className="t-aux">{hint}</p> : null}
          </div>
          {actions ? <div className="ds-card__acoes">{actions}</div> : null}
        </header>
      ) : null}

      <div className="ds-card__corpo">{children}</div>
    </section>
  );
}
