import type { PrintSector, Product } from '../api/types';
import { formatCurrency } from '../orders/format';
import { sectorLabelFor } from '../print-sectors/print-sectors';
import { Switch } from '../ds/Switch';
import { EditIcon } from '../ds/icons';
import { isProductActive, isProductAvailable, showsAvailabilityToggle } from './menu-model';

/**
 * Uma linha do cardápio.
 *
 * É uma GRADE de colunas fixas (imagem · nome+descrição · preço · estado ·
 * ação), não um flex com `space-between`. A diferença aparece na tela larga:
 * com space-between o preço ia para o canto oposto ao nome e cada linha
 * ancorava o olho num lugar diferente. Com a grade, preço e estado ficam
 * sempre na mesma abscissa e a coluna inteira se lê de cima a baixo.
 *
 * O ESTADO POSITIVO NÃO É ESCRITO. "DISPONÍVEL" em verde ao lado de um
 * interruptor verde ligado, repetido em toda linha da lista, é a mesma
 * informação duas vezes e uma parede de cor que não carrega significado
 * nenhum: se todas as linhas são verdes, o verde não distingue nada. O que
 * sobrou é a palavra dos estados que NÃO são o normal — "Esgotado" ao lado do
 * interruptor desligado, "Inativo" como etiqueta —, e são justamente elas que
 * o lojista está procurando quando abre esta tela.
 *
 * Item inativo é outro assunto: ele não está à venda, então a linha esmaece e
 * o interruptor de disponibilidade some. Perguntar "tem hoje?" sobre algo que
 * não está no cardápio faria o lojista mexer achando que resolveu.
 */
export function ProductRow({
  product,
  sectors,
  showSector,
  isSaving,
  onToggleAvailability,
  onEdit,
}: {
  product: Product;
  /** Setores da filial aberta no cabeçalho — é o que dá nome ao id do produto. */
  sectors: readonly PrintSector[];
  /** Falso com "Todas as filiais": sem filial não há setor a mostrar. */
  showSector: boolean;
  isSaving: boolean;
  onToggleAvailability: () => void;
  onEdit: () => void;
}) {
  const active = isProductActive(product);
  const available = isProductAvailable(product);
  const sector = sectorLabelFor(product.printing_sector_id, sectors);

  return (
    <li
      className={`item${active ? '' : ' item--inactive'}`}
      data-testid={`product-row-${product.id}`}
      data-active={active}
      data-available={available}
    >
      {product.image_url ? (
        <img className="item__thumb" src={product.image_url} alt="" />
      ) : (
        <span className="item__thumb item__thumb--empty" aria-hidden="true" />
      )}

      <span className="item__main">
        <span className="item__title">
          <span className="item__name">{product.name}</span>
          {/*
            "Esgotado" NÃO vira tag aqui: o estado já está escrito ao lado do
            interruptor, na coluna da direita, e repetir a mesma palavra duas
            vezes na mesma linha só gasta o espaço que o nome do item precisa.
            "Inativo" é tag porque o item inativo não tem interruptor — sem a
            tag, ele não teria onde dizer o que é.
          */}
          {!active ? <span className="tag">Inativo</span> : null}
        </span>
        {/*
          Uma linha só, cortada no fim. A descrição inteira é do cardápio do
          cliente; aqui ela serve para distinguir dois itens de nome parecido,
          e deixá-la crescer devolveria à lista a altura que a densidade pede.
        */}
        {product.description ? (
          <span className="item__description">{product.description}</span>
        ) : null}
      </span>

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
        O ESTADO TEM CÉLULA PRÓPRIA, e não divide a do interruptor.
        Dividindo, "Esgotado" transbordava a coluna de 34px e caía por cima do
        preço — o mesmo defeito de quem não decide quem cede numa linha.

        Só o estado que NÃO é o normal ganha palavra: ver o comentário do
        componente. A célula vazia mantém a grade alinhada de linha para linha.
      */}
      <span className="item__state">
        {showsAvailabilityToggle(product) && !available ? 'Esgotado' : ''}
      </span>

      {/*
        A célula do interruptor existe sempre, com ou sem controle: é a grade
        que mantém o preço e a ação alinhados de uma linha para a outra.
      */}
      <span className="item__status">
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
      <button
        type="button"
        className="btn btn--sm btn--ghost icon-btn item__edit"
        onClick={onEdit}
        aria-label={`Editar ${product.name}`}
        title="Editar item"
      >
        <EditIcon />
      </button>
    </li>
  );
}
