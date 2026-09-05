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
import { PRODUTOS_ANALISADOS } from './product-quadrants';
import {
  datesForPreset,
  previousRange,
  rangeProblem,
  type PerformancePreset,
  type PerformanceRange,
} from './report-model';

/**
 * Quantas LINHAS o ranking desenha. A tela escreve esse número na seção.
 *
 * Ele deixou de ser o `limit` da requisição: quem pede é `PRODUTOS_ANALISADOS`,
 * porque `listed_revenue_total` é a soma da PRÓPRIA lista devolvida e portanto o
 * denominador dos grupos de produto. Pedir dez e afirmar que um deles é "12% da
 * receita de itens" seria 12% de um total que exclui tudo o que ficou em 11º.
 * Ver `product-quadrants.ts`.
 */
export const RANKING_SIZE = 10;

type Reports = {
  summary: SalesSummary | null;
  byDay: SalesByDay | null;
  /**
   * O MESMO RELATÓRIO, NO PERÍODO ANTERIOR — e ele é a única coisa desta tela
   * que pode faltar sem consequência.
   *
   * Ele existe para uma frase só: a causa por dia ("puxado por terça e
   * sábado"), que precisa comparar o dia a dia dos dois períodos. Por isso ele
   * NÃO tem entrada em `errors`: quando falha, a frase de causa some e o resto
   * da tela — inclusive o veredito, que sai do `summary` — continua inteiro.
   * Uma tarja de erro por um enfeite ausente seria pior que o enfeite.
   */
  byDayPrevious: SalesByDay | null;
  payments: ReportPaymentMethods | null;
  products: ProductSales | null;
  cancellations: Cancellations | null;
  /**
   * O MESMO RELATÓRIO DE CANCELAMENTOS, NO PERÍODO ANTERIOR.
   *
   * `/reports/cancellations` não devolve comparação própria — só o `summary`
   * faz isso. Para que o quarto cartão do topo tenha variação como os outros
   * três, a tela pede o relatório duas vezes, que é a mesma técnica de
   * `byDayPrevious`.
   *
   * COMO ELE TAMBÉM NÃO TEM ENTRADA EM `errors`, `undefined` e `null` querem
   * dizer coisas diferentes aqui, e `readRateChange` separa as duas:
   * `undefined` é "a chamada falhou, a tela não sabe"; `null` dentro dele é
   * "respondeu, e não houve pedido no período anterior". Nenhuma das duas é
   * zero por cento de cancelamento.
   */
  cancellationsPrevious: Cancellations | undefined;
  commission: CommissionReport | null;
};

const VAZIO: Reports = {
  summary: null,
  byDay: null,
  byDayPrevious: null,
  payments: null,
  products: null,
  cancellations: null,
  cancellationsPrevious: undefined,
  commission: null,
};

/**
 * O estado da tela de Desempenho.
 *
 * AS OITO CHAMADAS VÃO EM PARALELO e cada uma falha por conta própria. Em série,
 * a tela levaria a soma dos oito tempos para desenhar a primeira coisa; e com
 * um `Promise.all`, um 500 na comissão apagaria o faturamento — que é a parte
 * que o lojista veio ver. `Promise.allSettled` deixa cada seção responder pelo
 * que ela conseguiu trazer.
 *
 * `branchId` VAZIO É "TODAS AS FILIAIS", e é o que o dono lê.
 *
 * Ele entrou nesta assinatura junto com o recorte nas rotas de relatório: sem
 * mandá-lo, o backend responde 403 ao gerente (`ensure_pode_ler_dinheiro`).
 * Quem decide se a leitura é possível é a TELA, antes de chamar — ver
 * `podeLerDinheiro` em `auth/permissions.ts`; este hook só carrega o que lhe
 * pedirem.
 */
