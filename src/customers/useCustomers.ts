import { useCallback, useEffect, useRef, useState } from 'react';

import { listCustomers } from '../api/customers';
import { messageFromUnknownError } from '../api/errors';
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
 * O QUE ELE NÃO FAZ, E É DE PROPÓSITO: ordenar. A rota não tem parâmetro de
 * ordenação e devolve pronto do pedido mais recente para o mais antigo.
 * Ordenar aqui ordenaria só as linhas já baixadas — com 300 clientes e 50 na
 * mão, "quem mais gastou" mostraria o maior DA PÁGINA, e a tela estaria
 * mentindo com cara de tabela ordenável.
 */
export function useCustomers(branchId: string) {
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

  const load = useCallback(async (term: string, branch: string) => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const page = await listCustomers({ branchId: branch, search: term }, PAGE_SIZE, 0);
      if (requestId !== requestRef.current) return;
      setCustomers(page.items);
      setTotal(page.total);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      // A lista some junto com o erro: manter na tela o resultado da busca
      // anterior, sob uma tarja vermelha, faz o lojista ler a lista velha como
      // se fosse a resposta da busca nova.
      setCustomers([]);
      setTotal(0);
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(search, branchId);
  }, [load, search, branchId]);

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
        { branchId, search },
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
  }, [branchId, customers.length, search]);

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
