import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { OrderListItem } from '../api/types';
import { useSession } from '../auth/session-context';
import { usePermissoes } from '../auth/use-permissions';
import { useBranchOperation } from '../store/useBranchOperation';
import { emptyBoardState } from './empty-board';
import {
  LANES,
  countFor,
  countForView,
  firstVisibleOrder,
  groupIntoLanes,
  historyOrders,
  type BoardView,
} from './board-lanes';
import { PageBar } from '../ds/PageBar';
import { Tabs } from '../ds/Tabs';
import { OrderBlock } from './OrderBlock';
import { OrderDetailPanel } from './OrderDetailPanel';
import { OrderLine } from './OrderLine';
import { OrdersActions, OrdersToolbar } from './OrdersToolbar';
import { STATUS_LABELS } from './order-status';
import { useNewOrderSound } from './useNewOrderSound';
import { useOrderStream } from './useOrderStream';
import { useDetailColumn } from './useDetailColumn';
import { useOrdersBoard } from './useOrdersBoard';
import { usePrepRange } from './usePrepRange';
import './OrdersPage.css';

const ABAS = [
  { key: 'andamento', label: 'Em andamento' },
  { key: 'historico', label: 'Histórico' },
] as const satisfies readonly { key: BoardView; label: string }[];

export function OrdersPage() {
  const { activeBranchId } = useSession();
  const { pode } = usePermissoes();
  const board = useOrdersBoard();
  const sound = useNewOrderSound();
  /*
   * Só para o estado vazio: "não entrou pedido" e "a loja está fechada" são
   * respostas diferentes, e sem `is_open` a tela só sabe dizer a primeira —
   * que é justamente a errada quando o lojista esqueceu a loja fechada. Uma
   * leitura de `/admin/branches/operation` na abertura, e nada mais.
   *
   * A FILIAL AQUI É A DO FILTRO, e ela pode ser "todas" — o quadro é de leitura,
   * então esta tela não adota filial nenhuma (ver `usePrepRange` abaixo, pelo
   * mesmo motivo).
   */
  const operation = useBranchOperation(activeBranchId);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>('andamento');
  /**
   * QUAL LINHA TEM UM AVANÇO EM VOO. Um id, e não um booleano: com dois pedidos
   * novos, apertar "Aceitar" no primeiro não pode deixar o segundo inerte — o
   * turno não espera a rede.
   */
  const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);

  const { applyStreamEvent, reload, updateFilters } = board;
  const { play } = sound;

  // A filial escolhida no cabeçalho é o filtro da tela. `updateFilters` ignora
  // patch que não muda nada, então isto não recarrega o quadro à toa.
  useEffect(() => {
    updateFilters({ branchId: activeBranchId });
  }, [activeBranchId, updateFilters]);

  /*
   * A janela de preparo da loja é a RÉGUA da barra de maturação: sem ela, a
   * barra mediria o nada e por isso não aparece. É o mesmo número que a
   * Cozinha usa como régua do cronômetro — uma leitura só, um hook só.
   *
   * A FILIAL AQUI É A DO FILTRO, NÃO A RESOLVIDA — de propósito, e é a
   * diferença para o controle de preparo na barra acima. O controle ESCREVE
   * numa filial, então resolver uma é o que o destrava. A barra MEDE pedidos:
   * com "todas as filiais", a lista mistura as duas lojas, e a janela da
   * principal julgaria o pedido da Zona Norte contra a promessa da Aldeota.
   * Sem régua da filial certa, a barra não aparece — que é o mesmo critério da
   * Cozinha (ver `KitchenPage`).
   */
  const { range } = usePrepRange(activeBranchId);
  const windowMinutes = range?.prep_time_max ?? null;

  const handleOrderEvent = useCallback(
    (event: Parameters<typeof applyStreamEvent>[0]) => {
      const { isNewOrder } = applyStreamEvent(event);
      if (isNewOrder) play();
    },
    [applyStreamEvent, play],
  );

  const { status: streamStatus } = useOrderStream({
    enabled: true,
    onOrderEvent: handleOrderEvent,
    // O backend avisa que o painel ficou offline tempo demais para o replay.
    onSyncRequired: reload,
    // Toda reabertura perde o cursor do stream; recarregar é o que repõe o
    // que aconteceu enquanto estávamos fora. Ver useOrderStream.
    onReconnected: reload,
  });

  /**
   * ============================================================================
   * AVANÇAR DA PRÓPRIA LINHA
   * ============================================================================
   *
   * É `board.changeOrderStatus`, o MESMO caminho do rodapé do detalhe — mesma
   * rota, mesma validação do backend, mesma resposta aplicada na lista. Não há
   * uma segunda maneira de mudar o status de um pedido nesta tela.
   *
   * QUANDO DÁ CERTO, A LINHA SE MOVE SOZINHA: `changeOrderStatus` já reinsere o
   * pedido devolvido pelo backend, e `groupIntoLanes` o realoca no bloco do
   * novo estágio no mesmo quadro. Não há recarga e não há nada a fazer aqui.
   *
   * QUANDO DÁ ERRADO, o erro fica em `board.actionError`, preso ao id do
   * pedido. É esse par que a lista lê para escrever o aviso NA LINHA que falhou
   * — sem isso, aceitar da lista um pedido que o painel não tem aberto falharia
   * em silêncio, e o dono ficaria olhando um pedido que não anda.
   */
  const handleAdvance = useCallback(
    async (orderId: string, target: string) => {
      setAdvancingOrderId(orderId);
      await board.changeOrderStatus(orderId, target);
      setAdvancingOrderId(null);
    },
    [board],
  );

  const lanes = groupIntoLanes(board.orders);
  const historico = historyOrders(board.orders);

  /*
   * O erro de um avanço feito DA LISTA — ver o aviso lá embaixo. Nulo quando o
   * pedido que falhou é o que está aberto no painel: lá a frase já existe.
   */
  const pedidoComErro =
    board.actionError && board.actionError.orderId !== selectedOrderId
      ? board.orders.find((order) => order.id === board.actionError?.orderId)
      : undefined;
  const erroDeAvanco = pedidoComErro
    ? `Pedido #${pedidoComErro.order_number}: ${board.actionError?.message}`
    : null;

  /*
   * ============================================================================
   * A TELA ESCOLHE O PRIMEIRO PEDIDO SOZINHA
   * ============================================================================
   *
   * Sem isso, a coluna de 400px do detalhe abria com uma frase explicando o que
   * acontece se alguém clicar — um terço da tela gasto para ensinar o clique
   * que o lojista dá cinquenta vezes por turno. Agora ela abre no pedido de
   * cima, como o Gmail abre na primeira conversa.
   *
   * TRÊS CONDIÇÕES, E CADA UMA EVITA UM ESTRAGO:
   *
   *   1. SÓ ONDE O PAINEL É COLUNA (`useDetailColumn`). Abaixo de 1280px ele
   *      flutua sobre a lista e, no telefone, é a tela inteira — escolher
   *      sozinho ali faria "abrir Pedidos" virar "cair num detalhe com a lista
   *      escondida atrás".
   *
   *   2. SÓ UMA VEZ POR VISITA (`jaEscolheu`). Sem a trava, fechar o painel o
   *      reabriria no mesmo instante, e o botão "Fechar detalhe" viraria um
   *      botão que não faz nada.
   *
   *   3. SÓ COM A LISTA JÁ CARREGADA. `firstVisibleOrder` devolve nulo enquanto
   *      não há pedido, então a trava não queima no primeiro quadro vazio: ela
   *      espera a lista chegar.
   */
  const detalheEhColuna = useDetailColumn();
  const jaEscolheu = useRef(false);
  const primeiroDaLista = firstVisibleOrder(board.orders, view)?.id ?? null;

  useEffect(() => {
    if (!detalheEhColuna || jaEscolheu.current) return;
    if (selectedOrderId !== null || primeiroDaLista === null) return;
    jaEscolheu.current = true;
    setSelectedOrderId(primeiroDaLista);
  }, [detalheEhColuna, selectedOrderId, primeiroDaLista]);

  /*
   * Quantos pedidos os três blocos somam. É a soma dos CONTADORES do filtro,
   * não das linhas carregadas: com a primeira página cheia de concluídos, as
   * linhas em andamento podem ser zero enquanto o filtro tem pedidos abertos
   * mais adiante — e o estado vazio afirmaria o contrário.
   */
  const emAndamento = LANES.reduce(
    (total, lane) => total + countFor(lane.statuses, board.counts),
    0,
  );
  /*
   * COM "TODAS AS FILIAIS", FECHADA SÓ VALE SE TODAS ESTIVEREM. A lista mistura
   * as lojas: com uma aberta e outra fechada, ainda entra pedido, e dizer "a
   * loja está fechada" mandaria o lojista abrir o que já está aberto. Nulo
   * enquanto a leitura não chegou — a tela não afirma nem uma coisa nem outra.
   */
  const linhas = operation.branches;
  const isOpen = linhas === null || linhas.length === 0 ? null : linhas.some((l) => l.is_open);

  const vazio = emptyBoardState({
    isOpen,
    period: board.filters.period,
    search: board.filters.search,
  });

  return (
    /*
     * Lista à esquerda, detalhe à direita: o detalhe deixou de ser janela
     * porque, aberto, ele escondia justamente os blocos que dizem o que fazer
     * em seguida. Clicar em outra linha troca o conteúdo do painel.
     */
    <div className="orders">
      <div className="orders__main">
        {/*
          A FAIXA DE 52px — e é ela que responde ao diagnóstico que abriu esta
          rodada.

          Antes eram quatro blocos empilhados antes do primeiro pedido: título,
          subtítulo explicando a tela, abas com régua própria e um cartão branco
          de filtros com 130px de altura. O primeiro pedido começava a ~500px do
          topo, e painel operacional não se apresenta.

          A FAIXA VIROU PRIMITIVO (`ds/PageBar`) depois que ela nasceu aqui:
          era desta tela que vinha o diagnóstico, e um cabeçalho por tela é como
          seis telas passam a ler como seis produtos. O SUBTÍTULO SAIU — quem
          abre Pedidos sabe o que é a tela.

          OS CONTADORES SUBIRAM PARA O GRUPO DO MEIO, e é o que paga o fim das
          faixas de agrupamento: os três estágios aparecem sempre, zerados
          inclusive, custando largura numa linha que já existia em vez de altura
          em três faixas.
        */}
        {/*
          FAIXA 1 — A TELA: onde estou e o que posso apertar.

          Antes eram quatro blocos empilhados antes do primeiro pedido: título,
          subtítulo explicando a tela, abas com régua própria e um cartão branco
          de filtros com 130px de altura. O primeiro pedido começava a ~500px do
          topo, e painel operacional não se apresenta.

          Hoje esta faixa carrega só duas coisas: a NAVEGAÇÃO (as abas) à
          esquerda, com o título, e a AÇÃO (som e atualizar) encostada na margem
          direita — o canto em que toda tela do painel põe a ação. Tudo o que se
          LÊ desceu para a segunda faixa. Ver o cabeçalho de `OrdersToolbar`.
        */}
        <PageBar
          title="Pedidos"
          aside={
            /*
              DUAS ABAS, E ELAS SEPARAM TRABALHO DE CONSULTA.
              Concluído e cancelado ocupavam duas das sete colunas do quadro
              antigo com o que ninguém toca durante o turno. Aqui eles
              continuam a um clique — e o clique é honesto, porque quem vai ao
              histórico está consultando.

              O COMPONENTE É O DO DESIGN SYSTEM (`ds/Tabs`), na variante da
              faixa. Esta tela tinha o próprio par `.tabs`/`.tab` escrito à mão,
              e duas implementações de aba é como uma delas para de receber o
              teclado de setas que a outra já tinha.
            */
            <Tabs
              label="Pedidos"
              variant="barra"
              testIdPrefix="orders-tab"
              value={view}
              onChange={(id) => setView(id as BoardView)}
              tabs={ABAS.map((aba) => ({
                id: aba.key,
                label: aba.label,
                /*
                  O CONTADOR DIZ O QUE HÁ DO OUTRO LADO — por isso ele fica na
                  aba FECHADA, e sai da aberta. Na aba aberta ele seria a mesma
                  informação duas vezes na mesma dobra: os contadores de estágio
                  da segunda faixa já somam esse número.
                */
                count: view === aba.key ? undefined : countForView(aba.key, board.counts),
              }))}
            />
          }
        >
          <OrdersActions
            isLoading={board.isLoading}
            soundBlocked={sound.isBlocked}
            isMuted={sound.isMuted}
            onEnableSound={() => void sound.unblock()}
            onToggleMute={sound.toggleMute}
            onReload={() => void board.reload()}
          />
        </PageBar>

        {/*
          FAIXA 2 — A LISTA E A LOJA: o recorte à esquerda, a promessa à direita.
        */}
        <OrdersToolbar
          filters={board.filters}
          streamStatus={streamStatus}
          onChange={board.updateFilters}
          contagens={
            view === 'andamento' ? (
              <div className="contagens" aria-label="Pedidos por estágio">
                {LANES.map((lane) => (
                  <span key={lane.key} className={`contagem is-${lane.stage}`}>
                    <i className="contagem__ponto" aria-hidden="true" />
                    {lane.title}
                    {/*
                      O contador vem de /admin/orders/status-counts e conta o
                      FILTRO inteiro, não só o que está carregado. Por isso ele
                      pode ser maior que o número de linhas abaixo — e é por isso
                      que ele mora AQUI, colado no período e na busca que o
                      governam.
                    */}
                    <b data-testid={`badge-${lane.key}`}>{countFor(lane.statuses, board.counts)}</b>
                  </span>
                ))}
              </div>
            ) : null
          }
        />

        {board.errorMessage ? (
          <p className="alert alert--error orders__alert" role="alert">
            {board.errorMessage}
          </p>
        ) : null}

        {/*
          O AVANÇO DA LINHA QUE O BACKEND RECUSOU.

          Ele existe porque a ação saiu do painel: o rodapé do detalhe escreve o
          próprio erro (`actionErrorMessage`, logo abaixo), mas quem aperta
          "Aceitar" na LINHA costuma estar com o painel fechado — é justamente o
          desvio que a ação da linha veio poupar. Sem isto, um 409 sumiria e o
          dono ficaria olhando um pedido que não anda, sem nada dito.

          ELE NOMEIA O PEDIDO. No topo da lista, "Não dá para ir de Aceito para
          Aceito" sozinho não diz de qual das seis linhas se está falando.

          E ELE SÓ APARECE QUANDO O PAINEL NÃO ESTÁ MOSTRANDO O MESMO ERRO: com
          o pedido aberto ao lado, a frase já está no rodapé, colada no botão
          que falhou — repeti-la aqui seria a mesma falha dita duas vezes na
          mesma dobra.
        */}
        {erroDeAvanco ? (
          <p
            className="alert alert--error orders__alert"
            role="alert"
            data-testid="row-advance-error"
          >
            {erroDeAvanco}
          </p>
        ) : null}

        {streamStatus === 'offline' ? (
          <p className="alert alert--warn orders__alert">
            Sem conexão com o servidor. Pedidos novos não vão aparecer sozinhos até a rede voltar.
          </p>
        ) : null}

        {/*
          A LISTA É O CONTAINER DE CONSULTA (`container-type: inline-size`), e é
          isso que faz a linha trocar de layout quando o painel de detalhe
          abre — e não só quando a JANELA encolhe. Ver `ds/OrderRow.css`.
        */}
        <div className="orders__lista" data-testid="board-lanes">
          {view === 'andamento' ? (
            <>
              {LANES.map((lane) => (
                <OrderBlock
                  key={lane.key}
                  lane={lane}
                  orders={lanes[lane.key] ?? []}
                  windowMinutes={windowMinutes}
                  selectedOrderId={selectedOrderId}
                  onOpenOrder={setSelectedOrderId}
                  onAdvanceOrder={(orderId, target) => void handleAdvance(orderId, target)}
                  advancingOrderId={advancingOrderId}
                />
              ))}

              {/*
                A LISTA INTEIRA VAZIA É OUTRO ESTADO, e não a soma de três
                blocos vazios. Bloco sem pedido não é desenhado — mas os TRÊS
                zerados deixavam a tela sem nada: nem "está entrando pedido?",
                nem "estou no dia certo?", nem o que fazer.

                Só depois de carregar: no primeiro quadro, "nenhum pedido" ainda
                não é uma afirmação — é o esqueleto.
              */}
              {!board.isLoading && emAndamento === 0 ? (
                <div className="orders__vazio" data-testid="board-empty">
                  <p className="t-section">{vazio.title}</p>
                  <p className="t-aux">{vazio.hint}</p>
                  {vazio.action ? (
                    <Link className="btn btn--sm" to={vazio.action.to}>
                      {vazio.action.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <Historico
              orders={historico}
              selectedOrderId={selectedOrderId}
              onOpenOrder={setSelectedOrderId}
              isLoading={board.isLoading}
              carregados={board.orders.length}
              total={board.totalInFilter}
              onLoadMore={() => void board.loadMore()}
            />
          )}
        </div>
      </div>

      {/*
        SEM PEDIDO NENHUM NA LISTA, O PAINEL NÃO EXISTE.
        Uma coluna de 400px dizendo "clique num pedido" ao lado de uma lista sem
        nenhum pedido para clicar é a tela pedindo o impossível. Com pedidos, ela
        continua permanente: é o que impede as linhas de andarem embaixo do
        ponteiro a cada clique.
      */}
      {selectedOrderId !== null || primeiroDaLista !== null ? (
        <OrderDetailPanel
          orderId={selectedOrderId}
          branchId={activeBranchId}
          onClose={() => {
            setSelectedOrderId(null);
            board.clearActionError();
          }}
          onChangeStatus={board.changeOrderStatus}
          /*
            CANCELAR É DA GERÊNCIA e avançar não é: são rotas diferentes
            (`PATCH .../cancel` contra `PATCH .../status`). Para quem está no
            balcão, isso é poder recusar um pedido que acabou de entrar e não
            poder desfazer um que já está em produção.
          */
          podeCancelar={pode('pedidos.cancelar')}
          onCancelOrder={board.cancelOrderWithReason}
          actionErrorMessage={
            board.actionError?.orderId === selectedOrderId ? board.actionError.message : null
          }
        />
      ) : null}
    </div>
  );
}

/**
 * O HISTÓRICO — a mesma lista, sem bloco.
 *
 * Aqui todos os pedidos estão no mesmo estado do ponto de vista de quem
 * consulta ("acabou"), então não há bloco e não há coluna mesclada: cada linha
 * traz o próprio rótulo, que é o que separa um concluído de um cancelado.
 * Cada linha "abre" o próprio grupo de uma linha só, e é isso que faz o rótulo
 * aparecer em todas: aqui a coluna mesclada não teria o que mesclar.
 *
 * SEM BARRA DE MATURAÇÃO: ela mede quanto falta para estourar, e um pedido de
 * ontem não tem o que estourar. Passar a régua aqui pintaria toda a lista de
 * vermelho.
 */
function Historico({
  orders,
  selectedOrderId,
  onOpenOrder,
  isLoading,
  carregados,
  total,
  onLoadMore,
}: {
  orders: OrderListItem[];
  selectedOrderId: string | null;
  onOpenOrder: (orderId: string) => void;
  isLoading: boolean;
  carregados: number;
  total: number;
  onLoadMore: () => void;
}) {
  if (isLoading && orders.length === 0) {
    return <p className="orders__aviso faint">Carregando…</p>;
  }

  if (orders.length === 0) {
    return <p className="orders__aviso faint">Nenhum pedido encerrado no período.</p>;
  }

  return (
    <div data-testid="board-historico">
      {orders.map((order) => (
        <OrderLine
          key={order.id}
          order={order}
          stageLabel={STATUS_LABELS[order.status] ?? order.status}
          abreBloco
          windowMinutes={null}
          isSelected={order.id === selectedOrderId}
          onOpen={() => onOpenOrder(order.id)}
        />
      ))}

      {/*
        O rodapé só existe quando há o que carregar. Com tudo na tela, "40 de
        40" é a terceira vez que o mesmo número aparece — o contador da aba já
        o disse, e as linhas estão logo acima.
      */}
      {carregados < total ? (
        <footer className="orders__rodape faint">
          <span>
            <span className="tnum">{carregados}</span> de <span className="tnum">{total}</span> no
            período
          </span>
          <button type="button" className="btn btn--sm" onClick={onLoadMore} disabled={isLoading}>
            Carregar mais
          </button>
        </footer>
      ) : null}
    </div>
  );
}
