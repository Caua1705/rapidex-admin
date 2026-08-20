import type { OrderListItem } from '../api/types';
import type { Lane } from './board-lanes';
import { OrderLine } from './OrderLine';

/**
 * UM BLOCO DE ESTÁGIO — e ele não tem cabeçalho.
 *
 * Antes isto era uma FAIXA: um título com fio até a margem, um ponto colorido e
 * um contador, e embaixo os pedidos correndo na horizontal. Três estágios, três
 * faixas, ~40px cada — e num fim de turno com dois estágios zerados sobravam
 * três títulos anunciando o nada, empurrando o pedido de verdade para fora da
 * dobra.
 *
 * O bloco agora é só a sequência de linhas. Quem diz o estágio é a PRIMEIRA
 * LINHA dele, na coluna mesclada (ver `ds/OrderRow`), e quem diz onde ele
 * começa é o fio mais forte no topo dessa linha. Bloco sem pedido não é
 * renderizado — e por isso não gasta altura nenhuma.
 *
 * O CONTADOR NÃO SUMIU: ele subiu para a barra do topo, onde os TRÊS estágios
 * aparecem sempre, zerados inclusive. Lá um zero custa 70px de largura numa
 * linha que já existia; aqui custava uma faixa inteira de altura.
 *
 * `data-lane` fica no elemento do bloco porque é por ele que o teste de ponta a
 * ponta pergunta "este pedido está no estágio certo?".
 */
export function OrderBlock({
  lane,
  orders,
  windowMinutes,
  selectedOrderId,
  onOpenOrder,
}: {
  lane: Lane;
  orders: OrderListItem[];
  windowMinutes: number | null;
  selectedOrderId: string | null;
  onOpenOrder: (orderId: string) => void;
}) {
  if (orders.length === 0) return null;

  return (
    <section className={`bloco is-${lane.stage}`} data-lane={lane.key} aria-label={lane.title}>
      {orders.map((order, indice) => (
        <OrderLine
          key={order.id}
          order={order}
          /*
            A COLUNA MESCLADA: o rótulo vai em TODAS as linhas e quem decide se
            ele aparece é o layout (ver `ds/OrderRow`). No largo, só a linha que
            ABRE o bloco o mostra — nas seguintes o fio de cor continua descendo
            e diz o mesmo sem repetir a palavra, que é o recurso de uma planilha
            de coluna mesclada. No compacto, onde não há coluna, todas mostram.
          */
          stageLabel={lane.title}
          abreBloco={indice === 0}
          windowMinutes={windowMinutes}
          isSelected={order.id === selectedOrderId}
          onOpen={() => onOpenOrder(order.id)}
        />
      ))}
    </section>
  );
}
