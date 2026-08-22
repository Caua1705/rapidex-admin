import { useEffect, useRef, useState } from 'react';

import { listOrders } from '../api/orders';
import type { OrderListItem } from '../api/types';
import {
  HORAS_MAX_PAGINAS,
  HORAS_PAGINA,
  lerHorasDeCancelamento,
  type LeituraDeHoras,
} from './cancellation-hours';

export type CancellationHours = {
  leitura: LeituraDeHoras | null;
  /** Quantos pedidos a leitura conseguiu ler. */
  lidos: number;
  /** Quantos o relatório de cancelamentos contou no período. */
  esperados: number;
  /** O teto de páginas cortou a busca: a leitura saiu de uma amostra. */
  truncado: boolean;
  isLoading: boolean;
  /** A hora não pôde ser lida. A seção diz isso em uma linha, e segue. */
  falhou: boolean;
};

const VAZIO: CancellationHours = {
  leitura: null,
  lidos: 0,
  esperados: 0,
  truncado: false,
  isLoading: false,
  falhou: false,
};

/**
 * ============================================================================
 * A HORA DOS CANCELAMENTOS — carregada da listagem de pedidos
 * ============================================================================
 *
 * O relatório de cancelamentos não tem hora nenhuma; quem tem é
 * `GET /admin/orders`, pelo `created_at` de cada item. O porquê inteiro, com as
 * duas ressalvas que a tela precisa dizer, está em `cancellation-hours.ts`.
 *
 * ----------------------------------------------------------------------------
 * AS SITUAÇÕES VÊM DO PRÓPRIO RELATÓRIO, E NÃO DE UMA LISTA FIXA AQUI
 * ----------------------------------------------------------------------------
 *
 * `situacoes` é montado a partir do `breakdown` de `/reports/cancellations` —
 * as situações que o BACKEND contou como "não virou venda" naquele período.
 *
 * Escrever `['cancelled', 'rejected']` neste arquivo funcionaria hoje e seria
 * uma segunda definição de "não virou venda" morando na tela: no dia em que o
 * backend acrescentasse uma situação ao relatório, a contagem de cima e o
 * gráfico de baixo passariam a discordar sem nada quebrar — que é o defeito
 * mais caro que esta tela pode ter, porque ele parece certo.
 *
 * A rota aceita UM status por chamada, então são N chamadas em paralelo — a
 * mesma decisão da Cozinha, que carrega as três colunas dela assim.
 *
 * ----------------------------------------------------------------------------
 * A FALHA É SILENCIOSA-COM-AVISO, NÃO UMA TARJA
 * ----------------------------------------------------------------------------
 *
 * `falhou` vira uma linha de apoio dentro da seção ("não deu para ler a hora"),
 * não um `.alert--error`. A seção "O que não virou venda" continua inteira sem
 * a hora: a taxa, o valor e a tabela de situações vêm do relatório e não
 * passaram por aqui. Uma tarja vermelha por um recorte ausente apagaria a
 * resposta que carregou.
 */
export function useCancellationHours(
  range: { startDate: string; endDate: string; branchId: string },
  /** As situações do `breakdown`, já sem repetição e em ordem estável. */
  situacoes: readonly string[],
  { habilitado, esperados }: { habilitado: boolean; esperados: number },
): CancellationHours {
  const [estado, setEstado] = useState<CancellationHours>(VAZIO);
  const requestRef = useRef(0);

  const { startDate, endDate, branchId } = range;
  /* Chave de texto pelo mesmo motivo de `useBranchComparison`: o array é novo a
     cada render de quem o monta. */
  const chaveDasSituacoes = situacoes.join(',');

  useEffect(() => {
    const alvos = chaveDasSituacoes ? chaveDasSituacoes.split(',') : [];
    if (!habilitado || !startDate || !endDate || alvos.length === 0) {
      setEstado(VAZIO);
      return;
    }

    const requestId = ++requestRef.current;
    setEstado((atual) => ({ ...atual, isLoading: true, falhou: false }));

    void (async () => {
      try {
        const porSituacao = await Promise.all(
          alvos.map((status) => carregarSituacao(status, { startDate, endDate, branchId })),
        );

        if (requestId !== requestRef.current) return;

        const pedidos = porSituacao.flatMap((pagina) => pagina.itens);
        const truncado = porSituacao.some((pagina) => pagina.truncado);

        setEstado({
          leitura: lerHorasDeCancelamento(pedidos),
          lidos: pedidos.length,
          esperados,
          truncado,
          isLoading: false,
          falhou: false,
        });
      } catch {
        if (requestId !== requestRef.current) return;
        setEstado({ ...VAZIO, falhou: true });
      }
    })();
  }, [habilitado, startDate, endDate, branchId, chaveDasSituacoes, esperados]);

  return estado;
}

/**
 * Uma situação, página a página, até acabar ou até o teto.
 *
 * O LAÇO PARA POR TRÊS MOTIVOS, e o terceiro é o que evita o laço infinito: a
 * página veio vazia. Sem ele, um backend que devolvesse `total` maior do que
 * consegue paginar giraria `HORAS_MAX_PAGINAS` vezes pedindo nada.
 */
async function carregarSituacao(
  status: string,
  range: { startDate: string; endDate: string; branchId: string },
): Promise<{ itens: OrderListItem[]; truncado: boolean }> {
  const itens: OrderListItem[] = [];
  let total = 0;

  for (let pagina = 0; pagina < HORAS_MAX_PAGINAS; pagina += 1) {
    const resposta = await listOrders(
      {
        status,
        startDate: range.startDate,
        endDate: range.endDate,
        // Vazio = todas as filiais que o token alcança, igual aos relatórios.
        ...(range.branchId ? { branchId: range.branchId } : {}),
      },
      HORAS_PAGINA,
      pagina * HORAS_PAGINA,
    );

    total = resposta.total;
    itens.push(...resposta.items);

    if (resposta.items.length === 0 || itens.length >= resposta.total) break;
  }

  return { itens, truncado: itens.length < total };
}
