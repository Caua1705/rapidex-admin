import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import {
  fetchCancellations,
  fetchCommissionReport,
  fetchPaymentMethodsReport,
  fetchProductSales,
  fetchSalesByDay,
  fetchSalesSummary,
  type ReportRange,
} from '../api/reports';
import type {
  Cancellations,
  CommissionReport,
  ProductSales,
  ReportPaymentMethods,
  SalesByDay,
  SalesSummary,
} from '../api/types';
import { datesForPreset, rangeProblem, type PerformancePreset, type PerformanceRange } from './report-model';

/** Quantos produtos o ranking pede. A tela escreve esse número na seção. */
export const RANKING_SIZE = 10;

type Reports = {
  summary: SalesSummary | null;
  byDay: SalesByDay | null;
  payments: ReportPaymentMethods | null;
  products: ProductSales | null;
  cancellations: Cancellations | null;
  commission: CommissionReport | null;
};

const VAZIO: Reports = {
  summary: null,
  byDay: null,
  payments: null,
  products: null,
  cancellations: null,
  commission: null,
};

/**
 * O estado da tela de Desempenho.
 *
 * AS SEIS ROTAS VÃO EM PARALELO e cada uma falha por conta própria. Em série,
 * a tela levaria a soma dos seis tempos para desenhar a primeira coisa; e com
 * um `Promise.all`, um 500 na comissão apagaria o faturamento — que é a parte
 * que o lojista veio ver. `Promise.allSettled` deixa cada seção responder pelo
 * que ela conseguiu trazer.
 *
 * NÃO EXISTE FILIAL AQUI, e não é esquecimento: nenhuma das seis rotas aceita
 * `branch_id` (ver `api/reports.ts`). O hook não recebe filial porque não teria
 * o que fazer com ela — passá-la e ignorá-la seria a mesma mentira que a tela
 * está evitando ao escrever o escopo na cara do lojista.
 */
export function usePerformance() {
  const [range, setRange] = useState<PerformanceRange>(() => ({
    preset: 'last7',
    ...datesForPreset('last7', { startDate: '', endDate: '' }),
  }));

  const [reports, setReports] = useState<Reports>(VAZIO);
  const [isLoading, setIsLoading] = useState(true);
  /** Um erro por seção: a que falhou diz por quê, as outras continuam de pé. */
  const [errors, setErrors] = useState<Partial<Record<keyof Reports, string>>>({});

  const requestRef = useRef(0);

  const problem = rangeProblem(range);

  const load = useCallback(async (janela: ReportRange) => {
    const requestId = ++requestRef.current;
    setIsLoading(true);

    const [summary, byDay, payments, products, cancellations, commission] =
      await Promise.allSettled([
        fetchSalesSummary(janela),
        fetchSalesByDay(janela),
        fetchPaymentMethodsReport(janela),
        fetchProductSales(janela, RANKING_SIZE),
        fetchCancellations(janela),
        fetchCommissionReport(janela),
      ]);

    if (requestId !== requestRef.current) return;

    const proximosErros: Partial<Record<keyof Reports, string>> = {};
    function ler<T>(resultado: PromiseSettledResult<T>, chave: keyof Reports): T | null {
      if (resultado.status === 'fulfilled') return resultado.value;
      proximosErros[chave] = messageFromUnknownError(resultado.reason);
      return null;
    }

    setReports({
      summary: ler(summary, 'summary'),
      byDay: ler(byDay, 'byDay'),
      payments: ler(payments, 'payments'),
      products: ler(products, 'products'),
      cancellations: ler(cancellations, 'cancellations'),
      commission: ler(commission, 'commission'),
    });
    setErrors(proximosErros);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Período inválido não vira requisição: o backend responderia 422 e a tela
    // mostraria a frase de validação do Pydantic no lugar da nossa.
    if (problem) {
      setIsLoading(false);
      return;
    }
    void load({ startDate: range.startDate, endDate: range.endDate });
  }, [load, problem, range.startDate, range.endDate]);

  const selectPreset = useCallback((preset: PerformancePreset) => {
    setRange((current) => ({ preset, ...datesForPreset(preset, current) }));
  }, []);

  const setCustomDate = useCallback((patch: { startDate?: string; endDate?: string }) => {
    setRange((current) => ({ ...current, ...patch, preset: 'custom' }));
  }, []);

  return {
    range,
    problem,
    reports,
    errors,
    isLoading,
    selectPreset,
    setCustomDate,
    reload: () => void load({ startDate: range.startDate, endDate: range.endDate }),
  };
}
