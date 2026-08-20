import { useState } from 'react';

import { useResolvedBranch } from '../auth/use-branch-scope';
import { branchName } from '../layout/branch-heading';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { ApplySectorDialog } from './ApplySectorDialog';
import { CategoryActionsMenu } from './CategoryActionsMenu';
import { CategoryDialog } from './CategoryDialog';
import { CategoryRail } from './CategoryRail';
import { PlusIcon } from '../ds/icons';
import { PageBar } from '../ds/PageBar';
import { SearchField } from '../ds/SearchField';
import { formatPriceInput, isCategoryActive } from './menu-model';
import { ProductDialog } from './ProductDialog';
import { qualifiersByProduct } from './product-name';
import { ProductRow } from './ProductRow';
import { useMenu, type CategoryDraft, type ProductDraft } from './useMenu';
import './MenuPage.css';

/**
 * CARDÁPIO.
 *
 * A TELA PASSOU A SER UMA PÁGINA, e não mais duas caixas esticadas até o pé do
 * navegador. O enquadramento anterior era `flex: 1` nos dois painéis: com três
 * itens numa categoria, dois retângulos vazios ocupavam dois terços de um
 * monitor de 1440 e a tela inteira lia como um esqueleto de wireframe. Aqui o
 * cardápio usa o mesmo enquadramento de Clientes e Desempenho — título da
 * página, uma frase de escopo, e cartões que ENCOLHEM até o tamanho do que
 * têm dentro (§7). O que sobra embaixo é o chão da página, não caixa vazia.
 *
 * As duas colunas grudam no alto enquanto a página rola: a barra de categorias
 * é a navegação da tela e o cabeçalho de colunas nomeia o que está passando.
 */
