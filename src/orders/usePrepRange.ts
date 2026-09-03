import { useEffect, useState } from 'react';

import { fetchBusinessHours } from '../api/store';
import { prepTimeForDay, weekdayDaOperacao } from '../store/business-hours';
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
 *
 * MAS FALHAR TAMBÉM NÃO É "NÃO DEFINIDO". São duas frases diferentes sobre a
 * loja: uma diz que ninguém configurou o prazo, a outra que o painel não
 * conseguiu perguntar. Quem lê a primeira acha que precisa configurar; quem
 * precisava ler a segunda ia recarregar. `falhou` é o que separa as duas.
 */
export function usePrepRange(branchId: string): {
  range: PrepRange | null;
  isLoading: boolean;
  falhou: boolean;
} {
  const [range, setRange] = useState<PrepRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    setRange(null);
    setFalhou(false);
    if (!branchId) return;

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const hours = await fetchBusinessHours(branchId);
        if (cancelled) return;
        // O DIA É O DA LOJA, não o do aparelho — ver `weekdayDaOperacao`.
        setRange(prepTimeForDay(hours, weekdayDaOperacao()));
      } catch {
        if (!cancelled) setFalhou(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { range, isLoading, falhou };
}
