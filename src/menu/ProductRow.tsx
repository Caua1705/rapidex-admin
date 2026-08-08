import type { Product } from '../api/types';
import { formatCurrency } from '../orders/format';
import { Switch } from '../ui/Switch';
import { EditIcon } from './icons';
import { isProductActive, isProductAvailable, showsAvailabilityToggle } from './menu-model';

/**
 * Uma linha do cardápio.
 *
 * O que a linha precisa responder de longe, nesta ordem: qual item é, quanto
 * custa, e se está saindo hoje. Por isso o interruptor de esgotado fica no fim,
 * com o rótulo do estado ATUAL escrito em cima dele — um interruptor sem
 * legenda obriga a decorar de que lado é "ligado".
 *
 * Item inativo é outro assunto: ele não está à venda, então a linha esmaece e
 * o interruptor de disponibilidade some. Perguntar "tem hoje?" sobre algo que
 * não está no cardápio faria o lojista mexer achando que resolveu.
 */
export function ProductRow({
  product,
  isSaving,
  onToggleAvailability,
  onEdit,
}: {
  product: Product;
  isSaving: boolean;
  onToggleAvailability: () => void;
  onEdit: () => void;
}) {
  const active = isProductActive(product);
  const available = isProductAvailable(product);

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

      <div className="item__main">
        <div className="item__title">
          <span className="item__name">{product.name}</span>
          {/*
            "Esgotado" NÃO vira tag aqui: o estado já está escrito em cima do
            interruptor, na coluna da direita, e repetir a mesma palavra duas
            vezes na mesma linha só gasta o espaço que o nome do item precisa.
            "Inativo" é tag porque o item inativo não tem interruptor — sem a
            tag, ele não teria onde dizer o que é.
          */}
          {!active ? <span className="tag">Inativo</span> : null}
        </div>
        {product.description ? <p className="item__description">{product.description}</p> : null}
      </div>

      <span className="item__price mono">{formatCurrency(product.price)}</span>

      {showsAvailabilityToggle(product) ? (
        <span className="item__availability">
          <span
            className={`item__availability-label${available ? '' : ' item__availability-label--out'}`}
          >
            {available ? 'Disponível' : 'Esgotado'}
          </span>
          <Switch
            checked={available}
            disabled={isSaving}
            onChange={onToggleAvailability}
            label={`${available ? 'Marcar como esgotado' : 'Marcar como disponível'}: ${product.name}`}
          />
        </span>
      ) : (
        // Espaço reservado para as linhas não dançarem de largura quando um
        // item inativo aparece no meio de itens ativos.
        <span className="item__availability item__availability--empty" aria-hidden="true" />
      )}

      <button
        type="button"
        className="btn btn--sm icon-btn"
        onClick={onEdit}
        aria-label={`Editar ${product.name}`}
        title="Editar item"
      >
        <EditIcon />
      </button>
    </li>
  );
}
