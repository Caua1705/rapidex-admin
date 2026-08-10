import { useId, type ReactNode } from 'react';

import { AlertIcon } from './icons';
import './Choice.css';

/**
 * Escolha única entre poucas opções visíveis ao mesmo tempo.
 *
 *   <RadioGroup
 *     legend="Como o pedido chega"
 *     name="tipo"
 *     value={tipo}
 *     onChange={setTipo}
 *     options={[
 *       { value: 'delivery', label: 'Entrega' },
 *       { value: 'pickup', label: 'Retirada no balcão', hint: 'O cliente busca na loja.' },
 *     ]}
 *   />
 *
 * RÁDIO OU SELETOR? Rádio quando as opções são poucas (até cinco) e a escolha
 * merece ser comparada de relance; `Select` quando são muitas ou quando o
 * espaço é de uma linha só. Rádio com quinze opções é uma tela inteira gasta.
 *
 * O grupo é um `<fieldset>` com `<legend>`: é o que faz o leitor de tela
 * anunciar "Como o pedido chega, Entrega, 1 de 2" ao entrar no primeiro botão.
 * Sem isso, cada rádio é uma pergunta solta.
 */
export type RadioOption = {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
};

export function RadioGroup({
  legend,
  name,
  value,
  onChange,
  options,
  error,
  disabled = false,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly RadioOption[];
  error?: string | null;
  disabled?: boolean;
}) {
  const base = useId();
  const errorId = `${base}-error`;

  return (
    <fieldset
      className="ds-choice-group"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="ds-choice-group__legend">{legend}</legend>

      {options.map((option, index) => {
        const optionId = `${base}-${index}`;
        const hintId = `${optionId}-hint`;
        const isDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            className={`ds-choice${isDisabled ? ' ds-choice--disabled' : ''}`}
            htmlFor={optionId}
          >
            <input
              id={optionId}
              className="ds-choice__box ds-choice__box--radio"
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={isDisabled}
              aria-describedby={option.hint ? hintId : undefined}
              onChange={() => onChange(option.value)}
            />

            <span className="ds-choice__text">
              <span className="ds-choice__label">{option.label}</span>
              {option.hint ? (
                <span className="ds-choice__hint" id={hintId}>
                  {option.hint}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}

      {error ? (
        <p className="ds-choice-group__error" id={errorId} role="alert">
          <AlertIcon size={14} />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
