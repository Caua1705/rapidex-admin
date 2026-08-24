/**
 * Chamadas da tela de Usuários — a equipe do restaurante.
 *
 * QUATRO ROTAS, TODAS `SOMENTE_DONO`, e a uniformidade é o contrário do que
 * acontece em Cupons e Cashback (ler pela gerência, escrever pelo dono):
 *
 *   GET   /admin/users                      quem entra no painel
 *   POST  /admin/users                      cadastrar — devolve a senha UMA vez
 *   PATCH /admin/users/{admin_user_id}      nome, papel, filial, is_active
 *   POST  /admin/users/{id}/reset-password  segunda via da senha
 *
 * Não há meio-termo a dar ao gerente: a lista traz o e-mail de todo mundo, que
 * é a metade da credencial de cada pessoa da casa.
 *
 * NÃO EXISTE DELETE, e a ausência é deliberada do lado do backend:
 * `print_agents.created_by_admin_user_id` referencia a linha,
 * `order_status_history.changed_by` guarda `admin:{email}` como TEXTO (então
 * e-mail liberado é histórico apontando para a pessoa errada) e o UNIQUE de
 * e-mail é GLOBAL. Tirar alguém é `PATCH { is_active: false }`, e isso vale na
 * requisição SEGUINTE daquela pessoa — `_load_admin_from_token` recarrega o
 * usuário do banco a cada chamada, sem esperar as 12h do token.
 *
 * NENHUMA DELAS ACEITA `branch_id` EM QUERY. A equipe é do RESTAURANTE, não da
 * filial: o seletor do topo não recorta esta tela, e a filial de cada pessoa é
 * uma COLUNA da lista (ver `auth/branch-scope.ts`, onde `/admin/users` está
 * como 'multi' ao lado de `/admin/settings`).
 *
 * O `print_agent` NÃO É ALCANÇADO POR NENHUMA DAS QUATRO: ele não vem no GET
 * (`list_people_by_restaurant` filtra a conta de máquina), o PATCH e o reset
 * respondem 404 nele, e `role: 'print_agent'` no corpo é 422 com mensagem
 * própria. A tela não precisa escondê-lo — ele não chega até ela.
 */
import { apiClient, unwrap } from './client';
import type { AdminUserCreate, AdminUserCreated, AdminUserDetail, AdminUserUpdate } from './types';

/**
 * A equipe deste restaurante — ATIVOS E INATIVOS, em ordem de cadastro.
 *
 * A rota não tem query nenhuma: nem filtro de situação, nem busca, nem
 * paginação. Quem quiser recortar recorta na tela, sobre a lista inteira que já
 * está na mão — e a tela DIZ que o filtro é dela, como Cupons faz, para ninguém
 * concluir que o backend perdeu gente.
 *
 * Quem está desativado continua vindo, e é o que a tela precisa: uma lista que
 * escondesse os inativos transformaria "reativar o atendente que saiu em
 * janeiro" numa coisa impossível pelo painel.
 */
export async function listAdminUsers(): Promise<AdminUserDetail[]> {
  return unwrap(await apiClient.GET('/admin/users'));
}

/**
 * Cadastra alguém e recebe a senha temporária — A ÚNICA VEZ QUE ELA EXISTE.
 *
 * A resposta é `{ admin_user, temporary_password }`, e o `temporary_password`
 * não está gravado em lugar nenhum: o banco só tem o bcrypt dele. Não há rota
 * que o devolva de novo, e isso é propriedade e não limitação — uma rota "me
 * mostra de novo" seria uma rota que devolve a senha de outra pessoa.
 *
 * Quem chama é responsável por mostrá-la antes de perder a referência. Ver
 * `users/TemporaryPasswordDialog.tsx`, que é o único lugar do painel que a
 * exibe e o único diálogo que não fecha sozinho.
 */
export async function createAdminUser(body: AdminUserCreate): Promise<AdminUserCreated> {
  return unwrap(await apiClient.POST('/admin/users', { body }));
}

/**
 * Edita nome, papel, filial e situação. O e-mail NÃO está aqui.
 *
 * `AdminUserUpdate` não tem `email`, e não é esquecimento: o UNIQUE é global e
 * o histórico de pedidos guarda `admin:{email}` como texto, então trocar o
 * e-mail de alguém reescreveria a autoria do que já aconteceu. Quem mudou de
 * e-mail vira cadastro novo, e o antigo se desativa.
 *
 * TRÊS RECUSAS COM 400, e a tela impede as três ANTES de chamar (ver
 * `users/users-model.ts`): desativar a própria conta, desativar o único dono
 * ativo, rebaixar o único dono ativo. Chegar aqui e voltar com erro seria
 * oferecer um caminho para depois fechá-lo na cara de quem o seguiu.
 *
 * O CORPO É MÍNIMO — só o que mudou. O backend faz `model_dump(exclude_unset)`
 * e aplica campo a campo, então mandar o objeto inteiro para trocar um campo é
 * reenviar por cima o que outra aba pode ter acabado de gravar. É a mesma
 * decisão do `alternarAtivo` de Cupons.
 */
export async function updateAdminUser(
  adminUserId: string,
  body: AdminUserUpdate,
): Promise<AdminUserDetail> {
  return unwrap(
    await apiClient.PATCH('/admin/users/{admin_user_id}', {
      params: { path: { admin_user_id: adminUserId } },
      body,
    }),
  );
}

/**
 * Nova senha temporária — e todo token daquela pessoa morre na hora.
 *
 * DEVOLVE O MESMO SCHEMA DO POST (`AdminUserCreatedResponse`), e é por isso que
 * um diálogo só serve aos dois caminhos: o que muda é como se chegou ali, não o
 * que há para fazer com a senha na mão.
 *
 * Ela é a segunda via de quem perdeu a senha e a resposta à suspeita de
 * vazamento — o `password_changed_at` que ela grava revoga a sessão do painel,
 * as de outros navegadores e o ticket do stream SSE.
 *
 * NÃO TEM CORPO. Não há o que escolher: quem escolhe a senha é o servidor, e é
 * essa a razão de o dono não conhecer a credencial de ninguém.
 */
export async function resetAdminUserPassword(adminUserId: string): Promise<AdminUserCreated> {
  return unwrap(
    await apiClient.POST('/admin/users/{admin_user_id}/reset-password', {
      params: { path: { admin_user_id: adminUserId } },
    }),
  );
}
