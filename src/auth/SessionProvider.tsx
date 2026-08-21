import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchCurrentUser, login } from '../api/auth';
import { onSessionExpired } from '../api/client';
import { listBranches } from '../api/orders';
import type { AdminUser, Branch } from '../api/types';
import { papelDe, podeEntrarNoPainel } from './permissions';
import { restaurantLabelFromBranches } from './restaurant-label';
import { SessionContext, type SessionContextValue } from './session-context';
import { clearSession, readSession, writeSession } from './session-storage';

export function SessionProvider({ children }: { children: ReactNode }) {
  /*
   * Começa já com o que está no localStorage. Se esperássemos o /admin/auth/me
   * para decidir, todo F5 piscaria a tela de login antes de mostrar o painel.
   *
   * A SESSÃO GUARDADA TAMBÉM PASSA PELA RECUSA DE CONTA DE MÁQUINA. Sem isso,
   * quem entrou como `print_agent` ANTES desta frente continuaria dentro do
   * painel para sempre: a recusa no login não alcança uma sessão que já está
   * gravada, e ela vale 12 horas.
   */
  const [user, setUser] = useState<AdminUser | null>(() => {
    const guardado = readSession()?.user ?? null;
    if (guardado && !podeEntrarNoPainel(papelDe(guardado.role))) {
      clearSession();
      return null;
    }
    return guardado;
  });
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

  /**
   * CONTA DE MÁQUINA NÃO ENTRA NO PAINEL, e a recusa é DAQUI — não do backend.
   *
   * `POST /admin/auth/login` aceita os quatro papéis de propósito: é por ele
   * que o agente de impressão se autentica, com o e-mail e a senha que estão em
   * texto puro no `config.ini` do computador do balcão. Recusar `print_agent`
   * lá pararia a impressão de todas as lojas. A porta é a mesma; o que muda é
   * quem entra por ela.
   *
   * O TOKEN NÃO É GRAVADO. A chamada de login já aconteceu e o backend já
   * emitiu um token válido — o que não acontece é ele chegar ao `localStorage`.
   * Guardá-lo "para o caso de" seria deixar na máquina uma credencial que o
   * painel se recusa a usar.
   */
  const signIn = useCallback(async (email: string, password: string) => {
    const response = await login(email, password);

    if (!podeEntrarNoPainel(papelDe(response.admin_user.role))) {
      throw new Error(
        'Esta é a conta do programa de impressão, e ela não abre o painel. ' +
          'Entre com o seu usuário.',
      );
    }

    writeSession({ accessToken: response.access_token, user: response.admin_user });
    setUser(response.admin_user);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      papel: papelDe(user?.role),
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
