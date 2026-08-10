import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import {
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  reorderCategories,
  setProductAvailability,
  updateCategory,
  updateProduct,
} from '../api/menu';
import { applyPrintSectorToCategory, setProductPrintSector } from '../api/print-sectors';
import type { Category, Product } from '../api/types';
import { categoryIdsForReorder, moveCategory, sortCategories, sortProducts } from './menu-model';

/** Uma página de produtos. O cardápio de um restaurante grande passa disso. */
const PAGE_SIZE = 50;

export type CategoryDraft = {
  id: string | null;
  name: string;
  isActive: boolean;
};

export type ProductDraft = {
  id: string | null;
  categoryId: string;
  name: string;
  price: string;
  description: string;
  isActive: boolean;
  isAvailable: boolean;
  /** Setor de impressão. `null` é "Não imprimir" — uma escolha, não um vazio. */
  printSectorId: string | null;
};

/**
 * O estado da tela de cardápio.
 *
 * Duas escolhas que valem explicação:
 *
 * - As ações de um clique só (esgotar, reordenar) são OTIMISTAS: a tela muda
 *   na hora e desfaz se o backend recusar. No meio do almoço, esperar o
 *   servidor para ver o item ficar cinza faz o lojista clicar de novo.
 * - Os produtos são carregados por categoria. A alternativa — trazer o
 *   cardápio inteiro para contar itens na barra lateral — seria uma
 *   requisição por categoria a cada abertura da tela, para mostrar um número.
 */
