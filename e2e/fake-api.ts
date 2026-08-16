/**
 * Backend falso do E2E.
 *
 * POR QUE existe: o teste de ponta a ponta precisa ser determinístico e rodar
 * no CI, onde não há restaurante de verdade com pedido pendente esperando. Em
 * vez de apontar para a API real (que mudaria de estado a cada execução e
 * quebraria o CI quando estivesse fora do ar), interceptamos as chamadas com
 * page.route() e respondemos com dados em memória.
 *
 * O que é fake é só o TRANSPORTE: os formatos de resposta são os mesmos do
 * /openapi.json — os tipos vêm de `src/api/generated/openapi.d.ts`, então uma
 * mudança de contrato no backend quebra este arquivo no `npm run typecheck`.
 */
import type { Page, Route } from '@playwright/test';

import type { components } from '../src/api/generated/openapi';

type Schemas = components['schemas'];
type AdminUser = Schemas['AdminUserResponse'];
type Branch = Schemas['AdminBranchResponse'];
type OrderListItem = Schemas['AdminOrderListItem'];
type OrderDetail = Schemas['OrderDetailResponse'];
type StreamEvent = Schemas['AdminOrderStreamEvent'];
type Category = Schemas['AdminCategoryResponse'];
type Product = Schemas['AdminProductResponse'];
type PrintSector = Schemas['PrintingSectorResponse'];
type RestaurantSettings = Schemas['AdminRestaurantSettingsResponse'];
type BusinessHour = Schemas['BusinessHourResponse'];
type BusinessHourInput = Schemas['BusinessHourInput'];
type PaymentMethod = Schemas['AdminPaymentMethodResponse'];
type CustomerListItem = Schemas['AdminCustomerListItem'];

export const LOGIN_EMAIL = 'dono@pizzaria.com';
export const LOGIN_PASSWORD = 'senha-certa';
export const ACCESS_TOKEN = 'jwt-de-mentira';

const RESTAURANT_ID = '11111111-1111-1111-1111-111111111111';
const BRANCH_ID = '22222222-2222-2222-2222-222222222222';

export const FAKE_USER: AdminUser = {
  id: '33333333-3333-3333-3333-333333333333',
  restaurant_id: RESTAURANT_ID,
  branch_id: null,
  name: 'Joana Souza',
  email: LOGIN_EMAIL,
  role: 'owner',
  is_active: true,
};

export const FAKE_BRANCH: Branch = {
  id: BRANCH_ID,
  name: 'Matriz Aldeota',
  slug: 'aldeota',
  display_name: 'Pizzaria do Zé — Aldeota',
  address: 'Av. Santos Dumont, 1000',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'CE',
  is_main: true,
  is_active: true,
};

/** Segunda filial: sem ela o seletor do cabeçalho não teria o que escolher. */
export const FAKE_BRANCH_2: Branch = {
  id: '44444444-4444-4444-4444-444444444444',
  name: 'Zona Norte',
  slug: 'zona-norte',
  display_name: 'Pizzaria do Zé — Zona Norte',
  address: 'Av. Brasil, 900',
  neighborhood: 'Parangaba',
  city: 'Fortaleza',
  state: 'CE',
  is_main: false,
  is_active: true,
};

/**
 * Soma dos itens do detalhe (45 + 79).
 *
 * O `total` do pedido na lista usa o mesmo número: card e painel mostrando
 * valores diferentes para o MESMO pedido seria um defeito plantado no falso.
 * Ele também é o que prova que a tela não soma os adicionais duas vezes — com
 * `additional_price_snapshot` somado por cima daria 141.
 */
const TOTAL_DOS_ITENS = 124;

/**
 * A data é sempre "agora": a tela abre filtrada em HOJE e o filtro de data do
 * SSE (orderMatchesFilters) compara o dia do pedido com o dia de hoje. Data
 * fixa faria o teste passar hoje e quebrar amanhã.
 */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function order(overrides: Partial<OrderListItem> & { id: string; order_number: number }) {
  const base: OrderListItem = {
    id: overrides.id,
    order_number: overrides.order_number,
    branch_id: BRANCH_ID,
    customer_name_snapshot: 'Cliente',
    customer_phone_snapshot: '85999990000',
    order_type: 'delivery',
    status: 'pending',
    payment_method: 'cash',
    payment_status: 'on_delivery',
    total: TOTAL_DOS_ITENS,
    created_at: minutesAgo(10),
  };
  return { ...base, ...overrides };
}

/** Os três pedidos com que toda tela do E2E começa. */
function initialOrders(): OrderListItem[] {
  return [
    // Pix ainda não pago: é o card que precisa aparecer destacado.
    order({
      id: 'ord-1001',
      order_number: 1001,
      customer_name_snapshot: 'Marcos Lima',
      payment_method: 'pix',
      payment_status: 'pending',
      created_at: minutesAgo(4),
    }),
    // Dinheiro na entrega: este é o que o caminho crítico move de status.
    order({
      id: 'ord-1002',
      order_number: 1002,
      customer_name_snapshot: 'Ana Paula',
      payment_method: 'cash',
      payment_status: 'on_delivery',
      created_at: minutesAgo(9),
    }),
    // Já na cozinha, para a tela não abrir com uma coluna só.
    order({
      id: 'ord-1003',
      order_number: 1003,
      customer_name_snapshot: 'Rafael Nunes',
      order_type: 'pickup',
      status: 'preparing',
      payment_method: 'credit_card',
      payment_status: 'paid',
      created_at: minutesAgo(25),
    }),
  ];
}

/**
 * Os adicionais do item, no formato que o backend passou a mandar.
 *
 * Os dois grupos trazem uma opção de MESMO NOME de propósito: "espaguete" em
 * "Acompanhamento" é a troca do que já vem no prato, e em "Adicional" é uma
 * porção a mais. É o caso que a tela precisa saber distinguir.
 */
