import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import type { Acao } from './permissions';
import { useSession } from './session-context';
import { usePermissoes } from './use-permissions';

/**
 * Guarda de rota: sem sessão, ninguém entra.
 *
 * Também é o que faz o 401 voltar para o login — quando o SessionProvider
 * zera o usuário, este componente rerenderiza e redireciona.
 *
 * `acao` É A SEGUNDA GUARDA, e ela existe porque esconder o item da lateral não
 * fecha a porta: o endereço continua digitável, e o F5 numa aba deixada aberta
 * antes de alguém ser rebaixado cairia na mesma tela. Sem ela, o atendente
 * chegaria numa lista que responde 403 e leria isso como defeito.
 *
 * O DESTINO É /pedidos, e não uma tela de "acesso negado": Pedidos é o que todo
 * papel que entra no painel alcança, e é onde ele iria de qualquer forma. Uma
 * tela de recusa seria uma página a mais para dizer "não é aqui" — e o backend
 * continua sendo quem recusa de verdade.
 */
export function RequireAuth({ children, acao }: { children: ReactNode; acao?: Acao }) {
  const { user } = useSession();
  const { pode } = usePermissoes();
  const location = useLocation();

  if (!user) {
    // Guarda de onde a pessoa veio para voltar ao mesmo lugar após o login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (acao && !pode(acao)) {
    return <Navigate to="/pedidos" replace />;
  }

  return <>{children}</>;
}
