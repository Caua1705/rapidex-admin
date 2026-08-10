import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Sheet } from '../ds/Sheet';
import { MoreIcon } from '../ds/icons';
import { NAV_GROUPS, type NavEntry } from './nav';

/**
 * A navegação do celular: quatro alvos no rodapé, do lado do polegar.
 *
 * POR QUE QUATRO E NÃO ONZE: o rodapé tem a largura da mão, não a do produto.
 * Três seções cobrem o que se faz com o celular na rua (ver pedido, mexer no
 * cardápio, abrir e fechar a loja) e a quarta — "Mais" — abre uma folha com o
 * resto INTEIRO. Nada é escondido; o que muda é quantos toques custa.
 *
 * POR QUE NÃO UM MENU-SANDUÍCHE NO TOPO: no celular, o topo é onde o polegar
 * não chega, e um menu que precisa ser aberto para trocar de tela é um toque a
 * mais em cada troca — no meio do turno, isso é a diferença entre olhar o
 * pedido e não olhar.
 */
const PRINCIPAIS = ['/pedidos', '/cardapio', '/minha-loja'];

export function BottomBar() {
  const [maisAberto, setMaisAberto] = useState(false);
  const { pathname } = useLocation();

  const todos = NAV_GROUPS.flatMap((group) => group.entries);
  const principais = PRINCIPAIS.flatMap((to) => {
    const found = todos.find((entry) => entry.to === to);
    return found ? [found] : [];
  });
  const restantes = todos.filter((entry) => !PRINCIPAIS.includes(entry.to));

  /* "Mais" fica marcado quando a tela aberta é uma das que moram dentro dele. */
  const emMais = restantes.some((entry) => entry.to === pathname);

  return (
    <>
      <nav className="shell__bottom" aria-label="Seções do painel">
        {principais.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            className={({ isActive }) => `shell__tab${isActive ? ' shell__tab--ativa' : ''}`}
            data-testid={`bottom-${entry.to.replace('/', '')}`}
          >
            <span className="shell__tab-icone" aria-hidden="true">
              <entry.Icon size={20} />
            </span>
            <span className="shell__tab-nome">{rotuloCurto(entry)}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`shell__tab${emMais ? ' shell__tab--ativa' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={maisAberto}
          onClick={() => setMaisAberto(true)}
          data-testid="bottom-mais"
        >
          <span className="shell__tab-icone" aria-hidden="true">
            <MoreIcon size={20} />
          </span>
          <span className="shell__tab-nome">Mais</span>
        </button>
      </nav>

      <Sheet
        open={maisAberto}
        title="Todas as seções"
        onClose={() => setMaisAberto(false)}
        data-testid="sheet-mais"
      >
        {NAV_GROUPS.map((group) => {
          const entradas = group.entries.filter((entry) => !PRINCIPAIS.includes(entry.to));
          if (entradas.length === 0) return null;

          return (
            <div className="shell__mais-grupo" key={group.title}>
              <p className="t-label">{group.title}</p>
              {entradas.map((entry) => (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  className="ds-sheet__opcao"
                  aria-current={entry.to === pathname ? 'page' : undefined}
                  onClick={() => setMaisAberto(false)}
                >
                  <span className="ds-sheet__opcao-icone" aria-hidden="true">
                    <entry.Icon size={18} />
                  </span>
                  {entry.label}
                  {entry.soon ? <span className="ds-sheet__opcao-nota">em breve</span> : null}
                </NavLink>
              ))}
            </div>
          );
        })}
      </Sheet>
    </>
  );
}

/** "Minha loja" não cabe embaixo de um ícone de 20px numa tela de 390. */
function rotuloCurto(entry: NavEntry): string {
  return entry.to === '/minha-loja' ? 'Loja' : entry.label;
}
