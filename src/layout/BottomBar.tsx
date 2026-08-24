import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { ROTA_DA_TROCA_DE_SENHA } from '../auth/RequireAuth';
import { Sheet } from '../ds/Sheet';
import { MoreIcon } from '../ds/icons';
import { type NavEntry } from './nav';
import { useNavGroups } from './use-nav';

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

  /*
   * A LISTA JÁ CHEGA RECORTADA PELO PAPEL. Com o atendente, "Clientes" não está
   * em `todos`, então não está nem entre os quatro do rodapé nem dentro de
   * "Mais" — e a folha do "Mais" não abre com um item que leva a um 403.
   */
  const navGroups = useNavGroups();
  const todos = navGroups.flatMap((group) => group.entries);
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
        {navGroups.map((group) => {
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

        {/*
          A CONTA ENTRA NA FOLHA, e não na lista de seções.
          "Trocar senha" vive no grupo da conta da barra do topo — e ali ela
          some abaixo de 768px, onde a barra já carrega a identificação, o tema
          e o "Sair". A regra do shell é que a informação não desaparece: ela
          troca de lugar, e este é o lugar dela no telefone.

          "Sair" NÃO se repete aqui: ele continua na barra do topo em todos os
          tamanhos, e um segundo caminho para encerrar a sessão seria o tipo de
          duplicação que faz alguém encerrá-la sem querer.
        */}
        <div className="shell__mais-grupo">
          <p className="t-label">Conta</p>
          <NavLink
            to={ROTA_DA_TROCA_DE_SENHA}
            className="ds-sheet__opcao"
            aria-current={ROTA_DA_TROCA_DE_SENHA === pathname ? 'page' : undefined}
            onClick={() => setMaisAberto(false)}
            data-testid="mais-trocar-senha"
          >
            Trocar minha senha
          </NavLink>
        </div>
      </Sheet>
    </>
  );
}

/** "Minha loja" não cabe embaixo de um ícone de 20px numa tela de 390. */
function rotuloCurto(entry: NavEntry): string {
  return entry.to === '/minha-loja' ? 'Loja' : entry.label;
}
