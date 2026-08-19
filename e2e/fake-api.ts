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
type BranchOperation = Schemas['AdminBranchOperationResponse'];
type BranchOverrides = Schemas['AdminBranchOperationOverrides'];
type BusinessHour = Schemas['BusinessHourResponse'];
type BusinessHourInput = Schemas['BusinessHourInput'];
type PaymentMethod = Schemas['AdminPaymentMethodResponse'];
type CustomerListItem = Schemas['AdminCustomerListItem'];
type SalesSummary = Schemas['SalesSummaryResponse'];
type SalesByDay = Schemas['SalesByDayResponse'];
type ReportPaymentMethods = Schemas['src__schemas__admin_report_schema__PaymentMethodsResponse'];
type ProductSales = Schemas['ProductSalesResponse'];
type Cancellations = Schemas['CancellationsResponse'];
type CommissionReport = Schemas['CommissionReportResponse'];

export const LOGIN_EMAIL = 'dono@pizzaria.com';
export const LOGIN_PASSWORD = 'senha-certa';
export const ACCESS_TOKEN = 'jwt-de-mentira';

const RESTAURANT_ID = '11111111-1111-1111-1111-111111111111';
const BRANCH_ID = '22222222-2222-2222-2222-222222222222';
const BRANCH_ID_2 = '44444444-4444-4444-4444-444444444444';

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
  id: BRANCH_ID_2,
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
  /*
   * `unavailable_by_required_group` entra em UM lugar só, no fim: o contrato
   * passou a exigi-lo, nenhum item do falso está bloqueado por grupo
   * obrigatório, e repetir `false` em seis itens só afastaria o que distingue
   * um do outro.
   */
  return [
    {
      id: 'prod-1',
      category_id: 'cat-1',
      name: 'X-Burger Clássico',
      // A DESCRIÇÃO EXISTE NO FALSO PORQUE ELA EXISTE NO CARDÁPIO DE VERDADE:
      // é o texto que sai no app do cliente, e quase todo item tem o seu. Sem
      // ela aqui, a linha da lista era só um nome curto seguido de meio metro
      // de nada até o preço, e a tela era julgada por um dado que nenhum
      // restaurante tem.
      description: 'Pão brioche, hambúrguer 180 g, queijo prato e molho da casa',
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
      description: 'Pão brioche, hambúrguer 180 g, alface, tomate e maionese verde',
      price: 26.5,
      is_active: true,
      is_available: false,
      sort_order: 1,
    },
    {
      id: 'prod-3',
      category_id: 'cat-1',
      name: 'Combo Duplo',
      description: 'Dois hambúrgueres, batata frita M e refrigerante em lata',
      price: 45,
      is_active: false,
      is_available: true,
      sort_order: 2,
    },
    {
      id: 'prod-4',
      category_id: 'cat-2',
      name: 'Batata frita M',
      description: 'Porção individual, com sal e alecrim',
      price: 14.9,
      is_active: true,
      is_available: true,
      sort_order: 0,
    },
    /*
     * DOIS NOMES QUE SÓ SE DISTINGUEM PELA GRAMATURA — o caso que faz a lista
     * do cardápio virar uma coluna de repetições. Os dois dividem a base
     * "Batata rústica", então a tela tira o parêntese do nome e desenha a
     * medida como marca própria (ver `product-name.ts`).
     *
     * "Batata frita M" fica ao lado de propósito: a base dele não se repete, e
     * é ele que prova que a tela não reescreve o nome de quem não tem problema.
     */
    {
      id: 'prod-5',
      category_id: 'cat-2',
      name: 'Batata rústica (400g)',
      price: 22,
      is_active: true,
      is_available: true,
      sort_order: 1,
    },
    {
      id: 'prod-6',
      category_id: 'cat-2',
      name: 'Batata rústica (1kg)',
      price: 38,
      is_active: true,
      is_available: false,
      sort_order: 2,
    },
  ].map((item) => ({ unavailable_by_required_group: false, ...item }));
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
  };
}

