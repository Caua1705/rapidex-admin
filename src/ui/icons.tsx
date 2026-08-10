/**
 * Ícones de linha do design system: traço de 2px, grade de 24px, cantos
 * arredondados. Autorais porque nenhuma biblioteca foi fornecida — se a marca
 * adotar uma (Lucide, Phosphor), a troca mantém o traço de 2px para não mudar
 * a densidade visual do painel.
 */
import type { ReactNode } from 'react';

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
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/** Três pontinhos: o menu de ações que não são a ação principal da tela. */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.01v.01M12 12v.01M12 17.99v.01" />
    </Icon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
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

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 15 6-6 6 6" />
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

/* --- ícones da navegação -------------------------------------------------
 *
 * Um por seção do produto. Todos na mesma grade de 24px e no mesmo traço de
 * 2px: numa coluna de onze itens, um ícone com peso diferente puxa o olho para
 * a seção errada.
 */

/** Lista de pedidos. */
export function OrdersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h7" />
    </Icon>
  );
}

/** Cardápio: as duas colunas de uma carta aberta. */
export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19h16M4 5h16M9 5v14M15 5v14" />
    </Icon>
  );
}

/** Panela com a alça — a cozinha, não o cardápio. */
export function KitchenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10h16v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-5Z" />
      <path d="M19 11h1.5a1.5 1.5 0 0 1 0 3H19" />
      <path d="m7 7 1-3M12 7l1-3M17 7l1-3" />
    </Icon>
  );
}

/** Toldo de loja. */
export function StoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18l-1.4-4.2A1 1 0 0 0 18.6 4H5.4a1 1 0 0 0-1 .8L3 9Z" />
      <path d="M9 20v-6h6v6" />
    </Icon>
  );
}

/** Clientes: uma pessoa e a sombra da segunda. */
export function CustomersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.5 14.4A6 6 0 0 1 21 20" />
    </Icon>
  );
}

/** Cupom: o bilhete com o furo do picote. */
export function CouponIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v2a2 2 0 0 0 0 3v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2 2 0 0 0 0-3v-2Z" />
      <path d="M14 9.5v1M14 13.5v1" />
    </Icon>
  );
}

/** Cashback: a moeda que volta. */
export function CashbackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M15 9.5a3.5 3.5 0 1 0 0 5" />
      <path d="M4.5 6.5v3h3" />
    </Icon>
  );
}

/** Desempenho: barras subindo. */
export function PerformanceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-5M13 20v-9M18 20v-13" />
    </Icon>
  );
}

/**
 * Usuários do painel: o crachá.
 *
 * Não são duas pessoas como em Clientes — quem entra aqui administra QUEM tem
 * acesso, e dois ícones de gente na mesma coluna virariam a mesma seção.
 */
export function TeamIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9.5" cy="10.5" r="2" />
      <path d="M6 16a3.5 3.5 0 0 1 7 0" />
      <path d="M15.5 10h3M15.5 13.5h3" />
    </Icon>
  );
}

/** Conversa: o canal de mensagem com o cliente. */
export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12Z" />
      <path d="M9 11.5v.01M12 11.5v.01M15 11.5v.01" />
    </Icon>
  );
}

/** Integrações: dois blocos ligados. */
export function IntegrationsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="M10.5 7h4a2.5 2.5 0 0 1 2.5 2.5v4" />
      <path d="M13.5 17h-4A2.5 2.5 0 0 1 7 14.5v-4" />
    </Icon>
  );
}
