import { useState } from 'react';

import { PrototipoSwitcher } from './PrototipoSwitcher';
import {
  BuscaIcon,
  CardapioIcon,
  ClientesIcon,
  CozinhaIcon,
  DesempenhoIcon,
  LojaIcon,
  PedidosIcon,
} from './icones';
import {
  JANELA_MINUTOS,
  ORDEM_ESTAGIOS,
  atrasado,
  brl,
  contagem,
  decorrido,
  porUrgencia,
  tituloDe,
  type ProtoEstagio,
} from './pedidos-exemplo';
import '@fontsource-variable/ibm-plex-sans';
import './PedidosA.css';

/**
 * DIREÇÃO A — REFINADA.
 *
 * A aposta: PEDIDO É LINHA, NÃO CARTÃO. Um cartão é uma caixa que precisa de
 * borda, sombra e respiro próprio; onze cartões são onze molduras competindo
 * pela mesma atenção. A linha de razão (o "ledger") empilha os mesmos sete
 * campos em colunas alinhadas, e o alinhamento faz o trabalho que a moldura
 * fazia — o olho desce uma coluna em vez de reler onze caixas.
 *
 * COMO ELA RESOLVE OS TRÊS PROBLEMAS:
 *
 *   1. Preâmbulo — o subtítulo explicativo não existe, e as abas voltaram a
 *      caber na mesma linha do título. Sobra UMA barra de 52px, e o primeiro
 *      pedido começa em 52px.
 *   2. Filtro — ele deixou de ser um objeto. Os quatro períodos são texto com
 *      sublinha no ativo, a busca é um campo sem caixa, tudo na mesma linha do
 *      título. Zero altura própria.
 *   3. Agrupamento — NÃO HÁ CABEÇALHO DE GRUPO. A tabela vem ordenada por
 *      estágio e o nome dele aparece na PRIMEIRA COLUNA, escrito só na
 *      primeira linha do bloco, como numa planilha de coluna mesclada. Estágio
 *      sem pedido não tem primeira linha — logo, não ocupa nada. O contador de
 *      todos os quatro, zerados incluídos, fica na barra do topo.
 *
 * O que ela sacrifica está no comentário do rodapé deste arquivo.
 */
