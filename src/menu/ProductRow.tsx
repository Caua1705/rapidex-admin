import type { HTMLAttributes } from 'react';

import type { PrintSector, Product } from '../api/types';
import { formatCurrency } from '../orders/format';
import { sectorLabelFor } from '../print-sectors/print-sectors';
import { Checkbox } from '../ds/Checkbox';
import { Switch } from '../ds/Switch';
import { AlertIcon, ChevronDownIcon, ChevronUpIcon, EditIcon, GripIcon } from '../ds/icons';
import { CAIXAS, imagemNaCaixa } from '../ds/image-url';
import {
  isProductActive,
  isProductAvailable,
  productSaleState,
  showsAvailabilityToggle,
} from './menu-model';
import { splitProductName } from './product-name';

/**
 * Uma linha do cardápio.
 *
 * É uma GRADE de colunas fixas (foto · nome+descrição · preço · impressão ·
 * situação · ação), não um flex com `space-between`. A diferença
 * aparece na tela larga: com space-between o preço ia para o canto oposto ao
 * nome e cada linha ancorava o olho num lugar diferente. Com a grade, tudo cai
 * na mesma abscissa e a coluna inteira se lê de cima a baixo — o cabeçalho da
 * lista usa a mesma grade, então os rótulos ficam por cima do que nomeiam.
 *
 * UM EIXO, UMA LINGUAGEM. "Inativo", "Esgotado" e "Sem opção" respondem à MESMA
 * pergunta — está à venda? — e por isso saem no mesmo lugar, com a mesma forma:
 * uma etiqueta na coluna "Situação". Antes eram duas linguagens diferentes
 * ("Inativo" como etiqueta colada ao nome, "Esgotado" como texto solto ao lado
 * do interruptor), e ler a lista exigia olhar em dois pontos para responder uma
 * pergunta só.
 *
 * A TERCEIRA ETIQUETA QUEBRA A REGRA DA COR DE PROPÓSITO, e é a única que a
 * quebra. "Inativo" e "Esgotado" são escolhas do lojista; "Sem opção"
 * ACONTECEU com ele — a última opção de um grupo obrigatório foi desativada e o
 * item saiu do cardápio público sem nada mudar por aqui. Uma etiqueta cinza
 * igual às outras duas leria como mais um estado normal da operação, e é
 * justamente o passar-batido que ela existe para impedir. Ela leva tinta de
 * ATENÇÃO, ícone e palavra própria — três canais, nenhum sozinho.
 *
 * O ESTADO POSITIVO CONTINUA SEM PALAVRA. "Disponível" ao lado de um
 * interruptor ligado, repetido em toda linha, é a mesma informação duas vezes:
 * se todas as linhas dizem o mesmo, a palavra não distingue nada. A célula fica
 * vazia, e as etiquetas que sobram são justamente o que o lojista procura.
 *
 * O QUE DIFERENCIA OS DOIS ESTADOS não é a cor da etiqueta — é o RECUO da
 * linha. Item esgotado continua em tinta cheia (é ele que se vem repor); item
 * inativo recua, porque está fora do cardápio. O preço, porém, continua o preço
 * de verdade: o item tem preço, só não está à venda, e um zero ali leria como
 * erro de cadastro.
 */
