import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useSession } from '../auth/session-context';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
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
  const { user, restaurantLabel, signOut } = useSession();

  return (
    <div className="shell">
      <nav className="shell__nav" aria-label="Seções do painel">
        <div className="shell__brand">
          <RapidexLogo size={28} />
        </div>

        <NavItem to="/pedidos" label="Pedidos" icon={<OrdersIcon />} />
        <NavItem to="/cardapio" label="Cardápio" icon={<MenuIcon />} />
      </nav>

      <div className="shell__main">
        <header className="shell__bar">
          <span className="shell__restaurant" title="Estabelecimento da sessão">
            {restaurantLabel}
          </span>

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
