import { useId, type ReactNode } from 'react';

import { Spinner } from './Spinner';
import './Switch.css';

/**
 * Interruptor: liga e desliga AGORA, sem passar por um botão de salvar.
 *
 *   <Switch checked={aberta} onChange={abrirLoja} label="Loja aberta" />
 *   <Switch checked={disponivel} onChange={repor} label="X-Burger" hideLabel loading />
 *
 * INTERRUPTOR OU CAIXA DE MARCAR? Interruptor quando o efeito é imediato e no
 * mundo real — a loja fecha, o item some do cardápio. Caixa de marcar quando o
 * valor só passa a valer depois do Salvar. Trocar um pelo outro é o jeito mais
 * fácil de alguém achar que salvou algo que não salvou, ou o contrário.
 *
 * `role="switch"` com `aria-checked`: o leitor de tela anuncia "ligado" e
 * "desligado", e não "marcado". O estado NUNCA é comunicado só pela cor — o
 * botão desliza de lado, que é a forma.
 *
 * `loading` existe porque a troca vai à rede: enquanto o backend não confirma,
 * o controle fica ocupado em vez de mentir que já mudou.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  hideLabel = false,
  disabled = false,
  loading = false,
  id,
  'data-testid': testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Sempre existe: quando `hideLabel`, vira o nome acessível do botão. */
  label: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  'data-testid'?: string;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const labelId = `${generated}-label`;
  const hintId = `${generated}-hint`;

  const botao = (
    <button
      type="button"
      id={controlId}
      role="switch"
      aria-checked={checked}
      aria-labelledby={hideLabel ? undefined : labelId}
      aria-label={hideLabel ? label : undefined}
      aria-describedby={hint ? hintId : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className="ds-switch"
      data-testid={testId}
      onClick={() => onChange(!checked)}
    >
      <span className="ds-switch__track" aria-hidden="true">
        <span className="ds-switch__knob" />
      </span>
    </button>
  );

  if (hideLabel) return loading ? <span className="ds-switch-busy">{botao}</span> : botao;

  return (
    <div className={`ds-switch-row${disabled ? ' ds-switch-row--disabled' : ''}`}>
      {botao}
      <span className="ds-switch-row__text">
        <label className="ds-switch-row__label" id={labelId} htmlFor={controlId}>
          {label}
        </label>
        {hint ? (
          <span className="ds-switch-row__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </span>
      {loading ? <Spinner /> : null}
    </div>
  );
}
