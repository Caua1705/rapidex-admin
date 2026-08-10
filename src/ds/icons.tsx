import type { ReactNode } from 'react';

/**
 * Os ícones do design system.
 *
 *   <SearchIcon />
 *   <ChevronDownIcon size={14} />
 *
 * Conjunto autoral de linha: traço de 2px, grade de 24px, cantos arredondados,
 * `stroke="currentColor"` e `fill="none"`. Todos saem `aria-hidden` — ícone é
 * desenho, e quem carrega o significado é o texto ou o `aria-label` de quem o
 * usa. Ícone com nome acessível próprio faz o leitor de tela dizer a mesma
 * coisa duas vezes.
 */
type IconProps = { size?: number };

function Icon({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 15 6-6 6 6" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/** Três pontos: o que não coube na barra, e não "outras coisas quaisquer". */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.01v.01M12 12v.01M12 17.99v.01" />
    </Icon>
  );
}
