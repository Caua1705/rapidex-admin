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
export type OrderStatusHistoryEntry = Schemas['StatusHistoryResponse'];
export type OrderStatusCountsResponse = Schemas['AdminOrderStatusCountsResponse'];
export type OrderStreamEvent = Schemas['AdminOrderStreamEvent'];
export type StreamTicket = Schemas['AdminStreamTicketResponse'];
export type Branch = Schemas['AdminBranchResponse'];

// --- cardápio -----------------------------------------------------------

export type Category = Schemas['AdminCategoryResponse'];
export type CategoryCreate = Schemas['AdminCategoryCreate'];
export type CategoryUpdate = Schemas['AdminCategoryUpdate'];

export type Product = Schemas['AdminProductResponse'];
export type ProductCreate = Schemas['AdminProductCreate'];
export type ProductUpdate = Schemas['AdminProductUpdate'];
export type ProductDetail = Schemas['AdminProductDetailResponse'];
export type ProductListResponse = Schemas['AdminProductListResponse'];
/** O grupo que vem no detalhe do produto — não o do cardápio público. */
export type ProductOptionGroup = Schemas['AdminOptionGroupResponse'];
