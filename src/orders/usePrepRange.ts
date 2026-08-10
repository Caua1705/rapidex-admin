import { useEffect, useState } from 'react';

import { fetchBusinessHours } from '../api/store';
import { backendWeekday, prepTimeForDay } from '../store/business-hours';
import type { PrepRange } from './prep-time';

/**
 * A faixa de preparo que vale HOJE, só leitura.
 *
 * Uma implementação só para os dois lugares que precisam dela: a barra de
 * pedidos, que a exibe e a ajusta, e a Cozinha, que a usa como régua do
 * cronômetro. Duas cópias divergiriam na primeira mudança — e aí o alarme da
 * cozinha e a promessa feita ao cliente passariam a ser números diferentes.
 *
 * O prazo mora na linha de horário do dia (é por isso que o PATCH de prep-time
 * devolve um `BusinessHourResponse`), então a leitura sai de
 * `GET /admin/branches/{id}/business-hours` filtrada pelo dia de hoje.
 *
 * Falhar aqui NÃO vira erro de tela: é número de apoio, e um alerta por causa
 * dele roubaria a tela de quem veio ver pedido.
 */
export function usePrepRange(branchId: string): { range: PrepRange | null; isLoading: boolean } {
  const [range, setRange] = useState<PrepRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setRange(null);
    if (!branchId) return;

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const hours = await fetchBusinessHours(branchId);
        if (cancelled) return;
        setRange(prepTimeForDay(hours, backendWeekday(new Date())));
      } catch {
        if (!cancelled) setRange(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { range, isLoading };
}
