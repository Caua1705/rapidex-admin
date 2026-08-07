import type { ReactNode } from 'react';

import { useSession } from '../auth/session-context';
import { RapidexLogo } from '../ui/RapidexLogo';
import './AppShell.css';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  attendant: 'Atendente',
};

/** Moldura de todas as telas autenticadas: barra do topo + conteúdo. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, restaurantLabel, signOut } = useSession();

  return (
    <div className="shell">
      <header className="shell__bar">
        <RapidexLogo />

        <span className="shell__divider" />
        <span className="shell__restaurant" title="Estabelecimento da sessão">
          {restaurantLabel}
        </span>

        <div className="shell__spacer" />

        <span className="shell__user">
          {user?.name}
          <span className="faint"> · {ROLE_LABELS[user?.role ?? ''] ?? user?.role}</span>
        </span>
        <button type="button" className="btn btn--sm" onClick={signOut}>
          Sair
        </button>
      </header>

      <main className="shell__content">{children}</main>
    </div>
  );
}
