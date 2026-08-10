import type { TextareaHTMLAttributes } from 'react';

import { useFieldState } from './field-context';
import './Input.css';

/**
 * Área de texto — a mesma caixa do `Input`, com mais linhas.
 *
 *   <Field label="Descrição" hint="Aparece no cardápio do cliente.">
 *     <Textarea value={descricao} onValueChange={setDescricao} rows={3} />
 *   </Field>
 *
 * Ela cresce só na vertical (`resize: vertical`): deixar arrastar na horizontal
 * quebra a coluna do formulário e não devolve mais.
 */
export function Textarea({
  invalid,
  onValueChange,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const field = useFieldState();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const disabled = rest.disabled ?? field?.disabled ?? false;

  return (
    <span
      className={[
        'ds-control',
        'ds-control--textarea',
        isInvalid ? 'ds-control--invalid' : '',
        disabled ? 'ds-control--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <textarea
        {...rest}
        id={rest.id ?? field?.controlId}
        className="ds-control__input"
        aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
        aria-invalid={isInvalid || undefined}
        disabled={disabled}
        onChange={(event) => {
          rest.onChange?.(event);
          onValueChange?.(event.target.value);
        }}
      />
    </span>
  );
}