export function usePerformance(
  branchId: string,
  { habilitado, comComissao }: { habilitado: boolean; comComissao: boolean },
) {
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

  const load = useCallback(
    async (janela: ReportRange) => {
      const requestId = ++requestRef.current;
      setIsLoading(true);

      /*
       * DUAS DAS CHAMADAS SÃO A MESMA ROTA COM OUTRO INTERVALO — `sales-by-day`
       * e `cancellations` no período anterior —, e as duas vão no mesmo
       * `allSettled`, em paralelo e não depois. Em série, o topo da tela (que é
       * a primeira coisa que o lojista lê) esperaria dois tempos de rede.
       *
       * `previousRange` devolve `null` se o par de datas for ilegível; aí a
       * promessa nem é criada, e quem lê cada uma já trata a ausência.
       */
      const anterior = previousRange(janela);

      const [
        summary,
        byDay,
        byDayPrevious,
        payments,
        products,
        cancellations,
        cancellationsPrevious,
        commission,
      ] = await Promise.allSettled([
        fetchSalesSummary(janela),
        fetchSalesByDay(janela),
        // O período anterior herda o MESMO recorte de filial: comparar a
        // Aldeota desta semana com a rede da semana passada seria uma variação
        // inventada.
        anterior
          ? fetchSalesByDay({ ...anterior, branchId: janela.branchId })
          : Promise.resolve(null),
        fetchPaymentMethodsReport(janela),
        fetchProductSales(janela, PRODUTOS_ANALISADOS),
        fetchCancellations(janela),
        /*
         * O CANCELAMENTO DO PERÍODO ANTERIOR — mesmo recorte de filial, pelo
         * mesmo motivo do `byDayPrevious`: comparar a taxa da Aldeota desta
         * semana com a da rede na semana passada seria uma variação
         * inventada.
         */
        anterior
          ? fetchCancellations({ ...anterior, branchId: janela.branchId })
          : Promise.resolve(null),
        /*
         * A COMISSÃO É SÓ DO DONO, e para os outros ela não é nem pedida.
         * Deixar a requisição sair e cair em `errors.commission` funcionaria —
         * o `allSettled` já isola cada relatório —, mas seria um 403 por
         * abertura de tela no log do backend para uma seção que a tela nem vai
         * desenhar.
         */
        comComissao ? fetchCommissionReport(janela) : Promise.resolve(null),
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
        // Sem `ler`: a falha dele não vira erro de seção nenhuma — ver o
        // comentário do campo em `Reports`.
        byDayPrevious: byDayPrevious.status === 'fulfilled' ? byDayPrevious.value : null,
        payments: ler(payments, 'payments'),
        products: ler(products, 'products'),
        cancellations: ler(cancellations, 'cancellations'),
        /*
         * Sem `ler`, como o `byDayPrevious`: a falha dele não vira tarja de
         * seção nenhuma. O que ela vira é `undefined`, e o cartão escreve
         * "não deu para ler o período anterior" no lugar da variação — em vez
         * de inventar 0 p.p., que diria que a taxa ficou parada.
         */
        cancellationsPrevious:
          cancellationsPrevious.status === 'fulfilled'
            ? (cancellationsPrevious.value ?? undefined)
            : undefined,
        commission: ler(commission, 'commission'),
      });
      setErrors(proximosErros);
      setIsLoading(false);
    },
    [comComissao],
  );

  useEffect(() => {
    // Período inválido não vira requisição: o backend responderia 422 e a tela
    // mostraria a frase de validação do Pydantic no lugar da nossa.
    if (problem) {
      setIsLoading(false);
      return;
    }
    /*
     * DESABILITADO NÃO PEDE NADA. É o gerente sem filial escolhida: o backend
     * responderia 403 nas cinco rotas de dinheiro (`ensure_pode_ler_dinheiro`),
     * e a tela mostraria cinco tarjas vermelhas para dizer o que uma frase
     * resolve. Ver `PerformancePage`.
     */
    if (!habilitado) {
      setIsLoading(false);
      return;
    }
    void load({ startDate: range.startDate, endDate: range.endDate, branchId });
  }, [load, problem, habilitado, range.startDate, range.endDate, branchId]);

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
    reload: () => {
      if (habilitado) void load({ startDate: range.startDate, endDate: range.endDate, branchId });
    },
  };
}
