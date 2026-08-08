import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchCurrentUser, login } from '../api/auth';
import { onSessionExpired } from '../api/client';
import { listBranches } from '../api/orders';
import type { AdminUser, Branch } from '../api/types';
import { restaurantLabelFromBranches } from './restaurant-label';
import { SessionContext, type SessionContextValue } from './session-context';
import { clearSession, readSession, writeSession } from './session-storage';

export function SessionProvider({ children }: { children: ReactNode }) {
  // Começa já com o que está no localStorage. Se esperássemos o /admin/auth/me
  // para decidir, todo F5 piscaria a tela de login antes de mostrar o painel.
  const [user, setUser] = useState<AdminUser | null>(() => readSession()?.user ?? null);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Vazio = todas as filiais que o token alcança. O backend já limita o escopo,
  // então "todas" nunca vaza filial de outro restaurante.
  const [activeBranchId, setActiveBranchId] = useState('');

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setBranches([]);
    setActiveBranchId('');
  }, []);

  // 401 em qualquer chamada da API cai aqui. Como o <RequireAuth> observa
  // `user`, zerar o estado já redireciona para o login sozinho.
  useEffect(() => onSessionExpired(signOut), [signOut]);

  // Confere o token guardado contra o backend. Um token expirado ou de um
  // lojista desativado devolve 401 e o efeito acima desloga.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        const [currentUser, currentBranches] = await Promise.all([
          fetchCurrentUser(),
          listBranches(),
        ]);
        if (cancelled) return;
        setUser(currentUser);
        setBranches(currentBranches);
        writeSession({ accessToken: readSession()?.accessToken ?? '', user: currentUser });
      } catch {
        // Erro de rede não desloga: o painel continua com o que tem em mão e
        // volta ao normal quando a internet voltar. 401 já foi tratado acima.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Roda quando entra um usuário novo (login) ou na montagem com sessão salva.
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await login(email, password);
    writeSession({ accessToken: response.access_token, user: response.admin_user });
    setUser(response.admin_user);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      branches,
      restaurantLabel: restaurantLabelFromBranches(branches),
      activeBranchId,
      selectBranch: setActiveBranchId,
      signIn,
      signOut,
    }),
    [user, branches, activeBranchId, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
