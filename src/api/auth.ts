/** Chamadas de autenticação do lojista. */
import { apiClient, unwrap } from './client';
import type { AdminUser, ChangePasswordBody, LoginResponse } from './types';

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

/**
 * Troca a PRÓPRIA senha. É a rota da tela de troca obrigatória e a do menu da
 * conta — a mesma nas duas, porque é a mesma coisa.
 *
 * ELA DERRUBA A PRÓPRIA SESSÃO, e isso não é efeito colateral: gravar
 * `password_changed_at` é o que revoga os tokens antigos, e sem essa linha
 * trocar a senha por suspeita de vazamento deixaria a sessão de quem vazou
 * viva pelas horas que faltassem do token. A resposta é uma mensagem, não um
 * token novo — a requisição seguinte com o token velho é 401.
 *
 * Por isso quem chama refaz o login com a senha nova em vez de seguir usando a
 * sessão. Ver `pages/ChangePasswordPage.tsx`.
 *
 * NÃO EXIGE PAPEL (`SEM_EXIGENCIA_DE_PAPEL`), e é uma das duas rotas que a
 * pessoa com senha temporária alcança — a outra é `GET /admin/auth/me`. Todo o
 * resto responde 403 enquanto `must_change_password` for verdadeiro.
 */
export async function changePassword(body: ChangePasswordBody): Promise<void> {
  await unwrap(await apiClient.PATCH('/admin/auth/password', { body }));
}