function optionGroupsFixture() {
  return [
    {
      option_group_id: 'grp-acomp',
      option_group_name_snapshot: 'Acompanhamento',
      options: [
        {
          id: 'sel-espaguete',
          option_id: 'opt-espaguete',
          option_name_snapshot: 'Espaguete',
          additional_price_snapshot: 0,
        },
      ],
    },
    {
      option_group_id: 'grp-adicional',
      option_group_name_snapshot: 'Adicional',
      options: [
        {
          id: 'sel-espaguete-extra',
          option_id: 'opt-espaguete',
          option_name_snapshot: 'Espaguete',
          additional_price_snapshot: 12,
        },
        {
          id: 'sel-bacon',
          option_id: 'opt-bacon',
          option_name_snapshot: 'Bacon',
          additional_price_snapshot: 5,
        },
      ],
    },
  ];
}

/** Detalhe montado a partir do item da lista, para os dois nunca divergirem. */
function detailOf(item: OrderListItem, history: Schemas['StatusHistoryResponse'][]): OrderDetail {
  return {
    id: item.id,
    order_number: item.order_number,
    restaurant_id: RESTAURANT_ID,
    branch_id: item.branch_id,
    customer_name_snapshot: item.customer_name_snapshot,
    customer_phone_snapshot: item.customer_phone_snapshot,
    order_type: item.order_type,
    status: item.status,
    payment_method: item.payment_method,
    payment_status: item.payment_status,
    subtotal: item.total,
    delivery_fee: 0,
    service_fee: 0,
    coupon_discount_amount: '0.00',
    cashback_redeemed_amount: '0.00',
    discount_total: '0.00',
    total: item.total,
    address_street: 'Rua das Flores',
    address_number: '123',
    address_neighborhood: 'Aldeota',
    address_complement: 'Apto 402',
    address_reference: 'Portão azul',
    address_city: 'Fortaleza',
    address_state: 'CE',
    address_zipcode: '60150000',
    notes: 'Sem cebola, por favor.',
    created_at: item.created_at,
    items: [
      {
        id: `${item.id}-item-1`,
        product_name_snapshot: 'Pizza Calabresa G',
        unit_price_snapshot: 45,
        quantity: 1,
        observation: 'Borda recheada',
        total: 45,
      },
      {
        id: `${item.id}-item-2`,
        product_name_snapshot: 'Filé à parmegiana',
        // Já inclui os adicionais: os `additional_price_snapshot` abaixo são só
        // conferência e NÃO podem ser somados de novo pela tela.
        unit_price_snapshot: 79,
        quantity: 1,
        total: 79,
        option_groups: optionGroupsFixture(),
      },
    ],
    status_history: history,
  };
}

/**
 * Cardápio inicial.
 *
 * "Combo Duplo" existe para provar que `is_active` e `is_available` são eixos
 * diferentes: ele está marcado como DISPONÍVEL e mesmo assim é inativo — a tela
 * tem que esmaecer a linha e não oferecer o interruptor de esgotado.
 */
function initialCategories(): Category[] {
  return [
    { id: 'cat-1', name: 'Lanches', slug: 'lanches', sort_order: 0, is_active: true },
    {
      id: 'cat-2',
      name: 'Acompanhamentos',
      slug: 'acompanhamentos',
      sort_order: 1,
      is_active: true,
    },
    { id: 'cat-3', name: 'Sobremesas', slug: 'sobremesas', sort_order: 2, is_active: false },
  ];
}

function initialProducts(): Product[] {
  return [
    {
      id: 'prod-1',
      category_id: 'cat-1',
      name: 'X-Burger Clássico',
      price: 24.9,
      is_active: true,
      is_available: true,
      sort_order: 0,
      // O único da categoria já configurado: os outros dois estão em "Não
      // imprimir", que é o que a coluna de setor existe para o lojista notar.
      printing_sector_id: 'sec-chapa',
    },
    {
      id: 'prod-2',
      category_id: 'cat-1',
      name: 'X-Salada',
      price: 26.5,
      is_active: true,
      is_available: false,
      sort_order: 1,
    },
    {
      id: 'prod-3',
      category_id: 'cat-1',
      name: 'Combo Duplo',
      price: 45,
      is_active: false,
      is_available: true,
      sort_order: 2,
    },
    {
      id: 'prod-4',
      category_id: 'cat-2',
      name: 'Batata frita M',
      price: 14.9,
      is_active: true,
      is_available: true,
      sort_order: 0,
    },
  ];
}

/**
 * As configurações iniciais do restaurante.
 *
 * `default_delivery_fee` está aqui porque o backend o devolve — e é justamente
 * o campo que o painel NÃO pode expor: ele é editável na API e não afeta a
 * cobrança. Deixá-lo no falso é o que permite ao teste provar que a tela não o
 * mostra.
 */
function initialSettings(): RestaurantSettings {
  return {
    min_order_value: 20,
    estimated_delivery_time_min: 30,
    estimated_delivery_time_max: 50,
    default_delivery_fee: 7.5,
    service_fee_enabled: true,
    service_fee_amount: 2,
    accepts_delivery: true,
    accepts_pickup: true,
    is_open: true,
  };
}

/** Segunda a sexta abertas, sábado à noite, domingo fechado. */
/**
 * A semana do falso: segunda a sexta abertas, fim de semana fechado.
 *
 * Os SETE dias vêm na resposta, inclusive os fechados. Antes só vinham os cinco
 * abertos — e a barra de preparo, que lê a linha do DIA DE HOJE, mostraria "não
 * definido" sempre que a suíte rodasse num sábado. Teste que muda de resultado
 * conforme o dia da semana é teste que ninguém confia na segunda-feira.
 */
function initialBusinessHours(branchId: string): BusinessHour[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `${branchId}-h-${weekday}`,
    weekday,
    opens_at: weekday <= 4 ? '18:00:00' : null,
    closes_at: weekday <= 4 ? '23:00:00' : null,
    is_closed: weekday > 4,
    sort_order: weekday,
  }));
}

