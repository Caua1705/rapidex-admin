import { useCallback, useEffect, useRef, useState } from 'react';

import { listCustomers } from '../api/customers';
import { messageFromUnknownError } from '../api/errors';
import { toQuery, type CustomerFilterState } from './customer-filters';
import type { CustomerListItem } from '../api/types';

/** Uma página. O mesmo tamanho do cardápio: cabe a rolagem de uma sentada. */
const PAGE_SIZE = 50;

/**
 * O estado da tela de clientes.
 *
 * A tela é de LEITURA e mais nada — não existe rota de escrita de cliente no
 * contrato, então aqui não há ação otimista, nem desfazer, nem rascunho. O que
 * existe é carregar, buscar e paginar.
 *
 * OS TRÊS FILTROS SÃO DO SERVIDOR, e o `filters` que ele recebe é o que está
 * APLICADO (nunca o rascunho do painel). Nada é peneirado aqui: os critérios
 * valem antes do `LIMIT` no SQL, e o `total` que volta é o do recorte — é ele
 * que continua dizendo se "Carregar mais" tem o que trazer. Filtrar o array
 * recebido daria uma resposta sobre 50 linhas com `total` de outra pergunta.
 *
 * TROCAR DE FILTRO VOLTA PARA A PRIMEIRA PÁGINA. `load` é a mesma função da
 * busca e do seletor de filial, e ela sempre pede `offset: 0` — um recorte novo
 * paginado do meio mostraria a página 3 de uma lista que agora tem uma.
 *
 * A IDENTIDADE DE `filters` É CARGA. Ele entra nas dependências do efeito, então
 * quem chama precisa guardá-lo em estado (é o que `CustomersPage` faz) e não
 * montá-lo a cada render — um objeto novo por render seria uma chamada por
 * render.
 *
 * O QUE ELE NÃO FAZ, E É DE PROPÓSITO: ordenar. A rota não tem parâmetro de
 * ordenação e devolve pronto do pedido mais recente para o mais antigo.
 * Ordenar aqui ordenaria só as linhas já baixadas — com 300 clientes e 50 na
 * mão, "quem mais gastou" mostraria o maior DA PÁGINA, e a tela estaria
 * mentindo com cara de tabela ordenável.
 */
export function useCustomers(branchId: string, filters: CustomerFilterState) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Descarta a resposta de uma busca que já não é a atual. */
  const requestRef = useRef(0);

  // A busca espera o lojista parar de digitar; sem isto é uma chamada por tecla.
  useEffect(() => {
    if (searchDraft === search) return;
    const timer = window.setTimeout(() => setSearch(searchDraft), 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  const load = useCallback(async (term: string, branch: string, criterios: CustomerFilterState) => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const page = await listCustomers(
        { branchId: branch, search: term, ...toQuery(criterios) },
        PAGE_SIZE,
        0,
      );
      if (requestId !== requestRef.current) return;
      setCustomers(page.items);
      setTotal(page.total);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      /*
       * A lista some junto com o erro: manter na tela o resultado da busca
       * anterior, sob uma tarja vermelha, faz o lojista ler a lista velha
       * como se fosse a resposta da busca nova.
       *
       * É por aqui que passaria o 400 de intervalo invertido — e é por isso
       * que o painel de filtros barra a faixa invertida ANTES de chamar: um
       * 400 aqui apaga a lista e troca a resposta por uma tarja, quando o
       * conserto é uma data que a pessoa acabou de digitar.
       */
      setCustomers([]);
      setTotal(0);
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(search, branchId, filters);
  }, [load, search, branchId, filters]);

  /**
   * A próxima página.
   *
   * `offset` sai de `customers.length`, e não de um contador de páginas: se uma
   * requisição se perder, o comprimento da lista continua sendo a verdade de
   * quanto já está na tela.
   */
  const loadMore = useCallback(async () => {
    const requestId = requestRef.current;
    setIsLoadingMore(true);
    try {
      const page = await listCustomers(
        { branchId, search, ...toQuery(filters) },
        PAGE_SIZE,
        customers.length,
      );
      // Uma busca nova enquanto a página vinha: a resposta é de outra pergunta.
      if (requestId !== requestRef.current) return;
      setCustomers((current) => [...current, ...page.items]);
      setTotal(page.total);
      setErrorMessage(null);
    } catch (error) {
      if (requestId === requestRef.current) setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [branchId, customers.length, search, filters]);

  return {
    customers,
    total,
    searchDraft,
    /** O termo que a lista na tela responde — não o que está sendo digitado. */
    search,
    isLoading,
    isLoadingMore,
    errorMessage,
    hasMore: customers.length < total,
    setSearchDraft,
    loadMore,
  };
}
