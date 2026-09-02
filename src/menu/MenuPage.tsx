import { useState } from 'react';

import { useAdoptedBranch } from '../auth/use-branch-scope';
import { useSession } from '../auth/session-context';
import { catalogPairingApplies } from './catalog-key';
import { branchName } from '../layout/branch-heading';
import { usePrintSectors } from '../print-sectors/usePrintSectors';
import { ApplySectorDialog } from './ApplySectorDialog';
import { usePermissoes } from '../auth/use-permissions';
import { CategoryActionsMenu } from './CategoryActionsMenu';
import { CategoryDialog } from './CategoryDialog';
import { CategoryRail } from './CategoryRail';
import { PlusIcon } from '../ds/icons';
import { PageBar } from '../ds/PageBar';
import { SearchField } from '../ds/SearchField';
import { countBlockedByRequiredGroup, isCategoryActive, productDraftFrom } from './menu-model';
import { ProductDialog } from './ProductDialog';
import { qualifiersByProduct } from './product-name';
import { ProductRow } from './ProductRow';
import { useMenu, type CategoryDraft, type ProductDraft } from './useMenu';
import { useReorderDrag } from './useReorderDrag';
import { Checkbox } from '../ds/Checkbox';
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
 *
 * ----------------------------------------------------------------------------
 * A TELA PASSOU A SER DE UMA LOJA, E NÃO DO RESTAURANTE
 * ----------------------------------------------------------------------------
 *
 * Ela sabia de filial por um detalhe: o setor de impressão era da loja, e o
 * resto do cardápio era da rede. Hoje é o contrário — produto, preço,
 * disponibilidade e categoria são todos da filial, sem herança entre lojas.
 *
 * O SINTOMA DE NÃO SABER DISSO ERA A TELA DOBRADA: "Promoções 10 / Promoções
 * 10", "Entradas 29 / Entradas 29" na barra de categorias, cada item duas
 * vezes na lista. Não era erro de ninguém — a leitura sem recorte devolve o
 * cardápio de todas as filiais que o token alcança, e num restaurante de duas
 * lojas isso é o cardápio duas vezes, com 200 e sem log.
 *
 * Por isso ela ADOTA a filial (`useAdoptedBranch`) em vez de só resolvê-la, e é
 * a mesma decisão das seções de Loja: a tela inteira fala de uma loja,
 * então o cabeçalho tem que dizer a mesma coisa. O seletor do topo deixa de
 * oferecer "Todas as filiais" enquanto ela está aberta — não porque escolher
 * seja proibido, mas porque ali "todas" não é um recorte mais largo: é o
 * cardápio das duas somado, que é o defeito, não um estado.
 *
 * O QUE ELA NÃO FAZ É PEDIR A FILIAL ANTES DE ABRIR. Sem escolha, o painel usa
 * a principal e DIZ qual é — a parede com um botão por loja é o padrão que
 * `auth/branch-scope.ts` existe para não repetir.
 */
/**
 * De que lado do item a linha de destino do arrastar e desenhada.
 *
 * DUAS RESPOSTAS E NAO UMA, porque a ultima posicao nao tem item depois dela:
 * soltar no fim da lista precisa de uma linha DEPOIS do ultimo, e marcar so
 * "antes" deixaria o gesto sem destino visivel justamente na posicao mais
 * usada - mandar um item para o fim.
 */
function dropDoItem(
  drag: { from: number; to: number } | null,
  index: number,
): 'antes' | 'depois' | undefined {
  if (!drag || drag.from === drag.to) return undefined;
  if (drag.to !== index) return undefined;
  return drag.to > drag.from ? 'depois' : 'antes';
}