export function PedidosA() {
  const [selecionado, setSelecionado] = useState<string | null>('p3');
  const [periodo, setPeriodo] = useState('hoje');
  const pedidos = porUrgencia();
  const contagens = contagem();

  return (
    <div className="pa">
      <nav className="pa__rail" aria-label="Seções do painel">
        <div className="pa__marca">Rapidex</div>

        <RailGrupo titulo="Operação">
          <RailItem ativo Icon={PedidosIcon}>
            Pedidos
          </RailItem>
          <RailItem Icon={CozinhaIcon}>Cozinha</RailItem>
        </RailGrupo>

        <RailGrupo titulo="Catálogo">
          <RailItem Icon={CardapioIcon}>Cardápio</RailItem>
        </RailGrupo>

        <RailGrupo titulo="Crescimento">
          <RailItem Icon={ClientesIcon}>Clientes</RailItem>
          <RailItem Icon={DesempenhoIcon}>Desempenho</RailItem>
        </RailGrupo>

        <RailGrupo titulo="Configurações">
          <RailItem Icon={LojaIcon}>Minha loja</RailItem>
        </RailGrupo>

        <div className="pa__rodape">
          <p className="pa__loja">Rapidex Aldeota</p>
          <p className="pa__pessoa">Cauã Carvalho · Proprietário</p>
        </div>
      </nav>

      <main className="pa__main">
        {/*
          A BARRA ÚNICA. Título, recorte e ferramenta na mesma linha de 52px —
          era isso que antes ocupava título + subtítulo + abas + cartão de
          filtro, quatro blocos empilhados.
        */}
        <header className="pa__barra">
          <h1 className="pa__titulo">Pedidos</h1>

          <div className="pa__contadores" aria-label="Pedidos por estágio">
            {ORDEM_ESTAGIOS.map((estagio) => (
              <span key={estagio} className="pa__contador" data-e={estagio}>
                <i className="pa__ponto" aria-hidden="true" />
                {tituloDe(estagio)}
                <b>{contagens[estagio]}</b>
              </span>
            ))}
          </div>

          <div className="pa__ferramentas">
            <div className="pa__periodo" role="group" aria-label="Período">
              {[
                ['hoje', 'Hoje'],
                ['ontem', 'Ontem'],
                ['7d', '7 dias'],
                ['custom', 'Escolher'],
              ].map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  className="pa__periodo-opt"
                  aria-pressed={periodo === valor}
                  onClick={() => setPeriodo(valor as string)}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            <label className="pa__busca">
              <BuscaIcon size={15} peso={1.4} />
              <input type="search" placeholder="Nº, cliente ou telefone" aria-label="Buscar" />
            </label>

            <span className="pa__vivo">
              <i aria-hidden="true" />
              Ao vivo
            </span>
          </div>
        </header>

        <table className="pa__tabela">
          <tbody>
            {pedidos.map((pedido, indice) => {
              const abre = indice === 0 || pedidos[indice - 1]!.estagio !== pedido.estagio;
              const tarde = atrasado(pedido);
              const trava = pedido.pagamento === 'pendente';

              return (
                <tr
                  key={pedido.id}
                  className="pa__linha"
                  data-e={pedido.estagio}
                  data-abre={abre || undefined}
                  data-sel={selecionado === pedido.id || undefined}
                  data-trava={trava || undefined}
                  onClick={() => setSelecionado(pedido.id)}
                >
                  {/*
                    A COLUNA MESCLADA. O nome do estágio é escrito uma vez por
                    bloco; nas linhas seguintes sobra só o fio de cor, que é o
                    que mantém a leitura de "ainda estou no mesmo estágio".
                  */}
                  <td className="pa__c-estagio">
                    <span className="pa__estagio-rotulo">{tituloDe(pedido.estagio)}</span>
                  </td>

                  <td className="pa__c-tempo">
                    <span className="pa__decorrido">{decorrido(pedido.minutos)}</span>
                    {tarde ? (
                      <span className="pa__estouro">+{pedido.minutos - JANELA_MINUTOS}</span>
                    ) : (
                      <span className="pa__hora">{pedido.hora}</span>
                    )}
                  </td>

                  <td className="pa__c-cliente">
                    <span className="pa__cliente">{pedido.cliente}</span>
                    <span className="pa__resumo">
                      <b>#{pedido.numero}</b> · {pedido.resumo}
                    </span>
                  </td>

                  <td className="pa__c-modalidade">
                    <span className="pa__modalidade">
                      {pedido.modalidade === 'entrega' ? 'Entrega' : 'Retirada'}
                    </span>
                    <span className="pa__destino">{pedido.destino}</span>
                  </td>

                  <td className="pa__c-pagamento">
                    {trava ? (
                      <span className="pa__trava">
                        Aguardando pagamento
                        <span>não preparar</span>
                      </span>
                    ) : (
                      <span className="pa__pagamento">
                        {pedido.formaPagamento}
                        <span>{pedido.pagamento === 'pago' ? 'Pago' : 'Paga na entrega'}</span>
                      </span>
                    )}
                  </td>

                  <td className="pa__c-valor">{brl(pedido.total)}</td>

                  <td className="pa__c-acao">
                    <span className="pa__acao">{ACOES[pedido.estagio]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>

      <PrototipoSwitcher atual="a" />
    </div>
  );
}

const ACOES: Record<ProtoEstagio, string> = {
  novo: 'Aceitar',
  preparo: 'Pronto',
  pronto: 'Despachar',
  rua: 'Concluir',
};

function RailGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="pa__grupo">
      <p className="pa__grupo-titulo">{titulo}</p>
      <ul>{children}</ul>
    </div>
  );
}

function RailItem({
  children,
  ativo,
  Icon,
}: {
  children: React.ReactNode;
  ativo?: boolean;
  Icon: (props: { size?: number; peso?: number }) => React.ReactElement;
}) {
  return (
    <li>
      <a className="pa__link" data-ativo={ativo || undefined} href="#conteudo">
        <Icon size={16} peso={1.3} />
        {children}
      </a>
    </li>
  );
}

/*
 * O QUE A DIREÇÃO A SACRIFICA.
 *
 * - A LINHA NÃO CABE NO CELULAR SEM VIRAR OUTRA COISA. Sete colunas em 390px
 *   não existem; abaixo de 900px cada linha se dobra em duas e a coluna
 *   mesclada vira uma faixa de estágio de 24px. A leitura por coluna, que é o
 *   ganho inteiro da direção, some no telefone.
 * - SEM COR DE LONGE. As matizes são fundas e dessaturadas de propósito, o que
 *   é ótimo a 60cm e ruim a três metros: quem olha o painel de longe, do outro
 *   lado do balcão, vai ler o texto e não a cor.
 * - O LARANJA DA MARCA NÃO APARECE. É uma escolha, não um esquecimento: a
 *   direção aposta que uma ferramenta séria não precisa se apresentar a cada
 *   dobra. Se a marca tiver de ser reconhecível na tela de operação, esta é a
 *   direção que perde primeiro.
 */
