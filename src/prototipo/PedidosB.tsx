import { useState } from 'react';

import { PrototipoSwitcher } from './PrototipoSwitcher';
import {
  AlertaIcon,
  BuscaIcon,
  CardapioIcon,
  ClientesIcon,
  CozinhaIcon,
  DesempenhoIcon,
  LojaIcon,
  MotoIcon,
  PeIcon,
  PedidosIcon,
  RelogioIcon,
  SetaIcon,
} from './icones';
import {
  JANELA_MINUTOS,
  ORDEM_ESTAGIOS,
  atrasado,
  brl,
  contagem,
  decorrido,
  grupos,
  tituloDe,
  type ProtoEstagio,
  type ProtoPedido,
} from './pedidos-exemplo';
import '@fontsource-variable/plus-jakarta-sans';
import './PedidosB.css';

/**
 * DIREÇÃO B — APP.
 *
 * A aposta: O ESTÁGIO É LUGAR, NÃO RÓTULO. Em vez de faixas empilhadas com um
 * título cada, o quadro é de colunas: um pedido está "em preparo" porque está
 * NA coluna de preparo, e o cabeçalho da coluna já é o contador. O ícone faz o
 * trabalho que a palavra fazia — a moto e a pessoa a pé são lidas de longe,
 * "Entrega"/"Retirada" não são.
 *
 * COMO ELA RESOLVE OS TRÊS PROBLEMAS:
 *
 *   1. Preâmbulo — não há título de página nem subtítulo. A tela se chama
 *      Pedidos porque é o item aceso na lateral; repetir isso no conteúdo é
 *      pagar 90px para dizer onde a pessoa já sabe que está.
 *   2. Filtro — uma faixa de 44px sem moldura, sem fundo e sem borda: busca em
 *      pílula, período em pílulas, estado da conexão. Ferramenta encostada na
 *      régua do topo, não cartão no meio do conteúdo.
 *   3. Agrupamento — COLUNA VAZIA NÃO É DESENHADA, e as que sobram se abrem
 *      para ocupar a largura. O contador dos quatro estágios, zerados
 *      incluídos, mora nas pílulas da faixa de cima: "Prontos 0" continua
 *      dito, sem gastar uma coluna para dizê-lo.
 *
 * O que ela sacrifica está no comentário do rodapé deste arquivo.
 */
