import { useState } from 'react';

import { useResolvedBranch } from '../auth/use-branch-scope';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { ApplySectorDialog } from './ApplySectorDialog';
import { CategoryActionsMenu } from './CategoryActionsMenu';
import { CategoryDialog } from './CategoryDialog';
import { CategoryRail } from './CategoryRail';
import { EditIcon, PlusIcon, SearchIcon } from '../ds/icons';
import { formatPriceInput, isCategoryActive } from './menu-model';
import { ProductDialog } from './ProductDialog';
import { ProductRow } from './ProductRow';
import { useMenu, type CategoryDraft, type ProductDraft } from './useMenu';
import './MenuPage.css';

export function MenuPage() {
  const menu = useMenu();
  /*
   * Os setores são da FILIAL, enquanto o cardápio é do restaurante inteiro. É
   * o cruzamento que obriga esta tela a saber de filial: em qual setor um item
   * imprime é uma resposta diferente em cada loja.
   *
   * A COLUNA SUMIA, E ISSO ERA O DEFEITO. Sem filial escolhida a coluna de
   * setor não era desenhada e "Aplicar setor a todos os itens" ficava
   * desabilitado — o lojista abria o Cardápio e via uma coluna a menos sem
   * nada dizendo por quê, mais uma ação travada. Hoje a filial é RESOLVIDA (a
   * principal, na falta de escolha) e o cabeçalho da coluna diz de qual loja é
   * a resposta. Ver `auth/branch-scope.ts`.
   */
  const { branchId, branch, hasChoice } = useResolvedBranch();
  const printing = usePrintSectors(branchId);
  const branchChosen = branchId !== '';
  /* Nomeia a filial só quando há mais de uma: com uma só não desambigua nada. */
  const sectorBranchLabel =
    hasChoice && branch ? (branch.display_name?.trim() || branch.name) : '';

  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [applyingSector, setApplyingSector] = useState(false);
  const [isApplyingSector, setIsApplyingSector] = useState(false);

  const { selectedCategory } = menu;

  function openNewProduct() {
    if (!selectedCategory) return;
    setProductDraft({
      id: null,
      categoryId: selectedCategory.id,
      name: '',
      price: '',
      description: '',
      isActive: true,
      isAvailable: true,
      // Item novo não imprime até alguém dizer onde: chutar um setor mandaria
      // comanda para a chapa errada sem ninguém ter escolhido nada.
      printSectorId: null,
    });
  }

  async function handleApplySector(printSectorId: string | null) {
    if (!selectedCategory) return;
    setIsApplyingSector(true);
    const updated = await menu.applySectorToCategory(selectedCategory.id, printSectorId);
    setIsApplyingSector(false);
    if (updated !== null) setApplyingSector(false);
  }

  return (
    <div className="menu">
      <CategoryRail
        categories={menu.categories}
        selectedCategoryId={menu.selectedCategoryId}
        movedCategoryId={menu.movedCategoryId}
        productCountByCategory={menu.productCountByCategory}
        onSelect={menu.selectCategory}
        onMove={(index, direction) => void menu.reorderCategory(index, direction)}
        onMoveSettled={menu.clearMovedCategory}
        onNew={() => setCategoryDraft({ id: null, name: '', isActive: true })}
      />

      <section className="menu__panel">
        <header className="menu__header">
          <div className="menu__heading">
            {/* O nome da categoria é o título da tela — nível 1, um por tela. */}
            <h1 className="t-title menu__title">{selectedCategory?.name ?? 'Cardápio'}</h1>
            {selectedCategory && !isCategoryActive(selectedCategory) ? (
              <span className="tag">Inativa</span>
            ) : null}
            {selectedCategory ? (
              <button
                type="button"
                className="btn btn--sm btn--ghost icon-btn"
                onClick={() =>
                  setCategoryDraft({
                    id: selectedCategory.id,
                    name: selectedCategory.name,
                    isActive: isCategoryActive(selectedCategory),
                  })
                }
                aria-label={`Editar categoria ${selectedCategory.name}`}
                title="Editar categoria"
              >
                <EditIcon />
              </button>
            ) : null}

            {/*
              As ações em lote saem daqui de perto do nome, e não do canto ao
              lado de "Novo item": aplicar setor sobrescreve a categoria
              inteira, e não pode ter o mesmo peso visual da ação do dia.
            */}
            {selectedCategory ? (
              <CategoryActionsMenu
                actions={[
                  {
                    id: 'aplicar-setor',
                    label: 'Aplicar setor a todos os itens',
                    // Sem `disabledReason`: a filial está resolvida, então a
                    // ação sempre tem em qual loja aplicar. O diálogo é que
                    // nomeia a filial antes de confirmar.
                    onSelect: () => setApplyingSector(true),
                    testId: 'apply-sector-open',
                  },
                ]}
              />
            ) : null}
          </div>

          <div className="menu__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={openNewProduct}
              disabled={!selectedCategory}
            >
              <PlusIcon />
              Novo item
            </button>
          </div>
        </header>

        {menu.errorMessage ? (
          <p className="alert alert--error menu__alert" role="alert">
            {menu.errorMessage}
          </p>
        ) : null}

        {/*
          A busca vive DENTRO do painel da lista, e não numa faixa própria
          acima dele: assim a superfície da lista começa na mesma ordenada da
          superfície da barra de categorias ao lado, e as duas colunas de
          conteúdo têm a mesma borda de cima.
        */}
        <div className="menu__list">
          <div className="menu__search">
            <span className="menu__search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              className="input menu__search-input"
              type="search"
              placeholder="Buscar item nesta categoria"
              aria-label="Buscar item nesta categoria"
              value={menu.searchDraft}
              onChange={(event) => menu.setSearchDraft(event.target.value)}
              disabled={!selectedCategory}
            />

            {/*
              DE QUAL FILIAL É A COLUNA DE SETOR. O cardápio é do restaurante
              inteiro, mas esta coluna não é — e sem dizer de qual loja ela
              responde, o lojista de duas lojas leria a resposta da Aldeota
              achando que vale para as duas. Some com uma filial só: aí não há
              o que desambiguar.
            */}
            {sectorBranchLabel ? (
              <span className="t-aux menu__sector-scope" data-testid="menu-sector-scope">
                Setor de impressão: {sectorBranchLabel}
              </span>
            ) : null}
          </div>

          {menu.isLoadingCategories ? (
            <p className="menu__empty faint">Carregando o cardápio…</p>
          ) : menu.categories.length === 0 ? (
            <p className="menu__empty faint">
              Nenhuma categoria ainda. Crie a primeira para começar o cardápio.
            </p>
          ) : menu.products.length === 0 ? (
            <p className="menu__empty faint">
              {menu.isLoadingProducts ? 'Carregando…' : 'Nenhum item encontrado.'}
            </p>
          ) : (
            // A coluna de setor entra pelo modificador porque ela vale para a
            // LISTA inteira (depende da filial, não do item): sem isso, a
            // grade teria largura diferente conforme a linha.
            <ul className={`menu__items${branchChosen ? ' menu__items--with-sector' : ''}`}>
              {menu.products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  sectors={printing.sectors}
                  showSector={branchChosen}
                  isSaving={menu.pendingAvailability.includes(product.id)}
                  onToggleAvailability={() => void menu.toggleAvailability(product)}
                  onEdit={() =>
                    setProductDraft({
                      id: product.id,
                      categoryId: product.category_id,
                      name: product.name,
                      price: formatPriceInput(product.price),
                      description: product.description ?? '',
                      isActive: product.is_active !== false,
                      isAvailable: product.is_available !== false,
                      printSectorId: product.printing_sector_id ?? null,
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {/*
          O rodapé só existe quando há o que carregar.
          "3 de 3 itens nesta categoria" com tudo na tela é a terceira vez que
          o mesmo número aparece — a barra de categorias já diz "3 itens" ao
          lado do nome, e as três linhas estão logo acima, contáveis com o
          olho. O que a tela NÃO diz sozinha é que faltam itens fora da página.
        */}
        {menu.products.length < menu.totalInCategory ? (
          <footer className="menu__footer faint">
            <span>
              <span>{menu.products.length}</span> de <span>{menu.totalInCategory}</span> itens na
              tela
            </span>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void menu.loadMoreProducts()}
              disabled={menu.isLoadingProducts}
            >
              Carregar mais
            </button>
          </footer>
        ) : null}
      </section>

      {categoryDraft ? (
        <CategoryDialog
          initial={categoryDraft}
          onClose={() => setCategoryDraft(null)}
          onSave={menu.saveCategory}
        />
      ) : null}

      {productDraft ? (
        <ProductDialog
          initial={productDraft}
          categories={menu.categories}
          sectors={printing.sectors}
          branchChosen={branchChosen}
          onClose={() => setProductDraft(null)}
          onSave={menu.saveProduct}
          // A foto sobe por rota própria, sem passar por `saveProduct`: sem
          // reler a lista, a linha do item fica sem miniatura até a próxima
          // troca de categoria — e quem acabou de enviá-la lê isso como falha.
          onImageUploaded={() => void menu.refreshProducts()}
        />
      ) : null}

      {applyingSector && selectedCategory ? (
        <ApplySectorDialog
          categoryName={selectedCategory.name}
          // O total da categoria, e não o que está carregado na tela: a ação
          // atinge a categoria inteira, inclusive o que a paginação não trouxe.
          productCount={menu.totalInCategory}
          // Quantos já têm setor: é o que a ação vai SOBRESCREVER, e o número
          // que diz se ela é inofensiva ou não. Sai dos produtos carregados —
          // não existe rota que conte isso, e a lista é paginada.
          configuredCount={menu.products.filter((product) => product.printing_sector_id).length}
          inspectedCount={menu.products.length}
          sectors={printing.sectors}
          isSaving={isApplyingSector}
          onClose={() => setApplyingSector(false)}
          onConfirm={(printSectorId) => void handleApplySector(printSectorId)}
        />
      ) : null}
    </div>
  );
}
