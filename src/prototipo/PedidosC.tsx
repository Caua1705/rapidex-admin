import { useState } from 'react';

import { PrototipoSwitcher } from './PrototipoSwitcher';
import { MotoIcon, PeIcon } from './icones';
import {
  JANELA_MINUTOS,
  ORDEM_ESTAGIOS,
  atrasado,
  contagem,
  cronometro,
  grupos,
  num,
  type ProtoEstagio,
  type ProtoPedido,
} from './pedidos-exemplo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './PedidosC.css';

/**
 * DIREÇÃO C — CONSOLE.
 *
 * A aposta: A TELA INTEIRA É A LISTA. Não há lateral, não há painel de
 * detalhe, não há cartão: uma barra de 46px no topo com TUDO — navegação,
 * contadores, período, busca — e daí para baixo só pedido, em linhas de 40px
 * distribuídas em três colunas. Em 1440×900 cabem trinta e poucos pedidos sem
 * rolar; é a direção feita para a sexta-feira à noite.
 *
 * COMO ELA RESOLVE OS TRÊS PROBLEMAS:
 *
 *   1. Preâmbulo — não existe. Nem título, nem subtítulo, nem aba: a barra do
 *      topo é navegação E ferramenta ao mesmo tempo, e o primeiro pedido
 *      começa em 46px, que é onde a barra acaba.
 *   2. Filtro — mora dentro da mesma barra de 46px, sem moldura nenhuma:
 *      período em três teclas, busca com atalho "/", estado da conexão num
 *      ponto. Altura própria: zero.
 *   3. Agrupamento — a faixa de estágio tem 22px, é grudada no topo enquanto
 *      se rola, e SÓ EXISTE SE TIVER PEDIDO. Os quatro contadores, zerados
 *      inclusive, ficam no meio da barra de cima.
 *
 * O que ela sacrifica está no comentário do rodapé deste arquivo.
 */
