import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchFunnelReport, type ReportRange } from '../api/reports';
import type { FunnelReport } from '../api/types';
import {
  datesForFunnelPreset,
  defaultFunnelRange,
  funnelRangeProblem,
  type FunnelPreset,
  type FunnelRange,
} from './funnel-model';

/**
 * O estado da tela do Funil.
 *
 * UMA ROTA SÓ, e por isso este hook é muito menor que o de Desempenho: não há
 * `Promise.allSettled`, não há erro por seção e não há relatório do período
 * anterior. A tela inteira sai de uma resposta — os cinco degraus, a divisão
 * por origem e a ressalva do `orders_count` vêm juntos, o que é justamente o
 * que faz o número da tela nunca discordar de si mesmo.
 *
 * NÃO HÁ `habilitado` COMO EM DESEMPENHO, e a ausência é o ponto: aquela tela
 * precisa de uma filial escolhida antes de pedir qualquer coisa, porque
 * `ensure_pode_ler_dinheiro` responde 403 ao gerente sem recorte. Esta rota não
 * passa por essa regra — não há um número de dinheiro na resposta —, então
 * gerente e dono a leem do mesmo jeito, com ou sem filial escolhida. Quem não
 * chega aqui é o atendente, e quem o barra é a rota da navegação.
 */
export function useFunnel(branchId: string) {
  const [range, setRange] = useState<FunnelRange>(defaultFunnelRange);
  const [funnel, setFunnel] = useState<FunnelReport | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestRef = useRef(0);
  const problem = funnelRangeProblem(range);

  const load = useCallback(async (janela: ReportRange) => {
    const requestId = ++requestRef.current;
    setIsLoading(true);

    try {
      const resposta = await fetchFunnelReport(janela);
      if (requestId !== requestRef.current) return;
      setFunnel(resposta);
      setErro(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      /*
       * A RESPOSTA ANTERIOR NÃO É APAGADA junto com o erro — e é diferente do
       * que a maioria das telas faz. Trocar a origem no seletor é a interação
       * mais frequente aqui, e limpar a tela a cada falha faria um 500 numa
       * origem apagar o funil inteiro que já estava lido. A tarja diz o que
       * falhou; o que está desenhado continua sendo a última resposta boa, e
       * o cabeçalho dela diz de qual recorte ela é.
       */
      setErro(messageFromUnknownError(error));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Período inválido — ou anterior à retenção — não vira requisição: o
    // backend responderia 400 com a frase dele no lugar da nossa, e a nossa é
    // a que explica os 90 dias.
    if (problem) {
      setIsLoading(false);
      return;
    }
    void load({
      startDate: range.startDate,
      endDate: range.endDate,
      branchId,
      source: range.source,
    });
  }, [load, problem, range.startDate, range.endDate, range.source, branchId]);

  const selectPreset = useCallback((preset: FunnelPreset) => {
    setRange((atual) => ({ ...atual, preset, ...datesForFunnelPreset(preset, atual) }));
  }, []);

  const setCustomDate = useCallback((patch: { startDate?: string; endDate?: string }) => {
    setRange((atual) => ({ ...atual, ...patch, preset: 'custom' }));
  }, []);

  const setSource = useCallback((source: string) => {
    setRange((atual) => ({ ...atual, source }));
  }, []);

  return { range, problem, funnel, erro, isLoading, selectPreset, setCustomDate, setSource };
}
