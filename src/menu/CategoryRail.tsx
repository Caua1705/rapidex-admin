import type { Category } from '../api/types';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from '../ds/icons';
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
 *
 * AS SETAS FICAM À DIREITA E SÓ APARECEM NO HOVER. Antes elas moravam à
 * esquerda, espremidas uma em cima da outra e desalinhadas do nome — e ainda
 * empurravam todos os nomes 14px para dentro, desalinhando a lista do título
 * "Categorias" logo acima. À direita elas ocupam o lugar da contagem, que é
 * informação de varredura (lida sem o mouse em cima de nenhuma linha) e por
 * isso pode ceder o espaço enquanto o ponteiro está ali.
 */
export function CategoryRail({
  categories,
  selectedCategoryId,
  movedCategoryId,
  productCountByCategory,
  onSelect,
  onMove,
  onMoveSettled,
  onNew,
}: {
  categories: Category[];
  selectedCategoryId: string | null;
  movedCategoryId: string | null;
  /**
   * Itens por categoria. Ausente = ainda não contado; a linha fica sem número
   * em vez de mostrar zero, que é uma afirmação diferente ("categoria vazia") e
   * a única que faz o lojista ir conferir o que não subiu.
   */
  productCountByCategory: Record<string, number>;
  onSelect: (categoryId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onMoveSettled: () => void;
  onNew: () => void;
}) {
  return (
    <div className="rail">
      <div className="rail__header">
        <h2 className="t-label">Categorias</h2>
        <button
          type="button"
          className="btn btn--sm btn--ghost icon-btn"
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
          const count = productCountByCategory[category.id];

          return (
            <li
              key={category.id}
              className={`rail__item${selected ? ' rail__item--selected' : ''}`}
              /* O realce dura o tempo da animação e some sozinho; é ele que
                 diz "esta é a que se moveu" quando duas linhas trocam. */
              data-moved={category.id === movedCategoryId ? 'true' : undefined}
              onAnimationEnd={onMoveSettled}
            >
              <button
                type="button"
                className="rail__select"
                onClick={() => onSelect(category.id)}
                aria-current={selected ? 'true' : undefined}
                data-testid={`category-select-${category.id}`}
              >
                <span className={`rail__name${active ? '' : ' rail__name--inactive'}`}>
                  {category.name}
                </span>
                {!active ? <span className="tag">Inativa</span> : null}

                {/*
                  A contagem responde "qual categoria está vazia?" sem abrir uma
                  por uma — é assim que se descobre que o cardápio subiu pela
                  metade antes de o cliente descobrir.

                  SÓ O NÚMERO. "3 itens / 1 item / 0 itens" escrevia a mesma
                  palavra em toda linha da lista, e era ela que empurrava os
                  números para abscissas diferentes conforme fosse singular ou
                  plural. Numa coluna de números à direita de nomes de
                  categoria, o que "3" conta não é ambíguo — e o leitor de tela
                  continua ouvindo a frase inteira.
                */}
                {count !== undefined ? (
                  <span className="rail__count tnum" data-testid={`category-count-${category.id}`}>
                    {count}
                    <span className="sr-only"> {count === 1 ? 'item' : 'itens'}</span>
                  </span>
                ) : null}
              </button>

              {/* Centradas no bloco do nome e escondidas até o ponteiro chegar. */}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
