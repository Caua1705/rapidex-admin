/**
 * ============================================================================
 * O QUE CADA PAPEL PODE APERTAR — a ponte entre o botão e a rota
 * ============================================================================
 *
 * Desde a revisão `20260814_0020` do backend, o papel do lojista decide
 * autorização em 62 rotas `/admin`, e a restrição está EM PRODUÇÃO. O painel
 * não sabia: o atendente via botões que ele não podia apertar e levava 403 ao
 * clicar. Do ponto de vista de quem está no balcão, isso não lê como "acesso
 * restrito" — lê como sistema quebrado.
 *
 * ----------------------------------------------------------------------------
 * ESTE ARQUIVO NÃO DECIDE NADA. ELE TRADUZ.
 * ----------------------------------------------------------------------------
 *
 * Quem decide é `api/generated/papeis.ts`, GERADO da auditoria de papéis do
 * backend (`npm run papeis:generate`). O que mora aqui é a única coisa que o
 * backend não tem como saber: **qual botão do painel chama qual rota**.
 *
 *     botão "Novo item"  →  POST /admin/products  →  SOMENTE_DONO
 *     └── a tela sabe ──┘   └── isto é gerado ──┘
 *
 * A ponte é escrita à mão porque não há de onde derivá-la, mas ela é TRAVADA
 * pelo compilador nos dois lados: o caminho tem de existir no mapa gerado (que
 * por sua vez tem de existir no contrato), e o método tem de ser um dos que
 * aquela rota declara. Apontar uma ação para `PUT /admin/products` não compila.
 *
 * ----------------------------------------------------------------------------
 * AS TRÊS REGRAS QUE NÃO SÃO DE ROTA — e por isso são escritas, não geradas
 * ----------------------------------------------------------------------------
 *
 * O backend tem três decisões que uma tabela de rotas não expressa, porque quem
 * decide não é a rota, é o CORPO ou a QUERY. Elas estão no fim deste arquivo,
 * com o motivo, e têm teste próprio. Não são lacuna: são exceção nomeada.
 *
 * ----------------------------------------------------------------------------
 * A REGRA DE TELA: SOME, NÃO DESABILITA
 * ----------------------------------------------------------------------------
 *
 * Botão que a pessoa não pode apertar não é renderizado. Desabilitado sem
 * explicação é pior que ausente — ela fica tentando, e um `title` não sobrevive
 * ao toque. E não existe "esconder por segurança": quem recusa é o backend,
 * sempre. Isto aqui é sobre não prometer o que não se cumpre.
 */
import {
  CONJUNTOS,
  PAPEL_POR_ROTA,
  type ConjuntoDePapeis,
  type Papel,
} from '../api/generated/papeis';

export type { Papel };

/**
 * Os pares (método, caminho) que o mapa gerado conhece, como um tipo.
 *
 * É o que faz `'PATCH /admin/orders/{order_id}/status'` ser uma chave válida e
 * `'DELETE /admin/orders/{order_id}/status'` não ser. Sem isto, a ponte abaixo
 * seria um monte de string solta — e string solta apontando para rota errada é
 * um botão escondido para sempre, sem nada acendendo.
 */
type RotaComPapel = {
  [Caminho in keyof typeof PAPEL_POR_ROTA]: {
    [Metodo in keyof (typeof PAPEL_POR_ROTA)[Caminho]]: `${Metodo & string} ${Caminho & string}`;
  }[keyof (typeof PAPEL_POR_ROTA)[Caminho]];
}[keyof typeof PAPEL_POR_ROTA];

/**
 * AS AÇÕES DO PAINEL, pelo nome que elas têm na tela.
 *
 * A granularidade é a do BOTÃO, não a da rota: "avançar o pedido" e "cancelar o
 * pedido" são dois controles diferentes na mesma linha e papéis diferentes, e
 * chamá-los ambos de "mexer no pedido" perderia justamente a distinção que
 * interessa.
 */
