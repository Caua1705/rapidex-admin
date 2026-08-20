/**
 * Os ícones dos protótipos — desenhados aqui, e não importados de `ds/icons`,
 * porque o design system atual não tem os dois que decidem a leitura de uma
 * modalidade à distância: a moto e a pessoa a pé.
 *
 * Todos aceitam `size` e `peso` (espessura do traço). É por aí que as três
 * direções divergem sem três cópias do mesmo caminho SVG: a Refinada pede fio
 * de cabelo (1.25), o App pede traço gordo e redondo (2), o Console pede o
 * menor tamanho legível.
 */

type Props = { size?: number; peso?: number };

function base(size: number, peso: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: peso,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

/** Entrega — a moto. */
export function MotoIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M8.5 17h7l-3-7H9" />
      <path d="M12.5 10 15 6h3" />
      <path d="M15.5 17 18 9h2.5" />
    </svg>
  );
}

/** Retirada — a pessoa vem a pé até o balcão. */
export function PeIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <circle cx="12.5" cy="4" r="2" />
      <path d="M12.5 8.5 9.5 11l1 4" />
      <path d="M12.5 8.5 15 11l2 1.5" />
      <path d="m10.5 15-2 5" />
      <path d="m12.5 14 2 2 .5 4" />
    </svg>
  );
}

export function RelogioIcon({ size = 16, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function BuscaIcon({ size = 16, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

export function AlertaIcon({ size = 16, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <path d="M12 4.5 21 19H3L12 4.5Z" />
      <path d="M12 10v4" />
      <path d="M12 16.6h.01" />
    </svg>
  );
}

export function CartaoIcon({ size = 16, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10.5h18" />
    </svg>
  );
}

export function SetaIcon({ size = 16, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <path d="M5 12h13" />
      <path d="m13 7 5 5-5 5" />
    </svg>
  );
}

/* ── Navegação. As três lateral/topo desenham a partir daqui. ─────────────── */

export function PedidosIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <path d="M6 4h12l1.5 15.5a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1L6 4Z" />
      <path d="M9 8h6" />
    </svg>
  );
}

export function CozinhaIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <path d="M4 13h16" />
      <path d="M5 13a7 7 0 0 1 14 0" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function CardapioIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function ClientesIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function DesempenhoIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <path d="M4 19h16" />
      <path d="M7 19v-6M12 19V6M17 19v-9" />
    </svg>
  );
}

export function LojaIcon({ size = 18, peso = 1.6 }: Props) {
  return (
    <svg {...base(size, peso)}>
      <path d="M4 9h16l-1 11H5L4 9Z" />
      <path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
    </svg>
  );
}
