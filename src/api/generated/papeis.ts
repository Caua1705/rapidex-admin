/**
 * GERADO POR `npm run papeis:generate`. NÃO EDITE À MÃO.
 *
 * O mapa de PAPEL POR ROTA do backend, lido de
 * `tests/test_papeis_das_rotas.py` e `src/api/dependencies/admin_scope.py` do
 * repositório do backend. Ver `scripts/papeis-generate.mjs` para o porquê de
 * ele não sair do `openapi.json`: 200 virando 403 não muda o documento.
 *
 * Uma linha acrescentada aqui à mão some na próxima geração, e some em
 * silêncio — como no `openapi.d.ts` ao lado.
 *
 * Duas regras do backend NÃO cabem neste mapa, porque quem decide não é a rota:
 * o preço no PATCH de produto (o corpo decide) e o recorte de filial nos
 * relatórios (a query decide). As duas moram em `src/auth/permissions.ts`,
 * escritas à mão e com o motivo.
 */

import type { paths } from './openapi';

/** Os quatro papéis de `admin_users.role`. */
export type Papel = 'attendant' | 'manager' | 'owner' | 'print_agent';

/** Os conjuntos com nome que o backend usa em `Depends(exigir_papel(...))`. */
export type ConjuntoDePapeis =
  'SOMENTE_DONO' | 'GERENCIA' | 'PESSOAS' | 'AGENTE_DE_IMPRESSAO' | 'PESSOAS_E_AGENTE';

export const CONJUNTOS: Record<ConjuntoDePapeis, readonly Papel[]> = {
  SOMENTE_DONO: ['owner'],
  GERENCIA: ['owner', 'manager'],
  PESSOAS: ['owner', 'manager', 'attendant'],
  AGENTE_DE_IMPRESSAO: ['print_agent'],
  PESSOAS_E_AGENTE: ['owner', 'manager', 'attendant', 'print_agent'],
};

/**
 * Quem pode chamar cada rota `/admin`.
 *
 * `satisfies Partial<Record<keyof paths, ...>>` é o que trava o mapa contra o
 * contrato GERADO: um caminho que o backend renomeou vira erro de compilação
 * aqui, e não um botão escondido para sempre por apontar para uma rota que não
 * existe mais.
 */