export function PedidosB() {
  const [selecionado, setSelecionado] = useState<string | null>('p1');
  const [periodo, setPeriodo] = useState('hoje');
  const colunas = grupos();
  const contagens = contagem();

  return (
    <div className="pb">
      <nav className="pb__lateral" aria-label="Seções do painel">
        <div className="pb__marca">
          <span className="pb__selo" aria-hidden="true">
            R
          </span>
          Rapidex
        </div>

        <div className="pb__loja">
          <span className="pb__loja-nome">Aldeota</span>
          <span className="pb__loja-estado">
            <i aria-hidden="true" />
            Aberta agora
          </span>
        </div>

        <LateralGrupo titulo="Operação">
          <LateralItem ativo Icon={PedidosIcon} contador={11}>
            Pedidos
          </LateralItem>
          <LateralItem Icon={CozinhaIcon}>Cozinha</LateralItem>
        </LateralGrupo>

        <LateralGrupo titulo="Catálogo">
          <LateralItem Icon={CardapioIcon}>Cardápio</LateralItem>
        </LateralGrupo>

        <LateralGrupo titulo="Crescimento">
          <LateralItem Icon={ClientesIcon}>Clientes</LateralItem>
          <LateralItem Icon={DesempenhoIcon}>Desempenho</LateralItem>
        </LateralGrupo>

        <LateralGrupo titulo="Configurações">
          <LateralItem Icon={LojaIcon}>Minha loja</LateralItem>
        </LateralGrupo>

        <div className="pb__conta">
          <span className="pb__avatar" aria-hidden="true">
            CC
          </span>
          <span>
            <strong>Cauã Carvalho</strong>
            <small>Proprietário</small>
          </span>
        </div>
      </nav>

      <main className="pb__main">
        {/*
          A FAIXA DE FERRAMENTAS. 44px, sem moldura. As pílulas de estágio à
          esquerda são o contador COMPLETO — inclusive o estágio zerado, que
          por isso não precisa de coluna lá embaixo.
        */}
        <div className="pb__ferramentas">
          <div className="pb__pilulas">
            {ORDEM_ESTAGIOS.map((estagio) => (
              <span
                key={estagio}
                className="pb__pilula"
                data-e={estagio}
                data-zero={contagens[estagio] === 0 || undefined}
              >
                {tituloDe(estagio)}
                <b>{contagens[estagio]}</b>
              </span>
            ))}
          </div>

          <label className="pb__busca">
            <BuscaIcon size={17} peso={2} />
            <input type="search" placeholder="Buscar pedido, cliente ou telefone" />
          </label>

          <div className="pb__periodo" role="group" aria-label="Período">
            {[
              ['hoje', 'Hoje'],
              ['ontem', 'Ontem'],
              ['7d', '7 dias'],
            ].map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                className="pb__periodo-opt"
                aria-pressed={periodo === valor}
                onClick={() => setPeriodo(valor as string)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <span className="pb__vivo">
            <i aria-hidden="true" />
            Ao vivo
          </span>
        </div>

        <div className="pb__quadro" data-colunas={colunas.length}>
          {colunas.map((coluna) => (
            <section key={coluna.estagio} className="pb__coluna" data-e={coluna.estagio}>
              <header className="pb__coluna-topo">
                <span className="pb__coluna-nome">{coluna.titulo}</span>
                <span className="pb__coluna-conta">{coluna.pedidos.length}</span>
              </header>

              <div className="pb__cartoes">
                {coluna.pedidos.map((pedido) => (
                  <CartaoB
                    key={pedido.id}
                    pedido={pedido}
                    selecionado={selecionado === pedido.id}
                    onSelecionar={() => setSelecionado(pedido.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <PrototipoSwitcher atual="b" />
    </div>
  );
}

const ACOES: Record<ProtoEstagio, string> = {
  novo: 'Aceitar pedido',
  preparo: 'Marcar pronto',
  pronto: 'Despachar',
  rua: 'Concluir',
};

function CartaoB({
  pedido,
  selecionado,
  onSelecionar,
}: {
  pedido: ProtoPedido;
  selecionado: boolean;
  onSelecionar: () => void;
}) {
  const tarde = atrasado(pedido);
  const trava = pedido.pagamento === 'pendente';
  const Modal = pedido.modalidade === 'entrega' ? MotoIcon : PeIcon;

  return (
    <article
      className="pb__cartao"
      data-e={pedido.estagio}
      data-tarde={tarde || undefined}
      data-trava={trava || undefined}
      data-sel={selecionado || undefined}
      onClick={onSelecionar}
    >
      <div className="pb__cartao-topo">
        {/*
          O CRONÔMETRO É O MAIOR OBJETO DO CARTÃO e ele muda de cor sozinho —
          é a única coisa que precisa ser lida do outro lado da cozinha.
        */}
        <span className="pb__tempo">
          <RelogioIcon size={15} peso={2.1} />
          {decorrido(pedido.minutos)}
          {tarde ? <em>+{pedido.minutos - JANELA_MINUTOS}</em> : null}
        </span>
        <span className="pb__numero">#{pedido.numero}</span>
      </div>

      <p className="pb__cliente">{pedido.cliente}</p>
      <p className="pb__resumo">{pedido.resumo}</p>

      <div className="pb__marcas">
        <span className="pb__marca-item" data-m={pedido.modalidade}>
          <Modal size={17} peso={2} />
          {pedido.modalidade === 'entrega' ? pedido.destino : 'Retirada no balcão'}
        </span>
        <span className="pb__marca-item" data-pg={pedido.pagamento}>
          {pedido.formaPagamento}
          {pedido.pagamento === 'pago' ? ' · pago' : null}
          {pedido.pagamento === 'na-entrega' ? ' · na entrega' : null}
        </span>
        <span className="pb__valor">{brl(pedido.total)}</span>
      </div>

      {/*
        A TRAVA DE PAGAMENTO É UMA FAIXA, não uma etiqueta a mais. Ela ocupa a
        largura toda porque o que ela diz não é um atributo do pedido — é uma
        proibição: a cozinha não começa.
      */}
      {trava ? (
        <p className="pb__trava">
          <AlertaIcon size={16} peso={2.1} />
          Aguardando pagamento — não preparar
        </p>
      ) : (
        <button type="button" className="pb__acao">
          {ACOES[pedido.estagio]}
          <SetaIcon size={16} peso={2.1} />
        </button>
      )}
    </article>
  );
}

function LateralGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="pb__grupo">
      <p className="pb__grupo-titulo">{titulo}</p>
      <ul>{children}</ul>
    </div>
  );
}

function LateralItem({
  children,
  ativo,
  contador,
  Icon,
}: {
  children: React.ReactNode;
  ativo?: boolean;
  contador?: number;
  Icon: (props: { size?: number; peso?: number }) => React.ReactElement;
}) {
  return (
    <li>
      <a className="pb__link" data-ativo={ativo || undefined} href="#conteudo">
        <Icon size={19} peso={1.9} />
        <span>{children}</span>
        {contador !== undefined ? <b>{contador}</b> : null}
      </a>
    </li>
  );
}

/*
 * O QUE A DIREÇÃO B SACRIFICA.
 *
 * - PEDIDO POR TELA. Cada cartão custa ~150px de altura; em 1440×900 cabem
 *   cerca de quatro por coluna. Numa sexta à noite com doze em preparo, a
 *   coluna rola — e rolar no pico é a pior coisa que um painel pede.
 * - AS COLUNAS ANDAM DE LUGAR. Como a coluna vazia não é desenhada, o quadro
 *   se reorganiza quando um estágio zera: o que estava no terço do meio pula
 *   para a esquerda. É o preço de não gastar largura com o vazio, e é um preço
 *   de verdade para quem usa memória muscular.
 * - MUITA SUPERFÍCIE. Cartão, sombra, raio de 16px e ícone em toda linha: é o
 *   que faz a tela ser entendida sem treinamento, e é também o que a faz
 *   parecer menos um instrumento e mais um aplicativo de consumidor.
 */
