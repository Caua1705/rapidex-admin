/** Chamadas de autenticação do lojista. */
import { apiClient, unwrap } from './client';
import type { AdminUser, LoginResponse } from './types';

export async function login(email: string, password: string): Promise<LoginResponse> {
  return unwrap(
    await apiClient.POST('/admin/auth/login', {
      body: { email, password },
    }),
  );
}

/**
 * Confere se o token guardado ainda vale.
 *
 * O backend recarrega o usuário do banco a cada chamada, então isto também
 * pega o caso de o lojista ter sido desativado com o token ainda na validade.
 */
export async function fetchCurrentUser(): Promise<AdminUser> {
  return unwrap(await apiClient.GET('/admin/auth/me'));
}
