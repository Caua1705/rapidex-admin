import { STAGE_LABEL, type Stage } from './status';
import './StatusChip.css';

/**
 * O estado de um pedido, escrito.
 *
 *   <StatusChip stage="preparando" />
 *   <StatusChip stage="pronto" size="sm" />
 *   <StatusChip stage="cancelado" label="Recusado" />
 *
 * TRÊS PISTAS AO MESMO TEMPO, sempre (WCAG 1.4.1):
 *   cor    — o fundo tingido e o ponto, da matiz do estágio;
 *   texto  — a palavra, que é o que o leitor de tela lê;
 *   forma  — o ponto à esquerda, que sobrevive ao daltonismo e à tela ruim
 *            do balcão.
 *
 * `label` EXISTE PORQUE O ESTÁGIO É MAIS GROSSO QUE O STATUS. `rejected` e
 * `cancelled` são o mesmo estágio visual (fim de linha, carmim) e palavras
 * diferentes para quem lê — o detalhe do pedido precisa dizer qual dos dois
 * foi. Sem esta propriedade, aquela tela escreveria o próprio chip, e um chip
 * de status implementado duas vezes é como as duas cópias divergem.
 *
 * O TEXTO NÃO É COLORIDO, e isso é medido: as três matizes mais claras da
 * escala (pendente, concluído, cancelado) já chegam a ~4.5:1 contra branco
 * puro, então sobre o próprio fundo tingido elas reprovariam. Com a tinta
 * comum no texto e a matiz no ponto, o chip passa com folga e continua
 * dizendo a mesma coisa.
 */
export function StatusChip({
  stage,
  label,
  size = 'md',
  className,
}: {
  stage: Stage;
  /** Sobrescreve a palavra, nunca a matiz. Sem ela, o rótulo do estágio. */
  label?: string;
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
      {label ?? STAGE_LABEL[stage]}
    </span>
  );
}
