import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchProductDetail, setOptionActive } from '../api/menu';
import type { Category, PrintSector, ProductOptionGroup } from '../api/types';
import { Select } from '../ds/Select';
import { formatCurrency } from '../orders/format';
import { activeSectors, NO_SECTOR_LABEL, sectorLabelFor } from '../print-sectors/print-sectors';
import { Modal } from '../ui/Modal';
import { Switch } from '../ds/Switch';
import { CatalogPairField } from './CatalogPairField';
import { parsePriceInput } from './menu-model';
import { ProductImageField } from './ProductImageField';
import { blockingRequiredGroup, groupEmptiedByDeactivating } from './required-groups';
import type { ProductDraft } from './useMenu';

/**
 * Novo item / editar item.
 *
 * Os dois interruptores são eixos diferentes e a tela diz isso em palavras:
 * "Item ativo" é estar no cardápio; "Disponível hoje" é ter na cozinha agora.
 * Quando o item está inativo, disponibilidade não se aplica — o interruptor
 * fica travado em vez de sumir, para que o motivo apareça em vez de o controle
 * simplesmente não existir.
 *
 * Grupos de complemento aparecem só para leitura: eles têm rotas próprias
 * (`/admin/products/{id}/option-groups`, `/admin/option-groups/{id}`) e editá-los
 * aqui, junto do preço, misturaria dois salvamentos independentes num botão só.
 */
