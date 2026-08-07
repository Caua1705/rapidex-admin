import type { OrderListItem } from '../api/types';

/**
 * Lembra quais eventos do SSE já foram aplicados.
 *
 * O stream entrega AO MENOS UMA VEZ: cada poll do backend olha 5s para trás do
 * cursor (porque `created_at` é o instante em que a transação COMEÇOU), então
 * o mesmo fato pode chegar duas vezes. Descartar por `occurred_at` não serve —
 * dois pedidos podem nascer no mesmo instante. O `event_key` é estável para o
 * mesmo fato, e é ele que usamos.
 *
 * O limite existe porque um painel aberto o dia todo receberia milhares de
 * eventos: um Set sem teto vira vazamento de memória. Eventos velhos podem ser
 * esquecidos com segurança — a repetição do backend é sempre recente.
 */
export class AppliedEventKeys {
  private readonly keys = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly maxSize = 500) {}

  /** true = evento novo (aplique). false = repetido (descarte). */
  markIfNew(eventKey: string): boolean {
    if (this.keys.has(eventKey)) return false;

    this.keys.add(eventKey);
    this.order.push(eventKey);

    while (this.order.length > this.maxSize) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.keys.delete(oldest);
    }
    return true;
  }

  get size(): number {
    return this.keys.size;
  }
}

/**
 * Insere ou atualiza o pedido na lista, mantendo a ordem do mais novo para o
 * mais velho — a mesma que `GET /admin/orders` devolve.
 *
 * O evento traz o pedido no MESMO formato de um item da lista, então dá para
 * substituir o objeto inteiro em vez de remendar campo a campo.
 */
export function upsertOrder(orders: OrderListItem[], incoming: OrderListItem): OrderListItem[] {
  const index = orders.findIndex((order) => order.id === incoming.id);
  if (index >= 0) {
    const copy = [...orders];
    copy[index] = incoming;
    return copy;
  }
  return [incoming, ...orders];
}
