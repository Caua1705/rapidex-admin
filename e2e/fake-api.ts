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
/*
 * DOIS SCHEMAS DE USUÁRIO, e eles não são o mesmo: `AdminUserResponse` é QUEM
 * ENTROU (login e `/me`); `AdminUserDetailResponse` é a ficha de OUTRA pessoa,
 * na tela do dono — e traz `created_at` e `password_changed_at` a mais.
 */
type AdminUserDetail = Schemas['AdminUserDetailResponse'];
type Branch = Schemas['AdminBranchResponse'];
type OrderListItem = Schemas['AdminOrderListItem'];
type OrderDetail = Schemas['OrderDetailResponse'];
type StreamEvent = Schemas['AdminOrderStreamEvent'];
type Category = Schemas['AdminCategoryResponse'];
type Product = Schemas['AdminProductResponse'];
type PrintSector = Schemas['PrintingSectorResponse'];
type PrintAgentPrinter = Schemas['PrintAgentPrinterResponse'];
type PrintTestRequest = Schemas['PrintTestRequest'];
type RestaurantSettings = Schemas['AdminRestaurantSettingsResponse'];
type RestaurantProfile = Schemas['AdminRestaurantProfileResponse'];
type BranchOperation = Schemas['AdminBranchOperationResponse'];
type BranchOverrides = Schemas['AdminBranchOperationOverrides'];
type BusinessHour = Schemas['BusinessHourResponse'];
type BusinessHourInput = Schemas['BusinessHourInput'];
type PaymentMethod = Schemas['AdminPaymentMethodResponse'];
type CashbackRule = Schemas['AdminCashbackRuleResponse'];
type Coupon = Schemas['CouponAdminResponse'];
type CouponTemplate = Schemas['CouponTemplateResponse'];
type CashbackWeekday = Schemas['CashbackWeekdayResponse'];
type CustomerListItem = Schemas['AdminCustomerListItem'];
type ReviewItem = Schemas['AdminOrderReviewItem'];
type SalesSummary = Schemas['SalesSummaryResponse'];
type MetricComparison = Schemas['MetricComparison'];
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
  /*
   * O SINAL QUE O PAINEL OBEDECE. Com ele verdadeiro, o backend só deixa passar
   * `GET /admin/auth/me` e `PATCH /admin/auth/password` — e o painel nem tenta o
   * resto: `RequireAuth` manda para a troca de senha antes de qualquer chamada.
   *
   * O falso encena os dois lados (ver `entrarComSenhaTemporaria` e o 403 na
   * porta do roteador), porque o teste que importa é justamente o de que a tela
   * obedece o CAMPO e não o 403.
   */
  must_change_password: false,
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
    /*
     * O TELEFONE DE CADA PEDIDO É O DA PESSOA QUE ELE NOMEIA, e isso passou a
     * importar: o detalhe do pedido mostra o histórico do cliente, procurado
     * por telefone em `/admin/customers`. Com os três pedidos herdando o mesmo
     * telefone padrão, o teste não teria como provar que o painel mostra o
     * histórico da pessoa CERTA — e mostrar o histórico da pessoa errada ao
     * lado do endereço de entrega é o defeito que mais importa aqui.
     *
     * Os três cobrem casos diferentes de propósito: Ana Paula é a freguesa
     * antiga (12 pedidos), Marcos Lima é o cliente de alguns meses (5) e Rafael
     * Nunes está no PRIMEIRO pedido, que é a frase curta.
     */
    // Pix ainda não pago: é o card que precisa aparecer destacado.
    order({
      id: 'ord-1001',
      order_number: 1001,
      customer_name_snapshot: 'Marcos Lima',
      customer_phone_snapshot: '85988887777',
      payment_method: 'pix',
      payment_status: 'pending',
      created_at: minutesAgo(4),
    }),
    // Dinheiro na entrega: este é o que o caminho crítico move de status.
    order({
      id: 'ord-1002',
      order_number: 1002,
      customer_name_snapshot: 'Ana Paula',
      customer_phone_snapshot: '85999990000',
      payment_method: 'cash',
      payment_status: 'on_delivery',
      created_at: minutesAgo(9),
    }),
    // Já na cozinha, para a tela não abrir com uma coluna só.
    order({
      id: 'ord-1003',
      order_number: 1003,
      customer_name_snapshot: 'Rafael Nunes',
      customer_phone_snapshot: '8532224444',
      order_type: 'pickup',
      status: 'preparing',
      payment_method: 'credit_card',
      payment_status: 'paid',
      created_at: minutesAgo(25),
    }),

    ...cancelamentosDeTresDiasAtras(),
  ];
}

/**
 * ============================================================================
 * OS SEIS PEDIDOS QUE NÃO VIRARAM VENDA — a fixture da HORA
 * ============================================================================
 *
 * Eles existem porque o Desempenho passou a ler a hora dos cancelamentos, e o
 * dado dessa leitura NÃO vem do relatório de cancelamentos: vem de
 * `GET /admin/orders`, pelo `created_at` de cada item. Sem pedidos cancelados
 * de verdade na fixture, o E2E exercitaria a seção com zero linhas.
 *
 * TRÊS DECISÕES ESTÃO CRAVADAS AQUI:
 *
 * 1. **HÁ TRÊS DIAS, E NÃO HOJE.** Pedidos abre em "hoje" e a Cozinha carrega
 *    por status: se estes seis fossem de hoje, os contadores da faixa de
 *    Pedidos e a lista inteira mudariam por causa de uma fixture de outra tela.
 *    Três dias atrás cai dentro dos 7 dias do Desempenho e fora do dia de
 *    Pedidos — e é o filtro de data do falso que faz a separação valer.
 *
 * 2. **SEIS, E NÃO TRÊS.** `HORA_LIMIARES.amostraMinima` é 5: abaixo disso a
 *    tela se recusa a desenhar o gráfico, porque três cancelamentos não têm
 *    "hora de concentração" — têm três horas. Com seis, a seção existe e pode
 *    ser testada.
 *
 * 3. **METADE NAS 20h.** Três dos seis entram às 20h locais, que é 50% e passa
 *    de `picoPct` (40%): é o caso "concentrado numa hora", que é a leitura que
 *    a seção existe para dar. Os outros três ficam espalhados, para que o
 *    gráfico tenha forma em vez de uma barra só.
 *
 * As contagens batem com `initialCancellations` de propósito — quatro
 * `cancelled` e dois `rejected`, seis no total. O relatório e a listagem
 * discordando seria um defeito plantado no falso, e ele passaria despercebido
 * justamente porque a tela mostra os dois números em blocos diferentes.
 */
function cancelamentosDeTresDiasAtras(): OrderListItem[] {
  /* A hora é a LOCAL da operação (UTC−3): 20h em Fortaleza são 23h em UTC. */
  const horasLocais: readonly { hora: number; status: string; pagamento: string }[] = [
    { hora: 13, status: 'cancelled', pagamento: 'refunded' },
    { hora: 19, status: 'rejected', pagamento: 'pending' },
    { hora: 20, status: 'cancelled', pagamento: 'refunded' },
    { hora: 20, status: 'cancelled', pagamento: 'refunded' },
    { hora: 20, status: 'rejected', pagamento: 'pending' },
    { hora: 21, status: 'cancelled', pagamento: 'pending' },
  ];

  const diaLocal = OPERATION_DAY.format(new Date(Date.now() - 3 * 24 * 60 * 60_000));

  /*
   * A CONVERSÃO PASSA PELO INSTANTE, e não por "somar 3 na hora do texto".
   *
   * 21h locais são 00h UTC do DIA SEGUINTE — colar `T00:…Z` no mesmo dia local
   * jogaria o pedido 24 horas para trás, para dentro do período ainda, e a
   * fixture mentiria em silêncio: o gráfico mostraria o balde certo pelo motivo
   * errado, e o primeiro pedido depois das 21h a ser acrescentado aqui cairia
   * no dia anterior sem nada acusar.
   */
  const emUtc = (horaLocal: number, minuto: number) =>
    new Date(
      Date.parse(
        `${diaLocal}T${String(horaLocal).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00Z`,
      ) +
        3 * 60 * 60_000,
    ).toISOString();

  return horasLocais.map((item, index) =>
    order({
      id: `ord-cancel-${index}`,
      order_number: 900 + index,
      customer_name_snapshot: 'Cliente do histórico',
      status: item.status,
      payment_method: 'pix',
      payment_status: item.pagamento,
      created_at: emUtc(item.hora, 10 + index * 3),
    }),
  );
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
    {
      id: 'cat-1',
      branch_id: BRANCH_ID,
      name: 'Lanches',
      slug: 'lanches',
      sort_order: 0,
      is_active: true,
    },
    {
      id: 'cat-2',
      branch_id: BRANCH_ID,
      name: 'Acompanhamentos',
      slug: 'acompanhamentos',
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'cat-3',
      branch_id: BRANCH_ID,
      name: 'Sobremesas',
      slug: 'sobremesas',
      sort_order: 2,
      is_active: false,
    },
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
      branch_id: BRANCH_ID,
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
      branch_id: BRANCH_ID,
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
      branch_id: BRANCH_ID,
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
      branch_id: BRANCH_ID,
      category_id: 'cat-2',
      name: 'Batata frita M',
      description: 'Porção individual, com sal e alecrim',
      price: 14.9,
      is_active: true,
      is_available: true,
      sort_order: 0,
    },
    /*
     * O ITEM QUE SAIU DE VENDA SOZINHO — e ele existe no falso porque é o caso
     * que a tela não podia mostrar.
     *
     * Os dois interruptores que o lojista controla estão LIGADOS: ativo e
     * disponível. E mesmo assim o cliente abre e não consegue fechar, porque a
     * última opção de um grupo obrigatório foi desativada — coisa que se faz
     * uma opção por vez, sem nunca ver o item sair do cardápio. O backend
     * calcula isso e devolve em `unavailable_by_required_group`; antes, a tela
     * deduzia a regra de novo e a listagem, que não carrega os grupos, mostrava
     * a linha como qualquer outra.
     */
    {
      id: 'prod-7',
      branch_id: BRANCH_ID,
      category_id: 'cat-2',
      name: 'Onion rings',
      description: 'Oito unidades, com molho barbecue',
      price: 19.9,
      is_active: true,
      is_available: true,
      sort_order: 3,
      unavailable_by_required_group: true,
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
      branch_id: BRANCH_ID,
      category_id: 'cat-2',
      name: 'Batata rústica (400g)',
      price: 22,
      is_active: true,
      is_available: true,
      sort_order: 1,
    },
    {
      id: 'prod-6',
      branch_id: BRANCH_ID,
      category_id: 'cat-2',
      name: 'Batata rústica (1kg)',
      price: 38,
      is_active: true,
      is_available: false,
      sort_order: 2,
    },
    /*
     * `catalog_key` = o id do próprio produto, que é EXATAMENTE o que a
     * migração fez: ela carimbou o id de origem no original e na cópia, e são
     * os dois com a mesma chave que fazem o relatório somar "picanha" nas
     * duas lojas em uma linha só. Produto criado depois nasce sem chave — ver
     * `copiaDoCardapio`.
     */
  ].map((item) => ({
    unavailable_by_required_group: false,
    catalog_key: item.id,
    ...item,
  }));
}

/**
 * O cardápio da SEGUNDA filial — e ele é uma CÓPIA, como no banco.
 *
 * A migração do backend deixou as linhas que já existiam na filial principal
 * (mesmos ids, mesmos slugs, para não quebrar link publicado) e deu à outra
 * loja um jogo novo de linhas, com ids próprios e a mesma `catalog_key`. Sem
 * este segundo cardápio aqui, o falso não teria como reproduzir o defeito que
 * esta rodada conserta: a tela sem recorte de filial mostrava "Lanches" duas
 * vezes na barra e cada item duas vezes na lista, e um falso de uma loja só
 * faria esse teste passar sozinho.
 *
 * O SETOR DE IMPRESSÃO DA CÓPIA É NULO de propósito. O remapeamento da
 * migração é por NOME dentro da filial de destino, e a segunda filial do falso
 * não tem setor nenhum cadastrado — então "ficou sem setor" é o estado real, e
 * é justamente o que a conferência do pós-deploy manda procurar.
 */
const SUFIXO_FILIAL_2 = '-zn';

function copiaDoCardapio(): { categories: Category[]; products: Product[] } {
  const categories = initialCategories().map((categoria) => ({
    ...categoria,
    id: `${categoria.id}${SUFIXO_FILIAL_2}`,
    branch_id: BRANCH_ID_2,
  }));

  const products: Product[] = initialProducts().map((produto) => ({
    ...produto,
    id: `${produto.id}${SUFIXO_FILIAL_2}`,
    branch_id: BRANCH_ID_2,
    category_id: `${produto.category_id}${SUFIXO_FILIAL_2}`,
    printing_sector_id: null,
  }));

  /*
   * UM ITEM QUE SÓ EXISTE NESTA LOJA, E SEM CHAVE DE CATÁLOGO.
   *
   * Ele é o estado de tudo o que o lojista cadastrar DEPOIS do deploy: a
   * migração pareou o que já existia, e nada mais nasce pareado. É o caso que
   * o campo "mesmo item em outra loja" existe para resolver — e o único em que
   * parear exige carimbar a chave nos DOIS lados, porque não há nenhuma para
   * reaproveitar. Sem ele aqui, o E2E só percorreria o caminho fácil.
   */
  products.push({
    id: 'prod-zn-milkshake',
    branch_id: BRANCH_ID_2,
    category_id: `cat-2${SUFIXO_FILIAL_2}`,
    name: 'Milkshake de morango',
    description: 'Copo de 400 ml, com calda',
    price: 18,
    is_active: true,
    is_available: true,
    sort_order: 3,
    printing_sector_id: null,
    catalog_key: null,
    unavailable_by_required_group: false,
  });

  return { categories, products };
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
    // A mensagem da MARCA. É dela que a filial herda enquanto não escreve a
    // própria — e é ela que some da bobina quando a loja manda `''`.
    receipt_footer_message: 'Obrigado pela preferência! @pizzariadoze',
  };
}

