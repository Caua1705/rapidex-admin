/**
 * Chamadas da tela "Minha loja".
 *
 * Duas escalas convivem aqui e é importante não confundi-las:
 *
 *   - `/admin/settings` é do RESTAURANTE inteiro, e hoje só os PADRÕES (valor
 *     mínimo, tempo estimado, taxa de serviço, taxa de contingência);
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
  BranchOperation,
  BranchOrderTypes,
  BranchSettingsUpdate,
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

// --- operação da filial -------------------------------------------------

/*
 * O ESTADO DO DIA É DA FILIAL, SEM HERANÇA.
 *
 * `PATCH /admin/settings/store-status` não existe mais: fechar a loja do Centro
 * fechava a da Aldeota junto, e não havia como fechar só uma — que é a única
 * coisa que a operação de fato quer fazer às 21h. A rota de hoje pede a filial
 * no caminho, e por isso todas as funções daqui exigem `branchId`.
 */

/**
 * A tela de operação inteira em uma chamada: uma linha por filial.
 *
 * `branchId` só RESTRINGE. Sem ele vêm todas as filiais que o token alcança —
 * que é uma só para quem está preso a uma filial, sem a tela precisar conhecer
 * a regra de escopo.
 */
export async function fetchBranchOperation(branchId?: string): Promise<BranchOperation[]> {
  return unwrap(
    await apiClient.GET('/admin/branches/operation', {
      params: { query: branchId ? { branch_id: branchId } : {} },
    }),
  );
}

/**
 * Abrir/fechar ESTA filial.
 *
 * Rota própria, como a disponibilidade do produto no cardápio: é a ação mais
 * clicada do painel e não pode arrastar junto o resto do formulário que estava
 * aberto na tela. Um PATCH das configurações inteiras reenviaria valor mínimo e
 * taxa de serviço meio editados só porque o lojista fechou a loja.
 *
 * A resposta é a linha de operação inteira da filial — inclusive `is_open_now`,
 * que pode voltar `false` com `is_open: true` quando o horário de hoje já
 * fechou.
 */
export async function setBranchOpen(branchId: string, isOpen: boolean): Promise<BranchOperation> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/store-status', {
      params: { path: { branch_id: branchId } },
      body: { is_open: isOpen },
    }),
  );
}

/**
 * Aceitar entrega e aceitar retirada — os dois também são DESTA filial.
 *
 * Edição parcial de propósito: quem chama manda só o campo que o lojista
 * mexeu. Mandar os dois reenviaria por cima do que outra aba (ou o gerente do
 * outro balcão) acabou de gravar, e o corpo vazio é 422 no backend — não há
 * como "salvar nada".
 *
 * Desligar os dois é PERMITIDO e equivale a fechar a loja. O backend aceita, e
 * quem precisa dizer isso na tela é a linha da filial: a chave continua ligada
 * e ninguém consegue comprar.
 */
export async function setBranchOrderTypes(
  branchId: string,
  body: BranchOrderTypes,
): Promise<BranchOperation> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/order-types', {
      params: { path: { branch_id: branchId } },
      body,
    }),
  );
}

/**
 * As sobrescritas comerciais DESTA filial: mínimo, prazo, taxa de serviço e
 * taxa de contingência.
 *
 * Rota separada do PATCH de padrões porque o corpo tem TRÊS estados por campo —
 * ausente não mexe, valor sobrescreve, e `null` explícito volta a herdar. Sem o
 * terceiro não haveria como desfazer uma divergência.
 *
 * Quem monta o corpo é `store/branch-overrides.ts`, e ele só manda `null`
 * quando o lojista apagou uma sobrescrita que existia: um formulário que
 * serializa campo vazio como `null` devolve ao padrão toda filial que estava
 * herdando, sem ninguém ter pedido.
 *
 * Papel SOMENTE_DONO no backend: gerente recebe 403.
 */
export async function updateBranchSettings(
  branchId: string,
  body: BranchSettingsUpdate,
): Promise<BranchOperation> {
  return unwrap(
    await apiClient.PATCH('/admin/branches/{branch_id}/settings', {
      params: { path: { branch_id: branchId } },
      body,
    }),
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
