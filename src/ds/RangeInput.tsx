import { useId } from 'react';

import { Input } from './Input';
import { useFieldState } from './field-context';
import './Input.css';

/**
 * Dois números que são UM dado: uma faixa.
 *
 *   <Field label="Tempo estimado" hint="É a faixa que o cliente vê ao escolher a loja.">
 *     <RangeInput
 *       from={{ value: min, onValueChange: setMin, label: 'Tempo mínimo, em minutos' }}
 *       to={{ value: max, onValueChange: setMax, label: 'Tempo máximo, em minutos' }}
 *       suffix="min"
 *     />
 *   </Field>
 *
 * POR QUE NÃO SÃO DOIS CAMPOS: mínimo e máximo são sempre editados juntos, o
 * backend os valida em par, e um sem o outro não quer dizer nada. Em duas
 * caixas rotuladas separadamente, cada uma pedia o próprio rótulo de três
 * palavras e a própria linha de ajuda — três campos onde há dois números.
 *
 * Cada caixa continua tendo nome acessível próprio (`label`), porque quem
 * navega por teclado precisa saber em qual das duas está.
 */
type Ponta = {
  value: string;
  onValueChange: (value: string) => void;
  /** Nome acessível da caixa — o rótulo visível é o do `Field`. */
  label: string;
  placeholder?: string;
  /**
   * Cada ponta é uma caixa própria e precisa de um alvo próprio no teste: a
   * faixa é o dado, mas quem se preenche continua sendo um número de cada vez.
   */
  'data-testid'?: string;
};

export function RangeInput({
  from,
  to,
  suffix,
  prefix,
  separator = 'a',
  inputMode = 'numeric',
  disabled,
  className,
}: {
  from: Ponta;
  to: Ponta;
  suffix?: string;
  prefix?: string;
  separator?: string;
  inputMode?: 'numeric' | 'decimal';
  disabled?: boolean;
  /** Teto de conteúdo da faixa inteira — ver `.ds-range--faixa` em Input.css. */
  className?: string;
}) {
  const field = useFieldState();
  const hintId = useId();

  return (
    <div className={['ds-range', className ?? ''].filter(Boolean).join(' ')}>
      <Input
        aria-label={from.label}
        aria-describedby={field?.describedBy}
        data-testid={from['data-testid']}
        value={from.value}
        onValueChange={from.onValueChange}
        placeholder={from.placeholder}
        prefix={prefix}
        suffix={suffix}
        inputMode={inputMode}
        disabled={disabled}
      />

      {/*
        O separador é decoração para quem escuta: o nome de cada caixa já diz
        "mínimo" e "máximo". Para quem lê, ele é o que transforma duas caixas
        soltas numa faixa.
      */}
      <span className="ds-range__sep" aria-hidden="true" id={hintId}>
        {separator}
      </span>

      <Input
        aria-label={to.label}
        aria-describedby={field?.describedBy}
        data-testid={to['data-testid']}
        value={to.value}
        onValueChange={to.onValueChange}
        placeholder={to.placeholder}
        prefix={prefix}
        suffix={suffix}
        inputMode={inputMode}
        disabled={disabled}
      />
    </div>
  );
}
