import { useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchSalesSummary } from '../api/reports';
import type { Branch, SalesSummary } from '../api/types';
import { compararFiliais, type FilialComparada } from './branch-comparison';

/**
 * Um teto de requisições paralelas, para que a comparação não vire uma rajada.
 *
 * Oito é o tamanho de rede que esta seção existe para servir — dois, três,
 * quatro endereços. Acima disso a leitura já não é "qual das duas vai melhor",
 * é um relatório de rede, e comparar trinta lojas numa lista vertical não
 * responde pergunta nenhuma. Quando o teto corta, a TELA DIZ quantas ficaram de
 * fora, em vez de mostrar oito como se fossem todas.
 */
export const FILIAIS_COMPARADAS_MAX = 8;

export type BranchComparison = {
  filiais: FilialComparada[];
  /** Filiais cuja chamada falhou, por nome — a tela as nomeia. */
  falharam: string[];
  /** Quantas o teto deixou de fora. */
  naoPedidas: number;
  isLoading: boolean;
  /** Só quando NENHUMA filial respondeu: aí a seção não tem o que desenhar. */
  erro: string | null;
};

const VAZIO: BranchComparison = {
  filiais: [],
  falharam: [],
  naoPedidas: 0,
  isLoading: false,
  erro: null,
};

/** O nome que a tela escreve quando a filial não é a que respondeu. */
function nomeDaFilial(branch: Branch): string {
  return branch.display_name?.trim() || branch.name;
}

/**
 * O faturamento de cada filial, uma requisição por loja.
 *
 * UMA POR FILIAL, EM PARALELO E COM `allSettled` — a mesma decisão do resto da
 * tela. Em série, comparar quatro lojas custaria quatro tempos de rede antes de
 * a primeira barra aparecer; com `Promise.all`, um 500 numa loja apagaria a
 * comparação inteira, inclusive as três que responderam.
 *
 * O PERÍODO É O MESMO DA TELA, e não um período próprio: duas janelas
 * diferentes na mesma página produziriam uma comparação que não compara nada.
 * Cada resposta já traz o período anterior de igual tamanho calculado pelo
 * backend, então a variação de CADA loja vem junto — e é ela que responde a
 * segunda pergunta do dono ("qual das duas está melhorando").
 *
 * `habilitado` É A REGRA DE ONDE A SEÇÃO APARECE, e quem a decide é a tela: só
 * em "Todas as filiais", só com mais de uma loja no acesso, e só para quem pode
 * ler dinheiro sem recorte — ver o bloco de `branch-comparison.ts`.
 */
export function useBranchComparison(
  branches: readonly Branch[],
  range: { startDate: string; endDate: string },
  { habilitado }: { habilitado: boolean },
): BranchComparison {
  const [estado, setEstado] = useState<BranchComparison>(VAZIO);
  const requestRef = useRef(0);

  const { startDate, endDate } = range;

  /*
   * AS FILIAIS ENTRAM NO EFEITO COMO CHAVE DE TEXTO, e não como array.
   *
   * `branches` vem da sessão e é um array novo a cada render do provider: posto
   * cru nas dependências, ele redispararia N requisições a cada re-render da
   * tela — e a tela re-renderiza a cada resposta que chega, o que fecha um laço
   * infinito. A chave muda quando o CONJUNTO de filiais muda, que é a única vez
   * em que recarregar faz sentido.
   *
   * O array de verdade viaja por `ref`, para que o efeito o leia sem depender
   * dele. É o mesmo padrão de `filtersRef` em `useOrdersBoard`.
   */
  const chaveDasFiliais = branches.map((filial) => filial.id).join(',');
  const branchesRef = useRef(branches);
  branchesRef.current = branches;

  useEffect(() => {
    if (!habilitado || !startDate || !endDate) {
      setEstado(VAZIO);
      return;
    }

    const requestId = ++requestRef.current;
    const pedidas = branchesRef.current.slice(0, FILIAIS_COMPARADAS_MAX);
    const naoPedidas = branchesRef.current.length - pedidas.length;

    setEstado((atual) => ({ ...atual, isLoading: true, erro: null }));

    void (async () => {
      const respostas = await Promise.allSettled(
        pedidas.map((filial) => fetchSalesSummary({ startDate, endDate, branchId: filial.id })),
      );

      if (requestId !== requestRef.current) return;

      const carregadas: { branch: Branch; summary: SalesSummary }[] = [];
      const falharam: string[] = [];
      let ultimoErro: string | null = null;

      respostas.forEach((resposta, indice) => {
        const filial = pedidas[indice];
        if (!filial) return;
        if (resposta.status === 'fulfilled') {
          carregadas.push({ branch: filial, summary: resposta.value });
        } else {
          falharam.push(nomeDaFilial(filial));
          ultimoErro = messageFromUnknownError(resposta.reason);
        }
      });

      setEstado({
        filiais: compararFiliais(carregadas),
        falharam,
        naoPedidas,
        isLoading: false,
        /*
         * O ERRO SÓ SOBE QUANDO NADA RESPONDEU. Com uma loja de pé, a seção
         * desenha o que tem e nomeia quem faltou: uma tarja vermelha por cima
         * de uma comparação parcial apagaria justamente a parte que carregou.
         */
        erro: carregadas.length === 0 ? ultimoErro : null,
      });
    })();
  }, [habilitado, startDate, endDate, chaveDasFiliais]);

  return estado;
}
