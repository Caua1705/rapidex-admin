/**
 * ============================================================================
 * O ESCOPO DE FILIAL, DECIDIDO EM UM LUGAR SÓ
 * ============================================================================
 *
 * "Todas as filiais" é um escopo VÁLIDO PARA LEITURA e INVÁLIDO PARA ESCRITA.
 * O painel tratava os dois casos igual, e o resultado era uma parede repetida:
 * Horários, Entrega, Pagamento e Filial respondiam com o mesmo cartão
 * ("Horários de funcionamento é de uma filial só. Escolha uma: [Matriz]
 * [Varjota]"), e o controle de preparo em Pedidos escrevia "escolha uma
 * filial" no lugar do valor. Quatro telas dizendo a mesma frase.
 *
 * Para o lojista isso não lê como regra do sistema. Lê como bug — ele pediu
 * uma tela e recebeu um formulário para preencher antes da tela.
 *
 * A CORREÇÃO É RESOLVER, NÃO BLOQUEAR: sem filial escolhida, o painel usa a
 * principal (`is_main`) e diz qual é. Trocar continua sendo pelo seletor do
 * topo, que é onde o lojista já espera.
 *
 * ----------------------------------------------------------------------------
 * O QUE SEPARA LEITURA DE ESCRITA ESTÁ NO CONTRATO, NÃO NO GOSTO DA TELA
 * ----------------------------------------------------------------------------
 *
 * Rota que recebe `branch_id` no PATH precisa de UMA filial: não existe id
 * para mandar, e salvar "todas" gravaria o mesmo valor em lojas diferentes.
 * Rota que recebe (ou omite) `branch_id` em QUERY entende vazio como "todas as
 * filiais que o token alcança" — ver §4.3 da skill de API.
 *
 * A tabela abaixo é essa leitura escrita por extenso, e é a ÚNICA no projeto.
 * Nenhuma tela reconfere: quem precisa da filial chama `useResolvedBranch()`
 * (um controle) ou `useAdoptedBranch()` (uma tela inteira), em
 * `auth/use-branch-scope.ts`.
 */
import type { paths } from '../api/generated/openapi';
import type { Branch } from '../api/types';
import { mainBranch } from './restaurant-label';
import { STORE_SECTIONS } from '../store/store-sections';

export type BranchScope =
  /** `branch_id` vazio (ou ausente) = todas as filiais que o token alcança. */
  | 'multi'
  /** `branch_id` vai no path: sem UMA filial escolhida não há o que chamar. */
  | 'single';

/**
 * As rotas `/admin` que o painel consome, e o escopo de cada uma.
 *
 * As chaves são conferidas contra `keyof paths` — o contrato gerado. Um nome
 * de rota errado aqui é erro de compilação, não um 404 na mão do lojista: foi
 * exatamente assim que `print-sectors` (que nunca existiu) passou despercebido
 * até chegar em produção como `printing-sectors`.
 */
export const ROUTE_BRANCH_SCOPE = {
  // --- LEITURA MULTI-FILIAL -------------------------------------------------
  // Vazio significa "todas as que eu enxergo". O backend já limita o escopo
  // pelo token, então não há filial de outro restaurante a proteger na tela.
  '/admin/orders': 'multi',
  '/admin/orders/status-counts': 'multi',
  '/admin/orders/stream': 'multi',
  '/admin/branches': 'multi',
  // Aceita `branch_id` em QUERY, então o seletor do topo funciona nela de
  // verdade: vazio lista todas as filiais que o token alcança.
  '/admin/customers': 'multi',

  /*
   * OS RELATÓRIOS SÃO 'multi' POR UM MOTIVO DIFERENTE DAS DE CIMA.
   *
   * As outras aceitam `branch_id` e entendem vazio como "todas". Estas seis
   * NÃO TÊM O PARÂMETRO: elas somam todas as filiais do token, sempre, e não
   * há como pedir uma. Para a tabela o efeito é o mesmo ('multi' = a tela
   * funciona com "todas as filiais" escolhida), mas a diferença importa na
   * tela: o seletor do topo continua visível e não muda nada nela, e é por
   * isso que `PerformancePage` escreve o escopo em vez de deixar o lojista
   * concluir que o filtro pegou.
   */
  '/admin/reports/summary': 'multi',
  '/admin/reports/sales-by-day': 'multi',
  '/admin/reports/payment-methods': 'multi',
  '/admin/reports/products': 'multi',
  '/admin/reports/cancellations': 'multi',
  '/admin/reports/commission': 'multi',
  // Estas três são do RESTAURANTE inteiro — não têm recorte de filial nenhum,
  // o que as deixa do lado que funciona com "todas" escolhida.
  '/admin/settings': 'multi',
  '/admin/categories': 'multi',
  '/admin/products': 'multi',

  // --- ESCRITA POR FILIAL ---------------------------------------------------
  // `{branch_id}` no path: é preciso escolher QUAL, dentro do que o token já
  // delimitou. É esta lista que faz uma tela resolver a filial em vez de pedi-la.
  '/admin/branches/{branch_id}': 'single',
  '/admin/branches/{branch_id}/business-hours': 'single',
  '/admin/branches/{branch_id}/payment-methods': 'single',
  '/admin/branches/{branch_id}/prep-time': 'single',
  '/admin/branches/{branch_id}/printing-sectors': 'single',
} as const satisfies Partial<Record<keyof paths, BranchScope>>;

/**
 * As TELAS que gravam por filial, derivadas de `STORE_SECTIONS`.
 *
 * Derivada, e não uma segunda lista escrita à mão: o campo `scope` da seção já
 * diz isso, e duas listas divergiriam na primeira seção nova. Cada uma destas
 * rotas consome pelo menos uma das rotas `single` da tabela acima.
 */
export const SINGLE_BRANCH_PATHS: readonly string[] = STORE_SECTIONS.filter(
  (secao) => secao.scope === 'branch',
).map((secao) => `/minha-loja/${secao.id}`);

/**
 * O escopo de uma tela do painel, pelo endereço dela.
 *
 * Quem usa é o seletor do topo: numa tela de escrita, "Todas as filiais" não é
 * uma opção que ele possa oferecer — escolhê-la levaria a um estado que a
 * própria tela desfaz no efeito seguinte, e o lojista veria o seletor piscar
 * de volta sozinho.
 */
export function branchScopeForPath(pathname: string): BranchScope {
  const normalizado = pathname.replace(/\/+$/, '');
  return SINGLE_BRANCH_PATHS.includes(normalizado) ? 'single' : 'multi';
}

/**
 * A filial sobre a qual se grava: a escolhida no topo ou, na falta dela, a
 * principal.
 *
 * O critério da falta é o de `mainBranch()` — o MESMO que já decide o nome do
 * restaurante no cabeçalho, importado em vez de recopiado.
 */
export function resolveBranch(
  branches: readonly Branch[],
  activeBranchId: string,
): Branch | null {
  const escolhida = branches.find((branch) => branch.id === activeBranchId);
  return escolhida ?? mainBranch(branches);
}