export type Acao =
  // --- pedidos
  | 'pedidos.ver'
  | 'pedidos.avancarStatus'
  | 'pedidos.cancelar'
  | 'pedidos.ajustarPreparo'
  | 'pedidos.tempoReal'
  // --- cardápio
  | 'cardapio.ver'
  | 'cardapio.criarProduto'
  | 'cardapio.editarProduto'
  | 'cardapio.trocarDisponibilidade'
  | 'cardapio.enviarFoto'
  | 'cardapio.editarComplemento'
  | 'cardapio.criarCategoria'
  | 'cardapio.editarCategoria'
  | 'cardapio.reordenarCategorias'
  | 'cardapio.reordenarProdutos'
  | 'cardapio.apontarSetorDoProduto'
  | 'cardapio.apontarSetorDaCategoria'
  // --- clientes, desempenho e avaliações
  | 'clientes.ver'
  | 'desempenho.ver'
  | 'desempenho.verComissao'
  | 'avaliacoes.ver'
  /*
   * CASHBACK LÊ COMO GERÊNCIA E ESCREVE COMO DONO, e são quatro ações porque
   * são quatro rotas — a da rede e as três da filial. Os papéis coincidem
   * (GERENCIA para ler, SOMENTE_DONO para as três escritas), mas apontar as
   * quatro para uma rota só faria o compilador parar de conferir três delas.
   */
  | 'cashback.ver'
  | 'cashback.editarRede'
  | 'cashback.editarFilial'
  | 'cashback.apagarSobrescrita'
  /*
   * CUPOM É A MESMA DIVISÃO DO CASHBACK, e são três ações porque são três
   * rotas. Ler é GERENCIA — quem toca a loja precisa saber qual campanha está
   * no ar para responder ao cliente que ligou. Criar e editar são SOMENTE_DONO,
   * e o router do backend explica por quê melhor do que um resumo: se o preço
   * do cardápio é do dono porque "a conta de gerente não pode valer desconto
   * ilimitado", um cupom de 99% pela porta ao lado vale exatamente o mesmo —
   * sem nem precisar tocar no cardápio.
   *
   * NÃO HÁ AÇÃO DE APAGAR: não existe DELETE. Desligar é o PATCH, e por isso
   * `cupons.editar` é o papel do botão "Desligar" também.
   *
   * A leitura das ARTES é rota própria e também GERENCIA. Ela não ganha ação
   * separada porque não há botão que a chame sozinha: quem abre a tela precisa
   * das duas listas para conseguir desenhar uma linha.
   */
  | 'cupons.ver'
  | 'cupons.criar'
  | 'cupons.editar'
  // --- minha loja
  | 'loja.abrirFechar'
  | 'loja.editarTiposDePedido'
  | 'loja.editarPadroes'
  /*
   * A MARCA É OUTRO RECURSO, NÃO OUTRA VISTA DOS PADRÕES — e por isso é outra
   * ação, mesmo tendo o mesmo papel de `loja.editarPadroes`. `/admin/settings`
   * grava `restaurant_settings`, o padrão que a filial herda; `/admin/restaurant`
   * grava `restaurants`, a marca. Apontar as duas para a mesma rota faria o
   * compilador parar de conferir uma delas — o mesmo motivo das quatro de
   * cashback logo acima.
   */
  | 'loja.editarMarca'
  | 'loja.editarValoresDaFilial'
  | 'loja.editarFilial'
  | 'loja.editarHorarios'
  /*
   * PAUSAR A ENTREGA É DE QUEM OPERA, e a chave estrutural é da gerência. Não é
   * incoerência: quem está no balcão às 19h com chuva é quem pausa, e uma pausa
   * que dependesse do gerente seria uma pausa que não acontece. A pausa volta
   * sozinha no prazo; a chave espera alguém religar.
   */
  | 'loja.pausarEntrega'
  | 'loja.editarFaixasDePrazo'
  | 'loja.editarPagamento'
  // --- impressão
  | 'impressao.verPrograma'
  | 'impressao.verImpressoras'
  | 'impressao.mandarTeste'
  | 'impressao.editarSetores'
  /*
   * LER COMO A COMANDA SAI É DE QUEM OPERA; MUDAR É DA GERÊNCIA. As duas ações
   * são a mesma rota em métodos diferentes, e é a única dupla assim do painel:
   * quem está ao lado da impressora precisa saber por que saíram duas vias, e
   * não precisa poder mudar para três.
   */
  | 'impressao.verConfiguracao'
  | 'impressao.editarConfiguracao'
  /*
   * A EQUIPE É INTEIRAMENTE DO DONO — as quatro rotas são `SOMENTE_DONO`, sem o
   * meio-termo que Cupons e Cashback têm ("a gerência lê, o dono escreve").
   *
   * Não há o que dar ao gerente aqui: `GET /admin/users` devolve o e-mail de
   * todo mundo da casa, que é metade da credencial de cada pessoa. Uma tela de
   * gerente sobre a equipe da filial precisaria de outro schema, e o backend
   * diz isso com todas as letras em `AdminUserDetailResponse`.
   *
   * São quatro ações e não uma porque são quatro rotas, e apontar as quatro
   * para uma só faria o compilador parar de conferir três delas — o mesmo
   * motivo das quatro de cashback. Os papéis coincidirem hoje não é garantia de
   * coincidirem amanhã: `GET` foi de gerência em três telas deste painel.
   */
  | 'usuarios.ver'
  | 'usuarios.criar'
  | 'usuarios.editar'
  | 'usuarios.redefinirSenha';

