import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useSession } from '../auth/session-context';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
import { BranchSelector } from './BranchSelector';
import './AppShell.css';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  attendant: 'Atendente',
};

/**
 * Moldura de todas as telas autenticadas: navegação lateral + barra do topo.
 *
 * A lateral tem largura fixa de 240px no desktop e colapsa para uma trilha de
 * ícones em telas estreitas — sem drawer, sem estado: no meio do turno, um
 * menu que precisa ser aberto para trocar de tela é um clique a mais em cada
 * troca.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();

  return (
    <div className="shell">
      <nav className="shell__nav" aria-label="Seções do painel">
        <div className="shell__brand">
          <RapidexLogo size={26} />
        </div>

        <NavItem to="/pedidos" label="Pedidos" icon={<OrdersIcon />} />
        <NavItem to="/cardapio" label="Cardápio" icon={<MenuIcon />} />
        <NavItem to="/minha-loja" label="Minha loja" icon={<StoreIcon />} />
        {/*
          A Cozinha é uma tela cheia, sem esta lateral. O link continua aqui
          porque é daqui que o lojista a abre no começo do turno — o que ela não
          tem é volta pela navegação, e sim o "Sair da cozinha" no próprio canto.
        */}
        <NavItem to="/cozinha" label="Cozinha" icon={<KitchenIcon />} />
      </nav>

      <div className="shell__main">
        <header className="shell__bar">
          {/* O nome do estabelecimento agora sai daqui: o seletor já o mostra,
              e dois lugares dizendo a mesma coisa ocupavam a barra à toa. */}
          <BranchSelector />

          <div className="shell__spacer" />

          <span className="shell__user">
            {user?.name}
            <span className="faint"> · {ROLE_LABELS[user?.role ?? ''] ?? user?.role}</span>
          </span>
          <ThemeToggle />
          <button type="button" className="btn btn--sm" onClick={signOut}>
            Sair
          </button>
        </header>

        <main className="shell__content">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `shell__link${isActive ? ' shell__link--active' : ''}`}
      title={label}
    >
      <span className="shell__link-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="shell__link-label">{label}</span>
    </NavLink>
  );
}

function OrdersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19h16M4 5h16M9 5v14M15 5v14" />
    </svg>
  );
}

/** Toldo de loja: o traço de 2px e a grade de 24px do resto do conjunto. */
function StoreIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18l-1.4-4.2A1 1 0 0 0 18.6 4H5.4a1 1 0 0 0-1 .8L3 9Z" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

/** Panela com a alça — a cozinha, não o cardápio. */
function KitchenIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10h16v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-5Z" />
      <path d="M19 11h1.5a1.5 1.5 0 0 1 0 3H19" />
      <path d="m7 7 1-3M12 7l1-3M17 7l1-3" />
    </svg>
  );
}