/**
 * O estado do dia de UMA filial — o que `is_open` era quando havia um só.
 *
 * `withinHours` não está no contrato: é a agenda da semana, que o backend
 * combina com a chave para responder `is_open_now`. O falso guarda os dois
 * separados porque a tela precisa distinguir "fechei a loja" de "o horário de
 * hoje já fechou", e sem a segunda metade não haveria como encenar a segunda.
 */
type BranchDayState = {
  is_open: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  withinHours: boolean;
};

function initialDayState(): BranchDayState {
  return { is_open: true, accepts_delivery: true, accepts_pickup: true, withinHours: true };
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

/* ==========================================================================
 * RELATÓRIOS (Desempenho)
 *
 * Os números são fixos e escolhidos para cobrir os casos que a tela precisa
 * saber desenhar — não para parecer uma loja real:
 *
 * - `change_percent` NULO no ticket médio: é o caso de "o período anterior foi
 *   zero", e é onde a tela tem que escrever "sem comparação" em vez de 0%.
 * - `payment_method` NULO numa linha: pedido sem forma registrada, que não
 *   pode virar "Outro".
 * - um dia com faturamento ZERO no meio da série: barra de altura zero, não um
 *   mínimo decorativo.
 * - `'9.00'` e `'10.00'` na mesma série: se alguém comparar as strings em vez
 *   dos números, o pico sai no dia errado e o print mostra.
 * ======================================================================= */

const PERIODO_DIAS = 7;

/** O período que a tela está vendo agora. */
const VALORES_PERIODO = ['420.00', '9.00', '10.00', '0.00', '880.50', '1240.00', '610.00'];

/*
 * O MESMO RELATÓRIO NO PERÍODO ANTERIOR — e ele existe para uma frase só.
 *
 * A tela pede `sales-by-day` DUAS vezes (período atual e anterior) para dizer
 * quais dias explicam a variação. Com o fake devolvendo a mesma série para
 * qualquer intervalo, a diferença dia a dia seria zero e a frase de causa nunca
 * apareceria no e2e — o teste passaria sem nunca ter exercitado a segunda
 * chamada.
 *
 * O segundo dia é muito maior aqui, e é o único que muda: assim a queda do
 * período tem UM culpado, e a frase tem de nomeá-lo. O total anterior
 * (R$ 4.560,50) é maior que o atual, coerente com o `-6,8%` que o resumo
 * devolve — se os dois discordassem, a tela descartaria a causa, que é
 * justamente a proteção que este fixture não pode mascarar.
 */
const VALORES_ANTERIORES = ['420.00', '1400.00', '10.00', '0.00', '880.50', '1240.00', '610.00'];

/**
 * Os sete dias de um período, a partir da data inicial pedida.
 *
 * QUAL DAS DUAS SÉRIES SAI depende de quão longe no passado o período termina:
 * o período que a tela está vendo inclui hoje, o anterior termina dias antes.
 * É uma heurística de fixture, não uma regra do backend — o backend responde
 * pelo intervalo que recebe, e é isso que ela imita com dois valores possíveis.
 */
function reportDays(inicio: string, fim: string): Schemas['SalesByDayItem'][] {
  const hoje = Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  const fimDoPeriodo = Date.parse(`${fim}T12:00:00Z`);
  const anterior = Number.isFinite(fimDoPeriodo) && hoje - fimDoPeriodo >= 2 * 86_400_000;

  const valores = anterior ? VALORES_ANTERIORES : VALORES_PERIODO;
  const primeiroDia = Date.parse(`${inicio}T12:00:00Z`);
  const base = Number.isFinite(primeiroDia) ? primeiroDia : hoje - (PERIODO_DIAS - 1) * 86_400_000;

  const dias: Schemas['SalesByDayItem'][] = [];
  for (let i = 0; i < PERIODO_DIAS; i += 1) {
    const valor = valores[i] ?? '0.00';
    dias.push({
      day: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
      orders_count: valor === '0.00' ? 0 : Math.max(1, Math.round(Number(valor) / 60)),
      revenue_total: valor,
    });
  }
  return dias;
}

/** O mesmo período, sem venda nenhuma — para o estado vazio da tela. */
function emptyReportDays(inicio: string): Schemas['SalesByDayItem'][] {
  const primeiroDia = Date.parse(`${inicio}T12:00:00Z`);
  const base = Number.isFinite(primeiroDia) ? primeiroDia : Date.now();

  return Array.from({ length: PERIODO_DIAS }, (_, i) => ({
    day: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
    orders_count: 0,
    revenue_total: '0.00',
  }));
}

function reportPeriod(start: string, end: string): Schemas['ReportPeriod'] {
  return { start_date: start, end_date: end, days: PERIODO_DIAS };
}

function initialSalesSummary(start: string, end: string): SalesSummary {
  return {
    restaurant_id: RESTAURANT_ID,
    period: reportPeriod(start, end),
    previous_period: reportPeriod(start, end),
    orders_count: 54,
    revenue_total: '3169.50',
    average_ticket: '58.69',
    breakdown: {
      subtotal_total: '2980.00',
      delivery_fee_total: '240.00',
      service_fee_total: '108.00',
      discount_total: '158.50',
      commission_total: '316.95',
    },
    order_types: [
      {
        order_type: 'delivery',
        orders_count: 41,
        revenue_total: '2510.00',
        revenue_share_percent: '79.2',
      },
      {
        order_type: 'pickup',
        orders_count: 13,
        revenue_total: '659.50',
        revenue_share_percent: '20.8',
      },
    ],
    excluded_orders_count: 3,
    orders_count_comparison: { current: '54', previous: '48', change: '6', change_percent: '12.5' },
    revenue_comparison: {
      current: '3169.50',
      previous: '3402.00',
      change: '-232.50',
      change_percent: '-6.8',
    },
    /*
     * O NULO. Sem período anterior com movimento não existe variação percentual
     * — e é aqui que um `?? 0` escreveria "0%" e diria que o ticket ficou igual.
     */
    average_ticket_comparison: {
      current: '58.69',
      previous: '0.00',
      change: '58.69',
      change_percent: null,
    },
  };
}

/**
 * A resposta de cada relatório num período sem venda.
 *
 * `excluded_orders_count` NÃO é zero de propósito: zero faturado com dois
 * pedidos excluídos é exatamente o caso em que o lojista precisa saber que os
 * dois existem — e é a linha que a tela mantém mesmo no estado vazio.
 */
function emptyReport(path: string, start: string, end: string): unknown {
  const semComparacao = { current: '0.00', previous: '0.00', change: '0.00', change_percent: null };

  if (path === '/admin/reports/summary') {
    return {
      restaurant_id: RESTAURANT_ID,
      period: reportPeriod(start, end),
      previous_period: reportPeriod(start, end),
      orders_count: 0,
      revenue_total: '0.00',
      average_ticket: '0.00',
      breakdown: {
        subtotal_total: '0.00',
        delivery_fee_total: '0.00',
        service_fee_total: '0.00',
        discount_total: '0.00',
        commission_total: '0.00',
      },
      order_types: [],
      excluded_orders_count: 2,
      orders_count_comparison: semComparacao,
      revenue_comparison: semComparacao,
      average_ticket_comparison: semComparacao,
    } satisfies SalesSummary;
  }

  if (path === '/admin/reports/sales-by-day') {
    return {
      restaurant_id: RESTAURANT_ID,
      period: reportPeriod(start, end),
      orders_count: 0,
      revenue_total: '0.00',
      days: emptyReportDays(start),
    } satisfies SalesByDay;
  }

  if (path === '/admin/reports/payment-methods') {
    return {
      restaurant_id: RESTAURANT_ID,
      period: reportPeriod(start, end),
      orders_count: 0,
      revenue_total: '0.00',
      payment_methods: [],
    } satisfies ReportPaymentMethods;
  }

  if (path === '/admin/reports/products') {
    return {
      restaurant_id: RESTAURANT_ID,
      period: reportPeriod(start, end),
      products: [],
      listed_revenue_total: '0.00',
      revenue_note:
        'Receita bruta dos itens, sem cupom, cashback nem taxas — não fecha com o faturamento do resumo.',
    } satisfies ProductSales;
  }

  if (path === '/admin/reports/cancellations') {
    return {
      restaurant_id: RESTAURANT_ID,
      period: reportPeriod(start, end),
      orders_count: 2,
      amount_total: '96.00',
      billable_orders_count: 0,
      cancellation_rate_percent: '100.0',
      breakdown: [
        { status: 'cancelled', payment_status: 'refunded', orders_count: 2, amount_total: '96.00' },
      ],
    } satisfies Cancellations;
  }

  return {
    restaurant_id: RESTAURANT_ID,
    start_date: start,
    end_date: end,
    orders_count: 0,
    excluded_orders_count: 2,
    commission_base_total: '0.00',
    commission_total: '0.00',
    orders: [],
  } satisfies CommissionReport;
}

function initialPaymentsReport(start: string, end: string): ReportPaymentMethods {
  return {
    restaurant_id: RESTAURANT_ID,
    period: reportPeriod(start, end),
    orders_count: 54,
    revenue_total: '3169.50',
    payment_methods: [
      {
        payment_method: 'pix',
        orders_count: 30,
        revenue_total: '1820.00',
        revenue_share_percent: '57.4',
      },
      {
        payment_method: 'cash',
        orders_count: 18,
        revenue_total: '1049.50',
        revenue_share_percent: '33.1',
      },
      /* Sem forma registrada. NÃO é "Outro" — ver `paymentMethodLabel`. */
      {
        payment_method: null,
        orders_count: 6,
        revenue_total: '300.00',
        revenue_share_percent: '9.5',
      },
    ],
  };
}

function initialProductSales(start: string, end: string): ProductSales {
  return {
    restaurant_id: RESTAURANT_ID,
    period: reportPeriod(start, end),
    products: [
      {
        product_id: 'prod-1',
        product_name: 'Pizza Calabresa G',
        orders_count: 22,
        quantity_total: 26,
        revenue_total: '1170.00',
      },
      {
        product_id: 'prod-2',
        product_name: 'X-Burger Clássico',
        orders_count: 19,
        quantity_total: 24,
        revenue_total: '597.60',
      },
      /* Produto apagado depois da venda: `product_id` nulo é caso do contrato. */
      {
        product_id: null,
        product_name: 'Combo de inverno (fora do cardápio)',
        orders_count: 4,
        quantity_total: 4,
        revenue_total: '180.00',
      },
    ],
    listed_revenue_total: '1947.60',
    revenue_note:
      'Receita bruta dos itens, sem cupom, cashback nem taxas — não fecha com o faturamento do resumo.',
  };
}

function initialCancellations(start: string, end: string): Cancellations {
  return {
    restaurant_id: RESTAURANT_ID,
    period: reportPeriod(start, end),
    orders_count: 3,
    amount_total: '186.00',
    billable_orders_count: 54,
    cancellation_rate_percent: '5.3',
    breakdown: [
      { status: 'cancelled', payment_status: 'refunded', orders_count: 2, amount_total: '141.00' },
      { status: 'rejected', payment_status: 'pending', orders_count: 1, amount_total: '45.00' },
    ],
  };
}

function initialCommission(start: string, end: string): CommissionReport {
  return {
    restaurant_id: RESTAURANT_ID,
    start_date: start,
    end_date: end,
    orders_count: 54,
    excluded_orders_count: 3,
    commission_base_total: '3169.50',
    commission_total: '316.95',
    orders: [],
  };
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
  /** Zera os relatórios: o período passa a não ter venda nenhuma. */
  emptyReports: () => void;
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
  /** Fecha TODAS as filiais no "banco" — o quadro de pedidos mistura as duas. */
  closeStore: () => void;
  /**
   * Deixa a chave ligada e a agenda de hoje fechada.
   *
   * É o estado que `is_open` sozinho não sabia descrever: a loja marcada como
   * aberta sem receber pedido, que é o chamado mais comum do suporte.
   */
  putOutsideHours: (branchId: string) => void;
  /** O estado do dia da filial: a chave, os tipos de pedido e a agenda. */
  operation: (branchId: string) => BranchDayState | undefined;
  /** Corpo de cada PATCH /admin/branches/{id}/order-types que chegou. */
  orderTypeCalls: () => { branchId: string; body: Record<string, unknown> }[];
  /** Corpo de cada PATCH /admin/branches/{id}/settings que chegou. */
  branchSettingsCalls: () => { branchId: string; body: Record<string, unknown> }[];
  /** As sobrescritas que a filial tem agora. Chave ausente = herdando. */
  overridesOf: (branchId: string) => Record<string, unknown>;
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
    /** Ligado por `emptyReports()`: os relatórios passam a responder zerados. */
    reportsEmpty: false,
    // Minha loja. As filiais são cópias, e não as constantes exportadas: os
    // PATCH da tela gravam nelas, e mutar a constante vazaria de um teste para
    // o outro.
    branches: [{ ...FAKE_BRANCH }, { ...FAKE_BRANCH_2 }] as Branch[],
    /*
     * ABRIR/FECHAR É DE CADA FILIAL. Enquanto era do restaurante, isto era um
     * campo dentro de `settings` — e fechar a Aldeota fechava o Centro junto.
     * As sobrescritas comerciais nascem TODAS nulas, como na migração: filial
     * nova herda o padrão do restaurante.
     */
    dayState: {
      [BRANCH_ID]: initialDayState(),
      [BRANCH_ID_2]: initialDayState(),
    } as Record<string, BranchDayState>,
    /*
     * TODAS AS FILIAIS NASCEM HERDANDO, como a migração as deixou. Copiar o
     * padrão do restaurante para cada uma deixaria uma cópia congelada, e a
     * próxima edição do padrão não chegaria a nenhuma.
     */
    overrides: {
      [BRANCH_ID]: {},
      [BRANCH_ID_2]: {},
    } as Record<string, Partial<Record<keyof BranchOverrides, number | boolean | null>>>,
    /** Corpo de cada PATCH de valores, para conferir o null explícito. */
    branchSettingsCalls: [] as { branchId: string; body: Record<string, unknown> }[],
    settings: initialSettings(),
    settingsPatches: [] as Record<string, unknown>[],
    branchPatches: [] as { branchId: string; body: Record<string, unknown> }[],
    /** Cada PATCH de tipos de pedido, para conferir que só vai o campo mexido. */
    orderTypeCalls: [] as { branchId: string; body: Record<string, unknown> }[],
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

  /**
   * Uma linha de `GET /admin/branches/operation`.
   *
   * `effective` é montado aqui, e não guardado: com a sobrescrita nula, o valor
   * que vale é o do restaurante — copiá-lo para o estado deixaria o falso
   * respondendo o número velho depois de um PATCH nos padrões.
   */
  function operationOf(branch: Branch): BranchOperation {
    const dia = state.dayState[branch.id] ?? initialDayState();
    const padrao = state.settings;
    const gravado = state.overrides[branch.id] ?? {};
    const overrides: BranchOverrides = {
      min_order_value: (gravado.min_order_value as number | null) ?? null,
      estimated_delivery_time_min: (gravado.estimated_delivery_time_min as number | null) ?? null,
      estimated_delivery_time_max: (gravado.estimated_delivery_time_max as number | null) ?? null,
      default_delivery_fee: (gravado.default_delivery_fee as number | null) ?? null,
      service_fee_enabled: (gravado.service_fee_enabled as boolean | null) ?? null,
      service_fee_amount: (gravado.service_fee_amount as number | null) ?? null,
    };

    return {
      branch_id: branch.id,
      branch_name: branch.display_name?.trim() || branch.name,
      is_open: dia.is_open,
      is_open_now: dia.is_open && dia.withinHours,
      accepts_delivery: dia.accepts_delivery,
      accepts_pickup: dia.accepts_pickup,
      overrides,
      /*
       * `effective` é o que o próximo pedido vai usar: a sobrescrita quando ela
       * existe, o padrão do restaurante quando ela é nula. A distinção é entre
       * NULO e valor, nunca entre verdadeiro e falso — um `??` no lugar de um
       * `or`, porque `service_fee_enabled: false` na filial é uma escolha e não
       * pode cair no `true` do restaurante.
       */
      effective: {
        min_order_value: overrides.min_order_value ?? padrao.min_order_value,
        estimated_delivery_time_min:
          overrides.estimated_delivery_time_min ?? padrao.estimated_delivery_time_min ?? null,
        estimated_delivery_time_max:
          overrides.estimated_delivery_time_max ?? padrao.estimated_delivery_time_max ?? null,
        default_delivery_fee: overrides.default_delivery_fee ?? padrao.default_delivery_fee,
        service_fee_enabled: overrides.service_fee_enabled ?? padrao.service_fee_enabled !== false,
        service_fee_amount: overrides.service_fee_amount ?? padrao.service_fee_amount,
      },
    };
  }

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

    /*
     * Antes de qualquer `/admin/branches/{id}`: "operation" é um caminho fixo e
     * seria lido como id de filial pelo casamento de rota abaixo — o mesmo
     * cuidado que o reorder já pedia no cardápio.
     */
    if (method === 'GET' && path === '/admin/branches/operation') {
      const pedida = new URL(request.url()).searchParams.get('branch_id');
      const linhas = state.branches
        .filter((branch) => !pedida || branch.id === pedida)
        .map(operationOf);
      // O `branch_id` só restringe, e pedir uma filial que não existe é 404 —
      // não lista vazia, que a tela leria como "sem filial nenhuma".
      if (pedida && linhas.length === 0) {
        return json(route, 404, { detail: 'Filial não encontrada.' });
      }
      return json(route, 200, linhas);
    }

    const branchSettingsMatch = /^\/admin\/branches\/([^/]+)\/settings$/.exec(path);
    if (method === 'PATCH' && branchSettingsMatch?.[1]) {
      const branchId = branchSettingsMatch[1];
      const branch = state.branches.find((item) => item.id === branchId);
      if (!branch) return json(route, 404, { detail: 'Filial não encontrada.' });

      const body = request.postDataJSON() as Record<string, unknown>;
      state.branchSettingsCalls.push({ branchId, body });

      /*
       * TRÊS ESTADOS POR CAMPO, e o falso precisa dos três para o teste
       * significar alguma coisa: chave ausente não mexe, valor sobrescreve, e
       * `null` explícito APAGA a sobrescrita — que é como a filial volta a
       * herdar. Um `Object.assign` trataria os dois primeiros igual.
       */
      const gravado = state.overrides[branchId] ?? {};
      for (const [campo, valor] of Object.entries(body)) {
        if (valor === null) delete gravado[campo as keyof BranchOverrides];
        else gravado[campo as keyof BranchOverrides] = valor as number | boolean;
      }
      state.overrides[branchId] = gravado;

      return json(route, 200, operationOf(branch));
    }

    const orderTypesMatch = /^\/admin\/branches\/([^/]+)\/order-types$/.exec(path);
    if (method === 'PATCH' && orderTypesMatch?.[1]) {
      const branchId = orderTypesMatch[1];
      const branch = state.branches.find((item) => item.id === branchId);
      if (!branch) return json(route, 404, { detail: 'Filial não encontrada.' });

      const body = request.postDataJSON() as {
        accepts_delivery?: boolean | null;
        accepts_pickup?: boolean | null;
      };
      state.orderTypeCalls.push({ branchId, body });

      /*
       * CORPO VAZIO É 422 NO BACKEND, e o falso responde igual: "não mudar
       * nada" não é uma edição. É o que prova que a tela manda só o campo que o
       * lojista mexeu — e não os dois com o outro repetido.
       */
      const delivery = body.accepts_delivery;
      const pickup = body.accepts_pickup;
      if (delivery === undefined && pickup === undefined) {
        return json(route, 422, { detail: 'Informe pelo menos um tipo de pedido.' });
      }

      const atual = state.dayState[branchId] ?? initialDayState();
      state.dayState[branchId] = {
        ...atual,
        // Edição parcial: o campo ausente não se mexe. Desligar os dois é
        // permitido — equivale a fechar a loja.
        accepts_delivery: delivery ?? atual.accepts_delivery,
        accepts_pickup: pickup ?? atual.accepts_pickup,
      };
      return json(route, 200, operationOf(branch));
    }

    const storeStatusMatch = /^\/admin\/branches\/([^/]+)\/store-status$/.exec(path);
    if (method === 'PATCH' && storeStatusMatch?.[1]) {
      const branchId = storeStatusMatch[1];
      const branch = state.branches.find((item) => item.id === branchId);
      if (!branch) return json(route, 404, { detail: 'Filial não encontrada.' });

      const body = request.postDataJSON() as { is_open: boolean };
      state.dayState[branchId] = {
        ...(state.dayState[branchId] ?? initialDayState()),
        is_open: body.is_open,
      };
      // A resposta é a LINHA DE OPERAÇÃO inteira, como no contrato: devolver só
      // o booleano deixaria o falso mais frouxo que o backend, e a tela leria
      // `is_open_now` como indefinido.
      return json(route, 200, operationOf(branch));
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

    // --- relatórios (Desempenho) -------------------------------------------

    /*
     * As seis rotas recebem `start_date` e `end_date` e MAIS NADA — nenhuma
     * aceita `branch_id`. O falso não filtra por filial de propósito: filtrar
     * aqui esconderia justamente o que a tela precisa avisar ao lojista.
     */
    if (method === 'GET' && path.startsWith('/admin/reports/')) {
      const query = new URL(request.url()).searchParams;
      const inicio = query.get('start_date') ?? '';
      const fim = query.get('end_date') ?? '';

      if (!inicio || !fim) {
        return json(route, 422, {
          detail: [{ loc: ['query', 'start_date'], msg: 'campo obrigatório', type: 'missing' }],
        });
      }

      /*
       * PERÍODO SEM VENDA NENHUMA. É um caso de verdade — loja que abriu esta
       * semana, período escolhido antes da primeira venda — e a tela tem uma
       * resposta própria para ele (uma frase, não seis seções zeradas). Sem
       * este interruptor não haveria como exercitá-la no e2e.
       */
      if (state.reportsEmpty) {
        return json(route, 200, emptyReport(path, inicio, fim));
      }

      if (path === '/admin/reports/summary') {
        return json(route, 200, initialSalesSummary(inicio, fim));
      }

      if (path === '/admin/reports/sales-by-day') {
        const dias = reportDays(inicio, fim);
        return json(route, 200, {
          restaurant_id: RESTAURANT_ID,
          period: reportPeriod(inicio, fim),
          orders_count: dias.reduce((soma, dia) => soma + dia.orders_count, 0),
          revenue_total: String(
            dias.reduce((soma, dia) => soma + Number(dia.revenue_total), 0).toFixed(2),
          ),
          days: dias,
        } satisfies SalesByDay);
      }

      if (path === '/admin/reports/payment-methods') {
        return json(route, 200, initialPaymentsReport(inicio, fim));
      }

      if (path === '/admin/reports/products') {
        return json(route, 200, initialProductSales(inicio, fim));
      }

      if (path === '/admin/reports/cancellations') {
        return json(route, 200, initialCancellations(inicio, fim));
      }

      if (path === '/admin/reports/commission') {
        return json(route, 200, initialCommission(inicio, fim));
      }
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
    /** Fecha TODAS as filiais: o quadro de pedidos mistura as duas lojas. */
    closeStore() {
      for (const branch of state.branches) {
        state.dayState[branch.id] = {
          ...(state.dayState[branch.id] ?? initialDayState()),
          is_open: false,
        };
      }
    },
    /** A chave fica ligada e a agenda de hoje fecha: `is_open_now` cai sozinho. */
    putOutsideHours(branchId: string) {
      state.dayState[branchId] = {
        ...(state.dayState[branchId] ?? initialDayState()),
        withinHours: false,
      };
    },
    operation: (branchId: string) => state.dayState[branchId],
    orderTypeCalls: () => state.orderTypeCalls,
    branchSettingsCalls: () => state.branchSettingsCalls,
    overridesOf: (branchId: string) => state.overrides[branchId] ?? {},
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
    emptyReports() {
      state.reportsEmpty = true;
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