/**
 * A ponte. Cada ação, a rota que ela chama.
 *
 * Quando um botão dispara mais de uma rota, aponta-se para a MAIS RESTRITA —
 * "salvar Entrega" grava por `PATCH /admin/branches/{branch_id}`, e é ela que
 * decide se o botão aparece.
 */
const ROTA_DA_ACAO = {
  // --- pedidos --------------------------------------------------------------
  'pedidos.ver': 'GET /admin/orders',
  'pedidos.avancarStatus': 'PATCH /admin/orders/{order_id}/status',
  /*
   * CANCELAR É DA GERÊNCIA, avançar é de quem opera. É a distinção mais fina
   * desta tabela e a que mais aparece: as duas ações moram na mesma linha de
   * pedido, e no balcão só uma delas existe.
   */
  'pedidos.cancelar': 'PATCH /admin/orders/{order_id}/cancel',
  'pedidos.ajustarPreparo': 'PATCH /admin/branches/{branch_id}/prep-time',
  /*
   * O ticket do stream é `PESSOAS_E_AGENTE` — o agente de impressão escuta o
   * mesmo stream dos pedidos. Aqui ele serve só para o quadro não tentar abrir
   * tempo real quando o papel não alcança a rota.
   */
  'pedidos.tempoReal': 'POST /admin/orders/stream-ticket',

  // --- cardápio -------------------------------------------------------------
  'cardapio.ver': 'GET /admin/products',
  /*
   * CRIAR PRODUTO É DO DONO, editar é da gerência, e a assimetria tem motivo:
   * `price` é obrigatório na criação, então deixar o gerente criar produto é
   * deixá-lo definir preço. Na edição o preço é opcional, e o backend barra só
   * o campo — ver `podeDefinirPreco` no fim deste arquivo.
   */
  'cardapio.criarProduto': 'POST /admin/products',
  'cardapio.editarProduto': 'PATCH /admin/products/{product_id}',
  /* "Acabou a costela" é a ação mais frequente do turno, e é do balcão. */
  'cardapio.trocarDisponibilidade': 'PATCH /admin/products/{product_id}/availability',
  'cardapio.enviarFoto': 'POST /admin/products/{product_id}/image',
  'cardapio.editarComplemento': 'PATCH /admin/options/{option_id}',
  'cardapio.criarCategoria': 'POST /admin/categories',
  'cardapio.editarCategoria': 'PATCH /admin/categories/{category_id}',
  'cardapio.reordenarCategorias': 'PATCH /admin/categories/reorder',
  /*
   * REORDENAR ITEM É DA GERÊNCIA, como reordenar categoria — e ao contrário de
   * "acabou a costela", que é do balcão.
   *
   * A distinção é a mesma que separa as duas ações na mesma linha da lista:
   * marcar esgotado responde ao que aconteceu HOJE na cozinha e se desfaz no
   * clique seguinte; a ordem do cardápio é decisão comercial — o que aparece
   * primeiro vende mais — e ela fica publicada até alguém mexer de novo.
   */
  'cardapio.reordenarProdutos': 'PATCH /admin/products/reorder',
  'cardapio.apontarSetorDoProduto': 'PATCH /admin/products/{product_id}/printing-sector',
  'cardapio.apontarSetorDaCategoria': 'PATCH /admin/categories/{category_id}/printing-sector',

  // --- clientes e desempenho ------------------------------------------------
  /*
   * A LISTA DE CLIENTES É DA GERÊNCIA, e é a tela inteira, não um botão dela: a
   * rota devolve nome e telefone da base toda, e é a que mais pesa numa senha
   * vazada. Para o atendente, Clientes não é "sem ações" — é fora do alcance.
   */
  'clientes.ver': 'GET /admin/customers',
  'desempenho.ver': 'GET /admin/reports/summary',
  /*
   * COMISSÃO É SÓ DO DONO, e não acompanhou os outros cinco relatórios quando
   * eles passaram para a gerência: é o percentual negociado com a plataforma,
   * não desempenho de loja, e não há recorte de filial que a torne assunto de
   * quem toca o balcão.
   */
  'desempenho.verComissao': 'GET /admin/reports/commission',
  /*
   * AVALIAÇÃO É DA GERÊNCIA, e a diferença para os relatórios ao lado é o
   * motivo de esta linha existir: a divisão de `admin_scope` é "dinheiro do
   * restaurante inteiro é do dono", e nota de cliente não diz quanto entrou.
   * Quem conserta atraso e pedido errado é quem toca a loja — nota que só o
   * dono vê não vira conserto no balcão.
   *
   * E, ao contrário de Desempenho, não há segunda regra pelo CORPO ou pela
   * QUERY: o gerente lê sem escolher filial antes.
   */
  'avaliacoes.ver': 'GET /admin/reviews',

  /*
   * LER CASHBACK É GERÊNCIA, igual a `GET /admin/coupons`: o percentual é termo
   * comercial, não alavanca de balcão — o atendente não aplica cashback à mão,
   * quem resolve é o checkout — e a senha do balcão é a que mais circula.
   *
   * ESCREVER É SOMENTE DO DONO, igual ao cupom, e com um agravante que o cupom
   * não tem: `enabled` liga o crédito E o resgate juntos, o resgate entra como
   * subtração na base da comissão, e o primeiro pedido depois de salvar já
   * fecha com outro número. Não existe o "cashback que ninguém usou".
   */
  'cashback.ver': 'GET /admin/cashback-rules',
  'cashback.editarRede': 'PUT /admin/cashback-rules',
  'cashback.editarFilial': 'PUT /admin/branches/{branch_id}/cashback-rules',
  'cashback.apagarSobrescrita': 'DELETE /admin/branches/{branch_id}/cashback-rules',

  // --- cupons ---------------------------------------------------------------
  'cupons.ver': 'GET /admin/coupons',
  'cupons.criar': 'POST /admin/coupons',
  /* Editar E desligar: `PATCH` é a única forma de tirar uma campanha do ar. */
  'cupons.editar': 'PATCH /admin/coupons/{coupon_id}',

  // --- minha loja -----------------------------------------------------------
  /* Fechar a loja no sábado à noite é de quem está lá. */
  'loja.abrirFechar': 'PATCH /admin/branches/{branch_id}/store-status',
  'loja.editarTiposDePedido': 'PATCH /admin/branches/{branch_id}/order-types',
  'loja.editarPadroes': 'PATCH /admin/settings',
  'loja.editarMarca': 'PATCH /admin/restaurant',
  'loja.editarValoresDaFilial': 'PATCH /admin/branches/{branch_id}/settings',
  'loja.editarFilial': 'PATCH /admin/branches/{branch_id}',
  'loja.editarHorarios': 'PUT /admin/branches/{branch_id}/business-hours',
  'loja.pausarEntrega': 'PATCH /admin/branches/{branch_id}/delivery-pause',
  'loja.editarFaixasDePrazo': 'PUT /admin/branches/{branch_id}/delivery-time-bands',
  'loja.editarPagamento': 'POST /admin/branches/{branch_id}/payment-methods',

  // --- impressão ------------------------------------------------------------
  /*
   * TRÊS PAPÉIS DIFERENTES NA MESMA TELA, e é o caso que mais justifica esta
   * granularidade: o atendente vê o estado do programa e manda uma via de
   * teste (é ele que está ao lado da impressora quando ela para), mas a lista
   * de impressoras da máquina e a edição dos setores são da gerência.
   */
  'impressao.verPrograma': 'GET /admin/branches/{branch_id}/print-agent',
  'impressao.verImpressoras': 'GET /admin/branches/{branch_id}/printers',
  'impressao.mandarTeste': 'POST /admin/branches/{branch_id}/print-test',
  'impressao.editarSetores': 'POST /admin/branches/{branch_id}/printing-sectors',
  'impressao.verConfiguracao': 'GET /admin/branches/{branch_id}/print-settings',
  'impressao.editarConfiguracao': 'PATCH /admin/branches/{branch_id}/print-settings',

  // --- a equipe -------------------------------------------------------------
  'usuarios.ver': 'GET /admin/users',
  'usuarios.criar': 'POST /admin/users',
  /* Editar E desativar: não existe DELETE, tirar alguém é `is_active: false`. */
  'usuarios.editar': 'PATCH /admin/users/{admin_user_id}',
  'usuarios.redefinirSenha': 'POST /admin/users/{admin_user_id}/reset-password',
} as const satisfies Record<Acao, RotaComPapel>;

