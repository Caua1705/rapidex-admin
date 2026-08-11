import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useSession } from '../auth/session-context';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
import { BottomBar } from './BottomBar';
import { BranchSelector } from './BranchSelector';
import { NAV_GROUPS, type NavEntry } from './nav';
import './AppShell.css';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  attendant: 'Atendente',
};

/**
 * A moldura de todas as telas autenticadas.
 *
 * ELA MUDA DE FORMA TRÊS VEZES, e a regra é sempre a mesma: a informação não
 * desaparece, ela troca de lugar.
 *
 *   ≥1024  lateral de 216px, com os nomes e os grupos escritos
 *   640–1023  lateral recolhida em trilha de ícones (56px), grupos separados
 *             por vão; o nome vive no `title` e no leitor de tela
 *   <640   a lateral sai da tela e vira barra INFERIOR de quatro alvos, com
 *          "Mais" abrindo o resto num folha (ver `BottomBar`)
 *
 * O que NÃO acontece em nenhum tamanho é `display: none` numa seção: esconder
 * é o que faz alguém procurar no celular o que só existe no desktop.
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
              O rótulo do grupo é `aria-hidden` porque ele já é o nome
              acessível da lista logo abaixo: sem isso, o leitor de tela diz
              "Operação" duas vezes seguidas ao entrar no grupo.
            */}
            <p className="t-label shell__group-title" aria-hidden="true">
              {group.title}
            </p>
            <ul aria-label={group.title}>
              {group.entries.map((entry) => (
                <li key={entry.to}>
                  <NavItem entry={entry} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shell__main">
        <header className="shell__bar">
          <BranchSelector />

          <div className="shell__spacer" />

          <span className="shell__user t-aux">
            {user?.name}
            <span className="ink-3"> · {ROLE_LABELS[user?.role ?? ''] ?? user?.role}</span>
          </span>
          <ThemeToggle />
          <button type="button" className="shell__sair" onClick={signOut}>
            Sair
          </button>
        </header>

        <main className="shell__content" id="conteudo">
          {children}
        </main>
      </div>

      <BottomBar />
    </div>
  );
}

/**
 * Um item da lateral.
 *
 * O que ainda não existe fica com peso reduzido e ganha a etiqueta "em breve",
 * mas continua CLICÁVEL — é o clique que responde "o painel tem isso?".
 * Escondê-lo faria o lojista procurar em todo canto antes de desistir.
 */
function NavItem({ entry }: { entry: NavEntry }) {
  const pending = entry.soon !== undefined;

  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        ['shell__link', isActive ? 'shell__link--active' : '', pending ? 'shell__link--soon' : '']
          .filter(Boolean)
          .join(' ')
      }
      title={entry.label}
      data-testid={`nav-${entry.to.replace('/', '')}`}
    >
      <span className="shell__link-icon" aria-hidden="true">
        <entry.Icon size={18} />
      </span>
      <span className="shell__link-label">{entry.label}</span>
      {pending ? <span className="shell__link-soon">Em breve</span> : null}
    </NavLink>
  );
}
