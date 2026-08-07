import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useSession } from './session-context';

/**
 * Guarda de rota: sem sessão, ninguém entra.
 *
 * Também é o que faz o 401 voltar para o login — quando o SessionProvider
 * zera o usuário, este componente rerenderiza e redireciona.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();

  if (!user) {
    // Guarda de onde a pessoa veio para voltar ao mesmo lugar após o login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
