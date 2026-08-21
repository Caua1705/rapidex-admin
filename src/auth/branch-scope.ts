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
  /**
   * Sem UMA filial escolhida não há o que chamar.
   *
   * Eram só as rotas com `{branch_id}` no PATH. Hoje também são as que exigem
   * a filial no CORPO — `POST /admin/categories` e
   * `PATCH /admin/categories/reorder` respondem 422 sem ela. O que define o
   * escopo não é onde o campo viaja, é não haver chamada possível sem ele.
   */
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
  // Esta é do RESTAURANTE inteiro — não tem recorte de filial nenhum, o que a
  // deixa do lado que funciona com "todas" escolhida.
  '/admin/settings': 'multi',

  // --- ESCRITA POR FILIAL ---------------------------------------------------
  // `{branch_id}` no path: é preciso escolher QUAL, dentro do que o token já
  // delimitou. É esta lista que faz uma tela resolver a filial em vez de pedi-la.
  /*
   * O CARDÁPIO MUDOU DE LADO NESTA TABELA, e é a mudança que mais explica a
   * tela.
   *
   * Ele já foi do restaurante inteiro: uma categoria valia nas duas lojas e a
   * única coisa de filial na tela era a coluna de impressão. Deixou de ser.
   * Cada filial tem os próprios produtos, os próprios preços e as próprias
   * categorias, sem herança entre elas.
   *
   * As duas de leitura ACEITAM a filial em query, e é aí que mora a armadilha
   * que trouxe estas linhas para cá: sem o parâmetro elas respondem 200 com o
   * cardápio das duas lojas somado — "Promoções 10 / Promoções 10" na barra de
   * categorias, cada item duas vezes na lista. Não é erro, é a resposta certa
   * para a pergunta errada, e por isso nada acende. Classificá-las como
   * 'multi' seria dizer que essa soma é um estado que a tela oferece.
   *
   * As de escrita fecham a conta: sem filial não há corpo válido a mandar.
   */
  '/admin/categories': 'single',
  '/admin/products': 'single',

  '/admin/branches/{branch_id}': 'single',
  '/admin/branches/{branch_id}/business-hours': 'single',
  '/admin/branches/{branch_id}/payment-methods': 'single',
  '/admin/branches/{branch_id}/prep-time': 'single',
  '/admin/branches/{branch_id}/printing-sectors': 'single',

  /*
   * O PROGRAMA DE IMPRESSÃO É DE UMA MÁQUINA, e máquina não tem versão "de
   * todas as filiais": o computador está numa loja só. As três levam
   * `{branch_id}` no path pelo mesmo motivo dos horários, e o backend recusa
   * até o AGENTE que não esteja preso a uma filial (400) — um agente que
   * pudesse escolher a loja se anunciaria como outra e receberia os comandos
   * dela.
   */
  '/admin/branches/{branch_id}/print-agent': 'single',
  '/admin/branches/{branch_id}/printers': 'single',
  '/admin/branches/{branch_id}/print-test': 'single',
} as const satisfies Partial<Record<keyof paths, BranchScope>>;

/**
 * As TELAS que falam de UMA filial, derivadas de `STORE_SECTIONS`.
 *
 * Derivada, e não uma segunda lista escrita à mão: o campo `scope` da seção já
 * diz isso, e duas listas divergiriam na primeira seção nova. Cada uma destas
 * rotas consome pelo menos uma das rotas `single` da tabela acima.
 *
 * O CARDÁPIO ENTRA À MÃO porque não é uma seção de Minha loja — é rota própria,
 * e a lista derivada não tem como alcançá-la. Ele está aqui pelo mesmo motivo
 * que as outras: o cardápio é de uma loja, e "Todas as filiais" nesta tela não
 * é um recorte mais largo, é o cardápio das duas somado.
 */
export const SINGLE_BRANCH_PATHS: readonly string[] = [
  ...STORE_SECTIONS.filter((secao) => secao.scope === 'branch').map(
    (secao) => `/minha-loja/${secao.id}`,
  ),
  '/cardapio',
];

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
export function resolveBranch(branches: readonly Branch[], activeBranchId: string): Branch | null {
  const escolhida = branches.find((branch) => branch.id === activeBranchId);
  return escolhida ?? mainBranch(branches);
}
