import { useState } from 'react';

import { useSession } from '../auth/session-context';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { ApplySectorDialog } from './ApplySectorDialog';
import { CategoryDialog } from './CategoryDialog';
import { CategoryRail } from './CategoryRail';
import { EditIcon, PlusIcon, SearchIcon } from '../ui/icons';
import { formatPriceInput, isCategoryActive } from './menu-model';
import { ProductDialog } from './ProductDialog';
import { ProductRow } from './ProductRow';
import { useMenu, type CategoryDraft, type ProductDraft } from './useMenu';
import './MenuPage.css';

export function MenuPage() {
  const { activeBranchId } = useSession();
  const menu = useMenu();
  /*
   * Os setores são da FILIAL escolhida no cabeçalho, enquanto o cardápio é do
   * restaurante inteiro. É o cruzamento que obriga esta tela a saber de filial:
   * sem uma escolhida, não há como dizer em qual setor um item imprime, porque
   * a resposta é diferente em cada loja.
   */
  const printing = usePrintSectors(activeBranchId);
  const branchChosen = activeBranchId !== '';

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
        onSelect={menu.selectCategory}
        onMove={(index, direction) => void menu.reorderCategory(index, direction)}
        onMoveSettled={menu.clearMovedCategory}
        onNew={() => setCategoryDraft({ id: null, name: '', isActive: true })}
      />

      <section className="menu__panel">
        <header className="menu__header">
          <div className="menu__heading">
            <h1 className="menu__title">{selectedCategory?.name ?? 'Cardápio'}</h1>
            {selectedCategory && !isCategoryActive(selectedCategory) ? (
              <span className="tag">Inativa</span>
            ) : null}
            {selectedCategory ? (
              <button
                type="button"
                className="btn btn--sm icon-btn"
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
          </div>

          <div className="menu__actions">
            {/*
              Aplicar setor à categoria inteira. Fica ao lado de "Novo item"
              porque é ação de CATEGORIA, e não de um produto — quem procura por
              ela está olhando a categoria aberta, não uma linha da lista.
            */}
            <button
              type="button"
              className="btn"
              onClick={() => setApplyingSector(true)}
              disabled={!selectedCategory || !branchChosen}
              title={
                branchChosen
                  ? undefined
                  : 'Setor é por filial: escolha uma no topo para aplicar a esta categoria.'
              }
              data-testid="apply-sector-open"
            >
              Aplicar setor à categoria
            </button>

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
        </div>

        <div className="menu__list">
          {/* A lista é um cartão em superfície elevada sobre o fundo da página:
              é o que separa "a área de trabalho" do resto da tela. */}
          <div className="menu__card">
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
        </div>

        <footer className="menu__footer faint">
          <span>
            {menu.products.length} de {menu.totalInCategory}{' '}
            {menu.totalInCategory === 1 ? 'item' : 'itens'} nesta categoria
          </span>
          {menu.products.length < menu.totalInCategory ? (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => void menu.loadMoreProducts()}
              disabled={menu.isLoadingProducts}
            >
              Carregar mais
            </button>
          ) : null}
        </footer>
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
        />
      ) : null}

      {applyingSector && selectedCategory ? (
        <ApplySectorDialog
          categoryName={selectedCategory.name}
          // O total da categoria, e não o que está carregado na tela: a ação
          // atinge a categoria inteira, inclusive o que a paginação não trouxe.
          productCount={menu.totalInCategory}
          sectors={printing.sectors}
          isSaving={isApplyingSector}
          onClose={() => setApplyingSector(false)}
          onConfirm={(printSectorId) => void handleApplySector(printSectorId)}
        />
      ) : null}
    </div>
  );
}
