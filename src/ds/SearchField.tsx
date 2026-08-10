import { useId } from 'react';

import { useFieldState } from './field-context';
import { SearchIcon, XIcon } from './icons';
import './Input.css';

/**
 * Campo de busca.
 *
 *   <SearchField
 *     label="Buscar item nesta categoria"
 *     value={busca}
 *     onValueChange={setBusca}
 *   />
 *
 * Ele NÃO usa `<Field>`: numa barra de filtros o rótulo visível seria uma
 * segunda linha em cima de cada campo, e o que a busca precisa é caber na
 * altura de um controle. O rótulo existe, invisível, ligado ao input — quem
 * escuta a tela ouve "Buscar item nesta categoria", quem lê vê a lupa.
 *
 * O botão de limpar só existe quando há o que limpar, entra na ordem de
 * tabulação e devolve o foco ao campo — limpar a busca e ficar sem foco em
 * lugar nenhum é como o teclado se perde.
 */
export function SearchField({
  label,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  id,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const field = useFieldState();
  const generated = useId();
  const controlId = id ?? field?.controlId ?? generated;

  return (
    <span className={`ds-control ds-control--search${disabled ? ' ds-control--disabled' : ''}`}>
      <label className="sr-only" htmlFor={controlId}>
        {label}
      </label>

      <span className="ds-control__icon" aria-hidden="true">
        <SearchIcon />
      </span>

      <input
        id={controlId}
        className="ds-control__input"
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={field?.describedBy}
        onChange={(event) => onValueChange(event.target.value)}
      />

      {value !== '' && !disabled ? (
        <button
          type="button"
          className="ds-control__clear"
          aria-label="Limpar a busca"
          onClick={() => {
            onValueChange('');
            document.getElementById(controlId)?.focus();
          }}
        >
          <XIcon />
        </button>
      ) : null}
    </span>
  );
}
