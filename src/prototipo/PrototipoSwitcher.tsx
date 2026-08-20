import { Link } from 'react-router-dom';

import './PrototipoSwitcher.css';

/**
 * A chavinha que troca de direção sem sair da tela.
 *
 * Existe porque o exercício é COMPARAR: com três abas do navegador, a memória
 * do que estava na anterior some no caminho. Ela é deliberadamente feia e
 * pequena, num canto, e não pertence a nenhuma das três paletas — é andaime de
 * protótipo, e tem de parecer andaime.
 */
export function PrototipoSwitcher({ atual }: { atual: 'a' | 'b' | 'c' }) {
  return (
    <div className="proto-switch" aria-label="Trocar de direção visual">
      <span className="proto-switch__rot">direção</span>
      {(['a', 'b', 'c'] as const).map((letra) => (
        <Link
          key={letra}
          to={`/prototipo/pedidos/${letra}`}
          className="proto-switch__opt"
          data-on={letra === atual || undefined}
          aria-current={letra === atual ? 'page' : undefined}
        >
          {letra.toUpperCase()}
        </Link>
      ))}
      <Link to="/prototipo" className="proto-switch__opt proto-switch__opt--sair">
        ?
      </Link>
    </div>
  );
}