export function PedidosC() {
  const [selecionado, setSelecionado] = useState<string | null>('p7');
  const [periodo, setPeriodo] = useState('hoje');
  const blocos = grupos();
  const contagens = contagem();

  return (
    <div className="pc">
      <header className="pc__topo">
        <span className="pc__marca">
          <i aria-hidden="true" />
          rapidex
        </span>

        <nav className="pc__nav" aria-label="Seções do painel">
          {['Pedidos', 'Cozinha', 'Cardápio', 'Clientes', 'Desempenho', 'Loja'].map((item) => (
            <a key={item} href="#conteudo" data-ativo={item === 'Pedidos' || undefined}>
              {item}
            </a>
          ))}
        </nav>

        {/*
          OS CONTADORES DOS QUATRO ESTÁGIOS, zerados incluídos. É o que paga a
          faixa de agrupamento que não é desenhada lá embaixo — aqui um zero
          custa 52px de largura, lá custava 40px de altura.
        */}
        <div className="pc__contadores" aria-label="Pedidos por estágio">
          {ORDEM_ESTAGIOS.map((estagio) => (
            <span
              key={estagio}
              className="pc__contador"
              data-e={estagio}
              data-zero={contagens[estagio] === 0 || undefined}
            >
              <i aria-hidden="true" />
              {CODIGO[estagio]}
              <b>{contagens[estagio]}</b>
            </span>
          ))}
        </div>

        <div className="pc__direita">
          <div className="pc__periodo" role="group" aria-label="Período">
            {[
              ['hoje', 'hoje'],
              ['ontem', 'ontem'],
              ['7d', '7d'],
            ].map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={periodo === valor}
                onClick={() => setPeriodo(valor as string)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <label className="pc__busca">
            <input type="search" placeholder="buscar" aria-label="Buscar pedido" />
            <kbd>/</kbd>
          </label>

          <span className="pc__vivo">
            <i aria-hidden="true" />
            ao vivo
          </span>

          <span className="pc__sessao">ALDEOTA · CC</span>
        </div>
      </header>

      <main className="pc__lista" id="conteudo">
        {blocos.map((bloco) => (
          <section key={bloco.estagio} className="pc__bloco" data-e={bloco.estagio}>
            {/* A faixa de 22px. Ela gruda ao rolar e não existe quando vazia. */}
            <h2 className="pc__faixa">
              <span className="pc__faixa-cap" aria-hidden="true" />
              {bloco.titulo}
              <b>{bloco.pedidos.length}</b>
              <span className="pc__faixa-fio" aria-hidden="true" />
            </h2>

            <div className="pc__grade">
              {bloco.pedidos.map((pedido) => (
                <LinhaC
                  key={pedido.id}
                  pedido={pedido}
                  selecionado={selecionado === pedido.id}
                  onSelecionar={() => setSelecionado(pedido.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* O rodapé de teclas. 22px, e é o que faz a tela render depois de um mês. */}
      <footer className="pc__teclas">
        <span>
          <kbd>A</kbd> aceitar
        </span>
        <span>
          <kbd>P</kbd> pronto
        </span>
        <span>
          <kbd>D</kbd> despachar
        </span>
        <span>
          <kbd>C</kbd> concluir
        </span>
        <span>
          <kbd>/</kbd> buscar
        </span>
        <span className="pc__teclas-fim">janela de preparo {JANELA_MINUTOS} min</span>
      </footer>

      <PrototipoSwitcher atual="c" />
    </div>
  );
}

const CODIGO: Record<ProtoEstagio, string> = {
  novo: 'NOV',
  preparo: 'PRE',
  pronto: 'PRO',
  rua: 'RUA',
};

const ACOES: Record<ProtoEstagio, string> = {
  novo: 'aceitar',
  preparo: 'pronto',
  pronto: 'despachar',
  rua: 'concluir',
};

function LinhaC({
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
    <button
      type="button"
      className="pc__linha"
      data-e={pedido.estagio}
      data-tarde={tarde || undefined}
      data-trava={trava || undefined}
      data-sel={selecionado || undefined}
      onClick={onSelecionar}
    >
      <span className="pc__cap" aria-hidden="true" />

      {/*
        O CRONÔMETRO, alinhado à direita numa casa de largura fixa. Numa coluna
        de trinta linhas o que se lê é a COLUNA, não o número — "7 min" e
        "41 min" com larguras diferentes fazem o olho reancorar a cada linha.
      */}
      <span className="pc__tempo">
        {cronometro(pedido.minutos)}
        {tarde ? <em>+{pedido.minutos - JANELA_MINUTOS}</em> : null}
      </span>

      <span className="pc__num">{pedido.numero}</span>

      <span className="pc__cliente">{pedido.cliente}</span>

      <span className="pc__modo" title={pedido.modalidade}>
        <Modal size={14} peso={1.7} />
        <span className="pc__destino">{pedido.destino}</span>
      </span>

      <span className="pc__pgto">{trava ? 'PGTO PEND' : pedido.formaPagamento}</span>

      <span className="pc__valor">{num(pedido.total)}</span>

      <span className="pc__tecla">{ACOES[pedido.estagio]}</span>
    </button>
  );
}

/*
 * O QUE A DIREÇÃO C SACRIFICA.
 *
 * - QUEM NUNCA VIU NÃO ENTENDE SOZINHO. "NOV 3", "PGTO PEND", cronômetro em
 *   00:41 e a modalidade só no ícone são código de quem já sabe. Rende no
 *   segundo dia e cobra o primeiro — o oposto exato da direção B.
 * - NÃO HÁ DETALHE NA MESMA TELA. Sem painel lateral, ver o endereço completo
 *   ou a observação do item exige abrir outra coisa por cima da lista.
 * - O ESCURO NÃO É NEUTRO. Ele é ótimo num salão à noite e ruim numa loja de
 *   shopping com vitrine ao sol; e a leitura por cor cai muito quando o
 *   monitor é o de R$ 400 que já está no balcão.
 * - MODALIDADE SÓ NO ÍCONE. É o que permite 40px de linha, e é a informação
 *   que mais depende do usuário ter aprendido o desenho.
 */
