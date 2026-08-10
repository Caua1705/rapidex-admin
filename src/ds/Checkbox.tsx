import { useId, type ReactNode } from 'react';

import './Choice.css';

/**
 * Caixa de marcar.
 *
 *   <Checkbox
 *     checked={cobraTaxa}
 *     onChange={setCobraTaxa}
 *     label="Cobrar taxa de serviço"
 *     hint="Some do carrinho do cliente quando desligada."
 *   />
 *
 * O <input> é nativo — teclado, formulário e leitor de tela vêm dele — mas com
 * `appearance: none` ele não desenha nada: a caixinha do sistema operacional e
 * o `accent-color` somem, e o que se vê é o desenho do design system.
 *
 * A ÁREA DE CLIQUE É A LINHA INTEIRA, não o quadrado de 18px: no balcão, com
 * pressa, ninguém acerta 18px de primeira. O rótulo é o `<label>` de verdade,
 * então clicar no texto marca a caixa sem nenhum código nosso.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  /** Marcado em parte: usado quando ele comanda uma lista meio marcada. */
  indeterminate = false,
  id,
  'data-testid': testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
  id?: string;
  'data-testid'?: string;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${generated}-hint`;

  return (
    <label
      className={`ds-choice${disabled ? ' ds-choice--disabled' : ''}`}
      htmlFor={controlId}
      data-testid={testId}
    >
      <input
        id={controlId}
        className="ds-choice__box ds-choice__box--check"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        ref={(node) => {
          // `indeterminate` não existe como atributo: só como propriedade.
          if (node) node.indeterminate = indeterminate && !checked;
        }}
        onChange={(event) => onChange(event.target.checked)}
      />

      <span className="ds-choice__text">
        <span className="ds-choice__label">{label}</span>
        {hint ? (
          <span className="ds-choice__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
