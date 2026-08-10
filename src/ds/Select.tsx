import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { useFieldState } from './field-context';
import { CheckIcon, ChevronDownIcon } from './icons';
import { Spinner } from './Spinner';
import './Select.css';

/**
 * Seletor. Botão + lista flutuante — nunca um `<select>` nativo.
 *
 *   <Field label="Categoria">
 *     <Select
 *       value={categoriaId}
 *       onChange={setCategoriaId}
 *       options={[
 *         { value: 'cat-1', label: 'Lanches' },
 *         { value: 'cat-2', label: 'Acompanhamentos', hint: '12 itens' },
 *       ]}
 *     />
 *   </Field>
 *
 * POR QUE NÃO O NATIVO: o `<select>` abre o menu do sistema operacional. Ele
 * não aceita a tipografia, nem o raio, nem o tom das superfícies do painel, e
 * denuncia na hora que a tela não foi desenhada. O preço de trocá-lo é ter de
 * reimplementar o teclado — e é isso que este arquivo faz, inteiro:
 *
 *   ↓ / ↑        andam pelas opções (tabindex rotativo: só a ativa é focável)
 *   Home / End   primeira e última
 *   Enter/Espaço escolhem e fecham
 *   Esc          fecha SEM escolher e devolve o foco ao gatilho
 *   Tab          fecha
 *   clique fora  fecha
 *
 * A opção escolhida leva um check — `aria-selected` sozinho é invisível para
 * quem enxerga, e a cor de fundo sozinha não passa em 1.4.1.
 */
export type SelectOption = {
  value: string;
  label: string;
  /** Detalhe à direita: contagem, unidade, o que ajuda a escolher. */
  hint?: string;
  disabled?: boolean;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Escolher…',
  disabled = false,
  loading = false,
  invalid,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Ocupado: a lista ainda está vindo, ou a escolha está sendo gravada. */
  loading?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const field = useFieldState();
  const generated = useId();
  const listId = `${generated}-lista`;
  const controlId = id ?? field?.controlId ?? `${generated}-gatilho`;
  const isInvalid = invalid ?? field?.invalid ?? false;
  const isDisabled = disabled || field?.disabled || loading;

  const [open, setOpen] = useState(false);
  /** Qual opção está sob o cursor do teclado. -1 = nenhuma ainda. */
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback((devolverFoco: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    // Sem isto, quem fechou com Esc é largado no fim do documento.
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  function abrir() {
    if (isDisabled) return;
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }

  /** Anda pela lista pulando o que está desabilitado. */
  function mover(from: number, step: number) {
    const total = options.length;
    for (let i = 1; i <= total; i += 1) {
      const next = (from + step * i + total * total) % total;
      if (!options[next]?.disabled) return next;
    }
    return from;
  }

  function escolher(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  }

  // Escape e clique fora. Só escutam enquanto a lista está aberta.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      close(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  /*
   * TABINDEX ROTATIVO: uma opção focável por vez, e o foco de verdade vai para
   * ela. É o que faz o leitor de tela anunciar "opção 3 de 7, Lanches,
   * selecionada" sem precisarmos narrar nada à mão.
   */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => mover(current, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => mover(current, -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(mover(-1, 1));
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(mover(options.length, -1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      escolher(activeIndex);
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  return (
    <div className="ds-select" ref={rootRef}>
      <button
        type="button"
        id={controlId}
        ref={triggerRef}
        className={[
          'ds-control',
          'ds-select__trigger',
          isInvalid ? 'ds-control--invalid' : '',
          isDisabled ? 'ds-control--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={isInvalid || undefined}
        aria-busy={loading || undefined}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        onClick={() => (open ? close(false) : abrir())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            abrir();
          }
        }}
      >
        <span className={`ds-select__value${selected ? '' : ' ds-select__value--empty'}`}>
          {selected?.label ?? placeholder}
        </span>

        {loading ? (
          <Spinner />
        ) : (
          <span className="ds-select__chevron" aria-hidden="true">
            <ChevronDownIcon size={14} />
          </span>
        )}
      </button>

      {open ? (
        <ul
          className="ds-select__list"
          id={listId}
          role="listbox"
          aria-labelledby={controlId}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                tabIndex={index === activeIndex ? 0 : -1}
                className={[
                  'ds-select__option',
                  isSelected ? 'ds-select__option--selected' : '',
                  option.disabled ? 'ds-select__option--disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => escolher(index)}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
              >
                {/*
                  O check é a FORMA que acompanha o estado. Sem ele, a escolha
                  seria só um fundo diferente — e fundo diferente é cor sozinha.
                */}
                <span className="ds-select__check" aria-hidden="true">
                  {isSelected ? <CheckIcon size={14} /> : null}
                </span>
                <span className="ds-select__label">{option.label}</span>
                {option.hint ? <span className="ds-select__hint">{option.hint}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
