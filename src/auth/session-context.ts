/**
 * O contexto fica separado do provider porque o Fast Refresh do Vite só
 * recarrega um arquivo sem perder estado se ele exportar apenas componentes.
 */
import { createContext, useContext } from 'react';

import type { AdminUser, Branch } from '../api/types';

export type SessionContextValue = {
  user: AdminUser | null;
  /** Filiais que este lojista enxerga. Vem do escopo do token. */
  branches: Branch[];
  /** Nome que aparece no topo. Ver comentário em SessionProvider. */
  restaurantLabel: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  }
  return value;
}
