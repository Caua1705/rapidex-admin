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
import type {
  OrderDetailWithOptions,
  OrderItemWithOptions,
  ProductCreateWithPrintSector,
  ProductUpdateWithPrintSector,
  ProductWithPrintSector,
} from './contract-pending';

type Schemas = components['schemas'];

export type AdminUser = Schemas['AdminUserResponse'];
export type LoginResponse = Schemas['AdminLoginResponse'];

export type OrderListItem = Schemas['AdminOrderListItem'];
export type OrderListResponse = Schemas['AdminOrderListResponse'];
/*
 * O detalhe e o item vêm do overlay, não do contrato gerado: o /openapi.json
 * publicado ainda não descreve o `option_groups` que o backend já manda. Ver
 * `contract-pending.ts` — quando ele sair, estes dois voltam a ser
 * `Schemas['OrderDetailResponse']` e `Schemas['OrderItemResponse']`.
 */
export type OrderDetail = OrderDetailWithOptions;
export type OrderItem = OrderItemWithOptions;
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

/*
 * O produto vem do overlay pelo mesmo motivo do detalhe do pedido: o
 * `print_sector_id` ainda não está no contrato publicado. Ver
 * `contract-pending.ts`, bloco 4 — e note que ali o setor é o único caso em que
 * a rota ainda NÃO existe do lado do backend.
 */
export type Product = ProductWithPrintSector;
export type ProductCreate = ProductCreateWithPrintSector;
export type ProductUpdate = ProductUpdateWithPrintSector;
export type ProductDetail = Schemas['AdminProductDetailResponse'];
export type ProductListResponse = Schemas['AdminProductListResponse'];
/** O grupo que vem no detalhe do produto — não o do cardápio público. */
export type ProductOptionGroup = Schemas['AdminOptionGroupResponse'];

// --- setores de impressão -----------------------------------------------

export type { PrintSector, PrintSectorCreate, PrintSectorUpdate } from './contract-pending';
