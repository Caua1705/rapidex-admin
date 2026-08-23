import type { Category } from '../api/types';
import { ChevronDownIcon, ChevronUpIcon, GripIcon, PlusIcon } from '../ds/icons';
import { useKeepActiveInView } from '../ds/useKeepActiveInView';
import { isCategoryActive } from './menu-model';
import { useReorderDrag } from './useReorderDrag';

/**
 * A barra de categorias.
 *
 * Ela NUNCA é filtrada — nem por busca, nem por "só as ativas". A ordem que
 * está aqui é a ordem que vai inteira para o PATCH /admin/categories/reorder,
 * e o backend renumera a partir do que recebe: esconder uma categoria da lista
 * seria apagar a posição dela na próxima subida de outra.
 *
 * ARRASTAR **E** SUBIR/DESCER — e as duas coisas juntas são a decisão.
 *
 * Aqui já esteve escrito "subir/descer EM VEZ DE arrastar", e o motivo era bom:
 * o painel é usado no balcão, às vezes com touch e a mão ocupada, e arrastar
 * exige precisão que ali não existe. O que estava errado era o "em vez de" —
 * com só as setas, levar a categoria do fim para o topo são dez cliques, e a
 * ordem do cardápio é decisão comercial que ninguém toma se custar dez cliques.
 *
 * Hoje o punho é o atalho e as setas são o caminho. Não é conveniência: a WCAG
 * 2.2 exige a alternativa por ponteiro único para tudo que se opera arrastando
 * (**2.5.7 Dragging Movements**, AA), e é a seta que a cumpre — ela é um
 * `<button>` com nome acessível, alcançável pelo teclado e pelo leitor de tela.
 * Os dois chamam a MESMA gravação em `useMenu`.
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
  onMoveTo,
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
  /*
   * OS TRÊS SÃO OPCIONAIS, e a ausência é o que esconde o controle.
   *
   * Reordenar e criar categoria são da GERÊNCIA. Passar um `undefined` daqui é
   * melhor do que uma propriedade `podeEditar`: o componente não precisa
   * conhecer papel nenhum, e "não há o que fazer" e "não tenho permissão"
   * chegam nele como a mesma coisa — que, para o desenho, são.
   */
  onMove?: (index: number, direction: -1 | 1) => void;
  /** O arrastar. Ausente junto com `onMove` — as duas são a mesma permissão. */
  onMoveTo?: (from: number, to: number) => void;
  onMoveSettled: () => void;
  onNew?: () => void;
}) {
  /*
   * O GESTO PRECISA EXISTIR MESMO SEM PERMISSÃO — hooks não se chamam dentro de
   * um `if`. Quem desliga é `disabled`, e sem `onMoveTo` o punho nem é
   * desenhado, então o gesto nunca chega a ser iniciado.
   */
  const arrastar = useReorderDrag({
    count: categories.length,
    onReorder: (from, to) => onMoveTo?.(from, to),
    disabled: !onMoveTo,
  });

  /*
   * NO TELEFONE ESTA LISTA É UMA FITA HORIZONTAL, e ela nascia em zero: a
   * categoria aberta ficava fora da tela, à direita, e a fita mostrava outras
   * três sem nenhuma marcada. Com um cardápio de verdade — dez, quinze
   * categorias — a aberta praticamente nunca está à vista.
   */
  const { fitaRef, ativoRef } = useKeepActiveInView<HTMLUListElement>(selectedCategoryId);

  return (
    <div className="rail">
      <div className="rail__header">
        <h2 className="t-label">Categorias</h2>
        {onNew ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost icon-btn"
            onClick={onNew}
            aria-label="Nova categoria"
            title="Nova categoria"
          >
            <PlusIcon />
          </button>
        ) : null}
      </div>

      <ul className="rail__list" ref={fitaRef}>
        {categories.map((category, index) => {
          const selected = category.id === selectedCategoryId;
          const active = isCategoryActive(category);
          const count = productCountByCategory[category.id];

          return (
            <li
              key={category.id}
              /*
                DOIS DONOS PARA O MESMO NÓ: o gesto de arrastar mede a posição
                de cada item, e a fita precisa saber onde está o ABERTO para
                enquadrá-lo. Uma função só que alimenta os dois — trocar por
                um dos dois refs sozinho quebraria silenciosamente o outro.
              */
              ref={(el) => {
                arrastar.registrar(index)(el);
                if (selected) ativoRef.current = el;
              }}
              className={`rail__item${selected ? ' rail__item--selected' : ''}${
                arrastar.drag?.from === index ? ' rail__item--arrastando' : ''
              }`}
              /* O realce dura o tempo da animação e some sozinho; é ele que
                 diz "esta é a que se moveu" quando duas linhas trocam. */
              data-moved={category.id === movedCategoryId ? 'true' : undefined}
              /*
                A LINHA DE DESTINO, e ela é um atributo e não um elemento: um
                `<li>` a mais no meio da lista deslocaria os índices que o gesto
                acabou de medir. Como `::before` do item que vai ceder o lugar,
                ela não ocupa espaço nenhum.
              */
              data-drop={dropDe(arrastar.drag, index)}
              onAnimationEnd={onMoveSettled}
            >
              {/*
                O PUNHO VEM ANTES DO NOME, e é a única coisa desta lista que
                fica sempre visível junto com o nome: ele É a affordance. As
                setas continuam aparecendo só no ponteiro/foco porque elas são o
                caminho alternativo, não a descoberta.
              */}
              {onMoveTo ? (
                <span
                  className="rail__punho"
                  role="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  title={`Arraste para reordenar ${category.name}`}
                  {...arrastar.punho(index)}
                >
                  <GripIcon size={14} />
                </span>
              ) : null}
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
                  <span className="rail__count" data-testid={`category-count-${category.id}`}>
                    {count}
                    <span className="sr-only"> {count === 1 ? 'item' : 'itens'}</span>
                  </span>
                ) : null}
              </button>

              {/* Centradas no bloco do nome e escondidas até o ponteiro chegar. */}
              {onMove ? (
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
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * De que lado do item a linha de destino é desenhada.
 *
 * DUAS RESPOSTAS E NÃO UMA, porque a última posição não tem item depois dela:
 * soltar no fim da lista precisa de uma linha DEPOIS do último, e marcar só
 * "antes" deixaria o gesto sem destino visível justamente na posição mais
 * usada — mandar um item para o fim.
 */
function dropDe(
  drag: { from: number; to: number } | null,
  index: number,
): 'antes' | 'depois' | undefined {
  if (!drag || drag.from === drag.to) return undefined;
  if (drag.to === index) return drag.to > drag.from ? 'depois' : 'antes';
  return undefined;
}
