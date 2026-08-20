import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { listProducts } from '../api/menu';
import type { PrintSector, Product } from '../api/types';
import { coverageOf, type SectorCoverage } from './sector-coverage';

/** O teto do `limit` de `GET /admin/products` no contrato. */
const PAGE_SIZE = 100;

/**
 * Teto de páginas, para o caso patológico.
 *
 * 20 páginas são 2000 itens — mais do que qualquer cardápio que este painel já
 * viu. O teto existe porque uma contagem é APOIO: ela não pode virar trinta
 * requisições em série na abertura de uma tela de configuração. Estourado o
 * teto, a tela diz que a contagem é parcial em vez de mentir um total.
 */
const MAX_PAGES = 20;

export type SectorCoverageState = SectorCoverage & {
  isLoading: boolean;
  errorMessage: string | null;
  /** O cardápio passou do teto de páginas: os números são de uma amostra. */
  isPartial: boolean;
  reload: () => void;
};

/**
 * Percorre o cardápio inteiro para contar itens por setor.
 *
 * POR QUE VARRER, EM VEZ DE PEDIR O NÚMERO: não existe rota que conte itens
 * por setor, e `GET /admin/products` não aceita `printing_sector_id` como
 * filtro — nem a listagem por categoria ajuda, porque setor e categoria são
 * recortes diferentes do mesmo cardápio. A varredura é de páginas de 100 e
 * roda uma vez ao abrir a tela.
 *
 * A VARREDURA É DA FILIAL, e isso mudou junto com o cardápio.
 *
 * Ela já foi do restaurante inteiro, cruzada com os setores de UMA filial — e
 * era uma conta impossível de fechar: o cardápio da rede tinha itens que a
 * loja não vende, e todo item de outra loja caía em "sem setor". Hoje os dois
 * lados são da mesma filial, e "12 itens sem setor" volta a ser um número que
 * o lojista pode zerar. Trocar de filial RELÊ os produtos: eles são outros.
 */
export function useSectorCoverage(
  branchId: string,
  sectors: readonly PrintSector[],
): SectorCoverageState {
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Sem filial não há cardápio a varrer, e varrer sem recorte contaria o
    // item de cada loja uma vez por loja. Ver `usePrintSectors`.
    if (!branchId) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      const todos: Product[] = [];
      let parcial = false;

      try {
        for (let pagina = 0; pagina < MAX_PAGES; pagina += 1) {
          const page = await listProducts({
            branchId,
            limit: PAGE_SIZE,
            offset: pagina * PAGE_SIZE,
          });
          if (cancelled) return;
          todos.push(...page.items);

          /*
           * Três saídas, e a terceira não é redundante: `items.length` menor
           * que o pedido é o sinal de última página que não depende do `total`
           * estar certo. Sem ela, uma resposta curta com `total` maior (item
           * apagado no meio da varredura) faria o laço repetir a mesma página
           * e contar os mesmos itens de novo.
           */
          if (todos.length >= page.total) break;
          if (page.items.length < PAGE_SIZE) break;
          if (pagina === MAX_PAGES - 1) parcial = true;
        }

        setProducts(todos);
        setIsPartial(parcial);
      } catch (error) {
        if (cancelled) return;
        // A contagem é apoio: ela reporta o erro no bloco dela e não derruba a
        // tela — os setores em si continuam listados e editáveis ao lado.
        setErrorMessage(messageFromUnknownError(error));
        setProducts([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, reloadKey]);

  return {
    ...coverageOf(products, sectors),
    isLoading,
    errorMessage,
    isPartial,
    reload: useCallback(() => setReloadKey((key) => key + 1), []),
  };
}
