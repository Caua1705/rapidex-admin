/**
 * ARQUIVO TEMPORÁRIO — apague quando o /openapi.json publicar estas rotas.
 *
 * Em 2026-08-08, `npm run api:generate` contra
 * https://api.pederapidex.com/openapi.json NÃO traz nada disto:
 *
 *   - PATCH /admin/orders/{order_id}/cancel
 *   - PATCH /admin/branches/{branch_id}/prep-time
 *   - `option_groups` dentro de OrderItemResponse
 *
 * O painel inteiro é tipado a partir do contrato gerado (ver README) — chamar
 * uma rota que não está lá é erro de compilação, e é assim que tem que ser.
 * Como o backend já entregou as três coisas mas o contrato publicado ainda não
 * as descreve, elas ficam declaradas AQUI, num arquivo só, escritas à mão e
 * marcadas como tal. Nada de tipo inventado espalhado pelas telas.
 *
 * COMO SUMIR COM ESTE ARQUIVO:
 *   1. `npm run api:generate`
 *   2. `npm run typecheck` — as asserções no fim deste arquivo passam a FALHAR
 *      de propósito assim que o contrato gerado ganhar cada rota.
 *   3. Apague o pedaço correspondente daqui e ajuste os apelidos em `types.ts`.
 */
import type { components, paths as generatedPaths } from './generated/openapi';

type Schemas = components['schemas'];

// --- 1. Cancelar pedido com motivo --------------------------------------

/** Motivo obrigatório, 3 a 300 caracteres. Os limites são do backend. */
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 300;

export type OrderCancelRequest = {
  reason: string;
};

// --- 2. Ajuste do tempo de preparo --------------------------------------

/**
 * Dois corpos na mesma rota: o empurrão relativo (o uso do dia a dia) e a
 * gravação da base, que só acontece quando o backend recusa o empurrão por
 * não ter faixa gravada ainda.
 */
export type PrepTimeAdjustRequest = { delta_minutes: number };
export type PrepTimeBaseRequest = { prep_time_min: number; prep_time_max: number };
export type PrepTimeRequest = PrepTimeAdjustRequest | PrepTimeBaseRequest;

/** A resposta já traz a faixa ajustada — a tela não faz segunda chamada. */
export type PrepTimeResponse = {
  prep_time_min: number;
  prep_time_max: number;
};

// --- 3. Adicionais escolhidos, dentro do item do pedido ------------------

/**
 * Cada item traz `option_groups`, cada grupo traz `options`, e a opção tem
 * `additional_price_snapshot`.
 *
 * O rótulo do grupo é `option_group_name_snapshot` — CONFIRMADO pelo backend,
 * e não a suposição `group_name_snapshot` que este arquivo carregava antes.
 * O `name` continua declarado como alternativa porque quem lê passa por
 * `readOptionGroups` (order-options.ts), que resolve o nome do campo num lugar
 * só: é lá, numa linha, que se conserta qualquer divergência futura.
 */
export type OrderItemOptionSnapshot = {
  id?: string | null;
  option_id?: string | null;
  /** Rótulo da opção: "Espaguete", "Bacon". */
  option_name_snapshot?: string | null;
  name?: string | null;
  /** Só para conferência: já está embutido no unit_price_snapshot do item. */
  additional_price_snapshot?: number | string | null;
  quantity?: number | null;
};

export type OrderItemOptionGroupSnapshot = {
  id?: string | null;
  option_group_id?: string | null;
  /** Rótulo do grupo: "Acompanhamento", "Adicional". */
  option_group_name_snapshot?: string | null;
  name?: string | null;
  options?: OrderItemOptionSnapshot[] | null;
};

/** O item do pedido como ele vem HOJE, mais os adicionais. */
export type OrderItemWithOptions = Schemas['OrderItemResponse'] & {
  option_groups?: OrderItemOptionGroupSnapshot[] | null;
};

/** O detalhe do pedido com os itens já enriquecidos. */
export type OrderDetailWithOptions = Omit<Schemas['OrderDetailResponse'], 'items'> & {
  items: OrderItemWithOptions[];
};

// --- as rotas, no formato que o openapi-fetch entende --------------------

type JsonBody<T> = { content: { 'application/json': T } };
type JsonOk<T> = { 200: { headers: Record<string, unknown>; content: { 'application/json': T } } };

export type PendingPaths = {
  '/admin/orders/{order_id}/cancel': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: { 'Idempotency-Key'?: string };
        path: { order_id: string };
        cookie?: never;
      };
      requestBody: JsonBody<OrderCancelRequest>;
      responses: JsonOk<OrderDetailWithOptions>;
    };
    trace?: never;
  };
  '/admin/branches/{branch_id}/prep-time': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: { branch_id: string };
        cookie?: never;
      };
      requestBody: JsonBody<PrepTimeRequest>;
      responses: JsonOk<PrepTimeResponse>;
    };
    trace?: never;
  };
};

// --- o alarme que manda apagar este arquivo ------------------------------

/**
 * `true` enquanto a rota NÃO existir no contrato gerado.
 *
 * No dia em que `npm run api:generate` trouxer a rota, o tipo vira `never`, a
 * constante abaixo para de compilar e o `npm run typecheck` falha apontando
 * para cá. É de propósito: sem isso, este arquivo sobreviveria anos depois de
 * ter virado uma cópia desatualizada do contrato de verdade.
 */
type StillMissing<Path extends string> = Path extends keyof generatedPaths ? never : true;

const _apagarQuandoOContratoTiverCancel: StillMissing<'/admin/orders/{order_id}/cancel'> = true;
const _apagarQuandoOContratoTiverPrepTime: StillMissing<'/admin/branches/{branch_id}/prep-time'> = true;

// Consome as constantes para elas não caírem como variáveis não usadas.
export const PENDING_CONTRACT_STILL_NEEDED =
  _apagarQuandoOContratoTiverCancel && _apagarQuandoOContratoTiverPrepTime;
