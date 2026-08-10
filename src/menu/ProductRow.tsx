import type { PrintSector, Product } from '../api/types';
import { formatCurrency } from '../orders/format';
import { sectorLabelFor } from '../print-sectors/print-sectors';
import { Switch } from '../ui/Switch';
import { EditIcon } from '../ui/icons';
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
 * O interruptor de esgotado fica no fim, com o rótulo do estado ATUAL ao lado
 * — um interruptor sem legenda obriga a decorar de que lado é "ligado".
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

      <span className="item__price mono">{formatCurrency(product.price)}</span>

      {/*
        A coluna existe para o lojista CONFERIR de bate-pronto se esqueceu
        algum item — é a pergunta "está tudo configurado?" respondida sem abrir
        item por item. Por isso "Não imprimir" aparece esmaecido e não em
        branco: célula vazia lê como "não carregou", e não como uma escolha.
      */}
      {showSector ? (
        <span
          className={[
            'item__sector',
            sector.empty ? 'item__sector--none' : '',
            sector.known ? '' : 'item__sector--unknown',
          ]
            .filter(Boolean)
            .join(' ')}
          data-testid={`product-sector-${product.id}`}
          title={
            sector.known ? undefined : 'Este item aponta para um setor que não é desta filial.'
          }
        >
          {sector.label}
        </span>
      ) : null}

      {/*
        A célula existe sempre, com ou sem interruptor: é a grade que mantém o
        preço e a ação alinhados de uma linha para a outra.
      */}
      <span className="item__status">
        {showsAvailabilityToggle(product) ? (
          <>
            <span className={`item__state${available ? '' : ' item__state--out'}`}>
              {available ? 'Disponível' : 'Esgotado'}
            </span>
            <Switch
              checked={available}
              disabled={isSaving}
              onChange={onToggleAvailability}
              label={`${available ? 'Marcar como esgotado' : 'Marcar como disponível'}: ${product.name}`}
            />
          </>
        ) : null}
      </span>

      <button
        type="button"
        className="btn btn--sm icon-btn item__edit"
        onClick={onEdit}
        aria-label={`Editar ${product.name}`}
        title="Editar item"
      >
        <EditIcon />
      </button>
    </li>
  );
}
