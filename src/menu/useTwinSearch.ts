import { useEffect, useMemo, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { listProducts } from '../api/menu';
import { useSession } from '../auth/session-context';
import { branchName } from '../layout/branch-heading';
import { branchesToSearch, type CatalogTwin } from './catalog-key';

/** Quantos itens por loja a busca traz. Ver o comentário do hook. */
const POR_FILIAL = 8;

/**
 * Menos que isto não é busca, é a lista inteira da outra loja.
 *
 * Um cardápio de 161 itens respondido em página de 8 não ajuda ninguém a achar
 * a picanha: o que o lojista tem em mão é o NOME, e é por ele que se procura.
 */
const MINIMO_DE_LETRAS = 2;

export type TwinResult = CatalogTwin & { price: number };

/**
 * Procura o mesmo item nas OUTRAS lojas, para parear a chave de catálogo.
 *
 * UMA REQUISIÇÃO POR FILIAL, e não uma só: `GET /admin/products` recorta por
 * UMA filial, e é assim mesmo que tem que ser — foi a leitura sem recorte que
 * pôs o cardápio em dobro na tela. Com duas lojas isso é uma requisição a mais
 * por busca, já com a espera de digitação que o resto do painel usa.
 *
 * A BUSCA COMEÇA COM O NOME QUE O LOJISTA ACABOU DE DIGITAR. É o atalho que
 * faz o campo valer a pena: quem cadastra "Picanha" na Aldeota quase sempre
 * quer a "Picanha" da Zona Norte, e ela já está na lista quando o painel abre.
 *
 * Falha de uma loja não derruba a busca das outras: o pareamento é apoio, e uma
 * filial fora do ar não pode impedir de parear com a que respondeu.
 */
export function useTwinSearch(currentBranchId: string, termoInicial: string) {
  const { branches } = useSession();
  const outras = useMemo(
    () => branchesToSearch(branches, currentBranchId),
    [branches, currentBranchId],
  );

  const [term, setTerm] = useState(termoInicial);
  const [debounced, setDebounced] = useState(termoInicial);
  const [results, setResults] = useState<TwinResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // A mesma espera do resto do painel; sem ela é uma requisição por tecla,
  // multiplicada pelo número de lojas.
  useEffect(() => {
    if (term === debounced) return;
    const timer = window.setTimeout(() => setDebounced(term), 400);
    return () => window.clearTimeout(timer);
  }, [term, debounced]);

  const termoCurto = debounced.trim().length < MINIMO_DE_LETRAS;

  useEffect(() => {
    if (termoCurto || outras.length === 0) {
      setResults([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      const porFilial = await Promise.all(
        outras.map(async (branch) => {
          try {
            const page = await listProducts({
              branchId: branch.id,
              search: debounced.trim(),
              limit: POR_FILIAL,
              offset: 0,
            });
            return page.items.map((item): TwinResult => ({
              id: item.id,
              name: item.name,
              branchLabel: branchName(branch),
              key: item.catalog_key ?? null,
              price: item.price,
            }));
          } catch (error) {
            return messageFromUnknownError(error);
          }
        }),
      );
      if (cancelled) return;

      const achados = porFilial.filter((parte): parte is TwinResult[] => Array.isArray(parte));
      const falhas = porFilial.filter((parte): parte is string => typeof parte === 'string');

      setResults(achados.flat());
      // Só reclama quando NENHUMA loja respondeu: com uma lista na tela, um
      // aviso ao lado dela faria o lojista duvidar do que está vendo.
      setErrorMessage(achados.length === 0 ? (falhas[0] ?? null) : null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced, outras, termoCurto]);

  return {
    term,
    setTerm,
    results,
    isLoading,
    errorMessage,
    /** O termo ainda não é uma busca: a tela pede mais letras em vez de "nada encontrado". */
    termoCurto,
  };
}
