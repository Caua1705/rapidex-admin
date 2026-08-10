import { useCallback, useEffect, useState } from 'react';

import { useSession } from '../auth/session-context';
import { BOARD_COLUMNS, columnCount, groupOrdersIntoColumns } from './board-columns';
import { OrderDetailPanel } from './OrderDetailPanel';
import { OrdersToolbar } from './OrdersToolbar';
import { PeriodLine } from './PeriodLine';
import { StatusColumn } from './StatusColumn';
import { useNewOrderSound } from './useNewOrderSound';
import { useOrderStream } from './useOrderStream';
import { useOrdersBoard } from './useOrdersBoard';
import './OrdersPage.css';

export function OrdersPage() {
  const { activeBranchId } = useSession();
  const board = useOrdersBoard();
  const sound = useNewOrderSound();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { applyStreamEvent, reload, updateFilters } = board;
  const { play } = sound;

  // A filial escolhida no cabeçalho é o filtro da tela. `updateFilters` ignora
  // patch que não muda nada, então isto não recarrega o quadro à toa.
  useEffect(() => {
    updateFilters({ branchId: activeBranchId });
  }, [activeBranchId, updateFilters]);

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

  const grouped = groupOrdersIntoColumns(board.orders);
  const loadedCount = board.orders.length;

  return (
    /*
     * Quadro à esquerda, detalhe à direita: o detalhe deixou de ser janela
     * porque, aberto, ele escondia justamente as colunas que dizem o que fazer
     * em seguida. Clicar em outro card troca o conteúdo do painel.
     */
    <div className="orders">
      <div className="orders__main">
        <OrdersToolbar
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

        <PeriodLine
          total={board.totalInFilter}
          loaded={loadedCount}
          isLoading={board.isLoading}
          onLoadMore={() => void board.loadMore()}
        />

        <div className="board">
          {BOARD_COLUMNS.map((column) => (
            <StatusColumn
              key={column.key}
              column={column}
              orders={grouped[column.key] ?? []}
              count={columnCount(column, board.counts)}
              selectedOrderId={selectedOrderId}
              onOpenOrder={setSelectedOrderId}
            />
          ))}
        </div>

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
