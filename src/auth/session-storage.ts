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

/*
 * escopo-ok: aqui mora o TOKEN e a linha do usuário, e nada disto recorta
 * nada. O restaurante vem dentro do JWT, que o backend assina e confere; o
 * `branch_id` da linha guardada não é lido por tela nenhuma (a filial de
 * trabalho é `activeBranchId`, que nasce vazia a cada carga e só muda pelo
 * seletor). Adulterar este objeto troca o RÓTULO que a tela desenha até o
 * `GET /admin/auth/me` responder — nunca o escopo de uma chamada, porque o
 * escopo não viaja daqui.
 */
export function readSession(): Session | null {
  // escopo-ok: token e rótulo, nunca recorte — ver o bloco acima.
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
  // escopo-ok: idem, na escrita.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  // escopo-ok: apagar a sessão não recorta nada.
  localStorage.removeItem(STORAGE_KEY);
}