/**
 * O PERFIL DO RESTAURANTE — a marca, e não os padrões que a filial herda.
 *
 * Os dois textos nascem DENTRO dos tetos (1000 e 300). O caso do texto legado
 * acima do teto — que a Response deixa passar porque só o corpo do PATCH os
 * declara — é plantado pelo teste que precisa dele, com `setProfileTexts`.
 */
function initialProfile(): RestaurantProfile {
  return {
    id: RESTAURANT_ID,
    /*
     * "Pizzaria do Zé", e não "Pizzaria Doze".
     *
     * O nome tinha virado "Doze" ao ser digitado, e a identificação do shell
     * passou a mostrar isso — com as INICIAIS "PD" no ladrilho. As duas filiais
     * do mesmo falso sempre disseram "Pizzaria do Zé — Aldeota" e "— Zona
     * Norte", então o falso afirmava dois nomes para o mesmo restaurante e o
     * `identificacao.spec.ts` cobrava o certo contra o errado.
     *
     * O `slug` FICA como está de propósito: ele é a URL pública do cardápio,
     * não é gravável por PATCH nenhum, e um slug que não deriva do nome é
     * justamente o caso realista — o lojista renomeia a casa e o endereço
     * salvo pelo cliente continua valendo.
     */
    name: 'Pizzaria do Zé',
    slug: 'pizzaria-doze',
    description: 'Pizza de forno a lenha desde 2011, no Centro.',
    assistant_notes: 'Pizzaria. Forno a lenha, massa fina e rodízio às quintas.',
  };
}

/**
 * O campo do corpo que passou do teto, ou `null`.
 *
 * Os tetos vivem em `AdminRestaurantProfileUpdate` e SÓ nele: a Response não os
 * declara, e é por isso que `setProfileTexts` consegue plantar um texto legado
 * maior que o teto sem o falso se contradizer.
 */
function campoAcimaDoTeto(body: Record<string, unknown>): string | null {
  if (typeof body.description === 'string' && body.description.length > 1000) {
    return 'description';
  }
  if (typeof body.assistant_notes === 'string' && body.assistant_notes.length > 300) {
    return 'assistant_notes';
  }
  return null;
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
  /*
   * A PAUSA DA ENTREGA — um instante, e não um booleano, porque é assim que ela
   * se desfaz sozinha. O falso guarda o carimbo e compara com o relógio na hora
   * de responder, como o backend.
   */
  deliveryPausedUntil: string | null;
  deliveryPauseReason: string | null;
};

