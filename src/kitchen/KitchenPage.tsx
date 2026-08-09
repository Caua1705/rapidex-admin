import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../auth/session-context';
import { useOrderStream } from '../orders/useOrderStream';
import { KitchenCard } from './KitchenCard';
import { groupForKitchen, KITCHEN_COLUMNS } from './kitchen-board';
import { useKitchenOrders } from './useKitchenOrders';
import './KitchenPage.css';

const STREAM_LABELS: Record<string, string> = {
  live: 'Tempo real ligado',
  connecting: 'Reconectando…',
  offline: 'Sem conexão',
};

/**
 * A tela da Cozinha: tela cheia, sem navegação lateral.
 *
 * Sem sidebar, sem filtro, sem busca e sem seletor de período. Isto não é uma
 * versão reduzida do quadro de pedidos — é um monitor pendurado na cozinha, que
 * fica ligado o dia inteiro e não é operado por ninguém: cada pixel gasto com
 * controle é pixel tirado do que precisa ser lido de longe.
 *
 * A filial continua sendo a da sessão, escolhida no cabeçalho das outras telas.
 * Ela aparece escrita no topo (e não como seletor) porque quem está na cozinha
 * precisa SABER de que loja é a fila, mas não tem por que trocá-la daqui.
 */
export function KitchenPage() {
  const { activeBranchId, branches, restaurantLabel } = useSession();
  const kitchen = useKitchenOrders(activeBranchId);

  const { applyStreamEvent, reload } = kitchen;

  const handleOrderEvent = useCallback(
    (event: Parameters<typeof applyStreamEvent>[0]) => applyStreamEvent(event),
    [applyStreamEvent],
  );

  const { status: streamStatus } = useOrderStream({
    enabled: true,
    onOrderEvent: handleOrderEvent,
    onSyncRequired: reload,
    // Toda reabertura perde o cursor do stream; recarregar é o que repõe o que
    // aconteceu enquanto estávamos fora. Ver useOrderStream.
    onReconnected: reload,
  });

  const grouped = groupForKitchen(kitchen.orders);
  const activeBranch = branches.find((branch) => branch.id === activeBranchId);
  const scopeLabel = activeBranch
    ? activeBranch.display_name?.trim() || activeBranch.name
    : restaurantLabel;

  return (
    <div className="kitchen">
      <header className="kitchen__bar">
        <h1 className="kitchen__title">Cozinha</h1>
        <span className="kitchen__scope faint">{scopeLabel}</span>

        <div className="kitchen__bar-right">
          <span className={`conn conn--${streamStatus}`} data-testid="kitchen-stream-status">
            <span className="conn__dot" />
            {STREAM_LABELS[streamStatus]}
          </span>

          {/* A única saída da tela: sem sidebar, ela precisa existir em algum
              lugar, e o canto é onde ela não compete com os cartões. */}
          <Link className="btn btn--sm" to="/pedidos">
            Sair da cozinha
          </Link>
        </div>
      </header>

      {kitchen.errorMessage ? (
        <p className="alert alert--error kitchen__alert" role="alert">
          {kitchen.errorMessage}
        </p>
      ) : null}

      {streamStatus === 'offline' ? (
        <p className="alert alert--warn kitchen__alert">
          Sem conexão com o servidor. Pedidos novos não vão aparecer sozinhos até a rede voltar.
        </p>
      ) : null}

      <div className="kitchen__board">
        {KITCHEN_COLUMNS.map((column) => {
          const columnOrders = grouped[column.key];
          return (
            <section
              className="kitchen-column"
              key={column.key}
              data-testid={`kitchen-column-${column.key}`}
            >
              <header className={`kitchen-column__head status-${column.key}`}>
                <span className="kitchen-column__dot" aria-hidden="true" />
                <h2 className="kitchen-column__title">{column.title}</h2>
                <span className="kitchen-column__count mono">{columnOrders.length}</span>
              </header>

              <div className="kitchen-column__cards">
                {columnOrders.length === 0 ? (
                  <p className="kitchen-column__empty faint">
                    {kitchen.isLoading ? 'Carregando…' : 'Nada aqui.'}
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      detail={kitchen.details[order.id]}
                      isPending={kitchen.pendingId === order.id}
                      errorMessage={
                        kitchen.actionError?.orderId === order.id
                          ? kitchen.actionError.message
                          : null
                      }
                      onAdvance={(target) => void kitchen.advance(order.id, target)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
