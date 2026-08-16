/**
 * Apelidos curtos para os tipos que vêm do OpenAPI.
 *
 * NADA aqui é escrito à mão: todos os campos saem de
 * `src/api/generated/openapi.d.ts`, que é gerado com `npm run api:generate`.
 * Este arquivo existe só para não espalhar
 * `components['schemas']['AdminOrderListItem']` pela tela inteira — se o
 * backend renomear um campo, o erro aparece no `npm run typecheck`.
 */
import type { components } from './generated/openapi';

type Schemas = components['schemas'];

export type AdminUser = Schemas['AdminUserResponse'];
export type LoginResponse = Schemas['AdminLoginResponse'];

export type OrderListItem = Schemas['AdminOrderListItem'];
export type OrderListResponse = Schemas['AdminOrderListResponse'];
export type OrderDetail = Schemas['OrderDetailResponse'];
export type OrderItem = Schemas['OrderItemResponse'];
/** Os adicionais escolhidos, congelados como estavam no cardápio. */
export type OrderItemOptionGroup = Schemas['OrderItemOptionGroupResponse'];
export type OrderItemOption = Schemas['OrderItemOptionResponse'];
export type OrderStatusHistoryEntry = Schemas['StatusHistoryResponse'];
export type OrderStatusCountsResponse = Schemas['AdminOrderStatusCountsResponse'];
export type OrderStreamEvent = Schemas['AdminOrderStreamEvent'];
export type StreamTicket = Schemas['AdminStreamTicketResponse'];
export type Branch = Schemas['AdminBranchResponse'];

// --- minha loja ---------------------------------------------------------

/** Configuração do RESTAURANTE inteiro, não da filial. */
export type RestaurantSettings = Schemas['AdminRestaurantSettingsResponse'];
export type RestaurantSettingsUpdate = Schemas['AdminRestaurantSettingsUpdate'];

/** Cadastro, localização e regras de entrega da filial, no mesmo PATCH. */
export type BranchUpdate = Schemas['AdminBranchUpdate'];

export type BusinessHour = Schemas['BusinessHourResponse'];
export type BusinessHourInput = Schemas['BusinessHourInput'];

/**
 * O que o PATCH de tempo de preparo devolve.
 *
 * É a LINHA DE HORÁRIO do dia, não um objeto só com a faixa: o prazo de preparo
 * mora junto do horário de funcionamento, e o backend responde a linha inteira.
 * Por isso `prep_time_min`/`max` são anuláveis aqui — a filial pode ter horário
 * gravado e ainda não ter faixa. Quem formata trata esse caso.
 */
export type PrepTimeResponse = Schemas['BusinessHourResponse'];

export type PaymentMethod = Schemas['AdminPaymentMethodResponse'];
export type PaymentMethodCreate = Schemas['AdminPaymentMethodCreate'];
export type PaymentMethodUpdate = Schemas['AdminPaymentMethodUpdate'];
/** `online` (gateway) ou `delivery` (dinheiro entra na entrega). */
export type PaymentFlow = PaymentMethod['payment_flow'];
export type PaymentMethodType = PaymentMethod['method_type'];

// --- cardápio -----------------------------------------------------------

export type Category = Schemas['AdminCategoryResponse'];
export type CategoryCreate = Schemas['AdminCategoryCreate'];
export type CategoryUpdate = Schemas['AdminCategoryUpdate'];

export type Product = Schemas['AdminProductResponse'];
/*
 * Nem `AdminProductCreate` nem `AdminProductUpdate` têm `printing_sector_id`:
 * o setor de um produto só muda por `PATCH /admin/products/{id}/printing-sector`
 * (ver `api/print-sectors.ts`). A RESPOSTA traz o campo — é por isso que a
 * lista do cardápio consegue mostrar a coluna de setor.
 */
export type ProductCreate = Schemas['AdminProductCreate'];
export type ProductUpdate = Schemas['AdminProductUpdate'];
export type ProductDetail = Schemas['AdminProductDetailResponse'];
export type ProductListResponse = Schemas['AdminProductListResponse'];
/** O grupo que vem no detalhe do produto — não o do cardápio público. */
export type ProductOptionGroup = Schemas['AdminOptionGroupResponse'];
/** Uma opção de um grupo de complemento. */
export type ProductOption = Schemas['AdminOptionResponse'];
export type ProductOptionUpdate = Schemas['AdminOptionUpdate'];
/** O caminho e a URL da foto recém-enviada. */
export type ProductImage = Schemas['ProductImageResponse'];

// --- clientes -------------------------------------------------------------

/*
 * O item da lista NÃO tem id: a chave do agrupamento é o telefone, e é assim
 * que o backend devolve (`AdminCustomerListItem`). Também não vêm e-mail, CPF
 * nem id de cadastro — a descrição da rota diz que são dados da conta global
 * da plataforma, não do relacionamento com esta loja.
 */
export type CustomerListItem = Schemas['AdminCustomerListItem'];
export type CustomerListResponse = Schemas['AdminCustomerListResponse'];

// --- relatórios (Desempenho) ----------------------------------------------

/*
 * NENHUMA destas rotas aceita `branch_id`: elas somam todas as filiais que o
 * token alcança. É por isso que a tela diz isso por escrito — ver
 * `PerformancePage`.
 *
 * `PaymentMethodsResponse` vem com o namespace inteiro no nome porque existem
 * DUAS respostas com esse nome no contrato (a do relatório e a da configuração
 * de formas de pagamento da filial), e o gerador desempata pelo caminho do
 * módulo Python. Encurtar aqui é justamente o trabalho deste arquivo.
 */
export type SalesSummary = Schemas['SalesSummaryResponse'];
export type SalesByDay = Schemas['SalesByDayResponse'];
export type SalesByDayItem = Schemas['SalesByDayItem'];
export type MetricComparison = Schemas['MetricComparison'];
export type OrderTypeSplitItem = Schemas['OrderTypeSplitItem'];
export type ReportPaymentMethods = Schemas['src__schemas__admin_report_schema__PaymentMethodsResponse'];
export type ProductSales = Schemas['ProductSalesResponse'];
export type Cancellations = Schemas['CancellationsResponse'];
export type CommissionReport = Schemas['CommissionReportResponse'];

// --- setores de impressão -----------------------------------------------

/*
 * Apelidos curtos, como o resto do arquivo: no contrato eles são
 * `PrintingSector*`. O id do setor no produto é `printing_sector_id`.
 */
export type PrintSector = Schemas['PrintingSectorResponse'];
export type PrintSectorCreate = Schemas['PrintingSectorCreate'];
export type PrintSectorUpdate = Schemas['PrintingSectorUpdate'];
/** Corpo de "apontar para um setor", igual para produto e para categoria. */
export type PrintSectorRequest = Schemas['ProductPrintingSectorRequest'];
export type ProductPrintSector = Schemas['ProductPrintingSectorResponse'];
export type CategoryPrintSectorResult = Schemas['CategoryPrintingSectorResponse'];
