/**
 * O contexto fica separado do provider porque o Fast Refresh do Vite só
 * recarrega um arquivo sem perder estado se ele exportar apenas componentes.
 */
import { createContext, useContext } from 'react';

import type { AdminUser, Branch } from '../api/types';
import type { Papel } from './permissions';

export type SessionContextValue = {
  user: AdminUser | null;
  /**
   * O papel deste lojista, já estreitado de `string` para os quatro conhecidos.
   *
   * Fica no contexto, e não é derivado em cada tela, porque é a mesma pergunta
   * em nove telas — e porque `user.role` é `string` no contrato: a estreita
   * repetida daria a cada tela a chance de escrever `'onwer'` e o TypeScript
   * concordar. `null` enquanto a sessão carrega, e `pode(null, …)` é falso.
   */
  papel: Papel | null;
  /** Filiais que este lojista enxerga. Vem do escopo do token. */
  branches: Branch[];
  /** Nome que aparece no topo. Ver comentário em SessionProvider. */
  restaurantLabel: string;
  /**
   * Filial que o painel está olhando. String vazia = todas as que o token
   * alcança.
   *
   * Mora na sessão, e não na tela de pedidos, porque é escopo de sessão: o
   * seletor do cabeçalho vale para o painel inteiro, e ter uma segunda cópia
   * dentro de uma tela é como as duas passam a discordar.
   */
  activeBranchId: string;
  selectBranch: (branchId: string) => void;
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
