import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { ROTA_DA_TROCA_DE_SENHA } from '../auth/RequireAuth';
import { Sheet } from '../ds/Sheet';
import { MoreIcon } from '../ds/icons';
import { useNavGroups } from './use-nav';

/**
 * A navegação do celular: quatro alvos no rodapé, do lado do polegar.
 *
 * POR QUE QUATRO E NÃO DOZE: o rodapé tem a largura da mão, não a do produto.
 * Três destinos cobrem o que se faz com o celular na rua e o quarto — "Mais" —
 * abre uma folha com o resto INTEIRO. Nada é escondido; o que muda é quantos
 * toques custa.
 *
 * POR QUE NÃO UM MENU-SANDUÍCHE NO TOPO: no celular, o topo é onde o polegar
 * não chega, e um menu que precisa ser aberto para trocar de tela é um toque a
 * mais em cada troca — no meio do turno, isso é a diferença entre olhar o
 * pedido e não olhar.
 */
type Principal = {
  /**
   * O item de `nav.ts` que empresta o ícone e, principalmente, o RECORTE POR
   * PAPEL: se o item não chega até este lojista, a aba não nasce.
   */
  deNav: string;
  /**
   * Onde o toque cai — e nem sempre é a tela inteira do item.
   *
   * A barra de baixo carrega AÇÃO, não seção. É a diferença entre ela e a
   * lateral, e é o que autoriza a terceira aba a apontar para dentro de Loja.
   */
  to: string;
  /** O rótulo, quando o destino não é a tela inteira e o nome dela não serve. */
  label?: string;
  testid: string;
};

/**
 * ============================================================================
 * OS TRÊS DO RODAPÉ
 * ============================================================================
 *
 * A TERCEIRA ABA É "OPERAÇÃO", E NÃO "LOJA" — e esta é a decisão que mais muda
 * o telefone nesta rodada.
 *
 * Abrir e fechar a loja, ligar e desligar entrega e retirada: é a coisa que o
 * dono faz com o celular na mão às sete da noite de sábado, e ela morava a dois
 * toques dentro de uma tela de CONFIGURAÇÃO. Apontar a aba direto para
 * `/loja/operacao` é Fitts aplicado ao que importa: o alvo mais barato da tela
 * — 44px, na altura do polegar — passa a carregar a ação mais urgente, em vez
 * do nome do grupo que a contém.
 *
 * ISSO É O QUE PAGA A LISTA DE NOVE SEÇÕES no telefone (ver `StoreIndexPage`).
 * Trocar a fita rolável pela lista custava um toque a mais para chegar em
 * Operação; com Operação no rodapé, não custa nenhum — e as outras oito seções
 * ganharam linhas de 44px no lugar de nove pastilhas numa fita que
 * transbordava.
 *
 * A COZINHA NÃO ENTRA aqui, apesar de estar em "Hoje": ela é um monitor
 * pendurado na parede, lido a dois metros. Ninguém a abre no telefone.
 */
const PRINCIPAIS: readonly Principal[] = [
  { deNav: '/pedidos', to: '/pedidos', testid: 'bottom-pedidos' },
  { deNav: '/cardapio', to: '/cardapio', testid: 'bottom-cardapio' },
  { deNav: '/loja', to: '/loja/operacao', label: 'Operação', testid: 'bottom-operacao' },
];

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
  const principais = PRINCIPAIS.flatMap((principal) => {
    const entry = todos.find((candidate) => candidate.to === principal.deNav);
    return entry ? [{ ...principal, entry }] : [];
  });
  /*
   * QUAL ABA FICA MARCADA.
   *
   * O casamento é por PREFIXO porque as seções de Loja são rotas de verdade:
   * em `/loja/horarios` nada casaria por igualdade, e a barra ficaria sem
   * nenhuma aba marcada — o telefone perderia a única pista de onde está.
   *
   * A exclusão dos destinos das abas é o que impede DUAS marcadas ao mesmo
   * tempo: `/loja/operacao` casa com a aba Operação e casaria também com o
   * prefixo `/loja` da lista.
   */
  const emAba = principais.some((principal) => principal.to === pathname);
  const emMais =
    !emAba && todos.some((entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`));

  return (
    <>
      <nav className="shell__bottom" aria-label="Seções do painel">
        {principais.map((principal) => (
          <NavLink
            key={principal.to}
            to={principal.to}
            className={({ isActive }) => `shell__tab${isActive ? ' shell__tab--ativa' : ''}`}
            data-testid={principal.testid}
          >
            <span className="shell__tab-icone" aria-hidden="true">
              <principal.entry.Icon size={20} />
            </span>
            <span className="shell__tab-nome">{principal.label ?? principal.entry.label}</span>
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
        {/*
          A FOLHA MOSTRA TUDO — inclusive as três telas que já estão na barra.

          Ela mostrava só o RESTO, e isso tinha dois defeitos. O primeiro é que
          o título mentia: "Todas as seções" em cima de um subconjunto. O
          segundo é o que a segunda passagem das capturas pegou — tirando
          Pedidos e Cardápio, o grupo "Hoje" ficava com UM item embaixo de um
          rótulo, que é exatamente o "Cardápio" de um item só que esta rodada
          desmanchou na lateral. A regra não pode valer numa navegação e não
          valer na outra.

          O preço são três linhas repetidas numa folha que rola. O que se ganha
          é a folha ser o MESMO mapa da lateral — mesmos grupos, mesma ordem —,
          e um mapa só é o que se aprende uma vez.
        */}
        {navGroups.map((group) => {
          /*
            O PÉ TEM RÓTULO AQUI, E NÃO TEM NA LATERAL. Não é incoerência: na
            lateral o que diz "isto é outra natureza" é o FIO e a POSIÇÃO — o
            bloco é o último, encostado no fim da lista. Na folha não há pé:
            ela é uma pilha de blocos rolando, todos igualmente longe do
            polegar, e um bloco sem nome no meio dela seria um bloco mudo.
            A informação não some, ela troca de forma.
          */
          return (
            <div className="shell__mais-grupo" key={group.title}>
              <p className="t-label">{group.title}</p>
              {group.entries.map((entry) => (
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
