import type { Category } from '../api/types';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from '../ui/icons';
import { isCategoryActive } from './menu-model';

/**
 * A barra de categorias.
 *
 * Ela NUNCA é filtrada — nem por busca, nem por "só as ativas". A ordem que
 * está aqui é a ordem que vai inteira para o PATCH /admin/categories/reorder,
 * e o backend renumera a partir do que recebe: esconder uma categoria da lista
 * seria apagar a posição dela na próxima subida de outra.
 *
 * Subir/descer em vez de arrastar: o painel é usado no balcão, às vezes com
 * touch e a mão ocupada, e arrastar exige precisão que ali não existe.
 */
export function CategoryRail({
  categories,
  selectedCategoryId,
  movedCategoryId,
  onSelect,
  onMove,
  onMoveSettled,
  onNew,
}: {
  categories: Category[];
  selectedCategoryId: string | null;
  movedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onMoveSettled: () => void;
  onNew: () => void;
}) {
  return (
    <div className="rail">
      <div className="rail__header">
        <h2 className="rail__title">Categorias</h2>
        <button
          type="button"
          className="btn btn--sm icon-btn"
          onClick={onNew}
          aria-label="Nova categoria"
          title="Nova categoria"
        >
          <PlusIcon />
        </button>
      </div>

      <ul className="rail__list">
        {categories.map((category, index) => {
          const selected = category.id === selectedCategoryId;
          const active = isCategoryActive(category);

          return (
            <li
              key={category.id}
              className={`rail__item${selected ? ' rail__item--selected' : ''}`}
              /* O realce dura o tempo da animação e some sozinho; é ele que
                 diz "esta é a que se moveu" quando duas linhas trocam. */
              data-moved={category.id === movedCategoryId ? 'true' : undefined}
              onAnimationEnd={onMoveSettled}
            >
              <span className="rail__reorder">
                <button
                  type="button"
                  className="rail__chevron"
                  disabled={index === 0}
                  onClick={() => onMove(index, -1)}
                  aria-label={`Mover ${category.name} para cima`}
                  title="Mover para cima"
                >
                  <ChevronUpIcon size={14} />
                </button>
                <button
                  type="button"
                  className="rail__chevron"
                  disabled={index === categories.length - 1}
                  onClick={() => onMove(index, 1)}
                  aria-label={`Mover ${category.name} para baixo`}
                  title="Mover para baixo"
                >
                  <ChevronDownIcon size={14} />
                </button>
              </span>

              <button
                type="button"
                className="rail__select"
                onClick={() => onSelect(category.id)}
                aria-current={selected ? 'true' : undefined}
              >
                <span className={`rail__name${active ? '' : ' rail__name--inactive'}`}>
                  {category.name}
                </span>
                {!active ? <span className="tag">Inativa</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
