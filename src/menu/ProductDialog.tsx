import { useEffect, useState } from 'react';

import { fetchProductDetail } from '../api/menu';
import type { Category, PrintSector } from '../api/types';
import { Select } from '../ds/Select';
import { activeSectors, NO_SECTOR_LABEL, sectorLabelFor } from '../print-sectors/print-sectors';
import { Modal } from '../ui/Modal';
import { Switch } from '../ds/Switch';
import { CatalogPairField } from './CatalogPairField';
import { parsePriceInput } from './menu-model';
import { OptionGroupsSection } from './OptionGroupsSection';
import { ProductImageField } from './ProductImageField';
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
 * GRUPOS DE COMPLEMENTO DEIXARAM DE SER SÓ LEITURA, e continuam fora do
 * "Salvar" deste diálogo: eles têm rotas próprias e cada formulário grava no
 * próprio clique. Misturar os dois salvamentos num botão só faria "Salvar"
 * significar duas coisas. Ver `OptionGroupsSection`.
 */
export function ProductDialog({
  initial,
  categories,
  sectors,
  branchChosen,
  branchId,
  catalogPairing,
  podeDefinirPreco,
  podeEditarComplemento,
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
  /**
   * O papel escreve complemento (`GERÊNCIA`)? Ler é `PESSOAS`.
   *
   * Vem como propriedade pelo mesmo motivo de `podeDefinirPreco`: este diálogo
   * é montado em teste sem provider nenhum, e ler a sessão daqui transformaria
   * "quem é você" numa exceção na montagem.
   */
  podeEditarComplemento: boolean;
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
        setImageUrl(detail.image_url ?? null);
      } catch {
        // A foto é informação de apoio: não conseguir lê-la não pode impedir a
        // edição do nome e do preço, que é o que trouxe o lojista até aqui. Os
        // grupos de complemento têm leitura própria — ver `OptionGroupsSection`.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draft.id]);

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
                ? 'Esta filial ainda não tem setor cadastrado. Crie em Loja › Impressão.'
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

        {/*
          OS COMPLEMENTOS SÃO OUTRA COISA, E GRAVAM SOZINHOS.

          Eles têm rotas próprias e cada formulário salva no próprio clique;
          este diálogo tem UM "Salvar" e ele grava o PRODUTO. Misturar os dois
          faria "Salvar" significar duas coisas — a razão continua a mesma de
          quando a seção era só leitura, e é ela que a mantém num componente à
          parte agora que ela edita. Ver `OptionGroupsSection`.

          Só na EDIÇÃO: o grupo precisa de um produto que já exista. Num item
          novo o id nasce quando o lojista pede a foto, e aí `draft.id` passa a
          valer — por isso a condição lê o rascunho, e não `initial`.
        */}
        {draft.id ? (
          <OptionGroupsSection productId={draft.id} podeEditar={podeEditarComplemento} />
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
