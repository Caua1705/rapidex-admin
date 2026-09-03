import { useCallback, useEffect, useRef, useState } from 'react';

import type { CategoryDraft, ProductDraft } from './menu-model';

import { messageFromUnknownError } from '../api/errors';
import {
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  reorderCategories,
  reorderProducts,
  setProductAvailability,
  updateCategory,
  updateProduct,
} from '../api/menu';
import { applyPrintSectorToCategory, setProductPrintSector } from '../api/print-sectors';
import type { Category, Product } from '../api/types';
import { catalogKeyBody, twinKeyToWrite } from './catalog-key';
import {
  categoryIdsForReorder,
  moveCategory,
  moveInList,
  podeReordenarProdutos,
  productIdsForReorder,
  sortCategories,
  sortProducts,
} from './menu-model';

/** Uma página de produtos. O cardápio de um restaurante grande passa disso. */
const PAGE_SIZE = 50;

/**
 * QUANTAS CHAMADAS DE DISPONIBILIDADE VÃO JUNTAS.
 *
 * **Não existe rota em lote** para esgotar item: o contrato tem
 * `PATCH /admin/products/{id}/availability` e mais nada. Marcar cinco itens são
 * cinco requisições, e a ação em massa desta tela é isso — o que ela poupa é o
 * TOQUE, não a rede.
 *
 * Quatro de cada vez, e não todas de uma vez: o navegador segura ~6 conexões
 * por host, e quarenta disparadas juntas enfileiram sozinhas, competem com a
 * releitura da lista e, na internet do balcão, estouram o tempo em bloco. Em
 * lotes, o que falha falha sozinho — e é isso que permite dizer QUAIS itens não
 * foram, em vez de "deu erro".
 *
 * A consequência assumida, e ela é dita na tela: **isto não é atômico**. Três
 * de cinco podem gravar. Uma rota em lote resolveria — é a única coisa desta
 * frente que pediria backend novo.
 */
const LOTE_SIMULTANEO = 4;

/** O que sobrou de uma ação em massa: o que gravou e o que não. */
export type ResultadoEmMassa = {
  gravados: number;
  /** Nome dos itens que não gravaram. A tela os NOMEIA, não os conta. */
  falharam: string[];
};

/*
 * Os rascunhos moram em `menu-model.ts` — forma de dados, sem React. Ficam
 * reexportados daqui porque é deste módulo que a tela sempre os importou.
 */
export type { CategoryDraft, ProductDraft } from './menu-model';

/**
 * O estado da tela de cardápio, DE UMA FILIAL.
 *
 * `branchId` não é um filtro que o hook aplica sobre um cardápio maior: ele é o
 * cardápio. Cada filial tem os próprios produtos, os próprios preços e as
 * próprias categorias, e não há herança entre elas — a picanha do Centro e a da
 * Aldeota são duas linhas independentes, com dois ids. Por isso ele entra como
 * parâmetro e não como estado daqui: quem escolhe a loja é o seletor do topo, e
 * um segundo lugar guardando a mesma escolha é como os dois passam a discordar.
 *
 * Filial vazia (o lojista não enxerga nenhuma) não carrega nada, como em
 * `usePrintSectors`: não existe cardápio a mostrar, e pedir sem o recorte
 * traria o das duas lojas somado.
 *
 * Duas outras escolhas que valem explicação:
 *
 * - As ações de um clique só (esgotar, reordenar) são OTIMISTAS: a tela muda
 *   na hora e desfaz se o backend recusar. No meio do almoço, esperar o
 *   servidor para ver o item ficar cinza faz o lojista clicar de novo.
 * - Os produtos são carregados por categoria. A alternativa — trazer o
 *   cardápio inteiro para contar itens na barra lateral — seria uma
 *   requisição por categoria a cada abertura da tela, para mostrar um número.
 */
