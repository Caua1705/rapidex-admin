import { Link } from 'react-router-dom';

import './Breadcrumb.css';

/**
 * Trilha de navegação.
 *
 *   <Breadcrumb
 *     items={[
 *       { label: 'Cardápio', to: '/cardapio' },
 *       { label: 'Cortes especiais' },
 *     ]}
 *   />
 *
 * QUANDO USAR: quando a tela é FILHA de outra e a volta não é óbvia — uma
 * categoria dentro do cardápio, uma filial dentro de configurações. Numa tela
 * de primeiro nível ela é ruído: repete o que a navegação lateral já marca.
 *
 * O último item NÃO é link: é onde a pessoa está, e leva `aria-current="page"`.
 * O separador é `aria-hidden` — quem escuta a tela ouve a lista, não as barras.
 */
export type CrumbItem = {
  label: string;
  /** Sem `to`, o item é o lugar atual (o último da trilha). */
  to?: string;
};

export function Breadcrumb({ items }: { items: readonly CrumbItem[] }) {
  return (
    <nav className="ds-crumb" aria-label="Trilha de navegação">
      <ol className="ds-crumb__lista">
        {items.map((item, index) => {
          const ultimo = index === items.length - 1;
          return (
            <li className="ds-crumb__item" key={`${item.label}-${index}`}>
              {item.to && !ultimo ? (
                <Link className="ds-crumb__link" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span className="ds-crumb__atual" aria-current="page">
                  {item.label}
                </span>
              )}
              {!ultimo ? (
                <span className="ds-crumb__sep" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
