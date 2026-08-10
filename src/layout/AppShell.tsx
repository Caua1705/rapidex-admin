import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useSession } from '../auth/session-context';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
import { BranchSelector } from './BranchSelector';
import { NAV_GROUPS, type NavEntry } from './nav';
import './AppShell.css';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  attendant: 'Atendente',
};

/**
 * Moldura de todas as telas autenticadas: navegação lateral + barra do topo.
 *
 * A lateral mostra o PRODUTO INTEIRO, agrupado, e não só o que já foi
 * construído — a lista e os grupos vivem em `nav.tsx`. Ela tem largura fixa e
 * colapsa para uma trilha de ícones em telas estreitas, sem drawer e sem
 * estado: no meio do turno, um menu que precisa ser aberto para trocar de tela
 * é um clique a mais em cada troca.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();

  return (
    <div className="shell">
      <nav className="shell__nav" aria-label="Seções do painel">
        <div className="shell__brand">
          <RapidexLogo size={22} />
        </div>

        {NAV_GROUPS.map((group) => (
          <div className="shell__group" key={group.title}>
            {/*
              Rótulo pequeno e fino, SEM linha divisória: o vão entre grupos já
              separa, e onze itens com quatro réguas no meio viram uma escada.
              Na trilha de ícones ele some da tela mas fica para o leitor.
            */}
            <p className="t-label shell__group-title">{group.title}</p>
            {group.entries.map((entry) => (
              <NavItem key={entry.to} entry={entry} />
            ))}
          </div>
        ))}
      </nav>

      <div className="shell__main">
        <header className="shell__bar">
          {/* O nome do estabelecimento sai daqui: o seletor já o mostra, e dois
              lugares dizendo a mesma coisa ocupavam a barra à toa. */}
          <BranchSelector />

          <div className="shell__spacer" />

          <span className="shell__user">
            {user?.name}
            <span className="faint"> · {ROLE_LABELS[user?.role ?? ''] ?? user?.role}</span>
          </span>
          <ThemeToggle />
          <button type="button" className="btn btn--sm btn--ghost" onClick={signOut}>
            Sair
          </button>
        </header>

        <main className="shell__content">{children}</main>
      </div>
    </div>
  );
}

/**
 * Um item da lateral.
 *
 * O que ainda não existe fica com peso reduzido e ganha a etiqueta "em breve"
 * — mas continua clicável, porque é o clique que responde à pergunta "o painel
 * tem isso?". Escondê-lo faria o lojista procurar em todo canto antes de
 * desistir.
 */
function NavItem({ entry }: { entry: NavEntry }) {
  const pending = entry.soon !== undefined;

  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        [
          'shell__link',
          isActive ? 'shell__link--active' : '',
          pending ? 'shell__link--soon' : '',
        ]
          .filter(Boolean)
          .join(' ')
      }
      title={entry.label}
      data-testid={`nav-${entry.to.replace('/', '')}`}
    >
      <span className="shell__link-icon" aria-hidden="true">
        <entry.Icon />
      </span>
      <span className="shell__link-label">{entry.label}</span>
      {pending ? <span className="shell__link-soon">em breve</span> : null}
    </NavLink>
  );
}