export const PAPEL_POR_ROTA = {
  '/admin/branches': { GET: 'PESSOAS' },
  '/admin/branches/{branch_id}': { GET: 'PESSOAS', PATCH: 'GERENCIA' },
  '/admin/branches/{branch_id}/business-hours': { GET: 'PESSOAS', PUT: 'GERENCIA' },
  '/admin/branches/{branch_id}/cashback-rules': {
    DELETE: 'SOMENTE_DONO',
    GET: 'GERENCIA',
    PUT: 'SOMENTE_DONO',
  },
  '/admin/branches/{branch_id}/delivery-pause': { PATCH: 'PESSOAS' },
  '/admin/branches/{branch_id}/delivery-time-bands': { GET: 'PESSOAS', PUT: 'GERENCIA' },
  '/admin/branches/{branch_id}/order-types': { PATCH: 'GERENCIA' },
  '/admin/branches/{branch_id}/payment-methods': { GET: 'PESSOAS', POST: 'GERENCIA' },
  '/admin/branches/{branch_id}/prep-time': { PATCH: 'PESSOAS' },
  '/admin/branches/{branch_id}/print-agent': { GET: 'PESSOAS' },
  '/admin/branches/{branch_id}/print-settings': { GET: 'PESSOAS', PATCH: 'GERENCIA' },
  '/admin/branches/{branch_id}/print-test': { POST: 'PESSOAS' },
  '/admin/branches/{branch_id}/printers': { GET: 'GERENCIA' },
  '/admin/branches/{branch_id}/printing-sectors': { GET: 'PESSOAS', POST: 'GERENCIA' },
  '/admin/branches/{branch_id}/settings': { PATCH: 'SOMENTE_DONO' },
  '/admin/branches/{branch_id}/store-status': { PATCH: 'PESSOAS' },
  '/admin/branches/operation': { GET: 'PESSOAS' },
  '/admin/cashback-rules': { GET: 'GERENCIA', PUT: 'SOMENTE_DONO' },
  '/admin/categories': { GET: 'PESSOAS', POST: 'GERENCIA' },
  '/admin/categories/{category_id}': { PATCH: 'GERENCIA' },
  '/admin/categories/{category_id}/printing-sector': { PATCH: 'GERENCIA' },
  '/admin/categories/reorder': { PATCH: 'GERENCIA' },
  '/admin/coupons': { GET: 'GERENCIA', POST: 'SOMENTE_DONO' },
  '/admin/coupons/{coupon_id}': { PATCH: 'SOMENTE_DONO' },
  '/admin/customers': { GET: 'GERENCIA' },
  '/admin/option-groups/{group_id}': { PATCH: 'GERENCIA' },
  '/admin/option-groups/{group_id}/options': { POST: 'GERENCIA' },
  '/admin/options/{option_id}': { PATCH: 'GERENCIA' },
  '/admin/orders': { GET: 'PESSOAS' },
  '/admin/orders/{order_id}': { GET: 'PESSOAS' },
  '/admin/orders/{order_id}/cancel': { PATCH: 'GERENCIA' },
  '/admin/orders/{order_id}/print-jobs': { GET: 'PESSOAS_E_AGENTE' },
  '/admin/orders/{order_id}/status': { PATCH: 'PESSOAS' },
  '/admin/orders/status-counts': { GET: 'PESSOAS' },
  '/admin/orders/stream-ticket': { POST: 'PESSOAS_E_AGENTE' },
  '/admin/payment-methods/{method_id}': { DELETE: 'GERENCIA', PATCH: 'GERENCIA' },
  '/admin/print-agent/heartbeat': { POST: 'AGENTE_DE_IMPRESSAO' },
  '/admin/print-agent/printers': { POST: 'AGENTE_DE_IMPRESSAO' },
  '/admin/printing-sectors/{sector_id}': { PATCH: 'GERENCIA' },
  '/admin/products': { GET: 'PESSOAS', POST: 'SOMENTE_DONO' },
  '/admin/products/{product_id}': { GET: 'PESSOAS', PATCH: 'GERENCIA' },
  '/admin/products/{product_id}/availability': { PATCH: 'PESSOAS' },
  '/admin/products/{product_id}/image': { POST: 'GERENCIA' },
  '/admin/products/{product_id}/option-groups': { GET: 'PESSOAS', POST: 'GERENCIA' },
  '/admin/products/{product_id}/printing-sector': { PATCH: 'GERENCIA' },
  '/admin/products/reorder': { PATCH: 'GERENCIA' },
  '/admin/reports/cancellations': { GET: 'GERENCIA' },
  '/admin/reports/commission': { GET: 'SOMENTE_DONO' },
  '/admin/reports/payment-methods': { GET: 'GERENCIA' },
  '/admin/reports/products': { GET: 'GERENCIA' },
  '/admin/reports/sales-by-day': { GET: 'GERENCIA' },
  '/admin/reports/summary': { GET: 'GERENCIA' },
  '/admin/restaurant': { GET: 'PESSOAS', PATCH: 'SOMENTE_DONO' },
  '/admin/reviews': { GET: 'GERENCIA' },
  '/admin/settings': { GET: 'PESSOAS', PATCH: 'SOMENTE_DONO' },
} as const satisfies Partial<
  Record<
    keyof paths,
    Partial<Record<'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', ConjuntoDePapeis>>
  >
>;

/**
 * As rotas `/admin` que de propósito NÃO exigem papel, com o motivo lá.
 *
 * Login aceita TODOS os papéis, inclusive `print_agent` — é por ele que o
 * agente de impressão se autentica, e recusá-lo no backend pararia a impressão
 * de todas as lojas. Quem recusa a conta de máquina é a TELA, depois do login.
 */
export const SEM_EXIGENCIA_DE_PAPEL: readonly string[] = [
  'POST /admin/auth/login',
  'GET /admin/auth/me',
  'PATCH /admin/auth/password',
  'GET /admin/orders/stream',
];
