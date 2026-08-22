/**
 * ============================================================================
 * AS FILIAIS, LADO A LADO — a pergunta que a soma engolia
 * ============================================================================
 *
 * Para quem tem duas lojas, "qual das duas vai melhor" é a PRIMEIRA pergunta, e
 * até agora a tela não a respondia: em "Todas as filiais" ela somava as duas e
 * avisava que estava somando. O aviso era honesto e inútil — dizia ao dono que
 * o número que ele estava lendo não era o que ele queria, sem lhe dar o que ele
 * queria.
 *
 * ----------------------------------------------------------------------------
 * ONDE A COMPARAÇÃO APARECE, E POR QUE NÃO É "SEMPRE"
 * ----------------------------------------------------------------------------
 *
 * SÓ EM "TODAS AS FILIAIS", e a decisão tem três razões, nesta ordem:
 *
 * 1. **Com uma filial escolhida, a tela já é sobre ELA.** A linha de escopo
 *    afirma "estes números são da filial Aldeota"; pôr o faturamento da Zona
 *    Norte logo abaixo faria a tela contradizer a própria legenda três
 *    centímetros depois de escrevê-la.
 *
 * 2. **O gerente nunca chega aqui.** `podeLerDinheiro` exige recorte para quem
 *    não é dono (`ensure_pode_ler_dinheiro` responde 403 sem `branch_id`), então
 *    "todas as filiais" é, por construção, a visão do DONO. Comparar sempre
 *    significaria pôr o resultado da Aldeota na frente do gerente do Centro —
 *    que é exatamente o que a regra do backend existe para impedir.
 *
 * 3. **É o lugar em que a pergunta nasce.** A comparação entra onde hoje mora o
 *    pedido de desculpas pela soma, e o transforma em resposta.
 *
 * Com UMA filial no acesso não há comparação nenhuma a fazer, e a seção não
 * existe — a mesma regra do `hasChoice` de `use-branch-scope.ts`.
 *
 * ----------------------------------------------------------------------------
 * SEM ROTA NOVA
 * ----------------------------------------------------------------------------
 *
 * `/admin/reports/summary` aceita `branch_id` desde a revisão `20260820_0026`,
 * e cada chamada já traz o período anterior de igual tamanho comparado pelo
 * backend. Uma requisição por filial, em paralelo, e a comparação está montada:
 * quem fatura mais, quem fez mais pedidos, quem tem o ticket maior — e, de
 * graça, para onde CADA UMA está indo, que é a segunda pergunta.
 */
import type { Branch, SalesSummary } from '../api/types';
import { toNumber, toNumberOrZero } from './report-model';

/**
 * Uma filial na comparação, com o resumo que o backend devolveu para ELA.
 *
 * `fatiaPct` é a fatia do faturamento somado das filiais QUE RESPONDERAM — não
 * do total da rede. Quando uma das chamadas falha, o denominador encolhe junto,
 * e é por isso que a tela nomeia quem ficou de fora: uma barra de 100% ao lado
 * de "não deu para carregar a Zona Norte" seria uma afirmação falsa desenhada.
 */
export type FilialComparada = {
  branch: Branch;
  summary: SalesSummary;
  faturamento: number;
  fatiaPct: number | null;
};

/**
 * A comparação, ordenada por faturamento — maior primeiro.
 *
 * A ORDEM É A RESPOSTA. Em ordem alfabética, ou na ordem em que o token
 * devolveu as filiais, "qual vai melhor" volta a exigir que o olho compare dois
 * números de quatro dígitos — que é o trabalho que esta seção existe para
 * poupar.
 */
export function compararFiliais(
  entradas: readonly { branch: Branch; summary: SalesSummary }[],
): FilialComparada[] {
  const total = entradas.reduce(
    (soma, item) => soma + toNumberOrZero(item.summary.revenue_total),
    0,
  );

  return entradas
    .map((item) => {
      const faturamento = toNumberOrZero(item.summary.revenue_total);
      return {
        branch: item.branch,
        summary: item.summary,
        faturamento,
        /*
         * SEM DENOMINADOR NÃO HÁ FATIA, e zero não é resposta: um período em
         * que nenhuma loja faturou não faz da Aldeota "0% da rede" — não existe
         * a rede da qual ela seria fatia. É a mesma decisão de
         * `revenue_share_percent` nulo no contrato.
         */
        fatiaPct: total > 0 ? (faturamento / total) * 100 : null,
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento);
}

/** A variação percentual do faturamento da filial, já lida. `null` = sem base. */
export function variacaoDaFilial(filial: FilialComparada): number | null {
  return toNumber(filial.summary.revenue_comparison.change_percent);
}
