import { STAGE_LABEL, type Stage } from './status';
import './StatusChip.css';

/**
 * O estado de um pedido, escrito.
 *
 *   <StatusChip stage="preparando" />
 *   <StatusChip stage="pronto" size="sm" />
 *
 * TRÊS PISTAS AO MESMO TEMPO, sempre (WCAG 1.4.1):
 *   cor    — o fundo tingido e o ponto, da matiz do estágio;
 *   texto  — a palavra, que é o que o leitor de tela lê;
 *   forma  — o ponto à esquerda, que sobrevive ao daltonismo e à tela ruim
 *            do balcão.
 *
 * O TEXTO NÃO É COLORIDO, e isso é medido: as três matizes mais claras da
 * escala (pendente, concluído, cancelado) já chegam a ~4.5:1 contra branco
 * puro, então sobre o próprio fundo tingido elas reprovariam. Com a tinta
 * comum no texto e a matiz no ponto, o chip passa com folga e continua
 * dizendo a mesma coisa.
 */
export function StatusChip({
  stage,
  size = 'md',
  className,
}: {
  stage: Stage;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={[`ds-chip`, `ds-chip--${size}`, `is-${stage}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ds-chip__ponto" aria-hidden="true" />
      {STAGE_LABEL[stage]}
    </span>
  );
}