function initialDayState(): BranchDayState {
  return {
    is_open: true,
    accepts_delivery: true,
    accepts_pickup: true,
    withinHours: true,
    deliveryPausedUntil: null,
    deliveryPauseReason: null,
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
      earns_cashback: true,
      sort_order: 0,
    },
    {
      id: 'pay-dinheiro',
      branch_id: branchId,
      payment_flow: 'delivery',
      method_type: 'cash',
      label: 'Dinheiro',
      enabled: true,
      /* A do dinheiro nasce SEM cashback: é a linha que prova que o gerente LÊ
         o estado sem poder mudá-lo, e que o dono vê a caixa desmarcada. */
      earns_cashback: false,
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
/**
 * Os dois setores da filial principal.
 *
 * `printer_name` cobre os DOIS estados, e eles são coisas diferentes: a Chapa
 * tem uma impressora escolhida no painel, e o Bar não tem — nulo ali significa
 * "deixar o programa decidir", ou seja, cair no `config.ini` da máquina. Um
 * fixture com os dois nulos deixaria o seletor da linha sem nada para mostrar.
 */
function initialPrintSectors(branchId: string): PrintSector[] {
  return [
    {
      id: 'sec-chapa',
      branch_id: branchId,
      name: 'Chapa',
      is_active: true,
      sort_order: 0,
      printer_name: 'EPSON TM-T20',
    },
    {
      id: 'sec-bar',
      branch_id: branchId,
      name: 'Bar',
      is_active: false,
      sort_order: 1,
      printer_name: null,
    },
  ];
}

/* ==========================================================================
 * O PROGRAMA DE IMPRESSÃO
 *
 * As duas filiais cobrem os dois estados que a tela tem de saber desenhar, e
 * eles NÃO são o mesmo com intensidades diferentes:
 *
 * - a MATRIZ tem agente, viu sinal há 12 segundos e reportou duas impressoras.
 *   É a loja instalada e funcionando;
 * - a ZONA NORTE nunca teve agente. O backend responde 200 com tudo nulo (não
 *   404), e a tela precisa dizer "nunca instalado" em vez de "desligado" — uma
 *   se resolve indo instalar, a outra ligando o computador.
 *
 * O terceiro estado (instalado e fora do ar) é o mesmo da Matriz com o
 * contador empurrado, e o teste que precisa dele usa `setPrintAgentSeconds`.
 * Guardar SEGUNDOS, e não um carimbo, é o que impede o falso de envelhecer: um
 * `last_seen_at` fixo viraria "há 3 meses" na semana que vem.
 * ======================================================================= */
type FakePrintAgent = { secondsSinceLastSeen: number; version: string | null };

function initialPrintAgents(): Record<string, FakePrintAgent> {
  return { [BRANCH_ID]: { secondsSinceLastSeen: 12, version: '1.4.2' } };
}

function initialPrinters(): Record<string, PrintAgentPrinter[]> {
  const agora = new Date().toISOString();
  return {
    [BRANCH_ID]: [
      { name: 'EPSON TM-T20', is_default: true, reported_at: agora },
      { name: 'Bematech MP-4200 TH', is_default: false, reported_at: agora },
    ],
  };
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
 * O DIA DA OPERAÇÃO de um carimbo ISO, em AAAA-MM-DD.
 *
 * Os filtros `last_order_from`/`last_order_to` são lidos pelo backend em
 * `America/Fortaleza`, e é o dia DELE que a comparação usa. Com o fuso do
 * processo que roda o teste, um pedido das 23h de ontem cairia no dia de hoje em
 * metade das máquinas e no de ontem na outra — e o teste passaria ou falharia
 * conforme quem o rodou.
 */
const OPERATION_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' });

function operationDay(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return OPERATION_DAY.format(date);
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
  '85966665555': BRANCH_ID,
  '8532224444': '44444444-4444-4444-4444-444444444444',
};

/**
 * OS CINCO CLIENTES DO FALSO, e cada um cobre um caso que a tela precisa saber
 * desenhar — não uma base que pareça real.
 *
 * `segment`, `average_ticket`, `billable_orders_count`, `days_since_last_order` e
 * `cadence_days` são CALCULADOS PELO BACKEND, sobre o recorte da consulta, e o
 * falso os entrega prontos como a rota entrega. Recalculá-los aqui seria
 * reimplementar a fórmula RFV dentro do arnês de teste — e um teste que refaz a
 * conta do backend passa mesmo quando a tela lê o campo errado.
 *
 * OS RITMOS SÃO ESCOLHIDOS PARA COBRIR O CASO QUE MOTIVOU `cadence_days`:
 * Juliana está `em_risco` com 20 dias e ritmo 8; Marcos está `perdido` com 95 e
 * ritmo 20. Duas distâncias diferentes com rótulos diferentes não provam nada —
 * o que a tela precisa mostrar é o RITMO de cada um, porque é ele que separa
 * dois clientes com a MESMA distância.
 *
 * O que cada linha cobre:
 *
 * - **Ana Paula** é `fiel` e tem pedido cancelado: `orders_count` 12 contra
 *   `billable_orders_count` 10. É a linha em que os três números parecem não
 *   fechar (12 pedidos, R$ 748,50, ticket R$ 74,85) e a tela tem que escrever o
 *   denominador embaixo do ticket.
 * - **Marcos Lima** é `perdido` — 95 dias sem aparecer.
 * - **Sem nome** é `ocasional`, e é o cliente de balcão que não se identificou.
 * - **Juliana Alves** é `em_risco` e NÃO TEM PEDIDO FATURÁVEL: os três dela
 *   foram cancelados, então `average_ticket` vem 0.0 do backend. Escrever
 *   "R$ 0,00" ali seria afirmar que ela gasta zero por pedido; a tela tem que
 *   dizer que não há o que dividir.
 * - **Rafael Nunes** é `novo` e mora na OUTRA filial — é ele que prova que o
 *   seletor do topo recorta esta lista.
 */
function initialCustomers(): CustomerListItem[] {
  return [
    {
      customer_name: 'Ana Paula',
      customer_phone: '85999990000',
      orders_count: 12,
      billable_orders_count: 10,
      total_spent: 748.5,
      average_ticket: 74.85,
      first_order_at: daysAgo(400),
      last_order_at: daysAgo(0),
      days_since_last_order: 0,
      cadence_days: 7,
      segment: 'fiel',
    },
    {
      customer_name: 'Marcos Lima',
      customer_phone: '85988887777',
      orders_count: 5,
      billable_orders_count: 5,
      total_spent: 312,
      average_ticket: 62.4,
      first_order_at: daysAgo(300),
      last_order_at: daysAgo(95),
      days_since_last_order: 95,
      cadence_days: 20,
      segment: 'perdido',
    },
    {
      customer_name: '',
      customer_phone: '85977776666',
      orders_count: 2,
      billable_orders_count: 2,
      total_spent: 89.9,
      average_ticket: 44.95,
      first_order_at: daysAgo(60),
      last_order_at: daysAgo(1),
      days_since_last_order: 1,
      cadence_days: 30,
      segment: 'ocasional',
    },
    {
      customer_name: 'Juliana Alves',
      customer_phone: '85966665555',
      orders_count: 3,
      billable_orders_count: 0,
      total_spent: 0,
      average_ticket: 0,
      first_order_at: daysAgo(45),
      last_order_at: daysAgo(20),
      days_since_last_order: 20,
      cadence_days: 8,
      segment: 'em_risco',
    },
    {
      customer_name: 'Rafael Nunes',
      customer_phone: '8532224444',
      orders_count: 1,
      billable_orders_count: 1,
      total_spent: 45,
      average_ticket: 45,
      first_order_at: daysAgo(12),
      last_order_at: daysAgo(12),
      days_since_last_order: 12,
      cadence_days: 30,
      segment: 'novo',
    },
  ];
}

/* ==========================================================================
 * AVALIAÇÕES
 *
 * O conjunto é escolhido para cobrir o que a tela precisa saber desenhar, e
 * não para parecer uma loja real:
 *
 * - TRÊS notas baixas com a MESMA etiqueta (`atrasou`): é o caso que produz a
 *   manchete da tela ("3 das 5 notas baixas apontaram Atrasou"). Com uma
 *   ocorrência de cada, a frase seria outra e o teste não provaria nada.
 * - uma nota baixa SEM etiqueta: ela é opcional para quem avalia, e é o que
 *   faz a soma das etiquetas não fechar com o total de baixas na tela.
 * - notas 4 e 5 SEM etiqueta nenhuma: o backend responde 422 a quem mandar
 *   etiqueta com nota alta, então um fixture com `problem_tag` num 5 estaria
 *   descrevendo uma resposta que a API não emite.
 * - uma avaliação SEM comentário: o campo é opcional e a linha não pode
 *   desabar sem ele.
 * - uma avaliação da SEGUNDA FILIAL: é o que prova o recorte por loja.
 * ======================================================================= */

function review(
  overrides: Partial<ReviewItem> & { order_number: number; rating: number },
): ReviewItem {
  return {
    branch_id: BRANCH_ID,
    comment: null,
    created_at: minutesAgo(90),
    problem_tag: null,
    ...overrides,
  };
}

function initialReviews(): ReviewItem[] {
  return [
    review({
      order_number: 5471,
      rating: 1,
      problem_tag: 'atrasou',
      comment: 'Esperei 1h40 e a pizza chegou fria. Nunca mais.',
      created_at: minutesAgo(30),
    }),
    review({
      order_number: 5468,
      rating: 2,
      problem_tag: 'atrasou',
      comment: 'Demorou demais.',
      created_at: minutesAgo(120),
    }),
    review({
      order_number: 5462,
      rating: 3,
      problem_tag: 'atrasou',
      created_at: minutesAgo(400),
    }),
    review({
      order_number: 5455,
      rating: 2,
      problem_tag: 'faltou_item',
      comment: 'Faltou a borda recheada que eu paguei.',
      created_at: minutesAgo(600),
    }),
    /* A nota baixa sem etiqueta: escolhê-la é opcional. */
    review({
      order_number: 5450,
      rating: 3,
      comment: 'Podia ser melhor.',
      created_at: minutesAgo(700),
    }),
    review({
      order_number: 5449,
      rating: 5,
      comment: 'Melhor pizza da cidade, chegou quentinha.',
      created_at: minutesAgo(800),
    }),
    review({ order_number: 5444, rating: 5, created_at: minutesAgo(900) }),
    review({ order_number: 5440, rating: 4, created_at: minutesAgo(1000) }),
    /* A outra loja: some quando o cabeçalho recorta a Aldeota. */
    review({
      order_number: 5439,
      rating: 1,
      branch_id: BRANCH_ID_2,
      problem_tag: 'veio_errado',
      comment: 'Veio pedido de outra pessoa.',
      created_at: minutesAgo(1100),
    }),
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

/**
 * O RESUMO, E ELE MUDA COM O RECORTE DE FILIAL.
 *
 * As seis rotas de relatório ganharam `branch_id` na revisão `20260820_0026` do
 * backend, e o falso precisa honrá-lo — senão o painel poderia parar de mandar
 * o parâmetro e nada ficaria vermelho. O número da filial é uma FRAÇÃO do da
 * rede, e não outro número qualquer: é o que faz "a loja fatura menos que a
 * rede" ser legível no print e no teste.
 *
 * Sem `branchId` é a soma de todas as lojas, que é o que o dono lê.
 */
/**
 * ============================================================================
 * O RESUMO DE VENDAS, POR RECORTE — e a soma das lojas FECHA com a rede
 * ============================================================================
 *
 * O falso devolvia dois resumos: um para "todas" e UM para qualquer filial. Isso
 * bastava enquanto a tela só perguntava "o número muda quando eu troco de
 * loja?". Deixou de bastar quando o Desempenho passou a COMPARAR as filiais
 * lado a lado: com a mesma resposta para as duas, a comparação desenharia duas
 * barras de 50% e o teste que ela existe para proteger passaria sem provar
 * nada.
 *
 * E a soma tem de fechar. `1820,00 + 1349,50 = 3169,50`, `1590 + 1812 = 3402`,
 * `31 + 23 = 54`, `26 + 22 = 48`. Um falso em que as partes não somam o todo é
 * um defeito plantado: a tela mostra a rede numa banda e as lojas na seção
 * seguinte, e ninguém percebe a conta furada até um lojista somar na mão.
 */
type RecorteDeResumo = {
  orders: number;
  ordersPrev: number;
  revenue: string;
  revenuePrev: string;
  excluidos: number;
};

const RESUMO_POR_FILIAL: Record<string, RecorteDeResumo> = {
  [BRANCH_ID]: {
    orders: 31,
    ordersPrev: 26,
    revenue: '1820.00',
    revenuePrev: '1590.00',
    excluidos: 4,
  },
  [BRANCH_ID_2]: {
    orders: 23,
    ordersPrev: 22,
    revenue: '1349.50',
    revenuePrev: '1812.00',
    excluidos: 2,
  },
};

const RESUMO_DA_REDE: RecorteDeResumo = {
  orders: 54,
  ordersPrev: 48,
  revenue: '3169.50',
  revenuePrev: '3402.00',
  excluidos: 6,
};

/** Uma `MetricComparison` calculada, para que os números não se contradigam. */
function comparacaoDe(atual: number, anterior: number, casas: number): MetricComparison {
  const mudanca = atual - anterior;
  return {
    current: atual.toFixed(casas),
    previous: anterior.toFixed(casas),
    change: mudanca.toFixed(casas),
    /*
     * NULO QUANDO O ANTERIOR FOI ZERO, como o contrato manda: não existe
     * variação percentual a partir de zero. É o caso em que um `?? 0` na tela
     * escreveria "0%" e diria que ficou igual.
     */
    change_percent: anterior === 0 ? null : ((mudanca / anterior) * 100).toFixed(1),
  };
}

function initialSalesSummary(start: string, end: string, branchId = ''): SalesSummary {
  const recorte = (branchId ? RESUMO_POR_FILIAL[branchId] : RESUMO_DA_REDE) ?? RESUMO_DA_REDE;
  const receita = Number(recorte.revenue);
  const receitaAnterior = Number(recorte.revenuePrev);
  const ticket = receita / recorte.orders;
  const ticketAnterior = receitaAnterior / recorte.ordersPrev;

  /* As fatias de entrega e retirada são as mesmas proporções em qualquer
     recorte — o que muda é o dinheiro em cima do qual elas incidem. */
  const entrega = receita * 0.792;
  const retirada = receita - entrega;

  return {
    restaurant_id: RESTAURANT_ID,
    period: reportPeriod(start, end),
    previous_period: reportPeriod(start, end),
    orders_count: recorte.orders,
    revenue_total: recorte.revenue,
    average_ticket: ticket.toFixed(2),
    breakdown: {
      subtotal_total: (receita * 0.94).toFixed(2),
      delivery_fee_total: (receita * 0.0757).toFixed(2),
      service_fee_total: (receita * 0.0341).toFixed(2),
      discount_total: (receita * 0.05).toFixed(2),
      commission_total: (receita * 0.1).toFixed(2),
    },
    order_types: [
      {
        order_type: 'delivery',
        orders_count: Math.round(recorte.orders * 0.76),
        revenue_total: entrega.toFixed(2),
        revenue_share_percent: '79.2',
      },
      {
        order_type: 'pickup',
        orders_count: recorte.orders - Math.round(recorte.orders * 0.76),
        revenue_total: retirada.toFixed(2),
        revenue_share_percent: '20.8',
      },
    ],
    excluded_orders_count: recorte.excluidos,
    orders_count_comparison: comparacaoDe(recorte.orders, recorte.ordersPrev, 0),
    revenue_comparison: comparacaoDe(receita, receitaAnterior, 2),
    /*
     * O NULO CONTINUA EXERCITADO, e continua sendo só na REDE. Sem período
     * anterior com movimento não existe variação percentual — e é aqui que um
     * `?? 0` escreveria "0%" e diria que o ticket ficou igual. Nas filiais o
     * ticket varia de verdade, porque a comparação entre lojas precisa de uma
     * seta para cada lado para ter o que provar.
     */
    average_ticket_comparison: branchId
      ? comparacaoDe(ticket, ticketAnterior, 2)
      : {
          current: ticket.toFixed(2),
          previous: '0.00',
          change: ticket.toFixed(2),
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

/**
 * O relatório de produtos.
 *
 * ELE CRESCEU DE TRÊS PARA OITO ITENS, e não foi por capricho de fixture: a
 * seção "O que vendeu" passou a separar os produtos em três grupos por fatia da
 * receita (campeões, promissores, repensáveis — ver `product-quadrants.ts`), e
 * com três produtos os três caíam todos em "campeões". Uma fixture que só
 * exercita um dos ramos deixa os outros dois sem teste nenhum.
 *
 * A ORDEM É POR UNIDADES, DECRESCENTE, como o contrato promete — e é ela que
 * torna a fixture interessante: o refrigerante é o TERCEIRO em unidades e um
 * mero "promissor" em dinheiro; a água é a quinta em unidades e "repensável". É
 * exatamente a discordância entre ranking e grupo que a seção existe para
 * mostrar, e agora ela está no falso.
 *
 * `listed_revenue_total` é a soma da própria lista — 2.495,60 — e é o
 * denominador de todas as fatias da seção.
 */
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
      {
        product_id: 'prod-6',
        product_name: 'Refrigerante lata',
        orders_count: 17,
        quantity_total: 19,
        revenue_total: '96.00',
      },
      {
        product_id: 'prod-3',
        product_name: 'Filé à parmegiana',
        orders_count: 8,
        quantity_total: 8,
        revenue_total: '316.00',
      },
      {
        product_id: 'prod-7',
        product_name: 'Água 500 ml',
        orders_count: 7,
        quantity_total: 7,
        revenue_total: '41.00',
      },
      {
        product_id: 'prod-8',
        product_name: 'Pudim da casa',
        orders_count: 6,
        quantity_total: 6,
        revenue_total: '63.00',
      },
      /* Produto apagado depois da venda: `product_id` nulo é caso do contrato. */
      {
        product_id: null,
        product_name: 'Combo de inverno (fora do cardápio)',
        orders_count: 4,
        quantity_total: 4,
        revenue_total: '180.00',
      },
      {
        product_id: 'prod-9',
        product_name: 'Pão de alho',
        orders_count: 4,
        quantity_total: 4,
        revenue_total: '32.00',
      },
    ],
    listed_revenue_total: '2495.60',
    revenue_note:
      'Receita bruta dos itens, sem cupom, cashback nem taxas — não fecha com o faturamento do resumo.',
  };
}

/**
 * Os pedidos que não viraram venda.
 *
 * AS CONTAGENS BATEM COM `cancelamentosDeTresDiasAtras()`, e isso passou a
 * importar: a mesma seção agora mostra a contagem do RELATÓRIO e um gráfico
 * montado a partir da LISTAGEM de pedidos. Com os dois discordando, a tela
 * escreveria "6 pedidos não viraram venda" em cima de um gráfico com quatro
 * barras — um defeito que não quebra nada e que ninguém nota, porque os dois
 * números moram em blocos diferentes.
 *
 * Quatro `cancelled` e dois `rejected`, seis no total. A taxa é sobre TODOS os
 * pedidos do período — 6 / (54 + 6) = 10,0% —, e não só sobre os faturados: é a
 * armadilha que a ressalva da seção existe para desarmar.
 */
function initialCancellations(start: string, end: string): Cancellations {
  return {
    restaurant_id: RESTAURANT_ID,
    period: reportPeriod(start, end),
    orders_count: 6,
    amount_total: '327.00',
    billable_orders_count: 54,
    cancellation_rate_percent: '10.0',
    breakdown: [
      { status: 'cancelled', payment_status: 'refunded', orders_count: 3, amount_total: '186.00' },
      { status: 'cancelled', payment_status: 'pending', orders_count: 1, amount_total: '52.00' },
      { status: 'rejected', payment_status: 'pending', orders_count: 2, amount_total: '89.00' },
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
  /**
   * Categorias na ordem em que o "banco" as tem.
   *
   * Com `branchId`, só as daquela loja — que é a lista que o painel enxerga.
   * Sem ele, as das duas, que é o que o backend responde a quem não recorta.
   */
  categories: (branchId?: string) => Category[];
  /** Produto pelo id, para conferir o que o painel gravou. */
  product: (productId: string) => Product | undefined;
  /** Corpo de cada PATCH /admin/categories/reorder, COM a filial que foi junto. */
  reorderCalls: () => { branchId: string | undefined; categoryIds: string[] }[];
  /**
   * Corpo de cada PATCH /admin/products/reorder.
   *
   * É por aqui que o teste confere a coisa que nenhuma asserção de tela
   * alcança: que a lista mandada é a COMPLETA da categoria, na ordem nova. Uma
   * tela que arrastasse certo e mandasse a lista curta mostraria a ordem certa
   * e gravaria a errada.
   */
  productReorderCalls: () => { categoryId: string; productIds: string[] }[];
  /**
   * Faz a gravação de disponibilidade DESTE item responder 500.
   *
   * Existe para o caso que a ação em massa não pode errar: sem rota em lote,
   * são N chamadas e três de cinco podem gravar. A tela tem de NOMEAR o que
   * ficou para trás.
   */
  failAvailability: (productId: string) => void;
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
  /**
   * A QUERY de cada GET /admin/customers que chegou, na ordem.
   *
   * Existe para uma asserção que nenhuma outra alcança: que os cinco critérios
   * viajam no ENDEREÇO, e não numa peneira feita no navegador. Uma tela que
   * filtrasse o array recebido mostraria a mesma lista curta na tela e não
   * deixaria rastro nenhum aqui.
   */
  customerQueries: () => URLSearchParams[];
  /**
   * A QUERY de cada GET /admin/reviews que chegou, na ordem.
   *
   * É por onde se prova que o filtro de nota viaja no ENDEREÇO — uma tela que
   * peneirasse o array recebido mostraria a mesma lista curta e não deixaria
   * rastro nenhum aqui.
   */
  reviewQueries: () => URLSearchParams[];
  /** Apaga todas as avaliações: o período passa a não ter nenhuma. */
  clearReviews: () => void;
  /**
   * Deixa só as notas 4 e 5.
   *
   * É o período em que TUDO DEU CERTO — o estado que a tela abre com a lista
   * vazia, porque o recorte padrão dela é "até 3 estrelas". Ele não tem
   * fixture próprio porque é o mesmo conjunto sem as baixas.
   */
  onlyHighReviews: () => void;
  /**
   * A chave de catálogo de cada produto, como o "banco" a tem.
   *
   * É por ela que se confere o pareamento: os DOIS lados precisam terminar com
   * a mesma chave, e gravar só um deles não pareia com ninguém.
   */
  catalogKeys: () => Record<string, string | null>;
  /** Cada POST /admin/products/{id}/image que chegou, com o peso do corpo. */
  imageUploads: () => { productId: string; bytes: number }[];
  /** Configurações do restaurante como o "banco" as tem agora. */
  settings: () => RestaurantSettings;
  /** Corpo de cada PATCH /admin/settings, para conferir o que a tela mandou. */
  settingsPatches: () => Record<string, unknown>[];
  /** O perfil do restaurante como o "banco" o tem agora. */
  profile: () => RestaurantProfile;
  /**
   * Corpo de cada PATCH /admin/restaurant.
   *
   * É AQUI que se confere a edição parcial: o campo que o lojista não mexeu não
   * pode aparecer no corpo, senão um texto legado acima do teto tomaria 422 e
   * levaria junto o campo que ele estava tentando salvar.
   */
  profilePatches: () => Record<string, unknown>[];
  /** Planta os dois textos antes do login — inclusive acima do teto. */
  setProfileTexts: (textos: {
    description?: string | null;
    assistant_notes?: string | null;
  }) => void;
  /** Corpo de cada PATCH /admin/branches/{id}. */
  branchPatches: () => { branchId: string; body: Record<string, unknown> }[];
  /** Corpo de cada PUT de horários — é onde se confere que vão os 7 dias. */
  hoursPuts: () => { branchId: string; periods: BusinessHourInput[] }[];
  /** Formas de pagamento que o "banco" tem agora. */
  paymentMethods: () => PaymentMethod[];
  /**
   * O corpo de cada PUT de cashback.
   *
   * É AQUI que se confere a armadilha do dia ausente: `weekdays` tem de sair
   * com SÓ os dias preenchidos, e nunca com sete linhas — sete linhas
   * congelariam o percentual de todos eles e matariam a herança.
   */
  cashbackPuts: () => { escopo: 'rede' | 'filial'; body: Record<string, unknown> }[];
  /** Planta a regra da rede antes do login, para a tela abrir com ela. */
  setCashbackRestaurantRule: (rule: CashbackRule | null) => void;
  /** Planta (ou apaga) a sobrescrita de uma filial. */
  setCashbackBranchRule: (branchId: string, rule: CashbackRule | null) => void;
  /** As campanhas que o "banco" tem agora. */
  coupons: () => Coupon[];
  /**
   * O corpo de cada escrita de cupom.
   *
   * É AQUI que se confere a trava principal da tela: `discount_type` e
   * `discount_value` têm de sair da ARTE escolhida, e não de campo nenhum do
   * formulário. O backend confere o tipo e NÃO confere o valor — uma asserção
   * de tela não alcança isso, só o corpo alcança.
   */
  couponBodies: () => { metodo: string; id: string | null; body: Record<string, unknown> }[];
  /** Deixa o catálogo de artes só com estas. Chamar ANTES do login. */
  setCouponTemplates: (templates: CouponTemplate[]) => void;
  /** Troca as campanhas do "banco". Chamar ANTES do login. */
  setCoupons: (coupons: Coupon[]) => void;
  /** Setores de impressão que o "banco" tem agora. */
  printSectors: () => PrintSector[];
  /**
   * Entra como outro papel. Chamar ANTES do login.
   *
   * Os quatro de `admin_users.role`. É a única coisa que muda entre um lojista
   * e outro do ponto de vista do painel — filial e restaurante saem do token
   * do mesmo jeito.
   */
  entrarComoPapel: (papel: 'owner' | 'manager' | 'attendant' | 'print_agent') => void;
  /** Cada POST de via de teste, para conferir o corpo que a tela mandou. */
  printTests: () => { branchId: string; body: PrintTestRequest }[];
  /**
   * Os corpos de `PATCH .../print-settings`, na ordem.
   *
   * É por aqui que o teste separa `null` de `''` no rodapé — os dois somem numa
   * asserção de tela, porque a tela mostra o efeito e não o que foi enviado.
   */
  printSettingsPatches: () => { branchId: string; body: Record<string, unknown> }[];
  /** Cada PATCH .../delivery-pause, na ordem. */
  pauseCalls: () => { branchId: string; body: Record<string, unknown> }[];
  /** Cada PUT .../delivery-time-bands, na ordem. */
  bandCalls: () => { branchId: string; body: Record<string, unknown> }[];
  /** Cada PATCH de produto, com o corpo — é onde se prova campo AUSENTE. */
  productPatches: () => { productId: string; body: Record<string, unknown> }[];
  /**
   * Empurra o último sinal do agente daquela filial.
   *
   * É o que produz o terceiro estado da tela — instalado e FORA DO AR —, que
   * não tem fixture próprio porque é o mesmo agente com o contador adiantado.
   * Acima de 90 segundos o falso responde `is_online: false`, como o backend.
   */
  setPrintAgentSeconds: (branchId: string, seconds: number) => void;
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
  /**
   * Espera o navegador pendurar a conexão do SSE.
   *
   * `pushNewOrder` antes disso é um evento que nasce atrás do cursor da conexão
   * que ainda vai chegar — ou seja, um evento que não é entregue a ninguém. O
   * teste passava por sorte, quando a conexão vencia a corrida contra a linha
   * seguinte do teste.
   *
   * Esperar `conn--live` na tela NÃO resolveria: este falso segura a resposta
   * do SSE até haver o que mandar, então o `onopen` do EventSource — e portanto
   * o "Tempo real" da barra — só acontece DEPOIS do primeiro evento.
   */
  waitForStream: () => Promise<void>;
  /** Muda o status por fora da tela, como faria outro atendente. */
  setStatusFromAnotherUser: (orderId: string, status: string) => void;
  /** Faz toda chamada autenticada responder 401 (sessão expirada). */
  expireSession: () => void;
  /** Encerra as respostas pendentes do SSE no fim do teste. */
  stop: () => void;
  /** Cria um item de pedido pronto para o pushNewOrder. */
  makeOrder: typeof order;

  // --- a equipe ------------------------------------------------------------

  /** A equipe como o "banco" a tem agora — ativos e inativos, sem a máquina. */
  adminUsers: () => AdminUserDetail[];
  /** Troca a equipe do "banco". Chamar ANTES do login. */
  setAdminUsers: (usuarios: AdminUserDetail[]) => void;
  /**
   * O corpo de cada escrita em `/admin/users`, na ordem.
   *
   * É AQUI que se prova o PATCH parcial: um corpo que carregasse nome, papel e
   * filial para desativar alguém desfaria o que outra aba gravou, e nenhuma
   * asserção de tela alcança isso — a tela mostraria o mesmo resultado.
   */
  adminUserBodies: () => { metodo: string; id: string | null; body: Record<string, unknown> }[];
  /** As senhas temporárias que o falso gerou, na ordem em que saíram. */
  senhasGeradas: () => string[];
  /**
   * Entra com a senha temporária ligada. Chamar ANTES do login.
   *
   * A partir daí o falso responde 403 em toda rota `/admin` que não seja o `me`
   * e o PATCH da senha — como `_ensure_temporary_password_was_changed`. É o que
   * permite conferir que o painel obedece o CAMPO: se ele dependesse do 403, a
   * tela abriria e só depois se fecharia, piscando o painel inteiro.
   */
  entrarComSenhaTemporaria: () => void;
  /** Cada PATCH /admin/auth/password que chegou, com o corpo. */
  trocasDeSenha: () => Record<string, unknown>[];
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

/* ==========================================================================
 * CUPONS
 *
 * A ARTE É DA PLATAFORMA, e o falso a trata assim: `coupon_templates` não tem
 * `restaurant_id` e não há rota que as cadastre — a lista vem inteira, sem
 * recorte, e só com as ativas.
 *
 * A semente cobre as CINCO situações de uma vez (programado, ativo, expirado,
 * esgotado, desligado) mais a arte fora do ar. Não é excesso: é o que faz uma
 * captura de tela mostrar a coluna de situação inteira em vez de uma etiqueta
 * repetida seis vezes.
 * ======================================================================= */

const ARTE_SUMIDA = 'tpl-desativada-pela-plataforma';

function diasDaqui(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

function initialCouponTemplates(): CouponTemplate[] {
  const arte = (
    id: string,
    name: string,
    discount_type: string,
    discount_value: string | null,
    sort_order: number,
  ): CouponTemplate => ({
    id,
    name,
    image_path: `${id}.png`,
    /*
     * `image_url` VEM PRONTA do backend (`build_storage_url`) — o painel não
     * monta URL de bucket. Aqui ela é um data: URI de 1px porque o e2e roda sem
     * rede: uma URL de verdade viraria uma imagem quebrada em toda captura.
     */
    image_url:
      'data:image/svg+xml;base64,' +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#dfe4ee"/><text x="80" y="52" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#2b3444">${name}</text></svg>`,
      ).toString('base64'),
    discount_type,
    discount_value,
    sort_order,
  });

  return [
    arte('tpl-percent-10', '10% OFF', 'percent', '10.00', 1),
    arte('tpl-percent-15', '15% OFF', 'percent', '15.00', 2),
    arte('tpl-percent-20', '20% OFF', 'percent', '20.00', 3),
    /* Uma arte de valor fixo LIVRE na semente: é ela que permite ao e2e trocar
       de arte percentual para não-percentual e conferir que o teto de desconto
       sai do corpo junto com o campo. */
    arte('tpl-fixed-3', 'R$ 3 OFF', 'fixed', '3.00', 4),
    arte('tpl-fixed-5', 'R$ 5 OFF', 'fixed', '5.00', 5),
    /*
     * "Primeiro pedido" é uma ARTE, cadastrada como `fixed` de R$ 10 — ela só
     * DIZ isso na vitrine. Marcar `first_order_only` não obriga a escolhê-la, e
     * escolhê-la não marca o booleano: são coisas independentes, e o painel não
     * pode ligar uma na outra.
     */
    arte('tpl-first', 'Primeiro pedido', 'fixed', '10.00', 6),
    arte('tpl-free', 'Frete grátis', 'free_delivery', null, 7),
  ];
}

function initialCoupons(restaurantId: string): Coupon[] {
  const base = {
    restaurant_id: restaurantId,
    description: null,
    max_discount_amount: null,
    min_order_value: '0.00',
    total_usage_limit: null,
    usage_limit_per_customer: null,
    cooldown_days: null,
    first_order_only: false,
    is_public: true,
    is_active: true,
    total_usage_count: 0,
    created_at: null,
    updated_at: null,
  };

  return [
    {
      ...base,
      id: 'cupom-frete',
      coupon_template_id: 'tpl-free',
      code: 'SETEMBRO',
      title: 'Setembro sem frete',
      discount_type: 'free_delivery',
      discount_value: '0.00',
      min_order_value: '60.00',
      valid_from: diasDaqui(-10),
      valid_until: diasDaqui(20),
      total_usage_limit: 100,
      total_usage_count: 37,
      usage_limit_per_customer: 1,
      first_order_only: true,
    },
    {
      ...base,
      id: 'cupom-natal',
      coupon_template_id: 'tpl-percent-10',
      code: 'NATAL10',
      title: 'Natal',
      discount_type: 'percent',
      discount_value: '10.00',
      valid_from: diasDaqui(30),
      valid_until: diasDaqui(45),
    },
    {
      ...base,
      id: 'cupom-volta',
      coupon_template_id: 'tpl-percent-20',
      code: 'VOLTA20',
      title: 'Volta às aulas',
      discount_type: 'percent',
      discount_value: '20.00',
      max_discount_amount: '15.00',
      valid_from: diasDaqui(-60),
      valid_until: diasDaqui(-30),
    },
    {
      ...base,
      id: 'cupom-cinco',
      coupon_template_id: 'tpl-fixed-5',
      code: 'CINCO',
      title: 'Cinco reais',
      discount_type: 'fixed',
      discount_value: '5.00',
      valid_from: diasDaqui(-5),
      valid_until: diasDaqui(25),
      total_usage_limit: 50,
      total_usage_count: 50,
    },
    {
      ...base,
      id: 'cupom-pausado',
      coupon_template_id: 'tpl-first',
      code: 'PRIMEIRA',
      title: 'Primeira compra',
      discount_type: 'fixed',
      discount_value: '10.00',
      valid_from: diasDaqui(-20),
      valid_until: diasDaqui(40),
      is_active: false,
    },
    /*
     * A CAMPANHA PENDURADA NUMA ARTE QUE A PLATAFORMA DESATIVOU. Ela não tem
     * par em `GET /admin/coupon-templates`, e por isso o backend responde 400 a
     * qualquer PATCH dela — inclusive a um que só a desligue.
     */
    {
      ...base,
      id: 'cupom-orfao',
      coupon_template_id: ARTE_SUMIDA,
      code: 'ANTIGA',
      title: 'Campanha antiga',
      discount_type: 'percent',
      discount_value: '5.00',
      valid_from: diasDaqui(-15),
      valid_until: diasDaqui(15),
      total_usage_count: 4,
    },
  ];
}

/* ==========================================================================
 * A EQUIPE
 *
 * A semente é o restaurante REAL de hoje: uma conta só, a do dono. É o estado
 * que a tela existe para acabar — enquanto ele durar, a senha do dono circula
 * no balcão.
 *
 * As outras três linhas cobrem o que a tela precisa mostrar de uma vez: um
 * gerente preso a uma filial, um atendente que ainda não entrou (senha
 * temporária) e alguém desativado. Não é excesso — é o que faz uma captura
 * mostrar a coluna de situação inteira em vez da mesma etiqueta quatro vezes.
 *
 * O `print_agent` NÃO ESTÁ AQUI, e a ausência é o contrato:
 * `list_people_by_restaurant` filtra a conta de máquina, e o PATCH responde 404
 * nela. Ele tem tela própria em Minha loja › Impressão.
 * ======================================================================= */

function initialAdminUsers(): AdminUserDetail[] {
  const base = {
    restaurant_id: RESTAURANT_ID,
    is_active: true,
    must_change_password: false,
    password_changed_at: '2026-07-02T12:00:00Z',
    created_at: '2026-05-10T12:00:00Z',
  };

  return [
    {
      ...base,
      id: FAKE_USER.id,
      branch_id: null,
      name: FAKE_USER.name,
      email: FAKE_USER.email,
      role: 'owner',
    },
    {
      ...base,
      id: 'user-gerente',
      branch_id: BRANCH_ID_2,
      name: 'Rafael Lima',
      email: 'rafael@pizzaria.com',
      role: 'manager',
      created_at: '2026-06-01T12:00:00Z',
    },
    {
      /* Cadastrado e ainda não entrou: `password_changed_at` nulo e a marca de
         senha temporária ligada — os dois juntos são o estado real de quem
         acabou de receber a senha pelo telefone. */
      ...base,
      id: 'user-balcao',
      branch_id: BRANCH_ID,
      name: 'Carla Nogueira',
      email: 'carla@pizzaria.com',
      role: 'attendant',
      must_change_password: true,
      password_changed_at: null,
      created_at: '2026-08-20T12:00:00Z',
    },
    {
      ...base,
      id: 'user-saiu',
      branch_id: BRANCH_ID,
      name: 'Bruno Alves',
      email: 'bruno@pizzaria.com',
      role: 'attendant',
      is_active: false,
      created_at: '2026-05-30T12:00:00Z',
    },
  ];
}

/**
 * A senha temporária, com o ALFABETO DO BACKEND.
 *
 * `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 20 caracteres: sem O/0 e sem I/l/1, e sem
 * minúscula. O falso repete o alfabeto de propósito — uma senha de mentira com
 * um "l" e um "0" dentro faria a captura de tela mentir sobre justamente a
 * propriedade que o diálogo promete (que ela dá para ditar por telefone).
 *
 * DETERMINÍSTICA: o e2e não pode fotografar uma senha diferente a cada
 * execução, e o teste precisa poder afirmar o que está na tela.
 */
function senhaTemporariaFalsa(indice: number): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let senha = '';
  for (let i = 0; i < 20; i += 1) {
    senha += alfabeto[(i * 7 + indice * 3) % alfabeto.length];
  }
  return senha;
}

  const state = {
    orders: initialOrders(),
    // O histórico é guardado de verdade porque o painel recarrega o detalhe
    // depois de mudar o status — e o teste confere a linha nova lá.
    history: {} as Record<string, Schemas['StatusHistoryResponse'][]>,
    sessionExpired: false,
    stopped: false,
    /** Append-only: cada conexão SSE lê a partir do próprio cursor. */
    streamLog: [] as StreamEvent[],
    /**
     * Quantas conexões SSE estão PENDURADAS agora, esperando evento.
     *
     * Ele existe por causa de uma corrida real: `serveStream` marca o cursor no
     * instante em que a conexão CHEGA ao handler, então um evento empurrado
     * antes disso nasce atrás do cursor e nunca é entregue. O teste precisa
     * poder esperar a conexão existir antes de empurrar — ver `waitForStream`.
     */
    streamConnections: 0,
    eventId: 0,
    /*
     * O CARDÁPIO DAS DUAS LOJAS VIVE NO MESMO "BANCO", como no Postgres de
     * verdade — é o que dá ao falso a chance de responder errado quando o
     * painel não recorta por filial, que é o defeito que esta suíte cobre.
     */
    categories: [...initialCategories(), ...copiaDoCardapio().categories],
    products: [...initialProducts(), ...copiaDoCardapio().products],
    reorderCalls: [] as { branchId: string | undefined; categoryIds: string[] }[],
    productReorderCalls: [] as { categoryId: string; productIds: string[] }[],
    /** Ids cuja gravação de disponibilidade responde 500. Ver `failAvailability`. */
    failAvailabilityFor: new Set<string>(),
    availabilityCalls: [] as { productId: string; isAvailable: boolean }[],
    customerQueries: [] as URLSearchParams[],
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
    profile: initialProfile(),
    profilePatches: [] as Record<string, unknown>[],
    branchPatches: [] as { branchId: string; body: Record<string, unknown> }[],
    /** Cada PATCH de tipos de pedido, para conferir que só vai o campo mexido. */
    orderTypeCalls: [] as { branchId: string; body: Record<string, unknown> }[],
    businessHours: {
      [BRANCH_ID]: initialBusinessHours(BRANCH_ID),
    } as Record<string, BusinessHour[]>,
    hoursPuts: [] as { branchId: string; periods: BusinessHourInput[] }[],
    paymentMethods: initialPaymentMethods(BRANCH_ID),
    /*
     * AS DUAS LINHAS DE CASHBACK, e o falso as guarda separadas porque a
     * herança é POR LINHA: a filial tem a regra inteira ou herda a inteira.
     * Um mapa por filial com `undefined` significando "herda" é exatamente a
     * forma que o backend tem no banco.
     */
    cashbackRestaurantRule: null as CashbackRule | null,
    cashbackBranchRules: {} as Record<string, CashbackRule | undefined>,
    /** Cada PUT de cashback, para conferir o corpo — é onde mora a armadilha. */
    cashbackPuts: [] as { escopo: 'rede' | 'filial'; body: Record<string, unknown> }[],
    /* As campanhas e o catálogo de arte. Duas listas, como no backend. */
    coupons: initialCoupons(RESTAURANT_ID),
    couponTemplates: initialCouponTemplates(),
    /** Corpo de cada POST/PATCH de cupom — onde se confere a trava da arte. */
    couponBodies: [] as { metodo: string; id: string | null; body: Record<string, unknown> }[],
    /*
     * O PAPEL DE QUEM ESTÁ LOGADO.
     *
     * Mora no estado, e não em `FAKE_USER`, porque o teste de papéis troca de
     * conta ANTES do login: o falso responde `/admin/auth/login` e
     * `/admin/auth/me` com o papel escolhido, que é a única coisa que muda
     * entre um lojista e outro para o painel.
     */
    papel: FAKE_USER.role,
    /*
     * A SENHA TEMPORÁRIA DE QUEM ENTROU. Mora no estado pelo mesmo motivo do
     * papel: o teste a liga ANTES do login, e ela sai no `admin_user` do login
     * e do `/me` — que é de onde o painel a lê.
     */
    senhaTemporaria: false,
    /* A senha que o login aceita AGORA. Ela muda quando a pessoa troca a
       própria senha — sem isso, o relogin automático da tela de troca não teria
       como passar, e o teste do primeiro acesso pararia no meio. */
    senhaDeLogin: LOGIN_PASSWORD,
    /** A equipe do restaurante, como o "banco" a tem. */
    adminUsers: initialAdminUsers(),
    adminUserBodies: [] as {
      metodo: string;
      id: string | null;
      body: Record<string, unknown>;
    }[],
    senhasGeradas: [] as string[],
    trocasDeSenha: [] as Record<string, unknown>[],
    printSectors: initialPrintSectors(BRANCH_ID),
    printAgents: initialPrintAgents(),
    printers: initialPrinters(),
    printTests: [] as { branchId: string; body: PrintTestRequest }[],
    /*
     * COMO A COMANDA SAI, por filial. O rodapé guarda os TRÊS estados de
     * verdade — `null` (herdando), `''` (esta loja recusou) e o texto —, que é
     * a única forma de o teste provar que a tela não confunde os dois vazios.
     */
    printSettings: {} as Record<
      string,
      {
        receipt_footer_message: string | null;
        print_customer_copies_delivery: number;
        print_production_copies_delivery: number;
        print_customer_copies_pickup: number;
        print_production_copies_pickup: number;
      }
    >,
    /** Cada corpo de PATCH .../print-settings, para conferir o que foi enviado. */
    printSettingsPatches: [] as { branchId: string; body: Record<string, unknown> }[],
    /** Cada PATCH .../delivery-pause, para o teste ler minutos e motivo. */
    pauseCalls: [] as { branchId: string; body: Record<string, unknown> }[],
    /** Cada PUT .../delivery-time-bands. */
    bandCalls: [] as { branchId: string; body: Record<string, unknown> }[],
    deliveryBands: {} as Record<
      string,
      {
        id: string;
        branch_id: string;
        max_distance_km: number;
        delivery_time_min: number;
        delivery_time_max: number;
      }[]
    >,
    productPatches: [] as { productId: string; body: Record<string, unknown> }[],
    /** Cada PATCH de setor na categoria inteira, para conferir o lote. */
    categorySectorCalls: [] as { categoryId: string; printSectorId: string | null }[],
    /** Cada PATCH de setor em UM produto, vindo da edição do item. */
    productSectorCalls: [] as { productId: string; printSectorId: string | null }[],
    customers: initialCustomers(),
    reviews: initialReviews(),
    /** A QUERY de cada GET /admin/reviews, na ordem em que chegou. */
    reviewQueries: [] as URLSearchParams[],
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
      /*
       * O PAR DO FRETE GRÁTIS PRECISA VOLTAR NA RESPOSTA, e ele já foi
       * esquecido aqui: sem eles a tela relia "herdando" logo depois de gravar
       * `false`, e a recusa da filial desaparecia sozinha no primeiro
       * recarregamento. É o campo que o falso não ecoa que mente sobre o
       * backend.
       */
      free_delivery_enabled: (gravado.free_delivery_enabled as boolean | null) ?? null,
      free_delivery_min_order_value:
        (gravado.free_delivery_min_order_value as number | null) ?? null,
    };

    return {
      branch_id: branch.id,
      branch_name: branch.display_name?.trim() || branch.name,
      is_open: dia.is_open,
      is_open_now: dia.is_open && dia.withinHours,
      accepts_delivery: dia.accepts_delivery,
      /*
       * `accepts_delivery_now` É A CHAVE JÁ DESCONTADA A PAUSA, e o falso o
       * calcula como o backend: comparando o carimbo com o relógio. Guardar um
       * booleano aqui faria a pausa não vencer sozinha — que é a única coisa
       * que a distingue de `accepts_delivery`.
       */
      accepts_delivery_now: dia.accepts_delivery && !pausaValendo(dia),
      ...(pausaValendo(dia)
        ? {
            delivery_paused_until: dia.deliveryPausedUntil,
            delivery_pause_reason: dia.deliveryPauseReason,
          }
        : {}),
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
        /*
         * A ENTREGA GRÁTIS entrou no `effective` numa rodada de entrega do
         * backend que este painel ainda não lê. Ela está aqui porque o contrato
         * a exige, e DESLIGADA, que é como a migração a cria: um falso que a
         * afirmasse ligada faria a tela ensaiar uma operação inexistente.
         */
        // `_ou_herdado`: o `false` da filial é uma ESCOLHA e não cai no padrão.
        free_delivery_enabled:
          overrides.free_delivery_enabled ?? padrao.free_delivery_enabled ?? false,
        free_delivery_min_order_value:
          overrides.free_delivery_min_order_value ?? padrao.free_delivery_min_order_value ?? null,
      },
    };
  }

  /** A pausa vale enquanto o prazo dela não venceu — o relógio decide. */
  function pausaValendo(dia: BranchDayState): boolean {
    if (!dia.deliveryPausedUntil) return false;
    return new Date(dia.deliveryPausedUntil).getTime() > Date.now();
  }

  function findOrder(orderId: string): OrderListItem | undefined {
    return state.orders.find((item) => item.id === orderId);
  }

  /**
   * O recorte de `GET /admin/orders`, compartilhado com `/status-counts`.
   *
   * O PERÍODO PASSOU A VALER AQUI, e ele não valia. Enquanto a listagem só
   * servia a Pedidos e à Cozinha — as duas abrem em "hoje" e a fixture inteira
   * era de hoje —, ignorar as datas não fazia diferença nenhuma. Deixou de ser
   * verdade quando o Desempenho passou a ler a HORA dos cancelamentos dessa
   * mesma rota: sem filtro de data, o falso devolveria pedidos de fora do
   * período e a leitura do gráfico sairia de uma amostra que o backend nunca
   * mandaria.
   *
   * O DIA É O DA OPERAÇÃO (America/Fortaleza), como no backend: um pedido das
   * 22h de sexta conta na sexta, não no sábado UTC.
   */
  function pedidosFiltrados(query: URLSearchParams): OrderListItem[] {
    const branchId = query.get('branch_id');
    const status = query.get('status');
    const inicio = query.get('start_date');
    const fim = query.get('end_date');
    const busca = query.get('search')?.trim().toLowerCase();

    return state.orders.filter((item) => {
      if (branchId && item.branch_id !== branchId) return false;
      if (status && item.status !== status) return false;

      const dia = operationDay(item.created_at);
      if (inicio && (!dia || dia < inicio)) return false;
      if (fim && (!dia || dia > fim)) return false;

      if (busca) {
        const digitos = busca.replace(/\D/g, '');
        const porNumero = digitos ? String(item.order_number).includes(digitos) : false;
        const porNome = item.customer_name_snapshot.toLowerCase().includes(busca);
        if (!porNumero && !porNome) return false;
      }

      return true;
    });
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
    state.streamConnections += 1;
    while (state.streamLog.length === cursor && !state.stopped && Date.now() < limite) {
      await sleep(50);
    }
    state.streamConnections -= 1;

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
      /* A senha que vale é sempre `state.senhaDeLogin` — inclusive com a marca
         de senha temporária ligada. A marca diz que a senha foi criada por
         outra pessoa, não que ela seja outra: quem entra é sempre o mesmo
         usuário do falso, e a senha dele muda quando ele a troca. */
      if (body.email !== LOGIN_EMAIL || body.password !== state.senhaDeLogin) {
        return json(route, 401, { detail: 'E-mail ou senha inválidos.' });
      }
      /*
       * O LOGIN ACEITA TODOS OS PAPÉIS, INCLUSIVE `print_agent` — e isso não é
       * descuido do falso: é o contrato. É por esta rota que o agente de
       * impressão se autentica com o e-mail e a senha do `config.ini`, e
       * recusá-lo aqui pararia a impressão de todas as lojas. Quem recusa a
       * conta de máquina é a TELA, depois do login.
       */
      return json(route, 200, {
        access_token: ACCESS_TOKEN,
        token_type: 'bearer',
        admin_user: {
          ...FAKE_USER,
          role: state.papel,
          must_change_password: state.senhaTemporaria,
        },
      });
    }

    if (method === 'GET' && path === '/admin/auth/me') {
      // O papel sai do banco a cada requisição, como no backend: rebaixar
      // alguém vale na hora, sem esperar o token de 12h expirar. A marca de
      // senha temporária vem junto, e pelo mesmo motivo.
      return json(route, 200, {
        ...FAKE_USER,
        role: state.papel,
        must_change_password: state.senhaTemporaria,
      });
    }

    /*
     * A TROCA DA PRÓPRIA SENHA — e as três recusas de `change_password`.
     *
     * Ela fica ACIMA da guarda de senha temporária logo abaixo porque é uma das
     * duas rotas que atravessam essa guarda. A outra é o `/me`, que já
     * respondeu.
     */
    if (method === 'PATCH' && path === '/admin/auth/password') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.trocasDeSenha.push(body);

      const atual = String(body.current_password ?? '');
      const nova = String(body.new_password ?? '');
      const confirmacao = String(body.confirm_password ?? '');

      /* A senha atual é a que o login aceita agora — a mesma variável, para os
         dois nunca discordarem. */
      if (atual !== state.senhaDeLogin) {
        return json(route, 400, { detail: 'Senha atual incorreta' });
      }
      if (nova !== confirmacao) {
        return json(route, 400, { detail: 'As senhas nao conferem' });
      }
      if (nova === atual) {
        return json(route, 400, { detail: 'A nova senha precisa ser diferente da atual' });
      }

      /*
       * TROCAR A SENHA DESLIGA A MARCA e revoga os tokens antigos. O falso
       * encena a primeira metade; a segunda é o painel refazer o login, e é por
       * isso que `LOGIN_PASSWORD` continua sendo a senha aceita no login — o
       * teste que fizer a troca precisa entrar de novo com a NOVA, então o
       * falso passa a aceitá-la.
       */
      state.senhaTemporaria = false;
      state.senhaDeLogin = nova;
      return json(route, 200, { message: 'Senha alterada. Entre de novo em todos os dispositivos.' });
    }

    /*
     * A REDE EMBAIXO — `_ensure_temporary_password_was_changed`.
     *
     * Com a senha temporária, TODA rota `/admin` que não seja o `me` e o PATCH
     * da senha responde 403. Ela existe aqui para provar o contrário do que
     * parece: o painel NÃO deve depender dela. Se a tela obedecesse o 403 em
     * vez do campo, o teste veria a tela de Pedidos abrir e só depois se
     * fechar — e é isso que a asserção do e2e recusa.
     */
    if (state.senhaTemporaria) {
      return json(route, 403, {
        detail: 'Troque a senha temporaria antes de usar o painel',
      });
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

    const pauseMatch = /^\/admin\/branches\/([^/]+)\/delivery-pause$/.exec(path);
    if (method === 'PATCH' && pauseMatch?.[1]) {
      const branchId = pauseMatch[1];
      const branch = state.branches.find((item) => item.id === branchId);
      if (!branch) return json(route, 404, { detail: 'Filial não encontrada.' });

      const body = request.postDataJSON() as { minutes: number; reason?: string | null };
      state.pauseCalls.push({ branchId, body });

      // Teto de 24h, como o backend: pausa de três dias é a chave estrutural
      // com passos a mais, e aí a distinção entre as duas deixa de existir.
      if (body.minutes > 24 * 60) {
        return json(route, 422, { detail: 'A pausa vai até 24 horas.' });
      }

      const atual = state.dayState[branchId] ?? initialDayState();
      state.dayState[branchId] =
        body.minutes <= 0
          ? // `0` retoma na hora — o botão de quem parou por 60 e resolveu em 20.
            { ...atual, deliveryPausedUntil: null, deliveryPauseReason: null }
          : {
              ...atual,
              deliveryPausedUntil: new Date(Date.now() + body.minutes * 60_000).toISOString(),
              deliveryPauseReason: body.reason?.trim() || null,
            };

      return json(route, 200, operationOf(branch));
    }

    const bandsMatch = /^\/admin\/branches\/([^/]+)\/delivery-time-bands$/.exec(path);
    if (bandsMatch?.[1]) {
      const branchId = bandsMatch[1];
      if (method === 'GET') {
        return json(route, 200, state.deliveryBands[branchId] ?? []);
      }
      if (method === 'PUT') {
        const body = request.postDataJSON() as {
          bands?: {
            max_distance_km: number;
            delivery_time_min: number;
            delivery_time_max: number;
          }[];
        };
        state.bandCalls.push({ branchId, body });

        /*
         * O BACKEND DEVOLVE ORDENADO POR TETO, e é essa ordem que a tela
         * repinta — a ordem que vale é a da regra ("a primeira faixa cujo teto
         * alcança"), não a de digitação.
         */
        state.deliveryBands[branchId] = [...(body.bands ?? [])]
          .sort((a, b) => a.max_distance_km - b.max_distance_km)
          .map((band, indice) => ({
            id: `faixa-${branchId}-${indice}`,
            branch_id: branchId,
            ...band,
          }));
        return json(route, 200, state.deliveryBands[branchId]);
      }
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
      const query = new URL(request.url()).searchParams;
      const items = pedidosFiltrados(query);
      /*
       * A PAGINAÇÃO É DE VERDADE, e passou a ser: `limit` e `offset` viravam
       * eco na resposta enquanto os itens vinham todos. Quem paga por isso é a
       * leitura de HORA do Desempenho, que percorre páginas até acabar
       * (`useCancellationHours`) — com uma página que ignora o `offset`, o laço
       * receberia a mesma lista para sempre e o falso esconderia um laço
       * infinito de produção.
       */
      const limit = Number(query.get('limit') ?? 100) || 100;
      const offset = Number(query.get('offset') ?? 0) || 0;

      return json(route, 200, {
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      });
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
        // `branch_id` só RESTRINGE: ausente = todas as filiais do token.
        return json(route, 200, initialSalesSummary(inicio, fim, query.get('branch_id') ?? ''));
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
     * Respeita filial, busca, os CINCO filtros e a paginação.
     *
     * A busca é "telefone (só dígitos) OU parte do nome", como o contrato
     * descreve: um termo só, dois critérios. Testar só o nome deixaria a busca
     * por telefone passar sem nunca ter rodado.
     *
     * ------------------------------------------------------------------------
     * A ORDEM AQUI É O CONTRATO, E É ELA QUE OS TESTES COBRAM
     * ------------------------------------------------------------------------
     *
     * Peneira primeiro, conta o que sobrou, e só então corta a página. É por
     * isso que `total` pode ser 3 com dois itens na resposta — e é exatamente o
     * que a tela não pode reproduzir por conta própria.
     *
     * Um falso que cortasse a página antes de filtrar passaria a mentir do mesmo
     * jeito que a tela mentiria se filtrasse o array recebido, e o teste que
     * existe para pegar esse erro passaria.
     *
     * OS DOIS 400 SÃO PARTE DO CONTRATO, não detalhe de implementação: intervalo
     * invertido (data ou ticket) é erro de quem chamou, e devolver lista vazia
     * deixaria o lojista procurando o cliente que sumiu da tela.
     */
    if (method === 'GET' && path === '/admin/customers') {
      const query = new URL(request.url()).searchParams;
      state.customerQueries.push(query);
      const branchId = query.get('branch_id');
      const search = (query.get('search') ?? '').trim().toLowerCase();
      const digits = search.replace(/\D/g, '');
      const limit = Number(query.get('limit') ?? 50);
      const offset = Number(query.get('offset') ?? 0);

      const segment = query.get('segment');
      const lastFrom = query.get('last_order_from');
      const lastTo = query.get('last_order_to');
      const minTicket = query.get('min_ticket');
      const maxTicket = query.get('max_ticket');

      if (lastFrom && lastTo && lastFrom > lastTo) {
        return json(route, 400, {
          detail: 'last_order_from nao pode ser depois de last_order_to.',
        });
      }
      if (minTicket !== null && maxTicket !== null && Number(minTicket) > Number(maxTicket)) {
        return json(route, 400, { detail: 'min_ticket nao pode ser maior que max_ticket.' });
      }

      const matching = state.customers.filter((item) => {
        if (branchId && CUSTOMER_BRANCH[item.customer_phone] !== branchId) return false;

        if (segment && item.segment !== segment) return false;

        if (lastFrom || lastTo) {
          // O dia da OPERAÇÃO, como o backend lê — não o dia do navegador.
          const dia = operationDay(item.last_order_at);
          if (dia === null) return false;
          if (lastFrom && dia < lastFrom) return false;
          // `last_order_to` é INCLUSIVO: o dia inteiro entra.
          if (lastTo && dia > lastTo) return false;
        }

        if (minTicket !== null && item.average_ticket < Number(minTicket)) return false;
        if (maxTicket !== null && item.average_ticket > Number(maxTicket)) return false;

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

    /*
     * ------------------------------------------------------------------------
     * GET /admin/reviews — e as DUAS propriedades do agregado que ele imita
     * ------------------------------------------------------------------------
     *
     * 1. **Total e média saem do HISTOGRAMA**, não de um `COUNT`/`AVG`
     *    paralelo. Um falso que os calculasse por outro caminho poderia
     *    concordar com a tela por acaso e esconder justamente o defeito que
     *    esta garantia existe para impedir.
     *
     * 2. **`max_rating` NÃO entra no agregado.** Ele recorta `items` e mais
     *    nada. Um falso que o aplicasse aos dois faria o teste da média que não
     *    desaba passar sem que a tela estivesse certa — seria o falso, e não o
     *    painel, sustentando a propriedade.
     *
     * O período recorta a data da AVALIAÇÃO (`created_at`), não a do pedido, e
     * a comparação é pelo dia da OPERAÇÃO — o mesmo cuidado de fuso da lista de
     * clientes.
     */
    if (method === 'GET' && path === '/admin/reviews') {
      const query = new URL(request.url()).searchParams;
      state.reviewQueries.push(query);

      const startDate = query.get('start_date');
      const endDate = query.get('end_date');
      const branchId = query.get('branch_id');
      const maxRating = query.get('max_rating');
      const limit = Number(query.get('limit') ?? 50);
      const offset = Number(query.get('offset') ?? 0);

      if (!startDate || !endDate) {
        return json(route, 422, { detail: 'start_date e end_date sao obrigatorios.' });
      }
      if (startDate > endDate) {
        return json(route, 400, { detail: 'end_date nao pode ser anterior a start_date' });
      }

      /** O período e a filial — o recorte que o agregado TAMBÉM enxerga. */
      const doPeriodo = state.reviews.filter((item) => {
        if (branchId && item.branch_id !== branchId) return false;
        const dia = operationDay(item.created_at);
        return dia !== null && dia >= startDate && dia <= endDate;
      });

      const byRating: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      const byProblemTag: Record<string, number> = {};
      doPeriodo.forEach((item) => {
        byRating[String(item.rating)] = (byRating[String(item.rating)] ?? 0) + 1;
        if (item.problem_tag) {
          byProblemTag[item.problem_tag] = (byProblemTag[item.problem_tag] ?? 0) + 1;
        }
      });

      const total = Object.values(byRating).reduce((soma, quantidade) => soma + quantidade, 0);
      const soma = Object.entries(byRating).reduce(
        (acumulado, [nota, quantidade]) => acumulado + Number(nota) * quantidade,
        0,
      );

      /* O filtro de nota entra AQUI, e só aqui. */
      const daLista = doPeriodo
        .filter((item) => maxRating === null || item.rating <= Number(maxRating))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      return json(route, 200, {
        items: daLista.slice(offset, offset + limit),
        summary: {
          total,
          // Período sem avaliação devolve `null`, e não 0.0.
          average: total === 0 ? null : Math.round((soma / total) * 100) / 100,
          by_rating: byRating,
          by_problem_tag: byProblemTag,
        },
      });
    }

    if (method === 'GET' && path === '/admin/orders/status-counts') {
      // O MESMO RECORTE DA LISTA. Contadores que ignorassem o período diriam
      // "Cancelados 4" em cima de uma lista de hoje sem nenhum cancelado — e o
      // lojista sairia procurando o pedido que a tela não mostra.
      const itens = pedidosFiltrados(new URL(request.url()).searchParams);
      const counts: Record<string, number> = {};
      itens.forEach((item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
      });
      return json(route, 200, {
        counts: Object.entries(counts).map(([status, count]) => ({ status, count })),
        total: itens.length,
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

      // `note` é o motivo da recusa: opcional no contrato, e é ele que faz o
      // histórico dizer POR QUE o pedido não saiu.
      const body = request.postDataJSON() as { status: string; note?: string };
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
        ...(body.note ? { note: body.note } : {}),
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

    // --- cashback ----------------------------------------------------------

    /*
     * AS CINCO ROTAS, e o falso reproduz a regra que a tela precisa acertar: a
     * leitura devolve `source`, e `source` é o que diz se salvar EDITA ou CRIA.
     *
     * O `PUT` é gravação inteira — não há merge com o que estava lá. É o que
     * torna este falso capaz de acusar um corpo montado errado: se a tela
     * mandasse os sete dias, o `weekdays` gravado teria sete linhas e o teste
     * veria isso.
     */
    /**
     * As recusas de escrita de cupom, na ORDEM do backend.
     *
     * A ordem importa e está no service: `_load_active_template` vem antes de
     * `_ensure_template_agrees`, e a checagem de código vem depois das duas.
     * Trocá-la aqui faria o e2e concordar com uma tela que aponta o campo
     * errado em produção.
     */
    function recusaDeCupom(body: Record<string, unknown>, ignorando: string | null) {
      const templateId = String(body.coupon_template_id ?? '');
      const arte = state.couponTemplates.find((item) => item.id === templateId);
      if (!arte) {
        return json(route, 400, { detail: 'Template de cupom invalido' });
      }

      if (arte.discount_type !== body.discount_type) {
        return json(route, 422, {
          detail: [
            {
              loc: ['body', 'discount_type'],
              msg: `Tipo de desconto do cupom (${String(body.discount_type)}) nao confere com o do template (${arte.discount_type})`,
              type: 'coupon_template_discount_type_mismatch',
            },
          ],
        });
      }

      /* `lower(trim(code))`: para o lojista, PROMO10 e promo10 são o mesmo. */
      const codigo = String(body.code ?? '')
        .trim()
        .toLowerCase();
      const donoDoCodigo = state.coupons.find(
        (item) => item.code.trim().toLowerCase() === codigo && item.id !== ignorando,
      );
      if (donoDoCodigo) {
        return json(route, 409, { detail: 'Codigo de cupom ja existe neste restaurante' });
      }

      const donoDaArte = state.coupons.find(
        (item) => item.coupon_template_id === templateId && item.id !== ignorando,
      );
      if (donoDaArte) {
        return json(route, 409, {
          detail: 'Esta arte ja esta em uso por outra campanha deste restaurante',
        });
      }

      return null;
    }

    function regraDaFilial(branchId: string): { source: string; rule: CashbackRule | null } {
      const propria = state.cashbackBranchRules[branchId];
      if (propria) return { source: 'branch', rule: propria };
      if (state.cashbackRestaurantRule) {
        return { source: 'restaurant', rule: state.cashbackRestaurantRule };
      }
      return { source: 'none', rule: null };
    }

    function regraGravada(body: Record<string, unknown>, branchId: string | null): CashbackRule {
      return {
        id: branchId ? `cb-${branchId}` : 'cb-rede',
        restaurant_id: 'rest-1',
        branch_id: branchId,
        enabled: Boolean(body.enabled),
        default_percent: String(body.default_percent ?? '0.00'),
        min_redeem_balance: String(body.min_redeem_balance ?? '0.00'),
        expiry_days: Number(body.expiry_days ?? 60),
        weekdays: (body.weekdays as CashbackWeekday[] | undefined) ?? [],
      };
    }

    if (path === '/admin/cashback-rules') {
      if (method === 'GET') {
        return json(
          route,
          200,
          state.cashbackRestaurantRule
            ? { source: 'restaurant', rule: state.cashbackRestaurantRule }
            : { source: 'none', rule: null },
        );
      }
      if (method === 'PUT') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.cashbackPuts.push({ escopo: 'rede', body });
        state.cashbackRestaurantRule = regraGravada(body, null);
        return json(route, 200, state.cashbackRestaurantRule);
      }
    }

    const cashbackMatch = /^\/admin\/branches\/([^/]+)\/cashback-rules$/.exec(path);
    if (cashbackMatch?.[1]) {
      const branchId = cashbackMatch[1];
      if (method === 'GET') return json(route, 200, regraDaFilial(branchId));
      if (method === 'PUT') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.cashbackPuts.push({ escopo: 'filial', body });
        state.cashbackBranchRules[branchId] = regraGravada(body, branchId);
        return json(route, 200, state.cashbackBranchRules[branchId]);
      }
      if (method === 'DELETE') {
        // 404 quando não havia sobrescrita: "voltou a herdar agora" e "já
        // herdava" são estados diferentes na tela.
        if (!state.cashbackBranchRules[branchId]) {
          return json(route, 404, { detail: 'Esta filial nao tem regra propria' });
        }
        delete state.cashbackBranchRules[branchId];
        return route.fulfill({ status: 204, body: '' });
      }
    }

    /* --- cupons -----------------------------------------------------------
     *
     * As três recusas do backend estão aqui porque são elas que a tela tem de
     * saber apontar, e nenhuma delas se encena com um 200:
     *
     *   400  arte desativada — e ela vem ANTES do 422 de tipo, de propósito
     *   409  código repetido, INCLUSIVE em outra caixa (`lower(trim(code))`)
     *   409  arte já em uso por outra campanha deste restaurante
     *
     * Os dois 409 têm mensagens diferentes porque apontam CAMPOS diferentes.
     * Quando não apontavam, quem esbarrava na arte repetida trocava o código,
     * tomava o mesmo erro e não tinha como sair do lugar.
     */

    if (path === '/admin/coupon-templates' && method === 'GET') {
      return json(route, 200, state.couponTemplates);
    }

    if (path === '/admin/coupons') {
      if (method === 'GET') return json(route, 200, state.coupons);

      if (method === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.couponBodies.push({ metodo: 'POST', id: null, body });

        const recusa = recusaDeCupom(body, null);
        if (recusa) return recusa;

        const criado: Coupon = {
          ...(body as unknown as Coupon),
          id: `cupom-novo-${state.coupons.length + 1}`,
          restaurant_id: RESTAURANT_ID,
          /* Zero sem ir ao banco: cupom que acabou de nascer não tem redenção. */
          total_usage_count: 0,
          created_at: new Date().toISOString(),
          updated_at: null,
        };

        state.coupons = [criado, ...state.coupons];
        return json(route, 201, criado);
      }
    }

    const cupomMatch = /^\/admin\/coupons\/([^/]+)$/.exec(path);
    if (cupomMatch?.[1] && method === 'PATCH') {
      const couponId = cupomMatch[1];
      const body = request.postDataJSON() as Record<string, unknown>;
      state.couponBodies.push({ metodo: 'PATCH', id: couponId, body });

      const atual = state.coupons.find((item) => item.id === couponId);
      if (!atual) return json(route, 404, { detail: 'Cupom nao encontrado' });

      /*
       * O BACKEND VALIDA A MESCLA, não o corpo. É por isso que um
       * `{ is_active: false }` numa campanha de arte desativada responde 400:
       * a arte conferida é a do RESULTADO, e ela continua sendo a que sumiu.
       */
      const mesclado: Coupon = { ...atual, ...(body as Partial<Coupon>) };
      const recusa = recusaDeCupom(mesclado as unknown as Record<string, unknown>, couponId);
      if (recusa) return recusa;

      const gravado: Coupon = { ...mesclado, updated_at: new Date().toISOString() };
      state.coupons = state.coupons.map((item) => (item.id === couponId ? gravado : item));
      return json(route, 200, gravado);
    }

    /* ======================================================================
     * A EQUIPE — e as guardas que a tela promete cumprir
     * =================================================================== */

    if (path === '/admin/users') {
      /* Sem query nenhuma: a rota devolve a equipe inteira, ativos e inativos,
         em ordem de cadastro. Quem recorta é a tela — e ela não recorta. */
      if (method === 'GET') return json(route, 200, state.adminUsers);

      if (method === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.adminUserBodies.push({ metodo: 'POST', id: null, body });

        const email = String(body.email ?? '').trim().toLowerCase();

        /* `print_agent` tem recusa PRÓPRIA, antes do Literal: o 422 do enum
           diria "Input should be 'owner', 'manager' or 'attendant'", que é
           verdadeiro e inútil para quem tentou. */
        if (body.role === 'print_agent') {
          return json(route, 422, {
            detail: [
              {
                loc: ['body', 'role'],
                msg: 'print_agent e conta de maquina e nasce so pelo scripts/create_admin_user.py',
                type: 'value_error',
              },
            ],
          });
        }

        /* O UNIQUE é GLOBAL e sobre `lower(email)`. A mensagem não diz de qual
           restaurante o e-mail é: qualquer resposta já revela que ele existe na
           plataforma, e o que esta esconde é ONDE. */
        if (state.adminUsers.some((item) => item.email.toLowerCase() === email)) {
          return json(route, 409, { detail: 'Este e-mail ja esta em uso' });
        }

        const senha = senhaTemporariaFalsa(state.senhasGeradas.length);
        state.senhasGeradas.push(senha);

        const criado: AdminUserDetail = {
          id: `user-novo-${state.adminUsers.length + 1}`,
          restaurant_id: RESTAURANT_ID,
          branch_id: (body.branch_id as string | null) ?? null,
          name: String(body.name ?? ''),
          email,
          role: String(body.role ?? 'attendant'),
          is_active: true,
          /* Nasce com a marca ligada: é o que fecha o painel para essa pessoa
             até ela escolher a própria senha. */
          must_change_password: true,
          password_changed_at: null,
          created_at: new Date().toISOString(),
        };

        state.adminUsers = [...state.adminUsers, criado];
        return json(route, 201, { admin_user: criado, temporary_password: senha });
      }
    }

    const usuarioMatch = /^\/admin\/users\/([^/]+)$/.exec(path);
    if (usuarioMatch?.[1] && method === 'PATCH') {
      const usuarioId = usuarioMatch[1];
      const body = request.postDataJSON() as Record<string, unknown>;
      state.adminUserBodies.push({ metodo: 'PATCH', id: usuarioId, body });

      const atual = state.adminUsers.find((item) => item.id === usuarioId);
      /* 404 e não 403 para quem não é pessoa deste restaurante: um 403
         confirmaria que aquele id existe. Vale também para a conta de máquina,
         que estas rotas não alcançam nem para ler. */
      if (!atual) return json(route, 404, { detail: 'Usuario nao encontrado' });

      if (body.role === 'print_agent') {
        return json(route, 422, {
          detail: [{ loc: ['body', 'role'], msg: 'print_agent e conta de maquina', type: 'value_error' }],
        });
      }

      /*
       * AS TRÊS GUARDAS, e as três respondem 400. A tela impede antes — estas
       * existem para o caso de a lista na mão estar velha, e para provar que a
       * tela realmente não chega aqui.
       */
      const desativando = body.is_active === false;
      if (desativando && atual.id === FAKE_USER.id) {
        return json(route, 400, { detail: 'Voce nao pode desativar a propria conta' });
      }

      const rebaixando = body.role !== undefined && body.role !== 'owner';
      const donosAtivos = state.adminUsers.filter(
        (item) => item.role === 'owner' && item.is_active,
      ).length;
      if (atual.role === 'owner' && atual.is_active && (desativando || rebaixando) && donosAtivos <= 1) {
        const acao = desativando ? 'desativar' : 'rebaixar';
        return json(route, 400, {
          detail: `Nao da para ${acao} o unico dono ativo do restaurante`,
        });
      }

      const gravado: AdminUserDetail = {
        ...atual,
        ...(body as Partial<AdminUserDetail>),
        /* Desativar grava `password_changed_at`: sem isso, reativar a pessoa
           depois ressuscitaria os tokens de 12h ainda dentro do prazo. */
        password_changed_at: desativando ? new Date().toISOString() : atual.password_changed_at,
      };
      state.adminUsers = state.adminUsers.map((item) => (item.id === usuarioId ? gravado : item));
      return json(route, 200, gravado);
    }

    const resetMatch = /^\/admin\/users\/([^/]+)\/reset-password$/.exec(path);
    if (resetMatch?.[1] && method === 'POST') {
      const usuarioId = resetMatch[1];
      state.adminUserBodies.push({ metodo: 'POST-reset', id: usuarioId, body: {} });

      const atual = state.adminUsers.find((item) => item.id === usuarioId);
      if (!atual) return json(route, 404, { detail: 'Usuario nao encontrado' });

      const senha = senhaTemporariaFalsa(state.senhasGeradas.length);
      state.senhasGeradas.push(senha);

      /* A marca volta a ligar e `password_changed_at` é regravado — é a linha
         que revoga todo token daquela pessoa, inclusive o ticket do stream. */
      const gravado: AdminUserDetail = {
        ...atual,
        must_change_password: true,
        password_changed_at: new Date().toISOString(),
      };
      state.adminUsers = state.adminUsers.map((item) => (item.id === usuarioId ? gravado : item));
      return json(route, 200, { admin_user: gravado, temporary_password: senha });
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

    // --- minha loja: a marca ----------------------------------------------

    /*
     * OUTRA TABELA, OUTRO PATCH. `/admin/settings` grava `restaurant_settings`,
     * o padrão que a filial herda; isto grava `restaurants`, a marca.
     *
     * `Object.assign` com o corpo é o que encena a EDIÇÃO PARCIAL do backend:
     * campo ausente não mexe (é assim que um texto legado acima do teto
     * sobrevive a um salvamento do outro campo), e `null` explícito apaga.
     */
    if (path === '/admin/restaurant') {
      if (method === 'GET') return json(route, 200, state.profile);
      if (method === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.profilePatches.push(body);

        // O 422 do teto, como o Pydantic o devolve: a tela tem de recusar
        // ANTES disto, e este ramo é o que prova que ela recusou.
        const acima = campoAcimaDoTeto(body);
        if (acima) {
          return json(route, 422, {
            detail: [{ loc: ['body', acima], msg: 'String should have at most N characters' }],
          });
        }

        Object.assign(state.profile, body);
        return json(route, 200, state.profile);
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

    // --- o programa de impressão -------------------------------------------
    //
    // Antes de `/admin/branches/{id}`, pelo mesmo motivo dos horários: o padrão
    // genérico casaria com estes três primeiro e devolveria uma filial no lugar
    // do estado do agente.

    const agentMatch = /^\/admin\/branches\/([^/]+)\/print-agent$/.exec(path);
    if (method === 'GET' && agentMatch?.[1]) {
      const branchId = agentMatch[1];
      const agent = state.printAgents[branchId];

      // Filial que nunca instalou responde 200 com o resto nulo, e não 404 —
      // "ninguém instalou aqui" é uma resposta, não um erro.
      if (!agent) return json(route, 200, { branch_id: branchId, is_online: false });

      const segundos = agent.secondsSinceLastSeen;
      return json(route, 200, {
        branch_id: branchId,
        // A MESMA janela de 90s do backend (`ONLINE_WINDOW_SECONDS`): o falso
        // decide o `is_online` como o servidor decide, porque a tela LÊ esse
        // campo em vez de recalcular a partir do carimbo.
        is_online: segundos <= 90,
        last_seen_at: new Date(Date.now() - segundos * 1000).toISOString(),
        seconds_since_last_seen: segundos,
        agent_version: agent.version,
      });
    }

    const printersMatch = /^\/admin\/branches\/([^/]+)\/printers$/.exec(path);
    if (method === 'GET' && printersMatch?.[1]) {
      const branchId = printersMatch[1];
      return json(route, 200, {
        branch_id: branchId,
        printers: state.printers[branchId] ?? [],
      });
    }

    /*
     * COMO A COMANDA SAI. Antes de `print-test` não importa (os caminhos são
     * distintos), mas depois de `printers` sim: todos começam com
     * `/admin/branches/{id}/`.
     */
    const printSettingsMatch = /^\/admin\/branches\/([^/]+)\/print-settings$/.exec(path);
    if (printSettingsMatch?.[1]) {
      const branchId = printSettingsMatch[1];
      const atual = state.printSettings[branchId] ?? {
        receipt_footer_message: null,
        // A migração faz as quatro nascerem em 1, inclusive a produção da
        // retirada: nascer em zero pararia a comanda da cozinha no deploy.
        print_customer_copies_delivery: 1,
        print_production_copies_delivery: 1,
        print_customer_copies_pickup: 1,
        print_production_copies_pickup: 1,
      };
      state.printSettings[branchId] = atual;

      if (method === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.printSettingsPatches.push({ branchId, body });

        /*
         * `exclude_unset` DE VERDADE: só o que veio no corpo é alterado. Com
         * `??` no lugar disto, `receipt_footer_message: null` viraria "não
         * mexe" e o falso passaria a mentir justamente sobre o estado que esta
         * rodada existe para acertar.
         */
        for (const chave of Object.keys(body)) {
          if (chave === 'receipt_footer_message') {
            const valor = body[chave];
            // O backend NORMALIZA na gravação: é isso que faz o valor devolvido
            // não ser byte a byte o enviado, e a tela ter de repintar o campo.
            atual.receipt_footer_message =
              typeof valor === 'string' ? valor.replace(/\t/g, ' ').trim() : null;
            continue;
          }
          const valor = body[chave];
          if (typeof valor !== 'number') {
            // `null` numa contagem é 422, e não "herda": as colunas são NOT NULL.
            return json(route, 422, {
              detail: [{ loc: ['body', chave], msg: 'a contagem de vias não pode ser nula' }],
            });
          }
          (atual as unknown as Record<string, number>)[chave] = valor;
        }
      }

      const marca = state.settings.receipt_footer_message ?? null;
      return json(route, 200, {
        branch_id: branchId,
        ...atual,
        // `_ou_herdado`: o vazio da filial é uma ESCOLHA e não cai no padrão.
        effective_receipt_footer_message:
          atual.receipt_footer_message !== null ? atual.receipt_footer_message : marca,
      });
    }

    const printTestMatch = /^\/admin\/branches\/([^/]+)\/print-test$/.exec(path);
    if (method === 'POST' && printTestMatch?.[1]) {
      const branchId = printTestMatch[1];
      const body = request.postDataJSON() as PrintTestRequest;
      state.printTests.push({ branchId, body });

      const agent = state.printAgents[branchId];
      return json(route, 202, {
        command_id: `cmd-${state.printTests.length}`,
        branch_id: branchId,
        created_at: new Date().toISOString(),
        // 202 é "enfileirado", não "impresso". Este campo é o que a tela usa
        // para não dizer "a via está saindo" quando o programa está desligado.
        agent_is_online: agent !== undefined && agent.secondsSinceLastSeen <= 90,
      });
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

    /*
     * O RECORTE É OPCIONAL AQUI, E O FALSO MANTÉM ISSO DE PROPÓSITO.
     *
     * O backend responde 200 sem `branch_id`, com o cardápio de todas as
     * filiais que o token alcança — que num restaurante de duas lojas é o
     * cardápio duas vezes. Fazer o falso exigir o parâmetro transformaria o
     * defeito num 422 barulhento e o teste passaria a provar outra coisa: o
     * que ele precisa provar é que a TELA manda o recorte, e isso só se prova
     * contra um falso que aceitaria não recebê-lo.
     */
    if (method === 'GET' && path === '/admin/categories') {
      const pedida = new URL(request.url()).searchParams.get('branch_id');
      return json(
        route,
        200,
        state.categories.filter((categoria) => !pedida || categoria.branch_id === pedida),
      );
    }

    /*
     * Antes de /admin/categories/{id}: "reorder" é rota, não id. Trocar a ordem
     * destes dois blocos faria a reordenação virar uma edição de categoria
     * chamada "reorder" — que é exatamente o bug que a ordem aqui previne.
     */
    if (method === 'PATCH' && path === '/admin/categories/reorder') {
      const body = request.postDataJSON() as { branch_id?: string; category_ids: string[] };
      state.reorderCalls.push({ branchId: body.branch_id, categoryIds: body.category_ids });

      // `branch_id` é OBRIGATÓRIO no corpo, e sem ele o backend responde 422 —
      // a lista completa de uma loja é parcial para a outra, e sem o recorte
      // não há como saber qual das duas a lista pretende ser.
      if (!body.branch_id) {
        return json(route, 422, {
          detail: [{ loc: ['body', 'branch_id'], msg: 'Field required', type: 'missing' }],
        });
      }
      const branchId = body.branch_id;

      /*
       * Renumera a partir da lista recebida, na ordem recebida — e SÓ dentro da
       * filial. As categorias das outras lojas ficam onde estão: uma
       * reordenação que as varresse do "banco" faria o falso esconder o bug de
       * quem manda a lista sem recorte, que é o oposto do que ele existe para
       * fazer.
       */
      const reordenadas = body.category_ids.flatMap((id, index) => {
        const found = state.categories.find(
          (category) => category.id === id && category.branch_id === branchId,
        );
        return found ? [{ ...found, sort_order: index }] : [];
      });
      state.categories = [
        ...state.categories.filter((category) => category.branch_id !== branchId),
        ...reordenadas,
      ];
      return json(route, 200, reordenadas);
    }

    if (method === 'POST' && path === '/admin/categories') {
      const body = request.postDataJSON() as {
        branch_id?: string;
        name: string;
        sort_order: number;
      };

      // Também obrigatório: não existe categoria da rede. A mesma categoria em
      // duas lojas são duas categorias, com dois ids.
      if (!body.branch_id) {
        return json(route, 422, {
          detail: [{ loc: ['body', 'branch_id'], msg: 'Field required', type: 'missing' }],
        });
      }

      const created: Category = {
        id: `cat-${state.categories.length + 1}-nova`,
        branch_id: body.branch_id,
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
      const branchId = query.get('branch_id');
      const categoryId = query.get('category_id');
      const search = (query.get('search') ?? '').toLowerCase();
      // Sem `branch_id` vêm os itens das duas lojas, pelo mesmo motivo das
      // categorias: é a resposta que o backend dá, e é o defeito que a tela
      // precisa não provocar.
      const matching = state.products.filter(
        (item) =>
          (!branchId || item.branch_id === branchId) &&
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

    /*
     * A NOVA ORDEM DOS PRODUTOS DE UMA CATEGORIA — e o falso RECUSA a lista
     * curta, como o backend.
     *
     * Ele podia aceitar e renumerar o que veio, e o e2e passaria igual. Mas a
     * regra que a tela precisa respeitar e justamente esta: com a busca ligada
     * ou com a paginacao cortando, a lista da tela e um recorte, e mandar o
     * recorte apaga a posicao de quem ficou de fora. Um falso permissivo aqui
     * esconderia exatamente o bug que `podeReordenarProdutos` existe para
     * impedir.
     */
    if (method === 'PATCH' && path === '/admin/products/reorder') {
      const body = request.postDataJSON() as { category_id: string; product_ids: string[] };
      state.productReorderCalls.push({
        categoryId: body.category_id,
        productIds: body.product_ids,
      });

      const daCategoria = state.products.filter((item) => item.category_id === body.category_id);
      if (daCategoria.length !== body.product_ids.length) {
        return json(route, 400, {
          detail: 'A lista precisa ter todos os produtos da categoria.',
        });
      }

      const reordenados = body.product_ids.flatMap((id, index) => {
        const found = daCategoria.find((item) => item.id === id);
        return found ? [Object.assign(found, { sort_order: index })] : [];
      });
      if (reordenados.length !== body.product_ids.length) {
        return json(route, 400, { detail: 'Produto de outra categoria na lista.' });
      }
      return json(route, 200, reordenados);
    }

    // Antes de /admin/products/{id}, pelo mesmo motivo do reorder.
    const availabilityMatch = /^\/admin\/products\/([^/]+)\/availability$/.exec(path);
    if (method === 'PATCH' && availabilityMatch?.[1]) {
      const found = state.products.find((item) => item.id === availabilityMatch[1]);
      if (!found) return json(route, 404, { detail: 'Produto não encontrado.' });

      /*
       * A FALHA DE UM ITEM SÓ — e ela existe porque a ação em massa da tela
       * NÃO É ATÔMICA: são N chamadas a esta rota, e três de cinco podem
       * gravar. É o caso que o e2e precisa exercitar, porque é o único em que
       * a tela tem de nomear quais itens ficaram para trás em vez de dizer
       * "deu erro".
       */
      if (state.failAvailabilityFor.has(found.id)) {
        return json(route, 500, { detail: 'Falha ao gravar a disponibilidade.' });
      }

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
        const body = request.postDataJSON() as Record<string, unknown>;
        /*
         * O CORPO É GUARDADO INTEIRO, e não só aplicado.
         *
         * É a única forma de um teste provar a AUSÊNCIA de um campo: `price` do
         * gerente não pode nem chegar ao backend — o contrato confere
         * `if payload.price is not None`, então reenviar o preço IGUAL ao que já
         * está gravado é 403 do mesmo jeito. Olhando só o produto resultante,
         * "não mandou" e "mandou o mesmo valor" seriam indistinguíveis.
         */
        state.productPatches.push({ productId: found.id, body });
        Object.assign(found, body);
        return json(route, 200, found);
      }
    }

    if (method === 'POST' && path === '/admin/products') {
      const body = request.postDataJSON() as Omit<Product, 'id' | 'branch_id'>;

      /*
       * A FILIAL VEM DA CATEGORIA, e o corpo não a traz. É a decisão do
       * backend: `category_id` já determina a loja, e pedir os dois abriria um
       * corpo em que eles podem discordar — cujo único desfecho seria um 400
       * que não precisa existir.
       */
      const categoria = state.categories.find((item) => item.id === body.category_id);
      if (!categoria) return json(route, 400, { detail: 'Categoria inválida.' });

      const created: Product = {
        ...body,
        id: `prod-${state.products.length + 1}-novo`,
        branch_id: categoria.branch_id,
      };
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
    categories: (branchId?: string) =>
      state.categories.filter((categoria) => !branchId || categoria.branch_id === branchId),
    product: (productId) => state.products.find((item) => item.id === productId),
    reorderCalls: () => state.reorderCalls,
    availabilityCalls: () => state.availabilityCalls,
    customerQueries: () => state.customerQueries,
    reviewQueries: () => state.reviewQueries,
    clearReviews() {
      state.reviews = [];
    },
    onlyHighReviews() {
      state.reviews = state.reviews.filter((item) => item.rating > 3);
    },
    imageUploads: () => state.imageUploads,
    cancelReasons: () => state.cancelReasons,
    settings: () => state.settings,
    settingsPatches: () => state.settingsPatches,
    profile: () => state.profile,
    profilePatches: () => state.profilePatches,
    setProfileTexts: (textos) => Object.assign(state.profile, textos),
    cashbackPuts: () => state.cashbackPuts,
    setCashbackRestaurantRule(rule) {
      state.cashbackRestaurantRule = rule;
    },
    setCashbackBranchRule(branchId, rule) {
      if (rule === null) delete state.cashbackBranchRules[branchId];
      else state.cashbackBranchRules[branchId] = rule;
    },
    coupons: () => state.coupons,
    adminUsers: () => state.adminUsers,
    setAdminUsers(usuarios) {
      state.adminUsers = usuarios;
    },
    adminUserBodies: () => state.adminUserBodies,
    senhasGeradas: () => state.senhasGeradas,
    entrarComSenhaTemporaria() {
      state.senhaTemporaria = true;
    },
    trocasDeSenha: () => state.trocasDeSenha,
    couponBodies: () => state.couponBodies,
    setCouponTemplates(templates) {
      state.couponTemplates = templates;
    },
    setCoupons(coupons) {
      state.coupons = coupons;
    },
    branchPatches: () => state.branchPatches,
    hoursPuts: () => state.hoursPuts,
    paymentMethods: () => state.paymentMethods,
    printSectors: () => state.printSectors,
    entrarComoPapel(papel) {
      state.papel = papel;
    },
    printTests: () => state.printTests,
    printSettingsPatches: () => state.printSettingsPatches,
    pauseCalls: () => state.pauseCalls,
    bandCalls: () => state.bandCalls,
    productPatches: () => state.productPatches,
    setPrintAgentSeconds(branchId, seconds) {
      state.printAgents[branchId] = {
        version: state.printAgents[branchId]?.version ?? null,
        secondsSinceLastSeen: seconds,
      };
    },
    categorySectorCalls: () => state.categorySectorCalls,
    productSectorCalls: () => state.productSectorCalls,
    products: () => state.products,
    catalogKeys: () =>
      Object.fromEntries(state.products.map((item) => [item.id, item.catalog_key ?? null])),
    clearPrepTimeBase(branchId) {
      state.prepTime[branchId] = null;
    },
    closeBranch(branchId) {
      state.closedBranches.add(branchId);
    },
    emptyReports() {
      state.reportsEmpty = true;
    },
    productReorderCalls: () => state.productReorderCalls,
    failAvailability(productId) {
      state.failAvailabilityFor.add(productId);
    },
    prepTimeOf: (branchId) => state.prepTime[branchId] ?? null,
    makeOrder: order,
    async waitForStream() {
      const limite = Date.now() + 10_000;
      while (state.streamConnections === 0 && !state.stopped && Date.now() < limite) {
        await sleep(20);
      }
    },
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