export function MenuPage() {
  const menu = useMenu();
  /*
   * Os setores são da FILIAL, enquanto o cardápio é do restaurante inteiro. É
   * o cruzamento que obriga esta tela a saber de filial: em qual setor um item
   * imprime é uma resposta diferente em cada loja. A filial é RESOLVIDA (a
   * principal, na falta de escolha) — ver `auth/branch-scope.ts`.
   */
  const { branchId, branch, hasChoice } = useResolvedBranch();
  const printing = usePrintSectors(branchId);
  const branchChosen = branchId !== '';
  /* Nomeia a filial só quando há mais de uma: com uma só não desambigua nada. */
  const sectorBranchLabel = hasChoice && branch ? branchName(branch) : '';

  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [applyingSector, setApplyingSector] = useState(false);
  const [isApplyingSector, setIsApplyingSector] = useState(false);

  const { selectedCategory } = menu;

  /*
   * A COLUNA DE FOTO SÓ EXISTE SE A CATEGORIA TEM FOTO.
   *
   * Onde há foto ela vale 44px de largura; onde não há nenhuma, uma coluna de
   * contornos tracejados é literalmente uma coluna de buracos, e o nome do item
   * começa na borda.
   */
  const showPhoto = menu.products.some((product) => product.image_url);

  /*
   * Os nomes que se repetem na lista, partidos em base + qualificador. Ver
   * `product-name.ts`.
   */
  const qualifiers = qualifiersByProduct(menu.products);

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

  function openEditCategory() {
    if (!selectedCategory) return;
    setCategoryDraft({
      id: selectedCategory.id,
      name: selectedCategory.name,
      isActive: isCategoryActive(selectedCategory),
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
      {/*
        A MESMA FAIXA DE 52px DE TODAS AS TELAS (`ds/PageBar`).

        O título desta tela era o NOME DA CATEGORIA aberta — então "Cardápio"
        não aparecia em lugar nenhum fora da lateral, e o painel começava sem
        dizer onde a pessoa estava. Hoje o nível 1 é o nome da tela, como em
        toda outra, e a categoria desce para o nível 2, na régua da lista que
        ela nomeia.

        A BUSCA SUBIU PARA CÁ. Ela morava dentro da régua da lista, disputando
        a linha com o nome da categoria e com o menu de ações — três coisas de
        naturezas diferentes na mesma barra. Ferramenta de tela mora na faixa
        de tela, que é onde Pedidos e Clientes já a põem.
      */}
      <PageBar title="Cardápio">
        <div className="menu__busca">
          <SearchField
            label="Buscar item nesta categoria"
            placeholder="Buscar item"
            value={menu.searchDraft}
            onValueChange={menu.setSearchDraft}
            disabled={!selectedCategory}
          />
        </div>

        {/*
          A AÇÃO DO DIA, e o único laranja desta tela. Ela morava dentro do
          cartão da lista, onde dividia a régua com o nome da categoria e ficava
          ao lado de duas ações de outro peso.
        */}
        <button
          type="button"
          className="btn btn--primary menu__new"
          onClick={openNewProduct}
          disabled={!selectedCategory}
        >
          <PlusIcon />
          Novo item
        </button>
      </PageBar>

      {/*
        A FRASE DE ESCOPO, e é ela que carrega "de qual loja é a coluna
        Impressão".

        Esse recado morava no cabeçalho da própria coluna, e ali ele não cabia:
        "Pizzaria do Zé — Aldeota" em 140px quebrava em duas linhas, engordava a
        régua de rótulos e desalinhava "Item", "Preço" e "Situação" do que
        nomeiam. Dito uma vez aqui, em prosa, ele sai inteiro e legível — o
        mesmo lugar em que Clientes diz o que a tela não tem.
      */}
      <p className="t-aux menu__note" data-testid="menu-sector-scope">
        {branchChosen ? (
          sectorBranchLabel ? (
            <>
              O cardápio é do restaurante inteiro. Só a coluna Impressão é de uma loja: ela responde
              pela <strong>{sectorBranchLabel}</strong>.
            </>
          ) : (
            <>
              O cardápio é do restaurante inteiro. A coluna Impressão diz em qual setor da cozinha
              cada item sai na comanda.
            </>
          )
        ) : (
          <>O cardápio é do restaurante inteiro: itens e categorias valem em todas as lojas.</>
        )}
      </p>

      {menu.errorMessage ? (
        <p className="alert alert--error" role="alert">
          {menu.errorMessage}
        </p>
      ) : null}

      <div className="menu__body">
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
          {/*
            A RÉGUA DA LISTA: o nome da categoria aberta e o que se faz COM ela.

            Ela é subordinada à faixa da tela — 44px contra 52px, nível 2 contra
            nível 1 — e é isso que faz "Cardápio › Pizzas" ler como uma coisa
            dentro da outra, em vez de dois títulos do mesmo tamanho a dois
            blocos de distância.
          */}
          <header className="menu__panel-head">
            <h2 className="t-section menu__panel-title">
              {selectedCategory?.name ?? 'Nenhuma categoria'}
            </h2>
            {selectedCategory && !isCategoryActive(selectedCategory) ? (
              <span className="tag">Inativa</span>
            ) : null}

            {/*
              UM CONTROLE, NÃO TRÊS. Editar a categoria era um lápis solto ao
              lado do nome, e aplicar setor um segundo botão de ícone logo
              depois: duas caixinhas mudas de 32px disputando a mesma régua com
              o título. As duas são ações SOBRE A CATEGORIA e agora moram no
              mesmo menu, escritas por extenso — o que também é o que separa
              "renomear" de "sobrescrever o setor de todos os itens".
            */}
            {selectedCategory ? (
              <CategoryActionsMenu
                actions={[
                  {
                    id: 'editar-categoria',
                    label: 'Editar categoria',
                    onSelect: openEditCategory,
                    testId: 'category-edit-open',
                  },
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
          </header>

          {menu.isLoadingCategories ? (
            <p className="menu__empty faint">Carregando o cardápio…</p>
          ) : menu.categories.length === 0 ? (
            <p className="menu__empty faint">
              Nenhuma categoria ainda. Crie a primeira para começar o cardápio.
            </p>
          ) : menu.products.length === 0 ? (
            /*
              DUAS AUSÊNCIAS DIFERENTES, DUAS FRASES DIFERENTES. "Nenhum item
              encontrado" servia para as duas e mentia numa: numa categoria
              recém-criada, sem busca nenhuma, "encontrado" faz o lojista
              procurar um filtro que ele não ligou. Sem busca a categoria está
              vazia, e a frase diz o que fazer a respeito.
            */
            <p className="menu__empty faint">
              {menu.isLoadingProducts
                ? 'Carregando…'
                : menu.searchDraft.trim() !== ''
                  ? 'Nenhum item desta categoria casa com a busca.'
                  : 'Esta categoria ainda não tem itens. Crie o primeiro em “Novo item”.'}
            </p>
          ) : (
            /*
              As duas colunas opcionais entram por modificador no ENVOLTÓRIO,
              não na linha: elas valem para a lista inteira (a de setor depende
              da filial, a de foto da categoria), e o cabeçalho tem que usar
              exatamente a mesma grade das linhas — senão o rótulo não fica em
              cima do que nomeia.
            */
            <div
              className={`menu__table${showPhoto ? ' menu__table--with-photo' : ''}${
                branchChosen ? ' menu__table--with-sector' : ''
              }`}
            >
              <div className="menu__columns t-label">
                {showPhoto ? <span /> : null}
                <span>Item</span>
                <span className="menu__col-price">Preço</span>
                {branchChosen ? <span>Impressão</span> : null}
                <span className="menu__col-state">Situação</span>
                {/* A ação: coluna de controle, larga demais para um rótulo de
                    32px e óbvia demais para precisar de um. */}
                <span />
              </div>

              <ul className="menu__items">
                {menu.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    sectors={printing.sectors}
                    showPhoto={showPhoto}
                    showSector={branchChosen}
                    qualifier={qualifiers[product.id] ?? null}
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
            </div>
          )}

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
      </div>

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