export function ProductRow({
  product,
  sectors,
  showPhoto,
  showSector,
  qualifier,
  isSaving,
  onToggleAvailability,
  onEdit,
  punho,
  itemRef,
  onMove,
  isFirst,
  isLast,
  drop,
  isDragging,
  selected,
  onSelect,
}: {
  product: Product;
  /** Setores da filial aberta no cabeçalho — é o que dá nome ao id do produto. */
  sectors: readonly PrintSector[];
  /** A categoria tem foto em algum item? Sem isso a coluna inteira não existe. */
  showPhoto: boolean;
  /** Falso com "Todas as filiais": sem filial não há setor a mostrar. */
  showSector: boolean;
  /**
   * O que estava entre parênteses no nome, quando outro item da lista divide a
   * mesma base ("Picanha Suína"). `null` desenha o nome inteiro, como está
   * cadastrado. Ver `product-name.ts`.
   */
  qualifier: string | null;
  isSaving: boolean;
  onToggleAvailability: () => void;
  /** Ausente = este papel não edita item. Ver `auth/permissions.ts`. */
  onEdit?: () => void;
  /*
   * ===================================================================
   * REORDENAR — as duas entradas, e nenhuma delas substitui a outra
   * ===================================================================
   *
   * `punho` é o gesto de arrastar (`useReorderDrag`); `onMove` é a seta de
   * sobe-um/desce-um. A seta não é herança: é o que cumpre a **WCAG 2.5.7
   * (Dragging Movements)** e o que serve o balcão com uma mão só. Ausentes as
   * duas = este papel não reordena, ou a lista está filtrada/paginada e a
   * rota exigiria a categoria completa (ver `podeReordenarProdutos`).
   */
  punho?: HTMLAttributes<HTMLElement>;
  /**
   * A `ref` do <li>, para o gesto MEDIR a linha no começo do arrastar.
   *
   * Chama-se `itemRef` e não `ref` de propósito: `ref` numa função de
   * componente é a propriedade reservada do React, e usá-la aqui obrigaria
   * `forwardRef` só para repassar um elemento que ninguém mais precisa.
   */
  itemRef?: (el: HTMLElement | null) => void;
  onMove?: (direction: -1 | 1) => void;
  /** Primeiro/último da lista: a seta correspondente não tem para onde ir. */
  isFirst?: boolean;
  isLast?: boolean;
  /** Onde a linha de destino do arrastar cai, se cair nesta linha. */
  drop?: 'antes' | 'depois';
  /** Esta linha está sendo arrastada agora. */
  isDragging?: boolean;
  /*
   * ===================================================================
   * SELEÇÃO MÚLTIPLA
   * ===================================================================
   *
   * `onSelect` ausente = a coluna de seleção não existe nesta lista. Ela
   * depende do MESMO papel do interruptor da linha
   * (`cardapio.trocarDisponibilidade`, `PESSOAS`): a ação em massa chama a
   * mesma rota N vezes, então quem pode uma pode a outra.
   */
  selected?: boolean;
  onSelect?: () => void;
}) {
  const active = isProductActive(product);
  const available = isProductAvailable(product);
  const state = productSaleState(product);
  const sector = sectorLabelFor(product.printing_sector_id, sectors);
  // Só parte o nome quando há qualificador a mostrar: fora disso, o que vai à
  // tela é exatamente a string cadastrada.
  const name = qualifier ? splitProductName(product.name).base : product.name;

  return (
    <li
      ref={itemRef}
      className={`item${active ? '' : ' item--inactive'}${selected ? ' item--selecionado' : ''}${
        isDragging ? ' item--arrastando' : ''
      }`}
      data-testid={`product-row-${product.id}`}
      data-active={active}
      data-available={available}
      data-drop={drop}
    >
      {/*
        O PUNHO E A CAIXA ABREM A LINHA, nesta ordem, e as duas células existem
        ou não existem para a LISTA INTEIRA — nunca por linha. Uma coluna que
        aparece em algumas linhas e some em outras desalinha tudo o que vem
        depois dela, que é a única coisa que esta grade existe para garantir.
      */}
      {punho ? (
        <span
          className="item__punho"
          role="button"
          tabIndex={-1}
          aria-hidden="true"
          title={`Arraste para reordenar ${product.name}`}
          {...punho}
        >
          <GripIcon size={14} />
        </span>
      ) : null}

      {onSelect ? (
        <Checkbox
          hideLabel
          checked={!!selected}
          onChange={onSelect}
          label={`Selecionar ${product.name}`}
          data-testid={`product-select-${product.id}`}
        />
      ) : null}

      {/*
        O SLOT DA FOTO só existe quando a categoria tem foto em algum item (ver
        `MenuPage`). Onde existe, ele mede 44px — grande o bastante para
        distinguir um prato de carne de outro, que é a única coisa que ele
        podia estar fazendo ali. Nos itens sem foto ele é um contorno tracejado,
        nunca um bloco preenchido.

        E ELE É O SÍTIO DE IMAGEM MAIS CARO DO PAINEL: até 50 destes por
        carregamento (o `PAGE_SIZE` de `useMenu`), e até 04/09/2026 cada um
        baixava o objeto do bucket em tamanho de upload para desenhar 44px.
        Medido na maior categoria do piloto: 2.440 KB por lista, contra 70 KB
        pedindo 88×88. `imagemNaCaixa` é quem faz o pedido; `loading="lazy"` é
        quem impede que as fotos de baixo da rolagem sejam baixadas junto.
      */}
      {showPhoto ? (
        product.image_url ? (
          <img
            className="item__thumb"
            src={imagemNaCaixa(product.image_url, CAIXAS.itemDoCardapio)}
            alt=""
            loading="lazy"
            decoding="async"
            data-testid={`product-thumb-${product.id}`}
          />
        ) : (
          <span className="item__thumb item__thumb--empty" aria-hidden="true" />
        )
      ) : null}

      <span className="item__main">
        <span className="item__title">
          <span className="item__name">{name}</span>
          {/*
            O QUALIFICADOR DA VARIAÇÃO, quando o nome se repete na lista.
            "Picanha Suína", "Picanha Suína (400g)" e "Picanha Suína (1kg)" têm
            catorze caracteres idênticos em semibold e o que as separa some no
            fim da string. Aqui a gramatura vira uma marca própria — a única
            coisa que muda entre as três linhas é a única com forma diferente.
          */}
          {qualifier ? <span className="tag item__variant">{qualifier}</span> : null}
        </span>

        {/*
          A DESCRIÇÃO SUBIU PARA A MESMA LINHA DO NOME. Empilhada, ela dava a
          toda linha com descrição a altura de um cartão — e uma categoria de 29
          itens não cabia em tela nenhuma. Ao lado, a informação é a mesma e a
          linha volta a ter uma altura só, igual à das outras.

          Quem cede a largura é ela, e não o nome: o nome identifica a linha e é
          o que o lojista veio procurar; a descrição desempata (§7).
        */}
        {product.description ? (
          <span className="item__description">{product.description}</span>
        ) : null}
      </span>

      {/* O preço É tabular: é dinheiro, e ele se compara descendo a coluna. */}
      <span className="item__price num">{formatCurrency(product.price)}</span>

      {/*
        A coluna existe para o lojista CONFERIR de bate-pronto onde cada item
        imprime. Ela só escreve quando HÁ um setor.

        "Não imprimir" em itálico, repetido em toda linha, era a mesma coisa que
        o "DISPONÍVEL" verde que já saiu daqui: uma palavra em cada linha da
        lista, sempre a mesma, ocupando a largura do que muda. A célula vazia
        não é ambígua — o que se procura nesta coluna é o item que TEM setor, e
        um nome escrito salta sobre um fundo de células em branco. O que não
        pode ficar mudo é o dado inconsistente, e esse continua escrito.
      */}
      {showSector ? (
        <span
          className={`item__sector${sector.known ? '' : ' item__sector--unknown'}`}
          data-testid={`product-sector-${product.id}`}
          title={
            sector.known ? undefined : 'Este item aponta para um setor que não é desta filial.'
          }
        >
          {sector.empty ? '' : sector.label}
        </span>
      ) : null}

      {/*
        SITUAÇÃO — UMA CÉLULA SÓ, porque é uma pergunta só: está à venda?

        A etiqueta e o interruptor eram duas colunas vizinhas, com um vão de
        12px entre elas e um rótulo em cima de uma das duas. Só que quem
        responde "está à venda?" é o par: o interruptor no estado normal, a
        etiqueta nos dois que não são ("Esgotado" para o item ativo que acabou
        na cozinha, "Inativo" para o que saiu do cardápio). Juntos numa célula
        encostada à direita, eles ficam na mesma abscissa em toda linha e o
        rótulo "Situação" passa a nomear a resposta inteira, não metade dela.

        O interruptor some no item inativo: "tem hoje?" é pergunta sem sentido
        sobre algo que não está no cardápio, e mexer ali não o traz de volta.

        A etiqueta NÃO recua junto com a linha do item inativo: ela é a
        explicação do recuo, e recuar as duas apagaria o motivo.
      */}
      <span className="item__state">
        {state === 'inativo' ? (
          <span className="tag">Inativo</span>
        ) : state === 'esgotado' ? (
          <span className="tag">Esgotado</span>
        ) : state === 'sem-opcao' ? (
          /*
            A TERCEIRA ETIQUETA, E A ÚNICA QUE O LOJISTA NÃO ESCOLHEU.

            "Inativo" e "Esgotado" são decisões dele: ele tirou o item do
            cardápio, ou disse que acabou. Esta ACONTECEU — ele desativou a
            última opção de um grupo obrigatório, coisa que faz todo dia uma
            opção por vez, e o item saiu de venda sem que nada mudasse aqui.
            Vestida igual às outras duas, ela leria como mais um estado normal
            da operação, e o lojista passaria por ela sem parar.

            TRÊS CANAIS, NENHUM SOZINHO (WCAG 1.4.1): a palavra, o ícone e a
            tinta de ATENÇÃO. `--alert` e não `--danger`, e a distinção é a que
            o sistema já faz: não é perigo nem erro, é uma coisa que precisa de
            olho — a mesma pergunta que a coluna Impressão responde quando
            aponta para um setor de outra filial.

            O `title` carrega a frase inteira porque a etiqueta cabe em 116px e
            a explicação não: quem quer o motivo tem o aviso do topo da lista,
            que o diz uma vez para a categoria toda.
          */
          <span
            className="tag tag--alerta item__bloqueado"
            title="Um grupo obrigatório deste item está sem nenhuma opção ativa. O cliente abre o item e não consegue fechar o pedido."
            data-testid={`product-blocked-${product.id}`}
          >
            <AlertIcon size={12} />
            Sem opção
          </span>
        ) : null}

        {showsAvailabilityToggle(product) ? (
          <Switch
            hideLabel
            checked={available}
            disabled={isSaving}
            onChange={onToggleAvailability}
            label={`${available ? 'Marcar como esgotado' : 'Marcar como disponível'}: ${product.name}`}
          />
        ) : null}
      </span>

      {/*
        Ação secundária: sem caixa, e só aparece com o ponteiro na linha (ou
        com o foco do teclado nela — ver `.item__edit` no CSS). Uma coluna de
        botões contornados, um por linha, é uma grade de caixinhas competindo
        com o nome do item, que é o que se veio ler.
      */}
      <span className="item__acoes">
        {/*
          AS SETAS SÃO A ALTERNATIVA AO ARRASTAR, e não um resto: a WCAG 2.2
          exige uma operação por ponteiro único para tudo que se arrasta
          (2.5.7), e no balcão elas são o caminho de quem está com uma mão na
          comanda. Elas aparecem junto do lápis, com o mesmo peso, e só com o
          ponteiro ou o foco na linha.
        */}
        {onMove ? (
          <span className="item__reorder">
            <button
              type="button"
              className="rail__chevron"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              aria-label={`Mover ${product.name} para cima`}
              title="Mover para cima"
            >
              <ChevronUpIcon size={14} />
            </button>
            <button
              type="button"
              className="rail__chevron"
              disabled={isLast}
              onClick={() => onMove(1)}
              aria-label={`Mover ${product.name} para baixo`}
              title="Mover para baixo"
            >
              <ChevronDownIcon size={14} />
            </button>
          </span>
        ) : null}

        {onEdit ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost icon-btn item__edit"
            onClick={onEdit}
            aria-label={`Editar ${product.name}`}
            title="Editar item"
          >
            <EditIcon />
          </button>
        ) : null}
      </span>
    </li>
  );
}
