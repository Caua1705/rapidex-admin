import type { OrderListItem } from '../api/types';
import type { BoardColumn } from './board-columns';
import { OrderCard } from './OrderCard';
import { stageOf } from './order-status';

/** Uma coluna do quadro: título, badge com o contador do backend e os cards. */
export function StatusColumn({
  column,
  orders,
  count,
  selectedOrderId,
  onOpenOrder,
}: {
  column: BoardColumn;
  orders: OrderListItem[];
  count: number;
  selectedOrderId: string | null;
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <section className="column" data-column={column.key}>
      {/*
        `is-<estágio>` vem de tokens.css e expõe --st e --st-wash de uma vez.
        A cor da coluna nunca é escolhida aqui.
      */}
      <header className={`column__header is-${stageOf(column.statuses[0]!)}`}>
        <span className="column__dot" />
        <h2 className="column__title">{column.title}</h2>
        {/*
          O contador vem de /admin/orders/status-counts e conta o FILTRO
          inteiro, não só o que está carregado nesta página. Por isso ele pode
          ser maior que o número de cards abaixo.
        */}
        <span className="column__badge" data-testid={`badge-${column.key}`}>
          {count}
        </span>
      </header>

      {/*
        COLUNA VAZIA NÃO ESCREVE NADA. "Nenhum pedido" era a mesma frase em
        cinco das sete colunas ao mesmo tempo, e ela já estava dita ao lado, no
        contador: uma coluna com 0 no cabeçalho e nenhum cartão embaixo não tem
        segunda leitura possível. O que sobrava era ruído em toda a largura do
        quadro, no lugar onde o próximo pedido vai aparecer.
      */}
      <div className="column__cards">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isSelected={order.id === selectedOrderId}
            onOpen={() => onOpenOrder(order.id)}
          />
        ))}
      </div>
    </section>
  );
}
