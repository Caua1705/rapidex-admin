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

/**
 * Os PADRÕES do restaurante — não mais o estado da loja.
 *
 * `is_open`, `accepts_delivery` e `accepts_pickup` SAÍRAM daqui: eles passaram
 * a ser de cada filial (ver `BranchOperation`). Mandá-los no PATCH responde
 * 422. O que sobrou são valor mínimo, prazo estimado, taxa de serviço e taxa de
 * contingência, e nenhum pedido os lê direto: a filial os herda nos campos que
 * deixou nulos.
 */
export type RestaurantSettings = Schemas['AdminRestaurantSettingsResponse'];
export type RestaurantSettingsUpdate = Schemas['AdminRestaurantSettingsUpdate'];

/**
 * O PERFIL do restaurante — a MARCA, e não os padrões que a filial herda.
 *
 * Outra tabela e outro dono: `RestaurantSettings` é `restaurant_settings`, o
 * padrão que cada filial sobrescreve em Valores; isto é `restaurants`, e filial
 * nenhuma o herda porque ele é um só.
 *
 * `id`, `name` e `slug` saem na LEITURA e não existem no corpo do PATCH. O slug
 * é a URL pública do cardápio — a única coisa que o cliente tem salva —, e
 * trocá-lo por aqui quebraria todo link que existe, em silêncio e sem
 * redirecionamento.
 */
export type RestaurantProfile = Schemas['AdminRestaurantProfileResponse'];

/**
 * Os dois textos do lojista sobre a casa, e eles têm PÚBLICOS OPOSTOS.
 *
 *   - `description` é VITRINE: sai em `RestaurantPublicResponse` e o cliente a
 *     lê no cardápio antes de pedir. Teto de 1000.
 *   - `assistant_notes` é PROMPT: entra no contexto do assistente de IA e não
 *     sai em resposta pública nenhuma. Teto de 300.
 *
 * Os dois eram o mesmo campo até a revisão `20260823_0034` do backend, e foram
 * separados justamente para a tela poder dizer "não escreva anúncio aqui" sem
 * mentir sobre o que acontece com o texto.
 *
 * OS TETOS SÓ EXISTEM AQUI, no corpo do PATCH — a resposta não os declara. Logo
 * um texto legado maior que o teto CHEGA na tela, e quem trata isso é
 * `store/restaurant-profile.ts`.
 *
 * Nulo APAGA o campo, e não há fallback de um para o outro: sem
 * `assistant_notes` o prompt sai sem a linha "Sobre a casa", e não com a
 * descrição no lugar dela.
 */
export type RestaurantProfileUpdate = Schemas['AdminRestaurantProfileUpdate'];

/**
 * Como UMA filial está operando agora — uma linha de `GET /admin/branches/operation`.
 *
 * `is_open` e `is_open_now` são coisas diferentes e as duas vêm de propósito:
 * `is_open` é a chave que o lojista controla, `is_open_now` é essa chave
 * combinada com a agenda da semana. Aberta com `is_open_now: false` significa
 * "você deixou aberta, mas o horário de hoje já fechou".
 *
 * `overrides` é o que está gravado NA filial — `null` ali é "herda o padrão do
 * restaurante", nunca zero. `effective` é o que o próximo pedido vai usar.
 */
export type BranchOperation = Schemas['AdminBranchOperationResponse'];

/**
 * O corpo do PATCH de tipos de pedido: os dois campos são opcionais.
 *
 * Corpo vazio é 422 — não existe "salvar nada". Quem chama manda só o campo
 * que mudou, e é isso que impede um clique em "entrega" de reenviar a retirada
 * por cima do que outra aba gravou.
 */
export type BranchOrderTypes = Schemas['AdminBranchOrderTypesRequest'];

/**
 * As sobrescritas comerciais de uma filial. Três estados por campo:
 *
 *   - ausente do corpo → não mexe;
 *   - com valor        → esta filial passa a usar esse valor;
 *   - `null` explícito → esta filial VOLTA A HERDAR o padrão do restaurante.
 *
 * Sem o terceiro não haveria como desfazer uma divergência: a filial ficaria
 * com a cópia congelada para sempre, e mudar o padrão não chegaria mais nela.
 * Quem monta o corpo é `store/branch-overrides.ts`, que só manda `null` quando
 * o lojista APAGOU uma sobrescrita que existia.
 */
export type BranchSettingsUpdate = Schemas['AdminBranchSettingsUpdate'];

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