export function ProductDialog({
  initial,
  categories,
  sectors,
  branchChosen,
  branchId,
  catalogPairing,
  podeDefinirPreco,
  onClose,
  onSave,
  onImageUploaded,
}: {
  initial: ProductDraft;
  categories: Category[];
  /** Setores da filial aberta no cabeçalho. Só os ativos são escolhíveis. */
  sectors: readonly PrintSector[];
  /** Falso com "Todas as filiais": não há de qual filial oferecer setor. */
  branchChosen: boolean;
  /** A filial deste item — a única que a busca de gêmeo NÃO varre. */
  branchId: string;
  /**
   * Oferecer o pareamento de catálogo. Falso num restaurante de uma loja só,
   * onde não há o que agrupar — ver `catalogPairingApplies`.
   *
   * Vem como propriedade, e não de `useSession()` aqui dentro, porque este
   * diálogo é montado em teste sem provider nenhum: ler a sessão daqui
   * transformaria "não tem segunda loja" em uma exceção na montagem.
   */
  catalogPairing: boolean;
  /**
   * O CAMPO DE PREÇO EXISTE PARA ESTE PAPEL.
   *
   * `PATCH /admin/products/{id}` é da gerência, mas o preço é do dono — é a
   * única regra do backend em que quem decide é o CORPO e não a rota, e por
   * isso ela chega aqui como propriedade em vez de sair do mapa de rotas.
   *
   * Vem de fora, e não de `usePermissoes()` aqui dentro, pelo mesmo motivo de
   * `catalogPairing`: este diálogo é montado em teste sem provider nenhum.
   */
  podeDefinirPreco: boolean;
  onClose: () => void;
  /** Devolve o id salvo — é o que permite pôr foto sem fechar. `null` é falha. */
  onSave: (draft: ProductDraft, price: number | null) => Promise<string | null>;
  /**
   * A foto subiu. A rota é própria e não passa por `onSave`, então a lista
   * atrás do diálogo continuaria mostrando a miniatura vazia sem este aviso.
   */
  onImageUploaded: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[] | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  /** A opção que espera confirmação por tirar o item de venda. */
  const [confirmando, setConfirmando] = useState<{
    optionId: string;
    optionName: string;
    groupName: string;
  } | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);
  const [erroOpcao, setErroOpcao] = useState<string | null>(null);
  /**
   * No item novo: o lojista pediu para pôr foto, então salvar NÃO fecha.
   *
   * O padrão é falso de propósito. Quem sobe cardápio faz em série — vinte
   * itens seguidos —, e um diálogo que sempre fica aberto cobra um fechamento
   * manual em cada um deles. A foto é o caso em que ficar aberto é o favor, e
   * é ele que o botão marca.
   */
  const [querFoto, setQuerFoto] = useState(false);

  /*
   * O ID VEM DO RASCUNHO, não de `initial`. São a mesma coisa até o lojista
   * pedir a foto num item novo: ali o item passa a existir e o diálogo vira
   * edição SEM FECHAR, porque a foto precisa do id que acabou de nascer. Se
   * `isEdit` continuasse lendo `initial.id`, o diálogo seguiria se dizendo
   * "Novo item" com um item já criado atrás dele — e o campo da foto
   * continuaria oferecendo o botão de PEDIR foto, no lugar do de enviá-la.
   */
  const isEdit = draft.id !== null;
  /** Nasceu neste diálogo: o rodapé não pode mais oferecer "Cancelar". */
  const criadoAqui = initial.id === null && draft.id !== null;
  const price = parsePriceInput(draft.price);
  const priceIsInvalid = draft.price.trim() !== '' && price === null;
  /*
   * Sem o campo de preço na tela, ele não pode travar o salvamento: para o
   * gerente o rascunho carrega o preço atual e ele nem aparece, então exigir
   * que ele seja válido seria travar o botão por um campo invisível.
   */
  const canSave = draft.name.trim().length > 0 && (!podeDefinirPreco || price !== null) && !saving;

  const carregarDetalhe = useCallback(async (productId: string) => {
    const detail = await fetchProductDetail(productId);
    setOptionGroups(detail.option_groups ?? []);
    setImageUrl(detail.image_url ?? null);
  }, []);

  // Segue `draft.id` para também correr no item recém-criado: ele volta com
  // zero grupos e sem foto, e é esse vazio que a tela precisa mostrar.
  useEffect(() => {
    const productId = draft.id;
    if (!productId) return;
    let cancelled = false;

    void (async () => {
      try {
        const detail = await fetchProductDetail(productId);
        if (cancelled) return;
        setOptionGroups(detail.option_groups ?? []);
        setImageUrl(detail.image_url ?? null);
      } catch {
        // Os complementos são informação de apoio: não conseguir lê-los não
        // pode impedir a edição do nome e do preço, que é o que trouxe o
        // lojista até aqui.
        if (!cancelled) setOptionGroups([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draft.id]);

  /**
   * Liga/desliga uma opção de complemento.
   *
   * DEPOIS DO PATCH, RELÊ O PRODUTO. A resposta do PATCH é a OPÇÃO
   * (`AdminOptionResponse`) e não diz nada sobre o produto — se a tela
   * confiasse nela, o aviso de "saiu de venda" nunca apareceria, porque o
   * dado que o carrega não está ali.
   */
  async function alternarOpcao(optionId: string, isActive: boolean) {
    // `draft.id` pelo mesmo motivo de `isEdit`: depois de criar aqui, é ele que
    // aponta para o item que existe.
    const productId = draft.id;
    if (!productId) return;

    setAlternando(optionId);
    setErroOpcao(null);
    setConfirmando(null);
    try {
      await setOptionActive(optionId, isActive);
      await carregarDetalhe(productId);
    } catch (error) {
      setErroOpcao(messageFromUnknownError(error));
    } finally {
      setAlternando(null);
    }
  }

  /**
   * O clique no interruptor da opção: às vezes pergunta antes.
   *
   * Só quando desativar ESTA opção deixa um grupo obrigatório sem nenhuma
   * ativa. Perguntar em todo clique é o que ensina o lojista a confirmar sem
   * ler — e é justamente este aviso que ele precisa ler.
   */
  function pedirAlternancia(optionId: string, optionName: string, isActive: boolean) {
    if (!optionGroups) return;

    if (!isActive) {
      const grupo = groupEmptiedByDeactivating(optionGroups, optionId);
      if (grupo) {
        setConfirmando({ optionId, optionName, groupName: grupo.name });
        return;
      }
    }
    void alternarOpcao(optionId, isActive);
  }

  const grupoBloqueador = optionGroups ? blockingRequiredGroup(optionGroups) : null;

  /**
   * Salvar. FECHA, menos quando o lojista pediu a foto de um item novo.
   *
   * `onSave` devolve o id porque é ele que decide o desfecho: sem id não houve
   * gravação e o diálogo fica onde está, com o erro que `useMenu` já pôs na
   * tela; com id e com foto pedida, o rascunho ADOTA esse id e o diálogo vira
   * edição no lugar de fechar — é a única forma de a rota da foto ter a quem
   * enviar sem obrigar o lojista a reabrir o item que ele acabou de cadastrar.
   */
  async function handleSave() {
    if (podeDefinirPreco && price === null) return;
    const criando = draft.id === null;
    setSaving(true);
    // Nulo = o campo não vai no corpo. Ver `saveProduct` em `useMenu.ts`.
    const saved = await onSave(draft, podeDefinirPreco ? price : null);
    setSaving(false);
    if (!saved) return;

    if (criando && querFoto) {
      setDraft((atual) => ({ ...atual, id: saved }));
      return;
    }
    onClose();
  }

  /*
   * A CONFIRMAÇÃO É UM DIÁLOGO PRÓPRIO, e não um `confirm()` do navegador: o
   * nativo não aceita a tipografia nem o tom do sistema, e some atrás da
   * janela num segundo monitor — que é onde o painel costuma ficar no balcão.
   */
  if (confirmando) {
    return (
      <Modal
        title="Isto tira o item de venda"
        onClose={() => setConfirmando(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmando(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--danger"
              data-testid="confirm-deactivate-option"
              onClick={() => void alternarOpcao(confirmando.optionId, false)}
            >
              Desativar mesmo assim
            </button>
          </>
        }
      >
        <p className="t-body">
          “{confirmando.optionName}” é a última opção ativa do grupo obrigatório “
          {confirmando.groupName}”.
        </p>
        <p className="t-body">
          Sem nenhuma opção nesse grupo, <strong>{draft.name}</strong> sai do cardápio do cliente e
          os pedidos que já o tinham no carrinho são recusados. O item continua ativo aqui — ele só
          não tem como ser vendido.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title={isEdit ? 'Editar item' : 'Novo item'}
      onClose={onClose}
      footer={
        <>
          {/*
            "Cancelar" VIRA "Concluir" depois de criar aqui: o item já existe e
            não há mais o que cancelar. Oferecer a palavra antiga prometeria
            desfazer uma criação que este diálogo não desfaz — e não existe
            excluir item no sistema.
          */}
          <button type="button" className="btn" onClick={onClose}>
            {criadoAqui ? 'Concluir' : 'Cancelar'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? 'Salvando…' : querFoto && !isEdit ? 'Salvar e pôr foto' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="form">
        {/*
          O ITEM FOI CRIADO, E A TELA PRECISA DIZER ISSO. Este é o único lugar do
          sistema onde salvar não fecha o diálogo: sem uma frase afirmando a
          criação, o lojista vê a mesma janela aberta depois de clicar em salvar
          e conclui que não salvou — e cadastra o item de novo.
        */}
        {criadoAqui ? (
          <p className="alert alert--info" role="status" data-testid="product-created-notice">
            <strong>{draft.name}</strong> foi criado. Envie a foto abaixo — o item já está no
            cardápio, com ou sem ela.
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">Nome do item</span>
          <input
            className="input"
            type="text"
            autoFocus
            placeholder="Ex.: X-Burger Clássico"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>

        <div className="form__grid">
          {/*
            O CAMPO SOME PARA QUEM NÃO DEFINE PREÇO — não fica desabilitado.

            Um campo travado com o preço dentro é a pior das três formas: ele
            CONVIDA a corrigir o número, aceita o foco, e só recusa no salvar.
            Ausente, o gerente edita o que ele edita (nome, descrição,
            categoria) e o preço continua sendo o que o dono definiu.
          */}
          {podeDefinirPreco ? (
            <label className="field">
              <span className="field__label">Preço</span>
              <input
                className="input tnum"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={draft.price}
                aria-invalid={priceIsInvalid}
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              />
              {priceIsInvalid ? (
                <span className="field__error-text">Informe um valor como 24,90.</span>
              ) : null}
            </label>
          ) : null}

          <div className="field">
            <span className="field__label" aria-hidden="true">
              Categoria
            </span>
            <Select
              value={draft.categoryId}
              onChange={(categoryId) => setDraft({ ...draft, categoryId })}
              aria-label="Categoria"
              data-testid="product-category"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </div>
        </div>

        <label className="field">
          <span className="field__label">Descrição</span>
          <textarea
            className="textarea"
            placeholder="Ingredientes e detalhes do item"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>

        {/*
          MESMO ITEM EM OUTRA LOJA — logo depois do que o item É (nome, preço,
          categoria, descrição) e antes de como ele se liga à operação.

          A posição importa: a pergunta é de IDENTIDADE, e ela só se responde
          com o nome já digitado — é dele que a busca parte. Mais abaixo, junto
          dos interruptores, ela viraria uma opção que ninguém desce para ler,
          e o item nasceria sem chave, que é o defeito de origem.
        */}
        {catalogPairing ? (
          <CatalogPairField
            branchId={branchId}
            productName={draft.name}
            pair={draft.catalog}
            onChange={(catalog) => setDraft({ ...draft, catalog })}
          />
        ) : null}

        {/*
          Setor de impressão. "Não imprimir" é a primeira opção e o padrão de
          item novo: nem tudo passa pela produção, e um item sem setor não é um
          cadastro incompleto.

          O seletor guarda '' para representar o null do backend — uma opção não
          carrega null. A conversão acontece aqui, num lugar só.

          O PLACEHOLDER DIZ POR QUE NÃO HÁ VALOR. Sem filial escolhida, o id
          gravado no produto não tem nome: setor é da filial, e este item pode
          imprimir em lugares diferentes em cada loja. O gatilho dizia
          "Escolher…", que é falso — não há o que escolher, e o item talvez já
          tenha setor.
        */}
        <div className="field">
          <span className="field__label" aria-hidden="true">
            Setor de impressão
          </span>
          <Select
            value={draft.printSectorId ?? ''}
            disabled={!branchChosen}
            placeholder={branchChosen ? NO_SECTOR_LABEL : 'Depende da filial'}
            onChange={(printSectorId) =>
              setDraft({ ...draft, printSectorId: printSectorId || null })
            }
            aria-label="Setor de impressão"
            data-testid="product-print-sector"
            options={sectorOptions(draft.printSectorId, sectors)}
          />
          <span className="field__hint">
            {!branchChosen
              ? 'Setor é por filial: escolha uma no topo para poder definir onde este item imprime.'
              : sectors.length === 0
                ? 'Esta filial ainda não tem setor cadastrado. Crie em Minha loja › Impressão.'
                : 'Onde o pedido com este item sai impresso.'}
          </span>
        </div>

        <div className="form__row">
          <Switch
            hideLabel
            checked={draft.isActive}
            onChange={(isActive) => setDraft({ ...draft, isActive })}
            label="Item ativo"
          />
          <div>
            <div className="form__switch-label">Item ativo</div>
            <p className="field__hint">
              Está no cardápio do cliente. Não existe excluir item — desative-o para tirar do ar sem
              apagar os pedidos que já o incluem.
            </p>
          </div>
        </div>

        <div className="form__row">
          <Switch
            hideLabel
            checked={draft.isActive && draft.isAvailable}
            disabled={!draft.isActive}
            onChange={(isAvailable) => setDraft({ ...draft, isAvailable })}
            label="Disponível hoje"
          />
          <div>
            <div className="form__switch-label">Disponível hoje</div>
            <p className="field__hint">
              {draft.isActive
                ? 'Tem na cozinha agora. Desligar marca o item como esgotado sem tirá-lo do cardápio.'
                : 'Não se aplica: um item inativo não está à venda.'}
            </p>
          </div>
        </div>

        <ProductImageField
          productId={draft.id}
          currentImageUrl={imageUrl}
          onUploaded={(url) => {
            setImageUrl(url);
            onImageUploaded();
          }}
          wantsPhoto={querFoto}
          onWantsPhotoChange={setQuerFoto}
        />

        {isEdit ? (
          <section className="form__section">
            <h3 className="form__section-title">Grupos de complemento</h3>

            {/*
              POR QUE O ITEM SUMIU DO CARDÁPIO SEM NINGUÉM DESLIGÁ-LO. Um grupo
              obrigatório sem nenhuma opção ativa tira o item de venda:
              `is_active` continua ligado, `is_available` continua ligado, e o
              cliente simplesmente não o vê. Sem esta faixa, a venda se perde
              em silêncio.
            */}
            {grupoBloqueador ? (
              <p className="alert alert--warn" data-testid="product-blocked-warning">
                Este item está fora de venda: o grupo obrigatório “{grupoBloqueador.name}” está sem
                nenhuma opção ativa. Reative uma opção dele para voltar ao cardápio.
              </p>
            ) : null}

            {optionGroups === null ? (
              <p className="faint">Carregando…</p>
            ) : optionGroups.length === 0 ? (
              <p className="faint">Nenhum grupo de complemento neste item.</p>
            ) : (
              <ul className="groups">
                {optionGroups.map((group) => (
                  <li key={group.id} className="groups__item">
                    <div className="groups__name">
                      {group.name}
                      <span className="faint">
                        {' '}
                        · {group.is_required ? 'obrigatório' : 'opcional'} · escolhe de{' '}
                        {group.min_select} a {group.max_select}
                        {group.is_active ? '' : ' · grupo desativado'}
                      </span>
                    </div>

                    <ul className="groups__options">
                      {(group.options ?? []).map((option) => (
                        <li key={option.id} className="groups__option">
                          <Switch
                            hideLabel
                            checked={option.is_active}
                            disabled={alternando !== null}
                            onChange={(isActive) =>
                              pedirAlternancia(option.id, option.name, isActive)
                            }
                            label={`${option.name} ativa`}
                          />
                          <span className="groups__option-name">{option.name}</span>
                          {option.additional_price > 0 ? (
                            <span className="groups__option-price tnum faint">
                              +{formatCurrency(option.additional_price)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}

            {erroOpcao ? (
              <p className="alert alert--error" role="alert">
                {erroOpcao}
              </p>
            ) : null}

            <p className="field__hint">
              Nome, preço e ordem dos complementos têm rotas próprias e não são editados junto do
              preço do item.
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * As opções do seletor de setor, incluindo a que o item JÁ tem.
 *
 * `activeSectors` oferece só os ativos, e com razão: escolher um setor
 * desativado seria mandar comanda para uma impressora que o lojista acabou de
 * tirar do ar. Só que o item pode estar apontando para um deles — ou para um
 * setor de outra filial —, e uma lista onde o valor atual não existe faz o
 * gatilho mostrar o placeholder, como se o campo estivesse vazio.
 *
 * A opção do valor atual entra desabilitada: ela DIZ onde o item imprime hoje
 * sem oferecê-la a quem ainda não a tinha.
 */
function sectorOptions(
  current: string | null,
  sectors: readonly PrintSector[],
): { value: string; label: string; disabled?: boolean }[] {
  const options = [
    { value: '', label: NO_SECTOR_LABEL },
    ...activeSectors(sectors).map((sector) => ({ value: sector.id, label: sector.name })),
  ];

  if (current === null || options.some((option) => option.value === current)) return options;

  const { label } = sectorLabelFor(current, sectors);
  return [...options, { value: current, label, disabled: true }];
}