export function MenuPage() {
  const { branchId, branch, hasChoice } = useAdoptedBranch();
  const { pode, podeDefinirPreco } = usePermissoes();
  const menu = useMenu(branchId);
  /*
   * A chave de catálogo só existe para agrupar DUAS lojas no relatório. Com uma
   * só, o campo do diálogo seria um controle que não distingue nada — e a busca
   * por trás dele não teria onde procurar.
   */
  const catalogPairing = catalogPairingApplies(useSession().branches);
  const printing = usePrintSectors(branchId);
  const branchChosen = branchId !== '';
  /* Nomeia a filial só quando há mais de uma: com uma só não desambigua nada. */
  const branchLabel = hasChoice && branch ? branchName(branch) : '';

  /** O que sobrou da última ação em massa: some no próximo clique. */
  const [resultadoEmMassa, setResultadoEmMassa] = useState<string | null>(null);

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

  /*
   * QUANTOS ITENS SAÍRAM DE VENDA SOZINHOS.
   *
   * O número sai de `unavailable_by_required_group`, que o backend calcula — a
   * tela não deduz mais esse estado (ver `menu-model.ts`). Ele existe porque a
   * etiqueta na linha, sozinha, não é ACHÁVEL: numa categoria de oitenta itens,
   * quem não estava rolando justamente por ali nunca vai ver a linha 47.
   *
   * Conta o que ESTÁ CARREGADO, e a frase diz isso quando a paginação cortou —
   * não existe rota que conte os bloqueados da categoria inteira, e um número
   * apresentado como total quando é parcial seria pior que número nenhum.
   */
  const bloqueados = countBlockedByRequiredGroup(menu.products);
  const listaParcial = menu.products.length < menu.totalInCategory;

  /* ========================================================================
   * REORDENAR ITEM — o punho, e as duas condições que o desligam
   *
   * A permissão é `cardapio.reordenarProdutos` (GERENCIA, como a de
   * categoria). As outras duas vêm da ROTA, não do papel:
   * `PATCH /admin/products/reorder` exige a lista COMPLETA da categoria, e
   * esta tela nem sempre a tem — a busca recorta, e a paginação corta em 50.
   *
   * Nos dois casos a tela DIZ o motivo em vez de sumir com o controle: um
   * punho que desaparece quando se digita na busca é lido como defeito.
   * ===================================================================== */
  const podeReordenarItem = pode('cardapio.reordenarProdutos');
  const reordenavel = podeReordenarItem && menu.canReorderProducts;

  const arrastarItem = useReorderDrag({
    count: menu.products.length,
    onReorder: (from, to) => void menu.reorderProductTo(from, to),
    disabled: !reordenavel,
  });

  /*
   * A SELEÇÃO MÚLTIPLA DEPENDE DO MESMO PAPEL DO INTERRUPTOR DA LINHA.
   *
   * Não existe rota em lote no contrato: a ação em massa chama
   * `PATCH /admin/products/{id}/availability` N vezes — a MESMA do interruptor,
   * que é `PESSOAS`. Logo, quem pode marcar um item pode marcar cinco, e não há
   * botão a esconder do balcão. Se algum dia nascer uma rota em lote com papel
   * próprio, é esta linha que muda.
   */
  const podeSelecionar = pode('cardapio.trocarDisponibilidade');
  const selecionados = menu.selectedIds.length;

  async function marcarEmMassa(isAvailable: boolean) {
    setResultadoEmMassa(null);
    const resultado = await menu.setAvailabilityForMany(isAvailable);
    if (!resultado) return;

    /*
     * O DESFECHO É DITO SEMPRE, inclusive no sucesso: são N requisições sem
     * atomicidade nenhuma (ver `setAvailabilityForMany`), e "cinco itens
     * marcados" é a única confirmação de que os cinco foram mesmo. No meio do
     * serviço ninguém confere linha por linha.
     */
    if (resultado.falharam.length === 0) {
      setResultadoEmMassa(
        `${resultado.gravados === 1 ? '1 item' : `${resultado.gravados} itens`} ${
          isAvailable ? 'de volta ao cardápio' : 'marcados como esgotados'
        }.`,
      );
      return;
    }
    setResultadoEmMassa(
      `${resultado.gravados === 0 ? 'Nenhum item foi alterado' : `${resultado.gravados} de ${resultado.gravados + resultado.falharam.length} foram alterados`}. Não deu para mudar: ${resultado.falharam.join(', ')}. A seleção continua marcada para tentar de novo.`,
    );
  }

  /*
   * AS AÇÕES SOBRE A CATEGORIA ABERTA, filtradas pelo papel.
   *
   * Montadas antes do JSX porque a lista precisa ser MEDIDA — é o comprimento
   * dela que decide se o menu de três pontinhos existe.
   */
  const acoesDaCategoria = [
    ...(pode('cardapio.editarCategoria')
      ? [
          {
            id: 'editar-categoria',
            label: 'Editar categoria',
            onSelect: openEditCategory,
            testId: 'category-edit-open',
          },
        ]
      : []),
    ...(pode('cardapio.apontarSetorDaCategoria')
      ? [
          {
            id: 'aplicar-setor',
            label: 'Aplicar setor a todos os itens',
            // Sem `disabledReason`: a filial está resolvida, então a ação
            // sempre tem em qual loja aplicar. O diálogo é que nomeia a filial
            // antes de confirmar.
            onSelect: () => setApplyingSector(true),
            testId: 'apply-sector-open',
          },
        ]
      : []),
  ];

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
      // E nasce sem par, que é o estado normal: a maioria dos itens não tem
      // gêmeo em outra loja. Quem tem, o lojista aponta no próprio diálogo.
      catalog: null,
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

          ELA É DO DONO, e não da gerência como o resto do cardápio: `price` é
          obrigatório em `POST /admin/products`, então quem cria item define
          preço. O gerente edita nome, descrição e categoria de um item que já
          existe — o campo de preço é que some para ele (ver `ProductDialog`).
        */}
        {pode('cardapio.criarProduto') ? (
          <button
            type="button"
            className="btn btn--primary menu__new"
            onClick={openNewProduct}
            disabled={!selectedCategory}
          >
            <PlusIcon />
            Novo item
          </button>
        ) : null}
      </PageBar>

      {/*
        A FRASE DE ESCOPO, e ela mudou de assunto.

        Dizia "o cardápio é do restaurante inteiro. Só a coluna Impressão é de
        uma loja" — o que era verdade até o cardápio passar a ser da filial, e
        virou a afirmação mais perigosa da tela: ela convidava o lojista a
        baixar um preço achando que baixava nas duas lojas. Hoje ela diz o
        contrário, e diz ANTES da lista, que é onde o preço é editado.

        A ressalva continua sendo uma frase de prosa aqui, e não um recado no
        cabeçalho da coluna: "Pizzaria do Zé — Aldeota" em 140px quebrava em
        duas linhas, engordava a régua de rótulos e desalinhava "Item", "Preço"
        e "Situação" do que nomeiam.
      */}
      <p className="t-aux menu__note" data-testid="menu-sector-scope">
        {!branchChosen ? (
          /*
            Sem filial nenhuma no acesso não há cardápio a mostrar — e a frase
            diz isso em vez de deixar a tela vazia parecer um cardápio vazio,
            que são coisas diferentes e levam a ações diferentes.
          */
          <>Este acesso não alcança nenhuma filial, e o cardápio é de uma filial.</>
        ) : branchLabel ? (
          <>
            Este é o cardápio da <strong>{branchLabel}</strong>: item, preço e disponibilidade valem
            só nesta loja. As outras têm o cardápio delas — inclusive o setor de impressão da coluna
            Impressão.
          </>
        ) : (
          <>
            O cardápio é desta loja. A coluna Impressão diz em qual setor da cozinha cada item sai
            na comanda.
          </>
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
          /*
            SEM O HANDLER, SEM O CONTROLE. Reordenar e criar categoria são da
            gerência; o balcão continua vendo a lista inteira e trocando de
            categoria, que é o que ele veio fazer.
          */
          onMove={
            pode('cardapio.reordenarCategorias')
              ? (index, direction) => void menu.reorderCategory(index, direction)
              : undefined
          }
          onMoveTo={
            pode('cardapio.reordenarCategorias')
              ? (from, to) => void menu.reorderCategoryTo(from, to)
              : undefined
          }
          onMoveSettled={menu.clearMovedCategory}
          onNew={
            pode('cardapio.criarCategoria')
              ? () => setCategoryDraft({ id: null, name: '', isActive: true })
              : undefined
          }
        />

        <section
          className={`menu__panel${
            podeSelecionar && selecionados > 0 ? ' menu__panel--selecionando' : ''
          }`}
        >
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
            {/*
              AS DUAS AÇÕES SÃO DA GERÊNCIA, e sem nenhuma delas o menu inteiro
              não é desenhado: três pontinhos que abrem uma lista vazia são o
              controle mais frustrante que uma tela pode ter.
            */}
            {selectedCategory && acoesDaCategoria.length > 0 ? (
              <CategoryActionsMenu actions={acoesDaCategoria} />
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
            <>
              {/* ============================================================
                  O AVISO DO ITEM QUE SAIU DE VENDA SOZINHO

                  ELE NÃO É ERRO E NÃO É ESCOLHA — é a terceira coisa, e é a
                  única da tela que o lojista não fez. `.alert--warn` responde
                  exatamente essa pergunta ("isto precisa de olho"), e é a
                  mesma tinta da etiqueta na linha: quem lê o aviso reconhece a
                  marca lá embaixo sem que ninguém precise ligar as duas.

                  ELE APARECE UMA VEZ POR TELA, no alto da lista, e não uma vez
                  por linha: a etiqueta já marca cada item, e repetir a
                  explicação em cada uma viraria listra (§8). Aqui ele diz o que
                  aconteceu e O QUE FAZER, que é o que a etiqueta de 116px não
                  tem como caber.
              ============================================================ */}
              {bloqueados > 0 ? (
                <p
                  className="alert alert--warn menu__bloqueados"
                  role="status"
                  data-testid="menu-bloqueados"
                >
                  {bloqueados === 1
                    ? 'Um item desta lista está fora de venda'
                    : `${bloqueados} itens desta lista estão fora de venda`}{' '}
                  porque um grupo obrigatório ficou sem nenhuma opção ativa — o cliente abre o item
                  e não consegue fechar o pedido. Abra o item e reative uma opção do grupo, ou
                  desligue o grupo se ele não for mais obrigatório.
                  {listaParcial
                    ? ` A contagem é dos ${menu.products.length} itens carregados; pode haver mais adiante na categoria.`
                    : ''}
                </p>
              ) : null}

              {/*
                As duas colunas opcionais entram por modificador no ENVOLTÓRIO,
                não na linha: elas valem para a lista inteira (a de setor depende
                da filial, a de foto da categoria), e o cabeçalho tem que usar
                exatamente a mesma grade das linhas — senão o rótulo não fica em
                cima do que nomeia.
              */}
              {/*
                POR QUE O PUNHO NAO ESTA AI - dito, e nao escondido.

                `PATCH /admin/products/reorder` exige a lista COMPLETA da
                categoria; com a busca ligada ou com a paginacao cortando, a
                tela tem um recorte. Sumir com o controle sem explicar faz o
                lojista procurar o que ele fez de errado; a frase diz o que
                desfazer para reordenar.
              */}
              {podeReordenarItem && !menu.canReorderProducts ? (
                <p className="t-aux menu__sem-arrastar" data-testid="menu-sem-arrastar">
                  {menu.searchDraft.trim() !== ''
                    ? 'Para reordenar os itens, limpe a busca: a nova ordem vale para a categoria inteira, e a busca mostra so parte dela.'
                    : `Para reordenar os itens, carregue a categoria inteira - a ordem vale para os ${menu.totalInCategory} itens, e ${menu.products.length} estao na tela.`}
                </p>
              ) : null}

              {/* ============================================================
                  A BARRA DA SELECAO

                  Ela SO EXISTE COM ALGO SELECIONADO, e gruda no alto da lista.
                  Uma barra permanente com "0 selecionados" e dois botoes
                  desligados seria mais uma fileira antes do primeiro item numa
                  tela cuja rolagem ja e o problema.

                  Ela NAO e um cartao nem um dialogo: e uma faixa tonal com um
                  fio. As duas acoes sao igualmente provaveis - no comeco do
                  servico se repoe, no meio se esgota -, entao NENHUMA delas e
                  primaria: dois `.btn` comuns. Um laranja aqui seria o segundo
                  laranja da tela, e o desta tela e o "Novo item".
              ============================================================ */}
              {podeSelecionar && selecionados > 0 ? (
                <div className="menu__selecao" data-testid="menu-selecao">
                  <span className="menu__selecao-contagem">
                    {selecionados === 1
                      ? '1 item selecionado'
                      : `${selecionados} itens selecionados`}
                  </span>

                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={menu.isBulkSaving}
                    onClick={() => void marcarEmMassa(false)}
                    data-testid="menu-esgotar-selecionados"
                  >
                    {menu.isBulkSaving ? 'Marcando...' : 'Marcar como esgotados'}
                  </button>

                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={menu.isBulkSaving}
                    onClick={() => void marcarEmMassa(true)}
                    data-testid="menu-repor-selecionados"
                  >
                    Marcar como disponiveis
                  </button>

                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    disabled={menu.isBulkSaving}
                    onClick={() => {
                      menu.clearSelection();
                      setResultadoEmMassa(null);
                    }}
                  >
                    Limpar
                  </button>
                </div>
              ) : null}

              {/*
                O DESFECHO DA ACAO EM MASSA, e ele e `role="status"` para o
                leitor de tela anunciar sozinho: quem acabou de marcar cinco
                itens nao esta olhando para o rodape da lista.
              */}
              {resultadoEmMassa ? (
                <p
                  className="alert alert--info menu__resultado"
                  role="status"
                  data-testid="menu-resultado-massa"
                >
                  {resultadoEmMassa}
                </p>
              ) : null}

              <div
                className={`menu__table${showPhoto ? ' menu__table--with-photo' : ''}${
                  branchChosen ? ' menu__table--with-sector' : ''
                }${reordenavel ? ' menu__table--reordenavel' : ''}${
                  podeSelecionar ? ' menu__table--selecionavel' : ''
                }`}
              >
                <div className="menu__columns t-label">
                  {reordenavel ? <span /> : null}
                  {podeSelecionar ? (
                    /*
                      A CAIXA DE "TODOS" MORA NO CABECALHO DA COLUNA que ela
                      comanda - e onde toda tabela a poe, e e o que a torna
                      encontravel sem instrucao.

                      "Todos" E O QUE ESTA NA TELA, e o rotulo acessivel diz o
                      numero: a lista e paginada e pode estar filtrada pela
                      busca, e uma caixa que marcasse a categoria inteira faria
                      cinco itens virarem quarenta sem ninguem ter pedido.
                    */
                    <Checkbox
                      hideLabel
                      checked={selecionados > 0 && selecionados === menu.products.length}
                      indeterminate={selecionados > 0}
                      onChange={menu.toggleSelectAll}
                      label={
                        selecionados > 0
                          ? 'Limpar a selecao'
                          : `Selecionar os ${menu.products.length} itens desta lista`
                      }
                      data-testid="menu-selecionar-todos"
                    />
                  ) : null}
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
                  {menu.products.map((product, index) => (
                    <ProductRow
                      key={product.id}
                      itemRef={arrastarItem.registrar(index)}
                      product={product}
                      punho={reordenavel ? arrastarItem.punho(index) : undefined}
                      onMove={
                        reordenavel
                          ? (direction) => void menu.reorderProductTo(index, index + direction)
                          : undefined
                      }
                      isFirst={index === 0}
                      isLast={index === menu.products.length - 1}
                      drop={dropDoItem(arrastarItem.drag, index)}
                      isDragging={arrastarItem.drag?.from === index}
                      selected={menu.selectedIds.includes(product.id)}
                      onSelect={podeSelecionar ? () => menu.toggleSelected(product.id) : undefined}
                      sectors={printing.sectors}
                      showPhoto={showPhoto}
                      showSector={branchChosen}
                      qualifier={qualifiers[product.id] ?? null}
                      isSaving={menu.pendingAvailability.includes(product.id)}
                      onToggleAvailability={() => void menu.toggleAvailability(product)}
                      /*
                      O RASCUNHO SAI DE UMA FUNÇÃO TESTADA, e não de um objeto
                      montado aqui: o corpo do PATCH manda `catalog_key`
                      sempre, então um campo esquecido nesta lista desfaria o
                      pareamento de um item porque alguém corrigiu o preço.
                    */
                      onEdit={
                        pode('cardapio.editarProduto')
                          ? () => setProductDraft(productDraftFrom(product))
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </div>
            </>
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
          branchId={branchId}
          catalogPairing={catalogPairing}
          podeDefinirPreco={podeDefinirPreco}
          podeEditarComplemento={pode('cardapio.editarComplemento')}
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