/*
 * A CLASSIFICAÇÃO RFV — cinco códigos, em minúsculas e sem acento.
 *
 * O apelido sai do enum GERADO, e não de uma união escrita à mão com as cinco
 * strings: é o que faz `Record<CustomerSegment, ...>` acender no
 * `npm run typecheck` no dia em que o backend acrescentar um sexto valor. Uma
 * união copiada continuaria compilando e a tela mostraria a linha sem rótulo.
 *
 * NÃO EXISTE `segment_label` no contrato, e é decisão do backend: rótulo em
 * português vindo da API transformaria mudança de texto de tela em deploy de
 * backend. Quem escreve "Em risco" é o painel (`customers/customer-segment.ts`).
 */
export type CustomerSegment = Schemas['CustomerSegment'];

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
export type ReportPaymentMethods =
  Schemas['src__schemas__admin_report_schema__PaymentMethodsResponse'];
export type ProductSales = Schemas['ProductSalesResponse'];
export type Cancellations = Schemas['CancellationsResponse'];
export type CommissionReport = Schemas['CommissionReportResponse'];

// --- avaliações -----------------------------------------------------------

/*
 * A avaliação como o LOJISTA a vê, e o que ela não tem é decisão de contrato:
 * `AdminOrderReviewItem` NÃO leva nome nem telefone do cliente. Os dois já
 * estão em `GET /admin/orders/{id}`, e repetir dado pessoal numa segunda tela
 * é superfície a mais sem leitor novo. O `order_number` é o que liga a nota ao
 * pedido — ver `docs/avaliacao-de-pedido.md` do backend, §4.
 */
export type ReviewItem = Schemas['AdminOrderReviewItem'];
export type ReviewsResponse = Schemas['AdminReviewsResponse'];

/**
 * O agregado do período, e as duas propriedades dele que a tela não pode
 * contrariar (as duas estão na descrição da rota, e as duas já custaram tela
 * errada em outros painéis):
 *
 *   - **`total` e `average` saem do HISTOGRAMA**, não de um `COUNT`/`AVG`
 *     paralelo. É o que garante que a média exibida e as barras da mesma tela
 *     nunca se contradigam. A tela lê os dois do mesmo objeto e não recalcula
 *     nenhum dos dois a partir de `items`.
 *   - **`max_rating` NÃO entra aqui.** Filtrar a lista para "só as notas
 *     baixas" não pode fazer a média do período desabar — o lojista concluiria
 *     que a semana piorou quando ele só apertou um filtro de lista.
 *
 * `average` NULO É "ninguém avaliou", nunca zero: média zero se lê como "todo
 * mundo odiou", que é o oposto.
 */
export type ReviewSummary = Schemas['AdminReviewSummary'];

/*
 * A ETIQUETA DE PROBLEMA, derivada do item gerado — não uma união escrita à
 * mão com as seis strings. É o que faz `Record<ReviewProblemTag, string>`
 * acender no `npm run typecheck` no dia em que o backend acrescentar uma
 * sétima (`REVIEW_PROBLEM_TAGS` pode crescer, e a descrição do agregado diz
 * isso com todas as letras). Uma união copiada continuaria compilando e a
 * etiqueta nova apareceria sem rótulo.
 *
 * Ela só existe com nota ATÉ 3 — mandar etiqueta com 4 ou 5 responde 422 do
 * lado de quem avalia. No painel isso é leitura: nota alta simplesmente não
 * tem etiqueta, e a tela não desenha um espaço vazio para ela.
 */
export type ReviewProblemTag = NonNullable<ReviewItem['problem_tag']>;

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

// --- entrega: a pausa e as faixas de prazo --------------------------------

/**
 * A FAIXA DE PRAZO POR DISTÂNCIA — e ela é um TETO, não um intervalo.
 *
 * Vale a primeira faixa, em ordem crescente, cujo teto alcança a distância. Não
 * há campo de piso de propósito: com piso daria para cadastrar 0–5 e 6–10 e
 * deixar o endereço de 5,4 km sem faixa nenhuma — um buraco que aparece no
 * endereço de um cliente específico e some quando alguém vai conferir.
 *
 * Os minutos são o DESLOCAMENTO, não o prazo total: o preparo da filial
 * continua somando por cima. Ver `store/delivery-bands.ts`.
 */
export type DeliveryTimeBand =
  Schemas['src__schemas__admin_settings_schema__DeliveryTimeBandResponse'];
export type DeliveryTimeBandInput = Schemas['DeliveryTimeBandInput'];

/** Pausa a entrega por um tempo. `minutes: 0` retoma na hora; teto de 24h. */
export type DeliveryPauseRequest = Schemas['AdminBranchDeliveryPauseRequest'];

// --- como a comanda desta filial sai --------------------------------------

