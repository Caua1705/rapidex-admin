/**
 * Onde a sessão do lojista mora entre um F5 e outro.
 *
 * localStorage e não sessionStorage: o painel fica aberto o dia todo e o
 * lojista abre pedido em aba nova; sessionStorage pediria login em cada aba.
 * O token do backend vale 12h, então ele expira sozinho de qualquer forma.
 */
import type { AdminUser } from '../api/types';

const STORAGE_KEY = 'rapidex-admin.session';

export type Session = {
  accessToken: string;
  user: AdminUser;
};

export function readSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    // Conferimos a forma porque o que está no localStorage pode ser de uma
    // versão anterior do painel. Sessão malformada = sem sessão.
    if (!parsed.accessToken || !parsed.user?.id) return null;
    return { accessToken: parsed.accessToken, user: parsed.user };
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
