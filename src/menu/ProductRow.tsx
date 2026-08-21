import type { PrintSector, Product } from '../api/types';
import { formatCurrency } from '../orders/format';
import { sectorLabelFor } from '../print-sectors/print-sectors';
import { Switch } from '../ds/Switch';
import { EditIcon } from '../ds/icons';
import { isProductActive, isProductAvailable, showsAvailabilityToggle } from './menu-model';
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
 * UM EIXO, UMA LINGUAGEM. "Inativo" e "Esgotado" respondem à MESMA pergunta —
 * está à venda? — e por isso saem no mesmo lugar, com a mesma forma: uma
 * etiqueta na coluna "Situação". Antes eram duas linguagens diferentes ("Inativo"
 * como etiqueta colada ao nome, "Esgotado" como texto solto ao lado do
 * interruptor), e ler a lista exigia olhar em dois pontos para responder uma
 * pergunta só.
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
}) {
  const active = isProductActive(product);
  const available = isProductAvailable(product);
  const sector = sectorLabelFor(product.printing_sector_id, sectors);
  // Só parte o nome quando há qualificador a mostrar: fora disso, o que vai à
  // tela é exatamente a string cadastrada.
  const name = qualifier ? splitProductName(product.name).base : product.name;

  return (
    <li
      className={`item${active ? '' : ' item--inactive'}`}
      data-testid={`product-row-${product.id}`}
      data-active={active}
      data-available={available}
    >
      {/*
        O SLOT DA FOTO só existe quando a categoria tem foto em algum item (ver
        `MenuPage`). Onde existe, ele mede 44px — grande o bastante para
        distinguir um prato de carne de outro, que é a única coisa que ele
        podia estar fazendo ali. Nos itens sem foto ele é um contorno tracejado,
        nunca um bloco preenchido.
      */}
      {showPhoto ? (
        product.image_url ? (
          <img className="item__thumb" src={product.image_url} alt="" />
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
        {!active ? (
          <span className="tag">Inativo</span>
        ) : !available ? (
          <span className="tag">Esgotado</span>
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
    </li>
  );
}