/**
 * O rodapé e as quatro contagens de via (revisão `20260821_0029`).
 *
 * OS DOIS CAMPOS DE MENSAGEM NÃO SÃO REDUNDANTES, e é o mesmo par
 * `overrides`/`effective` da tela de Operação: `receipt_footer_message` é o que
 * ESTA FILIAL gravou (e alimenta o controle de edição), enquanto
 * `effective_receipt_footer_message` é o que vai sair na bobina, já resolvido
 * com o padrão do restaurante. Só o efetivo faria toda filial parecer
 * divergente; só a sobrescrita, a tela não teria como mostrar o que o cliente
 * vai ler.
 *
 * As quatro contagens não têm par: elas não herdam nada.
 */
export type BranchPrintSettings = Schemas['BranchPrintSettingsResponse'];
export type BranchPrintSettingsUpdate = Schemas['BranchPrintSettingsUpdate'];

// --- o programa de impressão (o agente na máquina do balcão) --------------

/*
 * O SETOR É CONFIGURAÇÃO; O AGENTE É UMA MÁQUINA QUE EXISTE OU NÃO EXISTE.
 *
 * Os dois vivem na mesma tela e são recursos diferentes: um setor é uma linha
 * que o lojista cria, o agente é o programa rodando (ou não) no computador da
 * loja. Por isso as chamadas moram em `api/print-agent.ts`, e não junto das de
 * setor.
 */

/**
 * Último sinal e versão do programa daquela filial.
 *
 * FILIAL QUE NUNCA INSTALOU RESPONDE 200, não 404: `is_online: false` e o resto
 * nulo. "Ninguém instalou aqui" é uma resposta que a tela precisa mostrar, e é
 * diferente de "instalou e está desligado" — a primeira se resolve indo
 * instalar, a segunda se resolve ligando o computador.
 */
export type PrintAgentStatus = Schemas['PrintAgentStatusResponse'];

/** Uma impressora que o programa enxerga naquela máquina. */
export type PrintAgentPrinter = Schemas['PrintAgentPrinterResponse'];
export type PrintAgentPrinters = Schemas['PrintAgentPrintersResponse'];

/**
 * Para onde mandar a via de teste. Os dois campos são opcionais, e a ordem de
 * resolução do backend é `printer_name` > a impressora do setor > a padrão do
 * agente.
 */
export type PrintTestRequest = Schemas['PrintTestRequest'];

/**
 * O comando foi ENFILEIRADO — não "a via saiu". Quem imprime é o agente quando
 * o stream entregar, então a resposta traz `agent_is_online`: sem ele o lojista
 * vê sucesso e fica olhando uma impressora que não vai receber nada.
 */
export type PrintTestResult = Schemas['PrintTestResponse'];

// --- cashback -----------------------------------------------------------

/**
 * A REGRA QUE VALE, E DE ONDE ELA VEIO.
 *
 * `source` é o campo que torna a herança visível, e ele existe porque sem ele a
 * filial que HERDA e a que tem regra PRÓPRIA respondem exatamente a mesma
 * coisa. São três valores, e a tela precisa dos três separados:
 *
 *   `branch`      regra própria desta loja
 *   `restaurant`  herdada inteira da rede — salvar aqui CRIA uma sobrescrita
 *   `none`        ninguém configurou, e `rule` vem nulo
 *
 * `none` NÃO é `enabled: false`. Um é "ninguém configurou", o outro é
 * "configurado e desligado". Os dois caem em SEM_CASHBACK no checkout, mas só o
 * segundo tem números para a tela mostrar.
 */
export type CashbackRuleView = Schemas['AdminCashbackRuleView'];
export type CashbackRule = Schemas['AdminCashbackRuleResponse'];

/**
 * A regra INTEIRA — é `PUT`, não `PATCH`, e a herança é o motivo.
 *
 * A herança do cashback é por LINHA, não por coluna: a filial tem a regra toda
 * ou herda a toda. Um PATCH sobre filial sem regra própria teria de responder
 * "patch sobre o quê?" — sobre os valores herdados, criando uma sobrescrita
 * inteira a partir de um campo só.
 */
export type CashbackRuleWrite = Schemas['AdminCashbackRuleWrite'];

/**
 * O percentual de UM dia. `weekday` é 0 = SEGUNDA (o `datetime.weekday()` do
 * Python), como em `BusinessHourInput` — ver `store/business-hours.ts`.
 */
export type CashbackWeekdayInput = Schemas['CashbackWeekdayInput'];
export type CashbackWeekday = Schemas['CashbackWeekdayResponse'];
