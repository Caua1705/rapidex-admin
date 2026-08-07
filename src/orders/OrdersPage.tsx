import { useCallback, useState } from 'react';

import { useSession } from '../auth/session-context';
import { BOARD_COLUMNS, columnCount, groupOrdersIntoColumns } from './board-columns';
import { OrderDetailModal } from './OrderDetailModal';
import { OrdersToolbar } from './OrdersToolbar';
import { StatusColumn } from './StatusColumn';
import { useNewOrderSound } from './useNewOrderSound';
import { useOrderStream } from './useOrderStream';
import { useOrdersBoard } from './useOrdersBoard';
import './OrdersPage.css';

export function OrdersPage() {
  const { branches } = useSession();
  const board = useOrdersBoard();
  const sound = useNewOrderSound();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { applyStreamEvent, reload } = board;
  const { play } = sound;

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
    <div className="orders">
      <OrdersToolbar
        filters={board.filters}
        branches={branches}
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

      <footer className="orders__footer faint">
        <span>
          {loadedCount} de {board.totalInFilter} pedidos do período carregados
        </span>
        {loadedCount < board.totalInFilter ? (
          <button type="button" className="btn btn--sm" onClick={() => void board.loadMore()}>
            Carregar mais
          </button>
        ) : null}
      </footer>

      {selectedOrderId ? (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => {
            setSelectedOrderId(null);
            board.clearActionError();
          }}
          onChangeStatus={board.changeOrderStatus}
          actionErrorMessage={
            board.actionError?.orderId === selectedOrderId ? board.actionError.message : null
          }
        />
      ) : null}
    </div>
  );
}
