import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { ROTA_DA_TROCA_DE_SENHA } from '../auth/RequireAuth';
import { ErrorBoundary } from '../erro/ErrorBoundary';
import { roleLabel } from '../auth/role-labels';
import { useSession } from '../auth/session-context';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
import { BottomBar } from './BottomBar';
import { BranchSelector } from './BranchSelector';
import { EstablishmentBadge } from './EstablishmentBadge';
import { type NavEntry } from './nav';
import { useNavGroups } from './use-nav';
import './AppShell.css';

/**
 * A moldura de todas as telas autenticadas.
 *
 * ELA MUDA DE FORMA TRÊS VEZES, e a regra é sempre a mesma: a informação não
 * desaparece, ela troca de lugar.
 *
 *   ≥1180  lateral de 232px, com os nomes e os grupos escritos
 *   768–1179  lateral recolhida em trilha de ícones (72px), grupos separados
 *             por vão; o nome vive no `title` e no leitor de tela
 *   <768   a lateral sai da tela e vira barra INFERIOR de quatro alvos, com
 *          "Mais" abrindo o resto num folha (ver `BottomBar`)
 *
 * O que NÃO acontece em nenhum tamanho é `display: none` numa seção: esconder
 * é o que faz alguém procurar no celular o que só existe no desktop.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();
  /*
   * A LISTA JÁ CHEGA RECORTADA PELO PAPEL — ver `use-nav.ts`. Item que leva a
   * uma tela que responde 403 não é navegação, é convite a um beco.
   */
  const navGroups = useNavGroups();
  /*
   * SÓ PARA A BORDA DE ERRO. Ela é remontada a cada rota (`key`), e é isso que
   * a faz esquecer o erro da tela anterior — sem a chave, o React guarda o
   * estado de erro do componente e a próxima seção nasceria quebrada também,
   * fazendo o painel inteiro parecer perdido por causa de uma tela.
   */
  const { pathname } = useLocation();
  const initials = user?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <nav className="shell__nav" aria-label="Seções do painel">
        <div className="shell__brand">
          <RapidexLogo size={22} />
        </div>

        {/*
          A FERRAMENTA EM CIMA, O CLIENTE EMBAIXO, com um fio entre os dois.

          É a ordem que o mercado usa e ela não é convenção à toa: acima do fio
          está de quem é o painel (e de quem é o suporte); abaixo, de quem é a
          operação — a identificação e, em seguida, as seções que mexem nela.
          Trocar a ordem faria o painel parecer do restaurante, que é
          justamente o que ele não é.
        */}
        <EstablishmentBadge />

        {navGroups.map((group) => {
          /*
            O VÃO ANTES DO PRIMEIRO "EM BREVE".

            `nav.ts` já garante que o que não existe afunda para o fim do
            grupo; aqui o vão diz isso com os olhos. É um índice e não um
            seletor CSS porque o alvo é o PRIMEIRO pendente e mais nenhum — e
            marcar "o primeiro de uma classe" em CSS custaria um `:has` para
            economizar duas linhas de leitura.
          */
          const primeiroPendente = group.entries.findIndex((entry) => entry.soon !== undefined);

          return (
            <div
              className={`shell__group${group.rodape ? ' shell__group--rodape' : ''}`}
              key={group.title}
            >
              {/*
                O rótulo do grupo é `aria-hidden` porque ele já é o nome
                acessível da lista logo abaixo: sem isso, o leitor de tela diz
                "Hoje" duas vezes seguidas ao entrar no grupo.

                NO PÉ ELE NÃO É PINTADO — quem separa ali é o fio e a posição
                (ver `NavGroup.rodape`) —, mas ele CONTINUA no `aria-label` da
                lista logo abaixo. Um bloco de quatro links sem nome nenhum é
                um bloco mudo para quem não vê o fio.
              */}
              {group.rodape ? null : (
                <p className="t-label shell__group-title" aria-hidden="true">
                  {group.title}
                </p>
              )}
              <ul aria-label={group.title}>
                {group.entries.map((entry, i) => (
                  <li
                    key={entry.to}
                    className={i === primeiroPendente ? 'shell__item--em-breve' : undefined}
                  >
                    <NavItem entry={entry} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shell__main">
        <header className="shell__bar">
          <BranchSelector />

          <div className="shell__spacer" />

          <div className="shell__account">
            {/*
              NO CELULAR NÃO HÁ LATERAL, e a identificação vem para cá — para o
              grupo da CONTA, no lado direito da barra, e não para junto do
              seletor de filial na esquerda. Ver `EstablishmentBadge` para o
              porquê do lado. Em 768px para cima ela some daqui, porque a
              lateral voltou a mostrá-la.
            */}
            <EstablishmentBadge variant="barra" />

            <span className="shell__avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="shell__user">
              <strong>{user?.name}</strong>
              <span>{roleLabel(user?.role)}</span>
            </span>
            <span className="shell__account-divider" aria-hidden="true" />

            {/*
              TROCAR A PRÓPRIA SENHA MORA NO GRUPO DA CONTA, ao lado de "Sair" —
              e não numa seção do painel. Ela não é uma tela do restaurante: é
              uma coisa que se faz com a própria credencial, como sair.

              A tela de Usuários é do DONO e trata da senha dos OUTROS. Esta é de
              todo mundo e trata da sua — e é o que fecha o buraco de quem
              desconfia do próprio vazamento: sem ela, a única forma de trocar a
              senha do dono seria alguém redefini-la para ele, e não há alguém.

              ABAIXO DE 768px ELA SAI DAQUI e reaparece na folha do "Mais" (ver
              `BottomBar`): a barra do telefone já carrega a identificação, o
              tema e o "Sair", e um quarto controle de texto ali espremeria os
              três. A regra do shell é a de sempre — a informação não some, ela
              troca de lugar.
            */}
            <NavLink to={ROTA_DA_TROCA_DE_SENHA} className="shell__senha">
              Trocar senha
            </NavLink>

            <ThemeToggle />
            <button type="button" className="shell__sair" onClick={signOut}>
              Sair
            </button>
          </div>
        </header>

        <main className="shell__content" id="conteudo">
          {/*
            A BORDA FICA AQUI DENTRO, e não em volta do `<AppShell>`, porque é
            essa posição que preserva o resto: um defeito no Cardápio deixa a
            lateral, a barra do topo e as outras oito seções DE PÉ, e a pessoa
            navega para outro lugar e continua trabalhando. Envolvendo a moldura,
            um erro em qualquer tela apagaria o painel — que é exatamente o que
            acontecia antes de existir borda nenhuma.
          */}
          <ErrorBoundary escopo="tela" key={pathname}>
            {children}
          </ErrorBoundary>
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
