import type { InputHTMLAttributes, ReactNode } from 'react';

import { useFieldState } from './field-context';
import { Spinner } from './Spinner';
import './Input.css';

/**
 * Campo de texto, com afixo interno opcional.
 *
 *   <Input value={nome} onValueChange={setNome} />
 *   <Input prefix="R$" value={preco} onValueChange={setPreco} inputMode="decimal" />
 *   <Input suffix="min" value={tempo} onValueChange={setTempo} inputMode="numeric" />
 *   <Input value={cep} onValueChange={setCep} loading />
 *
 * O AFIXO É INTERNO, dentro da mesma caixa do campo, e não um rótulo colado do
 * lado de fora: "R$" fora da caixa lê como outra coluna, e some quando o campo
 * quebra de linha. Ele é `aria-hidden` porque a unidade já está no rótulo ou na
 * ajuda do `Field` — anunciar "R$" antes de cada dígito só atrapalha.
 *
 * A caixa inteira é a área de clique: clicar no afixo põe o cursor no texto.
 */
export function Input({
  prefix,
  suffix,
  loading = false,
  invalid,
  onValueChange,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Ocupado: o valor está sendo verificado ou gravado. Bloqueia a digitação. */
  loading?: boolean;
  /** Só para uso fora de um `Field` — dentro dele, quem manda é o erro. */
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
        isInvalid ? 'ds-control--invalid' : '',
        disabled || loading ? 'ds-control--disabled' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix ? (
        <span className="ds-control__affix" aria-hidden="true">
          {prefix}
        </span>
      ) : null}

      <input
        {...rest}
        id={rest.id ?? field?.controlId}
        className="ds-control__input"
        aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
        aria-invalid={isInvalid || undefined}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        onChange={(event) => {
          rest.onChange?.(event);
          onValueChange?.(event.target.value);
        }}
      />

      {loading ? (
        <span className="ds-control__affix">
          <Spinner />
        </span>
      ) : suffix ? (
        <span className="ds-control__affix" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
