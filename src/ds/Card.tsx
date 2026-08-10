import type { ReactNode } from 'react';

import './Card.css';

/**
 * A superfície de trabalho.
 *
 *   <Card title="Pedido" hint="O que o cliente vê antes de fechar.">
 *     <FieldRow>…</FieldRow>
 *   </Card>
 *
 *   <Card>…</Card>   // sem cabeçalho, quando a seção já tem título fora
 *
 * O cartão se separa do fundo por TOM (`--surface` sobre `--bg`) e por uma
 * sombra de um pixel. Sem borda: contornar tudo é o que faz a tela parecer
 * wireframe, e com a escada de superfície a borda vira o terceiro sinal
 * dizendo a mesma coisa.
 *
 * O `title` é `<h2>` por padrão. Quem tem mais de um nível na tela passa `as`.
 */
export function Card({
  title,
  hint,
  actions,
  as: Heading = 'h2',
  children,
  className,
}: {
  title?: string;
  hint?: ReactNode;
  /** Ações do cabeçalho — no máximo duas, à direita do título. */
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={['ds-card', className ?? ''].filter(Boolean).join(' ')}>
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