/**
 * Quem pode uma ação.
 *
 * O `satisfies RotaComPapel` lá em cima já garante que o par existe no mapa
 * gerado — mas a garantia se perde no `split`, que devolve strings comuns. O
 * `throw` é para o caso que o compilador não alcança: alguém editar o arquivo
 * gerado à mão, ou o `papeis:generate` gravar um mapa pela metade. Devolver uma
 * lista vazia ali esconderia o botão de TODO MUNDO, calado — que é o defeito
 * mais caro que este arquivo pode ter.
 */
export function papeisDaAcao(acao: Acao): readonly Papel[] {
  const rota = ROTA_DA_ACAO[acao];
  const [metodo, caminho] = rota.split(' ') as [string, keyof typeof PAPEL_POR_ROTA];
  const conjunto = (PAPEL_POR_ROTA[caminho] as Record<string, ConjuntoDePapeis | undefined>)[
    metodo
  ];
  if (!conjunto) {
    throw new Error(`A ação "${acao}" aponta para ${rota}, que não está no mapa de papéis.`);
  }
  return CONJUNTOS[conjunto];
}

/**
 * A pergunta que a tela faz.
 *
 * SEM PAPEL, NÃO PODE. Enquanto a sessão carrega, `papel` é nulo — e desenhar o
 * botão para escondê-lo meio segundo depois é pior do que ele aparecer junto
 * com o resto da tela.
 */