function initialPaymentMethods(branchId: string): PaymentMethod[] {
  return [
    {
      id: 'pay-pix',
      branch_id: branchId,
      payment_flow: 'online',
      method_type: 'pix',
      label: 'Pix',
      enabled: true,
      requires_gateway: true,
      sort_order: 0,
    },
    {
      id: 'pay-dinheiro',
      branch_id: branchId,
      payment_flow: 'delivery',
      method_type: 'cash',
      label: 'Dinheiro',
      enabled: true,
      requires_gateway: false,
      sort_order: 1,
    },
  ];
}

/**
 * Setores de impressão da filial.
 *
 * "Bar" nasce desativado para provar as duas metades da regra: ele não pode ser
 * OFERECIDO num produto, mas o nome dele continua aparecendo em quem já o tem.
 */
function initialPrintSectors(branchId: string): PrintSector[] {
  return [
    { id: 'sec-chapa', branch_id: branchId, name: 'Chapa', is_active: true, sort_order: 0 },
    { id: 'sec-bar', branch_id: branchId, name: 'Bar', is_active: false, sort_order: 1 },
  ];
}

/**
 * Clientes que já pediram na loja.
 *
 * Cada linha cobre um caso que a tela precisa saber desenhar:
 *
 * - Ana Paula: o caso comum, com pedido de hoje.
 * - Marcos Lima: sumiu há meses — é a linha que responde "a quem chamar de
 *   volta", que é a razão de a tela existir.
 * - (sem nome): quem compra no balcão sem se identificar. A linha não pode
 *   sair em branco.
 * - Rafael: um só pedido, e o telefone é FIXO (10 dígitos) — o formato do
 *   telefone tem dois casos e os dois precisam aparecer em print.
 *
 * As datas são relativas a agora pelo mesmo motivo dos pedidos: data fixa faria
 * "há 3 meses" virar "há 4 meses" na virada do mês e o print mentir sozinho.
 */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * De qual filial é cada cliente.
 *
 * Fica FORA do item porque o contrato não tem esse campo: o backend filtra por
 * filial na query e devolve o item sem dizer de qual loja ele veio. Um campo
 * `branch_id` inventado no fixture faria o falso mentir sobre o formato da
 * resposta — que é justamente o que este arquivo não pode fazer.
 */
const CUSTOMER_BRANCH: Record<string, string> = {
  '85999990000': BRANCH_ID,
  '85988887777': BRANCH_ID,
  '85977776666': BRANCH_ID,
  '8532224444': '44444444-4444-4444-4444-444444444444',
};

function initialCustomers(): CustomerListItem[] {
  return [
    {
      customer_name: 'Ana Paula',
      customer_phone: '85999990000',
      orders_count: 12,
      total_spent: 748.5,
      first_order_at: daysAgo(400),
      last_order_at: daysAgo(0),
    },
    {
      customer_name: 'Marcos Lima',
      customer_phone: '85988887777',
      orders_count: 5,
      total_spent: 312,
      first_order_at: daysAgo(300),
      last_order_at: daysAgo(95),
    },
    {
      customer_name: '',
      customer_phone: '85977776666',
      orders_count: 2,
      total_spent: 89.9,
      first_order_at: daysAgo(60),
      last_order_at: daysAgo(1),
    },
    {
      customer_name: 'Rafael Nunes',
      customer_phone: '8532224444',
      orders_count: 1,
      total_spent: 45,
      first_order_at: daysAgo(12),
      last_order_at: daysAgo(12),
    },
  ];
}

/** Espelho enxuto da máquina de estados do backend, só para recusar o inválido. */
const TRANSICOES: Record<string, string[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
};

/** Estado final = sem destino na tabela acima. */
function isTerminal(status: string): boolean {
  return (TRANSICOES[status]?.length ?? 0) === 0;
}

const ROTULOS: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  preparing: 'Preparando',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  rejected: 'Recusado',
};