export function useMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalInCategory, setTotalInCategory] = useState(0);

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Id da categoria que acabou de trocar de posição, para o realce. */
  const [movedCategoryId, setMovedCategoryId] = useState<string | null>(null);
  /** Produtos com a disponibilidade em voo, para travar o interruptor. */
  const [pendingAvailability, setPendingAvailability] = useState<readonly string[]>([]);

  // Descarta a resposta de uma busca que já não é a atual.
  const productRequestRef = useRef(0);

  // A busca espera o lojista parar de digitar; sem isto é uma chamada por tecla.
  useEffect(() => {
    if (searchDraft === search) return;
    const timer = window.setTimeout(() => setSearch(searchDraft), 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const loaded = sortCategories(await listCategories());
      setCategories(loaded);
      setSelectedCategoryId((current) => {
        if (current && loaded.some((category) => category.id === current)) return current;
        return loaded[0]?.id ?? null;
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadProducts = useCallback(async (categoryId: string | null, term: string) => {
    if (!categoryId) {
      setProducts([]);
      setTotalInCategory(0);
      return;
    }

    const requestId = ++productRequestRef.current;
    setIsLoadingProducts(true);
    try {
      const page = await listProducts({
        categoryId,
        search: term,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (requestId !== productRequestRef.current) return;
      setProducts(sortProducts(page.items));
      setTotalInCategory(page.total);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== productRequestRef.current) return;
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === productRequestRef.current) setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts(selectedCategoryId, search);
  }, [loadProducts, selectedCategoryId, search]);

  const loadMoreProducts = useCallback(async () => {
    if (!selectedCategoryId) return;
    const requestId = ++productRequestRef.current;
    setIsLoadingProducts(true);
    try {
      const page = await listProducts({
        categoryId: selectedCategoryId,
        search,
        limit: PAGE_SIZE,
        offset: products.length,
      });
      if (requestId !== productRequestRef.current) return;
      setProducts((current) => sortProducts([...current, ...page.items]));
      setTotalInCategory(page.total);
    } catch (error) {
      if (requestId === productRequestRef.current) setErrorMessage(messageFromUnknownError(error));
    } finally {
      if (requestId === productRequestRef.current) setIsLoadingProducts(false);
    }
  }, [products.length, search, selectedCategoryId]);

  const selectCategory = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    // Busca é sempre dentro da categoria aberta; carregá-la junto mostraria
    // "nenhum item" numa categoria que tem itens.
    setSearchDraft('');
    setSearch('');
  }, []);

  /**
   * Esgotar / repor.
   *
   * Otimista e por rota própria (PATCH .../availability), nunca por um PATCH do
   * produto inteiro: o corpo de um campo só não reenvia preço nem nome, então
   * marcar "acabou" não desfaz uma edição feita em outra aba.
   */
  const toggleAvailability = useCallback(async (product: Product) => {
    const target = product.is_available === false;
    setPendingAvailability((current) => [...current, product.id]);
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, is_available: target } : item)),
    );

    try {
      const saved = await setProductAvailability(product.id, target);
      setProducts((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setErrorMessage(null);
    } catch (error) {
      // Desfaz: deixar a tela dizendo "esgotado" enquanto o cardápio do
      // cliente continua vendendo é o pior desfecho possível aqui.
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, ...product } : item)),
      );
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setPendingAvailability((current) => current.filter((id) => id !== product.id));
    }
  }, []);

  /**
   * Sobe ou desce uma categoria.
   *
   * O corpo do PATCH é a lista COMPLETA de ids, montada por
   * `categoryIdsForReorder` a partir de todas as categorias carregadas — a
   * barra lateral nunca é filtrada justamente para que essa lista seja a
   * verdade inteira.
   */
  const reorderCategory = useCallback(
    async (index: number, direction: -1 | 1) => {
      const reordered = moveCategory(categories, index, direction);
      if (!reordered) return;

      const previous = categories;
      setCategories(reordered);
      setMovedCategoryId(reordered[index + direction]?.id ?? null);

      try {
        const saved = await reorderCategories(categoryIdsForReorder(reordered));
        setCategories(sortCategories(saved));
        setErrorMessage(null);
      } catch (error) {
        setCategories(previous);
        setErrorMessage(messageFromUnknownError(error));
      }
    },
    [categories],
  );

  const clearMovedCategory = useCallback(() => setMovedCategoryId(null), []);

  /** Criar ou renomear/ativar categoria. Não existe excluir: existe desativar. */
  const saveCategory = useCallback(
    async (draft: CategoryDraft) => {
      const name = draft.name.trim();
      if (!name) return false;

      try {
        if (draft.id) {
          await updateCategory(draft.id, { name, is_active: draft.isActive });
        } else {
          const created = await createCategory({
            name,
            // Categoria nova entra no fim: mudar a ordem de quem já existe
            // sem o lojista pedir bagunçaria o cardápio publicado.
            sort_order: categories.length,
            is_active: draft.isActive,
          });
          setSelectedCategoryId(created.id);
        }
        await loadCategories();
        setErrorMessage(null);
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      }
    },
    [categories.length, loadCategories],
  );

  /** Criar ou editar item. Também sem excluir — `is_active: false` é a saída. */
  const saveProduct = useCallback(
    async (draft: ProductDraft, price: number) => {
      const name = draft.name.trim();
      if (!name) return false;

      try {
        if (draft.id) {
          await updateProduct(draft.id, {
            category_id: draft.categoryId,
            name,
            description: draft.description.trim() || null,
            price,
            is_active: draft.isActive,
            is_available: draft.isAvailable,
          });

          // O setor NÃO entra no corpo acima: produto que já existe muda de
          // setor por rota própria (ver `api/print-sectors.ts`). Só chama se
          // mudou — salvar preço não deve gastar uma segunda requisição para
          // reescrever o mesmo setor. Sem o produto na lista carregada não dá
          // para comparar, e aí grava, que é o lado seguro.
          const before = products.find((product) => product.id === draft.id);
          if (!before || (before.printing_sector_id ?? null) !== draft.printSectorId) {
            await setProductPrintSector(draft.id, draft.printSectorId);
          }
        } else {
          const created = await createProduct({
            category_id: draft.categoryId,
            name,
            description: draft.description.trim() || null,
            price,
            is_active: draft.isActive,
            is_available: draft.isAvailable,
            sort_order: products.length,
          });

          // Item novo nasce sem setor, então só há o que gravar se o lojista
          // escolheu um. "Não imprimir" já é o estado do recém-criado — mandar
          // `null` aqui gastaria uma requisição para não mudar nada.
          if (draft.printSectorId) {
            await setProductPrintSector(created.id, draft.printSectorId);
          }
        }
        await loadProducts(selectedCategoryId, search);
        setErrorMessage(null);
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      }
    },
    [loadProducts, products, search, selectedCategoryId],
  );

  /**
   * Aplica um setor de impressão a TODOS os produtos da categoria aberta.
   *
   * É a razão de a funcionalidade existir: sem isto, configurar uma categoria
   * de 80 itens é clicar em 80 itens, um por um, e o que falha é o item 47 que
   * ninguém percebeu que ficou de fora.
   *
   * Sobrescreve inclusive quem já tinha outro setor — é o que conserta uma
   * categoria configurada errada. Quem chama mostra a contagem e confirma antes.
   */
  const applySectorToCategory = useCallback(
    async (categoryId: string, printSectorId: string | null): Promise<number | null> => {
      try {
        const updated = await applyPrintSectorToCategory(categoryId, printSectorId);
        // Relê a categoria em vez de aplicar o setor na lista em memória: o
        // backend é quem sabe quantos e quais produtos mudaram de fato.
        await loadProducts(selectedCategoryId, search);
        setErrorMessage(null);
        return updated;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return null;
      }
    },
    [loadProducts, search, selectedCategoryId],
  );

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  return {
    categories,
    selectedCategory,
    selectedCategoryId,
    products,
    totalInCategory,
    searchDraft,
    isLoadingCategories,
    isLoadingProducts,
    errorMessage,
    movedCategoryId,
    pendingAvailability,
    clearError: () => setErrorMessage(null),
    clearMovedCategory,
    loadMoreProducts,
    reorderCategory,
    saveCategory,
    saveProduct,
    selectCategory,
    setSearchDraft,
    toggleAvailability,
    applySectorToCategory,
  };
}