export function pode(papel: Papel | null | undefined, acao: Acao): boolean {
  if (!papel) return false;
  return papeisDaAcao(acao).includes(papel);
}

/* ==========================================================================
 * AS TRÊS REGRAS QUE A TABELA DE ROTAS NÃO EXPRESSA
 *
 * As três estão escritas à mão de propósito, e não é preguiça de gerar: no
 * backend elas TAMBÉM não estão na tabela, porque quem decide não é a rota. Ver
 * `ensure_pode_definir_preco`, `ensure_pode_definir_cashback` e
 * `ensure_pode_ler_dinheiro` em `api/dependencies/admin_scope.py`.
 *
 * DUAS DELAS SÃO A MESMA FORMA: um CAMPO do dono dentro de uma rota da
 * gerência (`price` no PATCH de produto, `earns_cashback` no de forma de
 * pagamento). Nas duas, esconder o controle não basta — o campo tem de sair do
 * CORPO, porque a checagem do backend só olha o que chegou.
 *
 * O risco de as três envelhecerem é real e assumido — em troca, sem elas a tela
 * promete coisas que o backend recusa. Cada uma tem teste próprio, e o teste é
 * o lugar onde a divergência aparece.
 * ======================================================================= */

/**
 * QUEM ESCREVE DINHEIRO NO CARDÁPIO É O DONO.
 *
 * `PATCH /admin/products/{id}` é da GERÊNCIA e edita nome, descrição, categoria
 * e preço pela mesma rota — o gerente precisa dos três primeiros. Quem decide
 * aqui é o CORPO, não o caminho, então a rota não pode ser recusada inteira:
 * some só o CAMPO de preço.
 *
 * O que isto protege: a conta de gerente valendo desconto ilimitado. Sem a
 * regra, "editar produto" e "dar 99% em tudo" são a mesma permissão.
 */
export function podeDefinirPreco(papel: Papel | null | undefined): boolean {
  return papel === 'owner';
}