export type FakeApi = {
  /** Estado que o "banco" tem agora. Os testes leem e escrevem à vontade. */
  orders: OrderListItem[];
  /** Categorias na ordem em que o "banco" as tem. */
  categories: () => Category[];
  /** Produto pelo id, para conferir o que o painel gravou. */
  product: (productId: string) => Product | undefined;
  /** Corpo de cada PATCH /admin/categories/reorder que chegou. */
  reorderCalls: () => string[][];
  /** Motivo gravado no cancelamento, para conferir o que a tela mandou. */
  cancelReasons: () => { orderId: string; reason: string }[];
  /** Apaga a faixa base da filial: o próximo ajuste responde 409. */
  clearPrepTimeBase: (branchId: string) => void;
  /** Fecha a filial: qualquer ajuste responde 409 de loja fechada. */
  closeBranch: (branchId: string) => void;
  /** Faixa que o "banco" tem agora para a filial. */
  prepTimeOf: (branchId: string) => { min: number; max: number } | null;
  /** Cada PATCH /admin/products/{id}/availability que chegou. */
  availabilityCalls: () => { productId: string; isAvailable: boolean }[];
  /** Cada POST /admin/products/{id}/image que chegou, com o peso do corpo. */
  imageUploads: () => { productId: string; bytes: number }[];
  /** Configurações do restaurante como o "banco" as tem agora. */
  settings: () => RestaurantSettings;
  /** Corpo de cada PATCH /admin/settings, para conferir o que a tela mandou. */
  settingsPatches: () => Record<string, unknown>[];
  /** Corpo de cada PATCH /admin/branches/{id}. */
  branchPatches: () => { branchId: string; body: Record<string, unknown> }[];
  /** Corpo de cada PUT de horários — é onde se confere que vão os 7 dias. */
  hoursPuts: () => { branchId: string; periods: BusinessHourInput[] }[];
  /** Formas de pagamento que o "banco" tem agora. */
  paymentMethods: () => PaymentMethod[];
  /** Setores de impressão que o "banco" tem agora. */
  printSectors: () => PrintSector[];
  /** Cada PATCH de setor aplicado a uma categoria inteira. */
  categorySectorCalls: () => { categoryId: string; printSectorId: string | null }[];
  /** Cada PATCH de setor aplicado a UM produto. */
  productSectorCalls: () => { productId: string; printSectorId: string | null }[];
  /** Todos os produtos, para conferir o que o lote gravou. */
  products: () => Product[];
  /**
   * Esvazia o quadro, para fotografar o estado sem nenhum pedido.
   *
   * É o estado que não aparecia em print nenhum e por isso passou muito tempo
   * sendo três faixas com zero e mais nada.
   */
  clearOrders: () => void;
  /** Devolve os pedidos iniciais depois de um `clearOrders`. */
  restoreOrders: () => void;
  /** Fecha a loja no "banco", como faria o interruptor de Minha loja. */
  closeStore: () => void;
  /** Empurra um pedido novo pelo SSE, como se outro cliente tivesse comprado. */
  pushNewOrder: (item: OrderListItem) => void;
  /** Muda o status por fora da tela, como faria outro atendente. */
  setStatusFromAnotherUser: (orderId: string, status: string) => void;
  /** Faz toda chamada autenticada responder 401 (sessão expirada). */
  expireSession: () => void;
  /** Encerra as respostas pendentes do SSE no fim do teste. */
  stop: () => void;
  /** Cria um item de pedido pronto para o pushNewOrder. */
  makeOrder: typeof order;
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Instala o backend falso na página. Chame ANTES do primeiro page.goto().
 */
export async function installFakeApi(page: Page): Promise<FakeApi> {
  const state = {
    orders: initialOrders(),
    // O histórico é guardado de verdade porque o painel recarrega o detalhe
    // depois de mudar o status — e o teste confere a linha nova lá.
    history: {} as Record<string, Schemas['StatusHistoryResponse'][]>,
    sessionExpired: false,
    stopped: false,
    /** Append-only: cada conexão SSE lê a partir do próprio cursor. */
    streamLog: [] as StreamEvent[],
    eventId: 0,
    categories: initialCategories(),
    products: initialProducts(),
    reorderCalls: [] as string[][],
    availabilityCalls: [] as { productId: string; isAvailable: boolean }[],
    imageUploads: [] as { productId: string; bytes: number }[],
    cancelReasons: [] as { orderId: string; reason: string }[],
    // A matriz já tem faixa gravada; a segunda filial não, para o teste do 409.
    prepTime: {
      [BRANCH_ID]: { min: 25, max: 35 },
    } as Record<string, { min: number; max: number } | null>,
    closedBranches: new Set<string>(),
    // Minha loja. As filiais são cópias, e não as constantes exportadas: os
    // PATCH da tela gravam nelas, e mutar a constante vazaria de um teste para
    // o outro.
    branches: [{ ...FAKE_BRANCH }, { ...FAKE_BRANCH_2 }] as Branch[],
    settings: initialSettings(),
    settingsPatches: [] as Record<string, unknown>[],
    branchPatches: [] as { branchId: string; body: Record<string, unknown> }[],
    businessHours: {
      [BRANCH_ID]: initialBusinessHours(BRANCH_ID),
    } as Record<string, BusinessHour[]>,
    hoursPuts: [] as { branchId: string; periods: BusinessHourInput[] }[],
    paymentMethods: initialPaymentMethods(BRANCH_ID),
    printSectors: initialPrintSectors(BRANCH_ID),
    /** Cada PATCH de setor na categoria inteira, para conferir o lote. */
    categorySectorCalls: [] as { categoryId: string; printSectorId: string | null }[],
    /** Cada PATCH de setor em UM produto, vindo da edição do item. */
    productSectorCalls: [] as { productId: string; printSectorId: string | null }[],
    customers: initialCustomers(),
  };

  function findOrder(orderId: string): OrderListItem | undefined {
    return state.orders.find((item) => item.id === orderId);
  }

  function historyOf(item: OrderListItem): Schemas['StatusHistoryResponse'][] {
    state.history[item.id] ??= [
      {
        id: `${item.id}-hist-0`,
        status: 'pending',
        changed_by: 'cliente',
        created_at: item.created_at,
      },
    ];
    return state.history[item.id] as Schemas['StatusHistoryResponse'][];
  }

  /**
   * Segura a resposta do SSE até o teste empurrar um evento.
   *
   * Fulfill imediato faria o EventSource receber corpo vazio, fechar e
   * reabrir em loop durante o teste inteiro. Segurando a conexão, ela se
   * comporta como um stream de verdade: só responde quando há o que mandar.
   *
   * O log é APPEND-ONLY e cada conexão guarda o próprio cursor, em vez de uma
   * fila compartilhada que a primeira conexão esvazia. A diferença aparece
   * quando existe mais de uma conexão viva — ao sair de /pedidos para /cozinha,
   * o stream da tela anterior ainda está pendurado por um instante, e com fila
   * compartilhada era ELE quem consumia o evento que a Cozinha esperava.
   */
  async function serveStream(route: Route) {
    const cursor = state.streamLog.length;
    const limite = Date.now() + 15_000;
    while (state.streamLog.length === cursor && !state.stopped && Date.now() < limite) {
      await sleep(50);
    }

    const frames = state.streamLog.slice(cursor).map((event) => {
      state.eventId += 1;
      return `id: ${state.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    });

    try {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        body: frames.join('') || ': keep-alive\n\n',
      });
    } catch {
      // A página já pode ter sido fechada no fim do teste. Não é falha.
    }
  }

  await page.route(/\/admin\//, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    // Sessão expirada: qualquer chamada com Authorization responde 401, que é
    // o gatilho do logout automático do painel.
    if (state.sessionExpired && path !== '/admin/auth/login') {
      return json(route, 401, { detail: 'Token expirado.' });
    }

    if (method === 'POST' && path === '/admin/auth/login') {
      const body = request.postDataJSON() as { email?: string; password?: string };
      if (body.email !== LOGIN_EMAIL || body.password !== LOGIN_PASSWORD) {
        return json(route, 401, { detail: 'E-mail ou senha inválidos.' });
      }
      return json(route, 200, {
        access_token: ACCESS_TOKEN,
        token_type: 'bearer',
        admin_user: FAKE_USER,
      });
    }

    if (method === 'GET' && path === '/admin/auth/me') {
      return json(route, 200, FAKE_USER);
    }

    if (method === 'GET' && path === '/admin/branches') {
      return json(route, 200, [FAKE_BRANCH, FAKE_BRANCH_2]);
    }

    if (method === 'GET' && path === '/admin/orders') {
      // Respeita o filtro de filial, que é o que o seletor do cabeçalho manda,
      // e o de status, que é como a Cozinha carrega as três colunas dela.
      const query = new URL(request.url()).searchParams;
      const branchId = query.get('branch_id');
      const status = query.get('status');
      const items = state.orders.filter(
        (item) => (!branchId || item.branch_id === branchId) && (!status || item.status === status),
      );
      return json(route, 200, { items, total: items.length, limit: 100, offset: 0 });
    }

    // --- clientes ----------------------------------------------------------

    /*
     * Respeita filial, busca e paginação — os três que a tela usa de verdade.
     *
     * A busca é "telefone (só dígitos) OU parte do nome", como o contrato
     * descreve: um termo só, dois critérios. Testar só o nome deixaria a busca
     * por telefone passar sem nunca ter rodado.
     */
    if (method === 'GET' && path === '/admin/customers') {
      const query = new URL(request.url()).searchParams;
      const branchId = query.get('branch_id');
      const search = (query.get('search') ?? '').trim().toLowerCase();
      const digits = search.replace(/\D/g, '');
      const limit = Number(query.get('limit') ?? 50);
      const offset = Number(query.get('offset') ?? 0);

      const matching = state.customers.filter((item) => {
        if (branchId && CUSTOMER_BRANCH[item.customer_phone] !== branchId) return false;
        if (!search) return true;
        if (item.customer_name.toLowerCase().includes(search)) return true;
        return digits !== '' && item.customer_phone.includes(digits);
      });

      return json(route, 200, {
        items: matching.slice(offset, offset + limit),
        total: matching.length,
        limit,
        offset,
      });
    }

    if (method === 'GET' && path === '/admin/orders/status-counts') {
      const counts: Record<string, number> = {};
      state.orders.forEach((item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
      });
      return json(route, 200, {
        counts: Object.entries(counts).map(([status, count]) => ({ status, count })),
        total: state.orders.length,
      });
    }

    if (method === 'POST' && path === '/admin/orders/stream-ticket') {
      return json(route, 200, { ticket: 'ticket-de-mentira', expires_in_seconds: 30 });
    }

    if (method === 'GET' && path === '/admin/orders/stream') {
      return serveStream(route);
    }

    const statusMatch = /^\/admin\/orders\/([^/]+)\/status$/.exec(path);
    if (method === 'PATCH' && statusMatch?.[1]) {
      const item = findOrder(statusMatch[1]);
      if (!item) return json(route, 404, { detail: 'Pedido não encontrado.' });

      const body = request.postDataJSON() as { status: string };
      const permitidos = TRANSICOES[item.status] ?? [];
      if (!permitidos.includes(body.status)) {
        // Mesma forma de erro do backend: 409 com a frase já em português.
        return json(route, 409, {
          detail: `Não é possível mudar de "${ROTULOS[item.status]}" para "${ROTULOS[body.status]}".`,
        });
      }

      item.status = body.status;
      historyOf(item).push({
        id: `${item.id}-hist-${body.status}`,
        status: body.status,
        changed_by: FAKE_USER.name,
        created_at: new Date().toISOString(),
      });
      return json(route, 200, detailOf(item, historyOf(item)));
    }

    /*
     * Cancelar com motivo. Antes de /admin/orders/{id}, senão "cancel" seria
     * lido como id de pedido.
     */
    const cancelMatch = /^\/admin\/orders\/([^/]+)\/cancel$/.exec(path);
    if (method === 'PATCH' && cancelMatch?.[1]) {
      const item = findOrder(cancelMatch[1]);
      if (!item) return json(route, 404, { detail: 'Pedido não encontrado.' });

      const body = request.postDataJSON() as { reason?: string };
      const reason = (body.reason ?? '').trim();
      // Mesma validação do backend: 3 a 300 caracteres, 422 fora disso.
      if (reason.length < 3 || reason.length > 300) {
        return json(route, 422, {
          detail: [{ loc: ['body', 'reason'], msg: 'O motivo precisa ter de 3 a 300 caracteres.' }],
        });
      }
      if (isTerminal(item.status)) {
        return json(route, 409, {
          detail: `"${ROTULOS[item.status]}" é um estado final e não muda mais.`,
        });
      }

      state.cancelReasons.push({ orderId: item.id, reason });
      item.status = 'cancelled';
      historyOf(item).push({
        id: `${item.id}-hist-cancelled`,
        status: 'cancelled',
        changed_by: FAKE_USER.name,
        note: reason,
        created_at: new Date().toISOString(),
      });
      return json(route, 200, detailOf(item, historyOf(item)));
    }

    const detailMatch = /^\/admin\/orders\/([^/]+)$/.exec(path);
    if (method === 'GET' && detailMatch?.[1]) {
      const item = findOrder(detailMatch[1]);
      if (!item) return json(route, 404, { detail: 'Pedido não encontrado.' });
      return json(route, 200, detailOf(item, historyOf(item)));
    }

    // --- tempo de preparo --------------------------------------------------

    const prepMatch = /^\/admin\/branches\/([^/]+)\/prep-time$/.exec(path);
    if (method === 'PATCH' && prepMatch?.[1]) {
      const branchId = prepMatch[1];

      // Filial fechada ganha de tudo: nem o ajuste nem a gravação da base
      // fazem sentido numa loja que não está vendendo.
      if (state.closedBranches.has(branchId)) {
        return json(route, 409, {
          code: 'BRANCH_CLOSED',
          detail: 'A filial está fechada agora. Reabra a loja para mexer no tempo de preparo.',
        });
      }

      const body = request.postDataJSON() as {
        delta_minutes?: number;
        prep_time_min?: number;
        prep_time_max?: number;
      };

      if (typeof body.prep_time_min === 'number' && typeof body.prep_time_max === 'number') {
        state.prepTime[branchId] = { min: body.prep_time_min, max: body.prep_time_max };
      } else {
        const current = state.prepTime[branchId];
        if (!current) {
          return json(route, 409, {
            code: 'PREP_TIME_NOT_CONFIGURED',
            detail: 'A filial ainda não tem tempo de preparo base gravado.',
          });
        }
        const delta = body.delta_minutes ?? 0;
        state.prepTime[branchId] = {
          min: Math.max(0, current.min + delta),
          max: Math.max(0, current.max + delta),
        };
      }

      // A resposta é a LINHA DE HORÁRIO do dia, como no contrato: o prazo de
      // preparo mora nela. Devolver só o par de números deixaria o falso mais
      // frouxo que o backend, e o painel passaria aqui e falharia em produção.
      const saved = state.prepTime[branchId] as { min: number; max: number };
      const hoje = (new Date().getDay() + 6) % 7;
      const row = (state.businessHours[branchId] ?? []).find((entry) => entry.weekday === hoje);
      return json(route, 200, {
        id: row?.id ?? `${branchId}-h-${hoje}`,
        weekday: hoje,
        opens_at: row?.opens_at ?? null,
        closes_at: row?.closes_at ?? null,
        is_closed: row?.is_closed ?? false,
        sort_order: row?.sort_order ?? hoje,
        prep_time_min: saved.min,
        prep_time_max: saved.max,
      });
    }

    // --- minha loja: configurações do restaurante --------------------------

    /*
     * Antes de /admin/settings, senão "store-status" seria lido como parte do
     * PATCH das configurações inteiras — o mesmo cuidado do reorder.
     */
    if (method === 'PATCH' && path === '/admin/settings/store-status') {
      const body = request.postDataJSON() as { is_open: boolean };
      state.settings.is_open = body.is_open;
      return json(route, 200, state.settings);
    }

    if (path === '/admin/settings') {
      if (method === 'GET') return json(route, 200, state.settings);
      if (method === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.settingsPatches.push(body);
        Object.assign(state.settings, body);
        return json(route, 200, state.settings);
      }
    }

    // --- minha loja: horários ---------------------------------------------

    const hoursMatch = /^\/admin\/branches\/([^/]+)\/business-hours$/.exec(path);
    if (hoursMatch?.[1]) {
      const branchId = hoursMatch[1];
      if (method === 'GET') {
        /*
         * O prazo de preparo mora na linha do dia — é daqui que a barra de
         * pedidos lê a faixa vigente na abertura. O falso guarda um prazo por
         * filial e o injeta em todas as linhas: basta para a leitura por dia,
         * e mantém `prepTimeOf` como fonte única do que foi gravado.
         */
        const prep = state.prepTime[branchId] ?? null;
        return json(
          route,
          200,
          (state.businessHours[branchId] ?? []).map((row) => ({
            ...row,
            prep_time_min: prep?.min ?? null,
            prep_time_max: prep?.max ?? null,
          })),
        );
      }
      if (method === 'PUT') {
        const body = request.postDataJSON() as { periods?: BusinessHourInput[] };
        const periods = body.periods ?? [];
        state.hoursPuts.push({ branchId, periods });

        // Como o backend: substitui a semana inteira, e dia ausente da lista
        // simplesmente não existe mais — ou seja, fica fechado.
        state.businessHours[branchId] = periods.map((period, index) => ({
          id: `${branchId}-h-${period.weekday}`,
          weekday: period.weekday,
          opens_at: period.opens_at ?? null,
          closes_at: period.closes_at ?? null,
          is_closed: period.is_closed,
          sort_order: index,
        }));
        return json(route, 200, state.businessHours[branchId]);
      }
    }

    // --- minha loja: formas de pagamento ----------------------------------

    const methodsMatch = /^\/admin\/branches\/([^/]+)\/payment-methods$/.exec(path);
    if (methodsMatch?.[1]) {
      const branchId = methodsMatch[1];
      if (method === 'GET') {
        return json(
          route,
          200,
          state.paymentMethods.filter((entry) => entry.branch_id === branchId),
        );
      }
      if (method === 'POST') {
        const body = request.postDataJSON() as Omit<PaymentMethod, 'id' | 'branch_id'>;
        const created: PaymentMethod = {
          ...body,
          id: `pay-${state.paymentMethods.length + 1}-novo`,
          branch_id: branchId,
        };
        state.paymentMethods.push(created);
        return json(route, 201, created);
      }
    }

    const paymentMethodMatch = /^\/admin\/payment-methods\/([^/]+)$/.exec(path);
    if (paymentMethodMatch?.[1]) {
      const methodId = paymentMethodMatch[1];
      const index = state.paymentMethods.findIndex((entry) => entry.id === methodId);
      if (index < 0) return json(route, 404, { detail: 'Forma de pagamento não encontrada.' });

      if (method === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown>;
        // O backend NÃO aceita trocar fluxo nem tipo: se o painel mandar, é bug
        // dele, e o falso precisa acusar em vez de aceitar em silêncio.
        if ('payment_flow' in body || 'method_type' in body) {
          return json(route, 422, {
            detail: [{ loc: ['body'], msg: 'payment_flow e method_type não podem ser alterados.' }],
          });
        }
        Object.assign(state.paymentMethods[index] as PaymentMethod, body);
        return json(route, 200, state.paymentMethods[index]);
      }
      if (method === 'DELETE') {
        state.paymentMethods.splice(index, 1);
        // 204 sem corpo, como o backend.
        return route.fulfill({ status: 204, body: '' });
      }
    }

    // --- setores de impressão ----------------------------------------------

    const sectorsMatch = /^\/admin\/branches\/([^/]+)\/printing-sectors$/.exec(path);
    if (sectorsMatch?.[1]) {
      const branchId = sectorsMatch[1];
      if (method === 'GET') {
        // Traz os desativados também: a aba de administração mostra todos, e é
        // a tela que filtra o que pode ser ESCOLHIDO num produto.
        return json(
          route,
          200,
          state.printSectors.filter((entry) => entry.branch_id === branchId),
        );
      }
      if (method === 'POST') {
        const body = request.postDataJSON() as { name: string; sort_order?: number };
        const created: PrintSector = {
          id: `sec-${state.printSectors.length + 1}-novo`,
          branch_id: branchId,
          name: body.name,
          is_active: true,
          sort_order: body.sort_order ?? 0,
        };
        state.printSectors.push(created);
        return json(route, 201, created);
      }
    }

    const sectorMatch = /^\/admin\/printing-sectors\/([^/]+)$/.exec(path);
    if (method === 'PATCH' && sectorMatch?.[1]) {
      const found = state.printSectors.find((entry) => entry.id === sectorMatch[1]);
      if (!found) return json(route, 404, { detail: 'Setor não encontrado.' });
      Object.assign(found, request.postDataJSON());
      return json(route, 200, found);
    }

    // --- minha loja: a filial ----------------------------------------------

    // Depois de prep-time, business-hours e payment-methods: todos começam com
    // o mesmo prefixo e este padrão casaria com eles primeiro.
    const branchMatch = /^\/admin\/branches\/([^/]+)$/.exec(path);
    if (branchMatch?.[1]) {
      const found = state.branches.find((entry) => entry.id === branchMatch[1]);
      if (!found) return json(route, 404, { detail: 'Filial não encontrada.' });

      if (method === 'GET') return json(route, 200, found);
      if (method === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.branchPatches.push({ branchId: found.id, body });
        Object.assign(found, body);
        return json(route, 200, found);
      }
    }

    // --- cardápio: categorias ---------------------------------------------

    if (method === 'GET' && path === '/admin/categories') {
      return json(route, 200, state.categories);
    }

    /*
     * Antes de /admin/categories/{id}: "reorder" é rota, não id. Trocar a ordem
     * destes dois blocos faria a reordenação virar uma edição de categoria
     * chamada "reorder" — que é exatamente o bug que a ordem aqui previne.
     */
    if (method === 'PATCH' && path === '/admin/categories/reorder') {
      const body = request.postDataJSON() as { category_ids: string[] };
      state.reorderCalls.push(body.category_ids);

      // Como o backend: renumera a partir da lista recebida, na ordem recebida.
      state.categories = body.category_ids.flatMap((id, index) => {
        const found = state.categories.find((category) => category.id === id);
        return found ? [{ ...found, sort_order: index }] : [];
      });
      return json(route, 200, state.categories);
    }

    if (method === 'POST' && path === '/admin/categories') {
      const body = request.postDataJSON() as { name: string; sort_order: number };
      const created: Category = {
        id: `cat-${state.categories.length + 1}-nova`,
        name: body.name,
        slug: body.name.toLowerCase().replace(/\s+/g, '-'),
        sort_order: body.sort_order,
        is_active: true,
      };
      state.categories.push(created);
      return json(route, 201, created);
    }

    /*
     * Aplicar o setor à categoria inteira. Antes de /admin/categories/{id},
     * pelo mesmo motivo do reorder: "printing-sector" é rota, não id de
     * categoria.
     */
    const categorySectorMatch = /^\/admin\/categories\/([^/]+)\/printing-sector$/.exec(path);
    if (method === 'PATCH' && categorySectorMatch?.[1]) {
      const categoryId = categorySectorMatch[1];
      const body = request.postDataJSON() as { printing_sector_id: string | null };
      state.categorySectorCalls.push({ categoryId, printSectorId: body.printing_sector_id });

      // Como o backend: sobrescreve TODOS os produtos da categoria, inclusive
      // os que já tinham outro setor.
      let updated = 0;
      state.products.forEach((item) => {
        if (item.category_id !== categoryId) return;
        item.printing_sector_id = body.printing_sector_id;
        updated += 1;
      });
      return json(route, 200, {
        category_id: categoryId,
        printing_sector_id: body.printing_sector_id,
        updated_products: updated,
      });
    }

    const categoryMatch = /^\/admin\/categories\/([^/]+)$/.exec(path);
    if (method === 'PATCH' && categoryMatch?.[1]) {
      const found = state.categories.find((category) => category.id === categoryMatch[1]);
      if (!found) return json(route, 404, { detail: 'Categoria não encontrada.' });
      Object.assign(found, request.postDataJSON());
      return json(route, 200, found);
    }

    // --- cardápio: produtos ------------------------------------------------

    if (method === 'GET' && path === '/admin/products') {
      const query = new URL(request.url()).searchParams;
      const categoryId = query.get('category_id');
      const search = (query.get('search') ?? '').toLowerCase();
      const matching = state.products.filter(
        (item) =>
          (!categoryId || item.category_id === categoryId) &&
          (!search || item.name.toLowerCase().includes(search)),
      );
      return json(route, 200, {
        items: matching,
        total: matching.length,
        limit: Number(query.get('limit') ?? 50),
        offset: Number(query.get('offset') ?? 0),
      });
    }

    // Antes de /admin/products/{id}, pelo mesmo motivo do reorder.
    const availabilityMatch = /^\/admin\/products\/([^/]+)\/availability$/.exec(path);
    if (method === 'PATCH' && availabilityMatch?.[1]) {
      const found = state.products.find((item) => item.id === availabilityMatch[1]);
      if (!found) return json(route, 404, { detail: 'Produto não encontrado.' });
      const body = request.postDataJSON() as { is_available: boolean };
      state.availabilityCalls.push({
        productId: found.id,
        isAvailable: body.is_available,
      });
      found.is_available = body.is_available;
      return json(route, 200, found);
    }

    /*
     * O setor de UM produto, também antes de /admin/products/{id}. O painel
     * chama esta rota ao editar um item: `AdminProductUpdate` não tem o campo,
     * então o PATCH do produto não muda setor nenhum.
     */
    const productSectorMatch = /^\/admin\/products\/([^/]+)\/printing-sector$/.exec(path);
    if (method === 'PATCH' && productSectorMatch?.[1]) {
      const found = state.products.find((item) => item.id === productSectorMatch[1]);
      if (!found) return json(route, 404, { detail: 'Produto não encontrado.' });

      const body = request.postDataJSON() as { printing_sector_id: string | null };
      state.productSectorCalls.push({
        productId: found.id,
        printSectorId: body.printing_sector_id,
      });
      found.printing_sector_id = body.printing_sector_id;

      const sector = state.printSectors.find((entry) => entry.id === body.printing_sector_id);
      return json(route, 200, {
        product_id: found.id,
        printing_sector_id: body.printing_sector_id,
        printing_sector_name: sector?.name ?? null,
      });
    }

    /*
     * A foto do produto, também antes de /admin/products/{id}.
     *
     * MULTIPART: nada de `postDataJSON()` aqui, que estouraria no corpo binário.
     * O que se guarda é de quem é a foto e que chegou byte — provar o conteúdo
     * do WebP é trabalho de `product-image.test.ts`, que testa a geometria pura.
     *
     * A URL devolvida é do MESMO domínio (o backend real devolve CDN): assim o
     * E2E não dispara uma requisição externa por uma imagem que não existe em
     * lugar nenhum. Ela carrega o id do produto porque é isso que o teste
     * confere — que a foto foi parar no item certo.
     */
    const imageMatch = /^\/admin\/products\/([^/]+)\/image$/.exec(path);
    if (method === 'POST' && imageMatch?.[1]) {
      const found = state.products.find((item) => item.id === imageMatch[1]);
      if (!found) return json(route, 404, { detail: 'Produto não encontrado.' });

      state.imageUploads.push({
        productId: found.id,
        bytes: request.postDataBuffer()?.length ?? 0,
      });

      // Sufixo por envio, como o backend faz: é o que distingue a foto nova da
      // anterior, que continua no bucket.
      const imagePath = `produtos/${found.id}-${state.imageUploads.length}.webp`;
      found.image_url = `/media/${imagePath}`;
      return json(route, 200, { image_path: imagePath, image_url: found.image_url });
    }

    const productMatch = /^\/admin\/products\/([^/]+)$/.exec(path);
    if (productMatch?.[1]) {
      const found = state.products.find((item) => item.id === productMatch[1]);
      if (!found) return json(route, 404, { detail: 'Produto não encontrado.' });

      if (method === 'GET') {
        return json(route, 200, { ...found, option_groups: [] });
      }
      if (method === 'PATCH') {
        Object.assign(found, request.postDataJSON());
        return json(route, 200, found);
      }
    }

    if (method === 'POST' && path === '/admin/products') {
      const body = request.postDataJSON() as Omit<Product, 'id'>;
      const created: Product = { ...body, id: `prod-${state.products.length + 1}-novo` };
      state.products.push(created);
      return json(route, 201, created);
    }

    return json(route, 404, { detail: `Rota não simulada no E2E: ${method} ${path}` });
  });

  return {
    orders: state.orders,
    /*
     * Os dois mexem no array NO LUGAR (`splice`), e não trocam a referência:
     * `api.orders` é o próprio array, e reatribuí-lo deixaria quem já o tem em
     * mão olhando para a lista velha.
     */
    clearOrders() {
      state.orders.splice(0, state.orders.length);
    },
    restoreOrders() {
      state.orders.splice(0, state.orders.length, ...initialOrders());
    },
    closeStore() {
      state.settings.is_open = false;
    },
    categories: () => state.categories,
    product: (productId) => state.products.find((item) => item.id === productId),
    reorderCalls: () => state.reorderCalls,
    availabilityCalls: () => state.availabilityCalls,
    imageUploads: () => state.imageUploads,
    cancelReasons: () => state.cancelReasons,
    settings: () => state.settings,
    settingsPatches: () => state.settingsPatches,
    branchPatches: () => state.branchPatches,
    hoursPuts: () => state.hoursPuts,
    paymentMethods: () => state.paymentMethods,
    printSectors: () => state.printSectors,
    categorySectorCalls: () => state.categorySectorCalls,
    productSectorCalls: () => state.productSectorCalls,
    products: () => state.products,
    clearPrepTimeBase(branchId) {
      state.prepTime[branchId] = null;
    },
    closeBranch(branchId) {
      state.closedBranches.add(branchId);
    },
    prepTimeOf: (branchId) => state.prepTime[branchId] ?? null,
    makeOrder: order,
    pushNewOrder(item) {
      state.orders.unshift(item);
      state.streamLog.push({
        type: 'order.created',
        event_key: `order.created:${item.id}`,
        occurred_at: new Date().toISOString(),
        order: item,
      });
    },
    setStatusFromAnotherUser(orderId, status) {
      const item = findOrder(orderId);
      if (item) item.status = status;
    },
    expireSession() {
      state.sessionExpired = true;
    },
    stop() {
      state.stopped = true;
    },
  };
}