export function useMenu(branchId: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalInCategory, setTotalInCategory] = useState(0);
  /** Itens por categoria, para a barra da esquerda. Ver `loadProductCounts`. */
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Id da categoria que acabou de trocar de posição, para o realce. */
  const [movedCategoryId, setMovedCategoryId] = useState<string | null>(null);
  /** O mesmo, para o produto: quem se moveu numa lista de 40 some no meio. */
  const [movedProductId, setMovedProductId] = useState<string | null>(null);
  /** Produtos com a disponibilidade em voo, para travar o interruptor. */
  const [pendingAvailability, setPendingAvailability] = useState<readonly string[]>([]);

  /*
   * A SELEÇÃO MORA AQUI, e não na tela, por causa de um bug específico: ela é
   * uma lista de ids, e trocar de categoria (ou digitar na busca) troca os
   * produtos debaixo dela. Guardada na página, uma seleção de três itens
   * sobreviveria à troca e a ação em massa cairia sobre ids que não estão mais
   * na tela — o lojista marcaria "esgotado" em itens que ele não está vendo.
   *
   * Aqui ela é limpa no mesmo lugar em que a lista muda, que é o único jeito de
   * as duas coisas não divergirem.
   */
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Descarta a resposta de uma busca que já não é a atual.
  const productRequestRef = useRef(0);

  /*
   * TROCAR DE FILIAL ZERA A TELA, E ISSO ACONTECE DURANTE A RENDERIZAÇÃO.
   *
   * Nenhum id sobrevive à troca: a categoria aberta, os produtos carregados e
   * as contagens da barra são todos da loja anterior. Deixá-los na tela por um
   * quadro que seja é mostrar o cardápio da loja errada — e pedir os produtos
   * de `selectedCategoryId` depois da troca é pedir uma categoria que não
   * existe nesta filial.
   *
   * O ajuste é feito no corpo do componente, e não num efeito, porque efeito é
   * TARDE DEMAIS: eles rodam todos no mesmo commit, então o que carrega
   * produtos dispararia com o id velho antes de o de limpeza corrigir o estado.
   * Ajustar aqui faz o React descartar esta renderização e repetir com o estado
   * novo ANTES de rodar efeito nenhum.
   */
  const [loadedBranchId, setLoadedBranchId] = useState(branchId);
  if (loadedBranchId !== branchId) {
    setLoadedBranchId(branchId);
    setCategories([]);
    setSelectedCategoryId(null);
    setProducts([]);
    setProductCounts({});
    setSelectedIds([]);
    setTotalInCategory(0);
    setErrorMessage(null);
    setIsLoadingCategories(branchId !== '');
  }

  // A busca espera o lojista parar de digitar; sem isto é uma chamada por tecla.
  useEffect(() => {
    if (searchDraft === search) return;
    const timer = window.setTimeout(() => setSearch(searchDraft), 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  /**
   * Quantos itens cada categoria tem, para a barra da esquerda.
   *
   * O NÚMERO NÃO VEM DE GRAÇA: `AdminCategoryResponse` não tem contagem, e não
   * existe rota que traga todas de uma vez. O que existe é o `total` do
   * envelope de `GET /admin/products`, então isto é uma sondagem por categoria
   * com `limit: 1` — corpo de um item, só para ler o total.
   *
   * Vale a pena porque a pergunta que a barra responde é "qual categoria está
   * vazia?", e essa é a que faz o lojista descobrir, no meio do almoço, que
   * subiu o cardápio pela metade. As sondagens são paralelas, falham em
   * silêncio (contagem é apoio, não pode derrubar a tela) e a categoria ABERTA
   * nem precisa delas: o `total` da listagem já está na mão e é sempre o mais
   * fresco.
   */
  const loadProductCounts = useCallback(
    async (list: readonly Category[]) => {
      const entries = await Promise.all(
        list.map(async (category) => {
          try {
            const page = await listProducts({
              branchId,
              categoryId: category.id,
              limit: 1,
              offset: 0,
            });
            return [category.id, page.total] as const;
          } catch {
            /*
             * A SONDAGEM QUE CAIU DEVOLVE A CATEGORIA, E NÃO `null`.
             *
             * Devolvendo `null`, a mesclagem abaixo preservava a chave
             * ANTERIOR — e a fita ficava com um número que não confere com a
             * lista aberta ao lado, sem nada dizendo isso. `undefined` é o
             * "não sei" que a fita já sabe desenhar: ela simplesmente não
             * escreve número nenhum naquela categoria.
             */
            return [category.id, undefined] as const;
          }
        }),
      );

      setProductCounts((current) => {
        const next = { ...current };
        entries.forEach(([id, total]) => {
          // `undefined` APAGA a chave: número velho no lugar de "não sei" é a
          // fita discordando da lista ao lado, calada.
          if (total === undefined) delete next[id];
          else next[id] = total;
        });
        return next;
      });
    },
    [branchId],
  );

  const loadCategories = useCallback(async () => {
    // Sem filial não há cardápio a pedir. O tratamento é o de `usePrintSectors`:
    // lista vazia, sem erro, e quem chama diz na tela o que está faltando.
    if (!branchId) {
      setCategories([]);
      setIsLoadingCategories(false);
      return;
    }

    setIsLoadingCategories(true);
    try {
      const loaded = sortCategories(await listCategories(branchId));
      setCategories(loaded);
      setSelectedCategoryId((current) => {
        if (current && loaded.some((category) => category.id === current)) return current;
        return loaded[0]?.id ?? null;
      });
      setErrorMessage(null);
      // Sem await: a barra aparece na hora e os números entram quando chegam.
      void loadProductCounts(loaded);
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setIsLoadingCategories(false);
    }
  }, [branchId, loadProductCounts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadProducts = useCallback(
    async (categoryId: string | null, term: string) => {
      /*
       * O CONTADOR SOBE ANTES DO DESVIO, e é isto que invalida a resposta em
       * voo da filial anterior: sem categoria a função sai sem pedir nada, mas
       * o pedido que já estava na rede continua chegando — e chegaria com a
       * lista da loja de onde o lojista acabou de sair.
       */
      const requestId = ++productRequestRef.current;
      if (!categoryId || !branchId) {
        setProducts([]);
        setTotalInCategory(0);
        return;
      }

      setIsLoadingProducts(true);
      try {
        const page = await listProducts({
          branchId,
          categoryId,
          search: term,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (requestId !== productRequestRef.current) return;
        setProducts(sortProducts(page.items));
        setTotalInCategory(page.total);
        // A lista trocou: a seleção era da lista anterior. Ver o comentário do
        // estado `selectedIds`.
        setSelectedIds([]);
        setErrorMessage(null);
      } catch (error) {
        if (requestId !== productRequestRef.current) return;
        setErrorMessage(messageFromUnknownError(error));
      } finally {
        if (requestId === productRequestRef.current) setIsLoadingProducts(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    void loadProducts(selectedCategoryId, search);
  }, [loadProducts, selectedCategoryId, search]);

  const loadMoreProducts = useCallback(async () => {
    if (!selectedCategoryId) return;
    const requestId = ++productRequestRef.current;
    setIsLoadingProducts(true);
    try {
      const page = await listProducts({
        branchId,
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
  }, [branchId, products.length, search, selectedCategoryId]);

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
   *
   * A VERDADE INTEIRA PASSOU A SER A DA FILIAL. A lista completa de uma loja é
   * parcial para a outra, e por isso `branch_id` acompanha o corpo — é ele que
   * diz ao backend qual das duas leituras a lista pretende ser.
   */
  const gravarOrdemDasCategorias = useCallback(
    async (reordered: Category[], movedId: string | null) => {
      const previous = categories;
      setCategories(reordered);
      setMovedCategoryId(movedId);

      try {
        const saved = await reorderCategories(branchId, categoryIdsForReorder(reordered));
        setCategories(sortCategories(saved));
        setErrorMessage(null);
      } catch (error) {
        setCategories(previous);
        setErrorMessage(messageFromUnknownError(error));
      }
    },
    [branchId, categories],
  );

  /** As setas: sobe um, desce um. */
  const reorderCategory = useCallback(
    async (index: number, direction: -1 | 1) => {
      const reordered = moveCategory(categories, index, direction);
      if (!reordered) return;
      await gravarOrdemDasCategorias(reordered, categories[index]?.id ?? null);
    },
    [categories, gravarOrdemDasCategorias],
  );

  /**
   * O arrastar: sai de uma posição, entra em outra.
   *
   * MESMA GRAVAÇÃO DAS SETAS, e é o que garante que os dois caminhos nunca
   * produzam ordens diferentes — o que muda entre eles é só como o índice de
   * destino é escolhido.
   */
  const reorderCategoryTo = useCallback(
    async (from: number, to: number) => {
      const reordered = moveInList(categories, from, to);
      if (!reordered) return;
      await gravarOrdemDasCategorias(reordered, categories[from]?.id ?? null);
    },
    [categories, gravarOrdemDasCategorias],
  );

  const clearMovedCategory = useCallback(() => setMovedCategoryId(null), []);
  const clearMovedProduct = useCallback(() => setMovedProductId(null), []);

  /* ========================================================================
   * A SELEÇÃO E A AÇÃO EM MASSA
   * ===================================================================== */

  const toggleSelected = useCallback((productId: string) => {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  /**
   * Marca ou desmarca TODOS os itens que a lista está mostrando.
   *
   * "Todos" é o que está NA TELA, e não a categoria inteira: a lista é paginada
   * e pode estar filtrada pela busca, e marcar o que não se vê é como cinco
   * itens viram quarenta sem ninguém ter pedido. Quem chama diz o número na
   * própria caixa.
   */
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) => (current.length > 0 ? [] : products.map((item) => item.id)));
  }, [products]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  /**
   * ESGOTAR (OU REPOR) VÁRIOS DE UMA VEZ.
   *
   * NÃO EXISTE ROTA EM LOTE — ver `LOTE_SIMULTANEO`. São N chamadas à MESMA
   * rota do interruptor da linha, e é isso que faz o papel desta ação ser
   * exatamente o mesmo do individual: `PATCH /admin/products/{id}/availability`
   * é `PESSOAS`, então o balcão continua podendo. Não há botão a esconder.
   *
   * **NÃO É ATÔMICO, E A TELA DIZ QUANDO NÃO FOI.** Três de cinco podem gravar.
   * Um "não deu certo" genérico depois de meia gravação é a pior resposta
   * possível aqui: o lojista não sabe quais itens releu o estado errado, e no
   * meio do serviço ele não vai conferir cinco linhas uma a uma. Por isso o que
   * volta são os NOMES do que falhou.
   *
   * O estado é aplicado item a item, conforme cada resposta chega, e não num
   * `setProducts` no fim: com quarenta itens, a lista ficaria parada por vários
   * segundos e depois piscaria inteira.
   */
  const setAvailabilityForMany = useCallback(
    async (isAvailable: boolean): Promise<ResultadoEmMassa | null> => {
      const alvos = products.filter((item) => selectedIds.includes(item.id));
      if (alvos.length === 0) return null;

      setIsBulkSaving(true);
      setPendingAvailability((current) => [...current, ...alvos.map((item) => item.id)]);

      const falharam: string[] = [];
      let gravados = 0;

      for (let i = 0; i < alvos.length; i += LOTE_SIMULTANEO) {
        const lote = alvos.slice(i, i + LOTE_SIMULTANEO);
        await Promise.all(
          lote.map(async (item) => {
            try {
              const saved = await setProductAvailability(item.id, isAvailable);
              gravados += 1;
              setProducts((current) =>
                current.map((linha) => (linha.id === saved.id ? saved : linha)),
              );
            } catch {
              /*
               * A MENSAGEM DE CADA FALHA NÃO SOBE, e é uma escolha: com cinco
               * itens seriam cinco frases idênticas do backend. O que muda de
               * item para item — e o que o lojista precisa — é QUAL item ficou
               * para trás. A linha dele continua no estado antigo, porque nada
               * foi aplicado de forma otimista aqui.
               */
              falharam.push(item.name);
            }
          }),
        );
      }

      setPendingAvailability((current) =>
        current.filter((id) => !alvos.some((item) => item.id === id)),
      );
      setIsBulkSaving(false);
      /*
       * A SELEÇÃO SÓ SAI QUANDO TUDO GRAVOU. Com falha, ela FICA — é o que
       * permite tentar de novo sem remarcar item por item, que é o mínimo a
       * oferecer a quem está no meio do serviço.
       */
      if (falharam.length === 0) setSelectedIds([]);
      return { gravados, falharam };
    },
    [products, selectedIds],
  );

  /**
   * A NOVA ORDEM DOS ITENS DA CATEGORIA ABERTA.
   *
   * O corpo é a lista COMPLETA da categoria, e é por isso que a tela só oferece
   * o arrastar quando ela está inteira na mão (`podeReordenarProdutos`): com a
   * busca ligada a lista é um recorte, e acima de 50 itens ela chega pela
   * metade. A conferência é repetida AQUI, e não só na tela, porque quem chama
   * não é o único caminho — um atalho de teclado ou um teste chamando direto
   * mandaria a lista curta, e o 400 do backend só apareceria como tarja
   * vermelha sem explicar o motivo.
   *
   * Otimista como o resto das ações de um clique: a lista muda na hora e volta
   * ao lugar se o backend recusar.
   */
  const reorderProductTo = useCallback(
    async (from: number, to: number) => {
      if (!selectedCategoryId) return;
      if (!podeReordenarProdutos({ search, loaded: products.length, total: totalInCategory })) {
        return;
      }

      const reordered = moveInList(products, from, to);
      if (!reordered) return;

      const previous = products;
      setProducts(reordered);
      setMovedProductId(products[from]?.id ?? null);

      try {
        const saved = await reorderProducts(selectedCategoryId, productIdsForReorder(reordered));
        setProducts(sortProducts(saved));
        setErrorMessage(null);
      } catch (error) {
        setProducts(previous);
        setErrorMessage(messageFromUnknownError(error));
      }
    },
    [products, search, selectedCategoryId, totalInCategory],
  );

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
            // A categoria nasce NA FILIAL ABERTA, e o campo é obrigatório no
            // corpo (422 sem ele). Não existe categoria da rede: a mesma
            // categoria em duas lojas são duas categorias, com dois ids.
            branch_id: branchId,
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
    [branchId, categories.length, loadCategories],
  );

  /**
   * Criar ou editar item. Também sem excluir — `is_active: false` é a saída.
   *
   * DEVOLVE O ID em vez de um `true`, e é o que permite "Salvar e pôr foto":
   * `POST /admin/products/{id}/image` precisa do id, e no item recém-criado o
   * único lugar do sistema que o conhece é aqui dentro. Devolvendo-o, o diálogo
   * vira modo edição sem fechar. `null` é a falha — quem chama não fecha.
   */
  const saveProduct = useCallback(
    /**
     * `price` NULO SIGNIFICA "NÃO MANDE ESTE CAMPO", e não "preço zero".
     *
     * O backend confere `if payload.price is not None: ensure_pode_definir_preco`
     * — ou seja, quem decide é o CORPO. Para o gerente não basta o campo sumir
     * da tela: o rascunho vem preenchido com o preço atual, e reenviá-lo
     * IGUAL ao que já está gravado é 403 do mesmo jeito. Ele tem de sair do
     * corpo.
     *
     * Na criação isto nunca é nulo: `POST /admin/products` é do dono, e o dono
     * sempre define preço.
     */
    async (draft: ProductDraft, price: number | null): Promise<string | null> => {
      const name = draft.name.trim();
      if (!name) return null;

      let savedId: string;
      try {
        /*
         * O GÊMEO É CARIMBADO ANTES, e a ordem não é detalhe.
         *
         * Quando o item da outra loja ainda não tinha chave, parear exige
         * gravar a MESMA chave nos dois lados — só de um lado não pareia com
         * ninguém, e o relatório continua contando os dois separados sem nada
         * na tela dizendo que não pegou.
         *
         * Primeiro o gêmeo porque a falha dele é a que ainda dá para desfazer:
         * nada foi criado aqui, o lojista vê o erro e tenta de novo. Na ordem
         * inversa, um item já criado ficaria com uma chave que não pareia, e
         * consertar isso exigiria achá-lo de novo. E é idempotente — a segunda
         * tentativa regrava o mesmo valor na mesma linha.
         */
        const carimbo = twinKeyToWrite(draft.catalog);
        if (carimbo) {
          await updateProduct(carimbo.productId, { catalog_key: carimbo.key });
        }

        if (draft.id) {
          savedId = draft.id;
          await updateProduct(draft.id, {
            category_id: draft.categoryId,
            name,
            description: draft.description.trim() || null,
            // Ver o comentário da assinatura: campo AUSENTE para quem não pode
            // definir preço, e não `null` — nulo aqui seria uma tentativa de
            // gravar, e o backend a recusaria.
            ...(price === null ? {} : { price }),
            is_active: draft.isActive,
            is_available: draft.isAvailable,
            // SEMPRE presente, inclusive nulo: nulo é como o lojista separa
            // dois itens, e omitir o campo significaria "não mexi na chave".
            catalog_key: catalogKeyBody(draft.catalog),
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
          /*
           * Criar exige preço, e `POST /admin/products` é SOMENTE_DONO — quem
           * chega aqui sempre pode defini-lo. O `?? 0` é para o compilador, e
           * não um valor que a tela use: sem o preço, o diálogo não deixa
           * salvar.
           */
          const created = await createProduct({
            category_id: draft.categoryId,
            name,
            description: draft.description.trim() || null,
            price: price ?? 0,
            is_active: draft.isActive,
            is_available: draft.isAvailable,
            sort_order: products.length,
            catalog_key: catalogKeyBody(draft.catalog),
          });
          savedId = created.id;

          // Item novo nasce sem setor, então só há o que gravar se o lojista
          // escolheu um. "Não imprimir" já é o estado do recém-criado — mandar
          // `null` aqui gastaria uma requisição para não mudar nada.
          if (draft.printSectorId) {
            await setProductPrintSector(created.id, draft.printSectorId);
          }
        }
        await loadProducts(selectedCategoryId, search);
        // Criar um item, ou movê-lo de categoria, muda a contagem de DUAS
        // categorias — a de origem e a de destino. Só a aberta se atualiza
        // sozinha pelo `total` da listagem, então aqui vale re-sondar.
        void loadProductCounts(categories);
        setErrorMessage(null);
        return savedId;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return null;
      }
    },
    [categories, loadProductCounts, loadProducts, products, search, selectedCategoryId],
  );

  /**
   * Relê a lista da categoria aberta, com a busca em vigor.
   *
   * EXISTE PARA QUEM MUDA UM PRODUTO POR FORA DE `saveProduct` — hoje só o
   * envio da foto, que tem rota própria (`POST /admin/products/{id}/image`) e
   * nunca passa por aqui. Sem isto, o item que acabou de receber foto volta
   * para a lista com a miniatura vazia, e quem enviou a foto há dois segundos
   * lê isso como falha e envia de novo.
   *
   * Não re-sonda as contagens: foto não muda quantos itens a categoria tem.
   */
  const refreshProducts = useCallback(
    () => loadProducts(selectedCategoryId, search),
    [loadProducts, search, selectedCategoryId],
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

  /*
   * A categoria ABERTA usa o total da listagem, que já está na mão e é sempre
   * o mais fresco — criar um item ali atualiza o número na hora, sem sondagem.
   * As outras usam o que a sondagem trouxe. A busca não conta: ela filtra a
   * lista e mudaria o total para "quantos casam com o termo".
   */
  const productCountByCategory =
    selectedCategoryId && search.trim() === ''
      ? { ...productCounts, [selectedCategoryId]: totalInCategory }
      : productCounts;

  return {
    categories,
    selectedCategory,
    selectedCategoryId,
    products,
    totalInCategory,
    productCountByCategory,
    searchDraft,
    isLoadingCategories,
    isLoadingProducts,
    errorMessage,
    movedCategoryId,
    movedProductId,
    pendingAvailability,
    selectedIds,
    isBulkSaving,
    /*
     * PODE ARRASTAR ITEM AGORA? A tela precisa da resposta para desenhar o
     * punho — e para dizer o MOTIVO quando não dá, em vez de sumir com ele.
     */
    canReorderProducts: podeReordenarProdutos({
      search,
      loaded: products.length,
      total: totalInCategory,
    }),
    clearError: () => setErrorMessage(null),
    clearMovedCategory,
    clearMovedProduct,
    clearSelection,
    setAvailabilityForMany,
    toggleSelectAll,
    toggleSelected,
    loadMoreProducts,
    refreshProducts,
    reorderCategory,
    reorderCategoryTo,
    reorderProductTo,
    saveCategory,
    saveProduct,
    selectCategory,
    setSearchDraft,
    toggleAvailability,
    applySectorToCategory,
  };
}