/**
 * QUEM ESCOLHE SE UMA FORMA DE PAGAMENTO GASTA O DINHEIRO DO LOJISTA É O DONO.
 *
 * `earns_cashback` mora em `AdminPaymentMethodCreate` e `...Update`, e as rotas
 * de forma de pagamento são GERENCIA. Quem decide aqui é o CORPO, não o
 * caminho — a mesma forma de `podeDefinirPreco` logo acima, e a mesma no
 * backend (`ensure_pode_definir_cashback`).
 *
 * POR QUE A LINHA CAI AQUI E NÃO NA ROTA: cadastrar bandeira, rótulo, ícone e
 * ordem é trabalho de quem toca a loja. Escolher se aquela forma **gasta o
 * dinheiro do lojista** não é. Sem a regra, o dono definiria o percentual e o
 * gerente escolheria em quais formas ele sai — meia decisão de cada lado da
 * mesma campanha.
 *
 * A CHECAGEM DO BACKEND SÓ MORDE QUANDO O CAMPO VEM NO CORPO: quem omite passa
 * e cai no default `True` da coluna. É a mesma mecânica do preço, e a mesma
 * consequência para a tela — não basta esconder o controle, o campo tem de sair
 * do CORPO. Ver `store/payment-methods` e o e2e que confere isso no corpo.
 */
export function podeDefinirCashback(papel: Papel | null | undefined): boolean {
  return papel === 'owner';
}

/**
 * QUEM LÊ FATURAMENTO: o dono sempre; a gerência só com o recorte de UMA
 * filial.
 *
 * Os cinco relatórios de dinheiro declaram GERENCIA na rota, mas
 * `ensure_pode_ler_dinheiro` responde 403 para o gerente que não mandou
 * `branch_id` — e a diferença não é burocracia. Sem recorte, "ler o
 * faturamento" significa ler o do RESTAURANTE INTEIRO, e dar isso ao gerente da
 * loja do Centro é entregar-lhe o resultado da Aldeota, que não é dele. Com
 * recorte, ele está lendo o resultado do próprio trabalho.
 *
 * `branchId` vazio é "todas as filiais" — ver `auth/branch-scope.ts`.
 */
export function podeLerDinheiro(papel: Papel | null | undefined, branchId: string): boolean {
  if (papel === 'owner') return true;
  if (papel === 'manager') return branchId !== '';
  return false;
}

/**
 * O `role` DO CONTRATO É `string`, E AQUI ELE VIRA `Papel` — OU NADA.
 *
 * `AdminUserResponse.role` é texto livre no OpenAPI (o backend o declara como
 * `str`), então estreitá-lo é trabalho da tela. Papel desconhecido devolve
 * `null`, e `pode(null, …)` é falso em tudo: se o backend criar um quinto
 * papel, o painel esconde os botões em vez de mostrar os que vão dar 403.
 *
 * FALHAR FECHADO É A ESCOLHA CERTA AQUI e não é óbvio — esconder demais é uma
 * funcionalidade que a pessoa não encontra, o que é ruim. Mostrar demais é a
 * pessoa apertando e levando 403, que é o defeito que esta frente existe para
 * apagar, e ela não tem como saber que o problema não é dela.
 */
export function papelDe(role: string | null | undefined): Papel | null {
  const conhecidos = CONJUNTOS.PESSOAS_E_AGENTE;
  return conhecidos.includes(role as Papel) ? (role as Papel) : null;
}

/**
 * `print_agent` NÃO ENTRA NO PAINEL.
 *
 * É conta de MÁQUINA: a senha dela fica em texto puro no `config.ini` do
 * computador do balcão, e o papel alcança quatro rotas — heartbeat, lista de
 * impressoras, ticket do stream e as vias de um pedido. Nenhuma tela.
 *
 * O BACKEND NÃO PODE RECUSAR ISSO NO LOGIN, e é por isso que a recusa mora
 * aqui: é por `POST /admin/auth/login` que o próprio agente se autentica, e
 * barrar o papel lá pararia a impressão de todas as lojas. A porta é a mesma; o
 * que muda é quem entra por ela.
 */
export function podeEntrarNoPainel(papel: Papel | null | undefined): boolean {
  return papel !== undefined && papel !== null && papel !== 'print_agent';
}
