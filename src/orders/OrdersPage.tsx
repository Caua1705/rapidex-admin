import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { OrderListItem } from '../api/types';
import { useSession } from '../auth/session-context';
import { useBranchOperation } from '../store/useBranchOperation';
import { emptyBoardState } from './empty-board';
import {
  LANES,
  countFor,
  countForView,
  groupIntoLanes,
  historyOrders,
  type BoardView,
} from './board-lanes';
import { OrderCard } from './OrderCard';
import { OrderDetailPanel } from './OrderDetailPanel';
import { OrderLane } from './OrderLane';
import { OrdersFilters } from './OrdersFilters';
import { useNewOrderSound } from './useNewOrderSound';
import { useOrderStream } from './useOrderStream';
import { useOrdersBoard } from './useOrdersBoard';
import { usePrepRange } from './usePrepRange';
import './OrdersPage.css';

export function OrdersPage() {
  const { activeBranchId } = useSession();
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
   * com "todas as filiais", o quadro mistura as duas lojas, e a janela da
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

  const lanes = groupIntoLanes(board.orders);
  const historico = historyOrders(board.orders);

  /*
   * Quantos pedidos as três faixas somam. É a soma dos CONTADORES do filtro,
   * não dos cartões carregados: com a primeira página cheia de concluídos, os
   * cartões em andamento podem ser zero enquanto o filtro tem pedidos abertos
   * mais adiante — e o estado vazio afirmaria o contrário.
   */
  const emAndamento = LANES.reduce(
    (total, lane) => total + countFor(lane.statuses, board.counts),
    0,
  );
  /*
   * COM "TODAS AS FILIAIS", FECHADA SÓ VALE SE TODAS ESTIVEREM. O quadro mistura
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
     * Quadro à esquerda, detalhe à direita: o detalhe deixou de ser janela
     * porque, aberto, ele escondia justamente as faixas que dizem o que fazer
     * em seguida. Clicar em outro cartão troca o conteúdo do painel.
     */
    <div className="orders">
      <div className="orders__main">
        {/*
          TÍTULO E ABAS NA MESMA LINHA.

          As abas eram um bloco próprio, com régua de largura inteira, embaixo
          do título e do subtítulo: três blocos empilhados antes do primeiro
          pedido. Elas não são conteúdo — são o RECORTE do que está na tela,
          que é a mesma natureza do título. Na linha dele, a tela ganha uma
          dobra inteira de altura sem perder nada.
        */}
        <header className="orders__header">
          <div>
            <h1 className="t-title">Pedidos</h1>
            <p className="t-aux">Acompanhe a operação e priorize o que precisa de atenção agora.</p>
          </div>
          {/*
          DUAS ABAS, E ELAS SEPARAM TRABALHO DE CONSULTA.
          Concluído e cancelado ocupavam duas das sete colunas do quadro com o
          que ninguém toca durante o turno. Aqui eles continuam a um clique —
          e o clique é honesto, porque quem vai ao histórico está consultando.
        */}
          <div className="tabs" role="tablist" aria-label="Pedidos">
            {(
              [
                { key: 'andamento', label: 'Em andamento' },
                { key: 'historico', label: 'Histórico' },
              ] as const
            ).map((aba) => (
              <button
                key={aba.key}
                type="button"
                role="tab"
                aria-selected={view === aba.key}
                className={`tab${view === aba.key ? ' tab--on' : ''}`}
                onClick={() => setView(aba.key)}
                data-testid={`orders-tab-${aba.key}`}
              >
                {aba.label}
                {/*
                O CONTADOR DIZ O QUE HÁ DO OUTRO LADO — por isso ele fica na
                aba FECHADA, e sai da aberta.

                Na aba aberta ele é a mesma informação duas vezes na mesma
                dobra (§8): "Em andamento 3" em cima de faixas que já dizem
                "Novos 2 · Em preparo 1 · Prontos e na rua 0" é exatamente o
                "total que é a SOMA de contadores visíveis" que a regra
                nomeia. No Histórico é o mesmo caso, com o rodapé de
                paginação no lugar das faixas — e é o mesmo motivo pelo qual
                aquele rodapé já só aparece quando há o que carregar.

                Fechada, ela não repete nada: é o único jeito de saber que
                entraram três pedidos enquanto se consultava o histórico.
              */}
                {view === aba.key ? null : (
                  <span className="tab__count">{countForView(aba.key, board.counts)}</span>
                )}
              </button>
            ))}
          </div>
        </header>

        <OrdersFilters
          filters={board.filters}
          streamStatus={streamStatus}
          isLoading={board.isLoading}
          soundBlocked={sound.isBlocked}
          isMuted={sound.isMuted}
          onEnableSound={() => void sound.unblock()}
          onToggleMute={sound.toggleMute}
          onChange={board.updateFilters}
          onReload={() => void board.reload()}
        />

        {board.errorMessage ? (
          <p className="alert alert--error orders__alert" role="alert">
            {board.errorMessage}
          </p>
        ) : null}

        {streamStatus === 'offline' ? (
          <p className="alert alert--warn orders__alert">
            Sem conexão com o servidor. Pedidos novos não vão aparecer sozinhos até a rede voltar.
          </p>
        ) : null}

        {view === 'andamento' ? (
          <div className="faixas" data-testid="board-lanes">
            {LANES.map((lane) => (
              <OrderLane
                key={lane.key}
                lane={lane}
                orders={lanes[lane.key] ?? []}
                count={countFor(lane.statuses, board.counts)}
                windowMinutes={windowMinutes}
                selectedOrderId={selectedOrderId}
                onOpenOrder={setSelectedOrderId}
              />
            ))}

            {/*
              O QUADRO INTEIRO VAZIO É OUTRO ESTADO, e não a soma de três
              faixas vazias. Uma faixa sem pedido continua sem escrever nada —
              o zero do contador ao lado já diz —, mas as TRÊS zeradas juntas
              deixavam a tela com três fios e nada mais: nem "está entrando
              pedido?", nem "estou no dia certo?", nem o que fazer.

              Só depois de carregar: no primeiro quadro, "nenhum pedido" ainda
              não é uma afirmação — é o esqueleto.
            */}
            {!board.isLoading && emAndamento === 0 ? (
              <div className="quadro-vazio" data-testid="board-empty">
                <p className="t-section">{vazio.title}</p>
                <p className="t-aux">{vazio.hint}</p>
                {vazio.action ? (
                  <Link className="btn btn--sm" to={vazio.action.to}>
                    {vazio.action.label}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
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

      <OrderDetailPanel
        orderId={selectedOrderId}
        onClose={() => {
          setSelectedOrderId(null);
          board.clearActionError();
        }}
        onChangeStatus={board.changeOrderStatus}
        onCancelOrder={board.cancelOrderWithReason}
        actionErrorMessage={
          board.actionError?.orderId === selectedOrderId ? board.actionError.message : null
        }
      />
    </div>
  );
}

/**
 * O HISTÓRICO — uma grade de pedidos encerrados, e nada além disso.
 *
 * Sem faixa e sem cabeçalho de estágio: aqui todos os pedidos estão no mesmo
 * estado do ponto de vista de quem consulta ("acabou"), e o que separa um
 * concluído de um cancelado é a matiz do próprio cartão. Agrupá-los custaria
 * dois cabeçalhos para dizer o que a cor já diz.
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
    return <p className="orders__vazio faint">Carregando…</p>;
  }

  if (orders.length === 0) {
    return <p className="orders__vazio faint">Nenhum pedido encerrado no período.</p>;
  }

  return (
    <div className="historico" data-testid="board-historico">
      <div className="historico__grade">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            windowMinutes={null}
            isSelected={order.id === selectedOrderId}
            onOpen={() => onOpenOrder(order.id)}
          />
        ))}
      </div>

      {/*
        O rodapé só existe quando há o que carregar. Com tudo na tela, "40 de
        40" é a terceira vez que o mesmo número aparece — o contador da aba já
        o disse, e os cartões estão logo acima.
      */}
      {carregados < total ? (
        <footer className="historico__rodape faint">
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
