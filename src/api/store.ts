/**
 * Chamadas da tela "Minha loja".
 *
 * Duas escalas convivem aqui e é importante não confundi-las:
 *
 *   - `/admin/settings` é do RESTAURANTE inteiro (valor mínimo, tempo estimado,
 *     taxa de serviço, aceita entrega/retirada, loja aberta);
 *   - `/admin/branches/{id}` e o que pende dele — horários, entrega, formas de
 *     pagamento — são de UMA FILIAL.
 *
 * Por isso as funções de filial exigem `branchId` como primeiro argumento: com
 * "Todas as filiais" escolhida no cabeçalho não existe id para mandar, e a tela
 * precisa parar antes de chegar aqui.
 */
import { apiClient, unwrap, unwrapEmpty } from './client';
import type {
  Branch,
  BranchUpdate,
  BusinessHourInput,
  BusinessHour,
  PaymentMethod,
  PaymentMethodCreate,
  PaymentMethodUpdate,
  RestaurantSettings,
  RestaurantSettingsUpdate,
} from './types';

// --- restaurante --------------------------------------------------------

export async function fetchSettings(): Promise<RestaurantSettings> {
  return unwrap(await apiClient.GET('/admin/settings'));
}

export async function updateSettings(body: RestaurantSettingsUpdate): Promise<RestaurantSettings> {
  return unwrap(await apiClient.PATCH('/admin/settings', { body }));
}

/**
 * Abrir/fechar a loja.
 *
 * Rota própria, como a disponibilidade do produto no cardápio: é a ação mais
 * clicada do painel e não pode arrastar junto o resto do formulário que estava
 * aberto na tela. Um PATCH das configurações inteiras reenviaria valor mínimo e
 * taxa de serviço meio editados só porque o lojista fechou a loja.
 */
export async function setStoreOpen(isOpen: boolean): Promise<RestaurantSettings> {
  return unwrap(
    await apiClient.PATCH('/admin/settings/store-status', { body: { is_open: isOpen } }),
  );
}

// --- filial -------------------------------------------------------------

export async function fetchBranch(branchId: string): Promise<Branch> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

/**
 * Dados cadastrais E regras de entrega da filial saem pelo mesmo PATCH.
 *
 * As duas abas da tela (Filial e Entrega) chamam esta função com corpos
 * diferentes — cada uma manda só os seus campos, e o backend aceita edição
 * parcial. Mandar o objeto inteiro faria a aba de entrega reenviar o endereço
 * que o lojista talvez esteja editando em outra aba.
 */
export async function updateBranch(branchId: string, body: BranchUpdate): Promise<Branch> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

// --- horários -----------------------------------------------------------

export async function fetchBusinessHours(branchId: string): Promise<BusinessHour[]> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/business-hours', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

/**
 * Substitui a SEMANA INTEIRA.
 *
 * O PUT troca tudo o que existe, e dia que não está na lista vira dia fechado.
 * Mandar só os dias que o lojista mexeu não edita de menos: apaga o resto da
 * semana. Por isso quem chama monta o corpo com `weekPayload`
 * (store/business-hours.ts), que sempre devolve os 7 dias.
 */
export async function replaceBusinessHours(
  branchId: string,
  periods: BusinessHourInput[],
): Promise<BusinessHour[]> {
  return unwrap(
    await apiClient.PUT('/admin/branches/{branch_id}/business-hours', {
      params: { path: { branch_id: branchId } },
      body: { periods },
    }),
  );
}

// --- formas de pagamento ------------------------------------------------

export async function listPaymentMethods(branchId: string): Promise<PaymentMethod[]> {
  return unwrap(
    await apiClient.GET('/admin/branches/{branch_id}/payment-methods', {
      params: { path: { branch_id: branchId } },
    }),
  );
}

export async function createPaymentMethod(
  branchId: string,
  body: PaymentMethodCreate,
): Promise<PaymentMethod> {
  return unwrap(
    await apiClient.POST('/admin/branches/{branch_id}/payment-methods', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

/**
 * Edição parcial. `payment_flow` e `method_type` NÃO estão no corpo aceito.
 *
 * Não é omissão: trocar o fluxo de uma forma já cadastrada mudaria, no meio do
 * expediente, como os próximos pedidos daquela filial são cobrados. Quem errou
 * o cadastro desabilita a linha e cria outra.
 */
export async function updatePaymentMethod(
  methodId: string,
  body: PaymentMethodUpdate,
): Promise<PaymentMethod> {
  return unwrap(
    await apiClient.PATCH('/admin/payment-methods/{method_id}', {
      params: { path: { method_id: methodId } },
      body,
    }),
  );
}

/** Responde 204 sem corpo — daí o `unwrapEmpty`. */
export async function deletePaymentMethod(methodId: string): Promise<void> {
  unwrapEmpty(
    await apiClient.DELETE('/admin/payment-methods/{method_id}', {
      params: { path: { method_id: methodId } },
    }),
  );
}
