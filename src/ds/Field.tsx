import { useId, type ReactNode } from 'react';

import { FieldContext } from './field-context';
import './Field.css';

/**
 * O envelope de todo campo: rótulo, controle, ajuda e erro.
 *
 *   <Field label="Valor mínimo do pedido" hint="Abaixo disso o cliente não fecha o pedido.">
 *     <Input prefix="R$" value={valor} onChange={setValor} inputMode="decimal" />
 *   </Field>
 *
 *   <Field label="Latitude" error="Precisa ficar entre -90 e 90.">
 *     <Input value={lat} onChange={setLat} />
 *   </Field>
 *
 * POR QUE ELE EXISTE: a ligação entre rótulo, ajuda, erro e controle é a parte
 * do formulário que mais some quando cada tela monta o seu à mão — e é
 * exatamente ela que o leitor de tela usa. Aqui a ligação é feita uma vez:
 *
 *   - o rótulo aponta para o controle (`htmlFor` / `id`);
 *   - ajuda e erro entram no `aria-describedby` do controle;
 *   - o erro marca o controle como inválido (`aria-invalid`) e é anunciado.
 *
 * O controle não precisa saber de nada disso: ele lê o contexto.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  /**
   * Some com o rótulo VISUAL, mantendo-o para o leitor de tela. Só para o
   * caso em que a coluna inteira já tem cabeçalho — nunca "porque ficou feio".
   */
  hideLabel = false,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  children: ReactNode;
}) {
  const base = useId();
  const controlId = `${base}-control`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  const invalid = Boolean(error);
  const describedBy =
    [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ controlId, describedBy, invalid, disabled }}>
      <div className={`ds-field${disabled ? ' ds-field--disabled' : ''}`}>
        <label className={hideLabel ? 'sr-only' : 'ds-field__label'} htmlFor={controlId}>
          {label}
          {/*
            O asterisco é enfeite para quem lê a tela e nada para quem a escuta.
            A palavra "obrigatório" entra no nome acessível do rótulo, e o
            controle recebe `required` de verdade.
          */}
          {required ? (
            <>
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> (obrigatório)</span>
            </>
          ) : null}
        </label>

        {children}

        {hint ? (
          <p className="ds-field__hint" id={hintId}>
            {hint}
          </p>
        ) : null}

        {/*
          O erro é anunciado quando aparece, sem roubar o foco de quem está
          digitando — `polite`, não `assertive`. Quem manda o foco para o
          primeiro campo inválido é o `onSubmit` do formulário.
        */}
        {invalid ? (
          <p className="ds-field__error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/**
 * Uma linha de campos irmãos — dois ou três lado a lado dentro de uma seção.
 *
 *   <FieldRow>
 *     <Field label="Cidade">…</Field>
 *     <Field label="Estado">…</Field>
 *   </FieldRow>
 */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="ds-field-row">{children}</div>;
}
