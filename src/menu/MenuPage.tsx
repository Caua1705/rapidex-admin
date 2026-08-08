import { useState } from 'react';

import { CategoryDialog } from './CategoryDialog';
import { CategoryRail } from './CategoryRail';
import { EditIcon, PlusIcon, SearchIcon } from './icons';
import { formatPriceInput, isCategoryActive } from './menu-model';
import { ProductDialog } from './ProductDialog';
import { ProductRow } from './ProductRow';
import { useMenu, type CategoryDraft, type ProductDraft } from './useMenu';
import './MenuPage.css';

export function MenuPage() {
  const menu = useMenu();
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);

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
    });
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

          <button
            type="button"
            className="btn btn--primary"
            onClick={openNewProduct}
            disabled={!selectedCategory}
          >
            <PlusIcon />
            Novo item
          </button>
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
            <ul className="menu__items">
              {menu.products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
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
                    })
                  }
                />
              ))}
            </ul>
          )}
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
          onClose={() => setProductDraft(null)}
          onSave={menu.saveProduct}
        />
      ) : null}
    </div>
  );
}
