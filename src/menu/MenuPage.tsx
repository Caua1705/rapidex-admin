import { useState } from 'react';

import { useSession } from '../auth/session-context';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { ApplySectorDialog } from './ApplySectorDialog';
import { CategoryActionsMenu } from './CategoryActionsMenu';
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
                    disabledReason: branchChosen
                      ? undefined
                      : 'Setor é por filial: escolha uma no topo para aplicar a esta categoria.',
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

        {/* A lista é a área de trabalho: um degrau de tom acima do fundo da
            página, sem cartão dentro de cartão. */}
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
              <span className="tnum">{menu.products.length}</span> de{' '}
              <span className="tnum">{menu.totalInCategory}</span> itens na tela
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
