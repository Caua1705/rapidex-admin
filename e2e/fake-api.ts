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
    total: 50,
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
      total: 89.9,
      created_at: minutesAgo(4),
    }),
    // Dinheiro na entrega: este é o que o caminho crítico move de status.
    order({
      id: 'ord-1002',
      order_number: 1002,
      customer_name_snapshot: 'Ana Paula',
      payment_method: 'cash',
      payment_status: 'on_delivery',
      total: 62.5,
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
      total: 41,
      created_at: minutesAgo(25),
    }),
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

/** Espelho enxuto da máquina de estados do backend, só para recusar o inválido. */
const TRANSICOES: Record<string, string[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
};

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
  /** Cada PATCH /admin/products/{id}/availability que chegou. */
  availabilityCalls: () => { productId: string; isAvailable: boolean }[];
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
    streamQueue: [] as StreamEvent[],
    eventId: 0,
    categories: initialCategories(),
    products: initialProducts(),
    reorderCalls: [] as string[][],
    availabilityCalls: [] as { productId: string; isAvailable: boolean }[],
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
   */
  async function serveStream(route: Route) {
    const limite = Date.now() + 15_000;
    while (state.streamQueue.length === 0 && !state.stopped && Date.now() < limite) {
      await sleep(50);
    }

    const frames = state.streamQueue.splice(0).map((event) => {
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
      return json(route, 200, [FAKE_BRANCH]);
    }

    if (method === 'GET' && path === '/admin/orders') {
      return json(route, 200, {
        items: state.orders,
        total: state.orders.length,
        limit: 100,
        offset: 0,
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

    const detailMatch = /^\/admin\/orders\/([^/]+)$/.exec(path);
    if (method === 'GET' && detailMatch?.[1]) {
      const item = findOrder(detailMatch[1]);
      if (!item) return json(route, 404, { detail: 'Pedido não encontrado.' });
      return json(route, 200, detailOf(item, historyOf(item)));
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
    categories: () => state.categories,
    product: (productId) => state.products.find((item) => item.id === productId),
    reorderCalls: () => state.reorderCalls,
    availabilityCalls: () => state.availabilityCalls,
    makeOrder: order,
    pushNewOrder(item) {
      state.orders.unshift(item);
      state.streamQueue.push({
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
