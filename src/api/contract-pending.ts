/**
 * ARQUIVO TEMPORÁRIO — apague quando o /openapi.json publicar estas rotas.
 *
 * Em 2026-08-08, `npm run api:generate` contra
 * https://api.pederapidex.com/openapi.json NÃO traz nada disto:
 *
 *   - PATCH /admin/orders/{order_id}/cancel
 *   - PATCH /admin/branches/{branch_id}/prep-time
 *   - `option_groups` dentro de OrderItemResponse
 *   - tudo de SETOR DE IMPRESSÃO (ver o aviso no bloco 4)
 *
 * O painel inteiro é tipado a partir do contrato gerado (ver README) — chamar
 * uma rota que não está lá é erro de compilação, e é assim que tem que ser.
 * Como o backend já entregou as três primeiras mas o contrato publicado ainda
 * não as descreve, elas ficam declaradas AQUI, num arquivo só, escritas à mão e
 * marcadas como tal. Nada de tipo inventado espalhado pelas telas.
 *
 * OS BLOCOS NÃO TÊM TODOS O MESMO GRAU DE CONFIANÇA. Os três primeiros
 * descrevem rotas que EXISTEM e foram exercitadas; o quarto descreve rota que
 * AINDA NÃO EXISTE do outro lado. Cada bloco diz em que pé está.
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

// --- 4. Setores de impressão --------------------------------------------

/**
 * ATENÇÃO — ESTE BLOCO É DIFERENTE DOS TRÊS DE CIMA.
 *
 * Os outros descrevem rotas que o backend JÁ TEM e que o /openapi.json ainda
 * não publicou. Este descreve rota que **ainda não existe do outro lado**: em
 * 2026-08-09 o backend não tem tabela de setor, não tem `print_sector_id` em
 * `products` e não tem nenhuma destas rotas. Foi conferido no modelo
 * (`src/models/`, sem arquivo de setor) e em `product_model.py`.
 *
 * A forma abaixo foi combinada com o time e segue a convenção que o resto da
 * API já usa para recurso de filial (as formas de pagamento são o molde:
 * `GET/POST /admin/branches/{id}/...` e `PATCH /admin/<recurso>/{id}`).
 *
 * ENQUANTO O BACKEND NÃO SUBIR, a tela compila, monta e chama — e recebe 404.
 * É o esperado, e não um bug do painel. O que ela NÃO faz é inventar dado: sem
 * as rotas, a aba mostra o erro que vier da API.
 */
export type PrintSector = {
  id: string;
  branch_id: string;
  name: string;
  /** Desativar é o substituto de excluir, como no cardápio. */
  is_active: boolean;
  sort_order: number;
};

export type PrintSectorCreate = {
  name: string;
  is_active?: boolean;
  sort_order?: number;
};

/** Renomear e desativar. `branch_id` não muda: setor pertence a uma filial. */
export type PrintSectorUpdate = {
  name?: string;
  is_active?: boolean;
  sort_order?: number;
};

/**
 * O corpo do "aplicar a todos os produtos da categoria".
 *
 * `null` é um valor legítimo aqui: significa "não imprimir", e é como se limpa
 * o setor de uma categoria inteira. Por isso o campo é obrigatório no corpo —
 * omiti-lo e mandá-lo nulo teriam que significar coisas diferentes, e um corpo
 * vazio não diz qual das duas o lojista quis.
 */
export type CategoryPrintSectorRequest = {
  print_sector_id: string | null;
};

/** Quantos produtos a aplicação em lote alterou. */
export type CategoryPrintSectorResponse = {
  updated_count: number;
};

/**
 * O produto com o setor. `null`/ausente = não imprime.
 *
 * O setor é POR FILIAL e o produto é do RESTAURANTE — quem cruza os dois é a
 * tela, que só oferece os setores da filial aberta no cabeçalho.
 */
export type ProductWithPrintSector = Schemas['AdminProductResponse'] & {
  print_sector_id?: string | null;
};

export type ProductUpdateWithPrintSector = Schemas['AdminProductUpdate'] & {
  print_sector_id?: string | null;
};

export type ProductCreateWithPrintSector = Schemas['AdminProductCreate'] & {
  print_sector_id?: string | null;
};

// --- as rotas, no formato que o openapi-fetch entende --------------------

type JsonBody<T> = { content: { 'application/json': T } };
type JsonOk<T> = { 200: { headers: Record<string, unknown>; content: { 'application/json': T } } };
/** POST pode responder 200 ou 201; declarar os dois evita depender de qual. */
type JsonOkOrCreated<T> = JsonOk<T> & {
  201: { headers: Record<string, unknown>; content: { 'application/json': T } };
};

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

  /*
   * Setores de impressão. Note que os PRODUTOS não aparecem aqui: as rotas
   * deles já existem no contrato gerado, e declará-las de novo faria a
   * interseção `paths & PendingPaths` sobrescrever os outros verbos com
   * `never`. O `print_sector_id` do produto entra pelo TIPO do corpo
   * (ProductUpdateWithPrintSector), não por uma segunda declaração de rota.
   */
  '/admin/branches/{branch_id}/print-sectors': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: { branch_id: string };
        cookie?: never;
      };
      requestBody?: never;
      responses: JsonOk<PrintSector[]>;
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: { branch_id: string };
        cookie?: never;
      };
      requestBody: JsonBody<PrintSectorCreate>;
      responses: JsonOkOrCreated<PrintSector>;
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/print-sectors/{sector_id}': {
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
        path: { sector_id: string };
        cookie?: never;
      };
      requestBody: JsonBody<PrintSectorUpdate>;
      responses: JsonOk<PrintSector>;
    };
    trace?: never;
  };
  '/admin/categories/{category_id}/print-sector': {
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
        path: { category_id: string };
        cookie?: never;
      };
      requestBody: JsonBody<CategoryPrintSectorRequest>;
      responses: JsonOk<CategoryPrintSectorResponse>;
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
const _apagarQuandoOContratoTiverSetores: StillMissing<'/admin/branches/{branch_id}/print-sectors'> = true;
const _apagarQuandoOContratoTiverSetorDaCategoria: StillMissing<'/admin/categories/{category_id}/print-sector'> = true;

// Consome as constantes para elas não caírem como variáveis não usadas.
export const PENDING_CONTRACT_STILL_NEEDED =
  _apagarQuandoOContratoTiverCancel &&
  _apagarQuandoOContratoTiverPrepTime &&
  _apagarQuandoOContratoTiverSetores &&
  _apagarQuandoOContratoTiverSetorDaCategoria;
