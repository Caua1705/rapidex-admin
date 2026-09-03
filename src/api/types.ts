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

// --- as vias de UM pedido -------------------------------------------------

/**
 * As bobinas de um pedido, na ordem em que devem sair.
 *
 * ELA NÃO É HISTÓRICO DE IMPRESSÃO, e a diferença é a tela inteira: a rota não
 * marca nada como impresso — reimprimir é a operação mais comum do balcão, e
 * por isso ela é um GET repetível. Quem lê isto pode dizer O QUE SAI; não pode
 * dizer que saiu.
 *
 * `jobs` VAZIA é resposta legítima (a filial zerou as duas contagens), e a
 * lista com só a via do cliente também (pagamento online ainda não confirmado
 * não gera ordem de preparo). Ver `orders/print-jobs.ts`.
 */
export type OrderPrintJobs = Schemas['OrderPrintJobsResponse'];

/**
 * Uma bobina, já quebrada em `columns` colunas pelo backend.
 *
 * **CÓPIA É ENTRADA REPETIDA, não um campo `copies`**: duas vias do cliente
 * chegam como dois itens idênticos em sequência. O contrato explica por quê —
 * não existe atualização remota do agente, e um campo novo não seria lido pelas
 * instalações que já estão em campo.
 */
export type PrintJob = Schemas['PrintJobResponse'];

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

// --- cupons ---------------------------------------------------------------

/**
 * A CAMPANHA como o painel a lê.
 *
 * `total_usage_count` é o par de `total_usage_limit` e conta a MESMA coisa que
 * o checkout conta para barrar o próximo cliente: redenção em `applied`, só.
 * Pedido cancelado estorna a redenção e DEVOLVE A VAGA — o número na tela é
 * quanto ainda cabe, não um histórico de tentativas. Ele é opcional no
 * contrato porque não sai de coluna nenhuma (o service o preenche por fora), e
 * o POST devolve 0 sem perguntar ao banco.
 *
 * NÃO HÁ `branch_id` AQUI, e não é omissão: cupom é do restaurante inteiro e
 * vale em todas as lojas. Nenhuma tela pode escrever "vale na filial X".
 */
export type Coupon = Schemas['CouponAdminResponse'];

/**
 * O corpo da criação. `extra="forbid"` do outro lado: campo desconhecido é 422,
 * não uma chave ignorada em silêncio.
 *
 * `discount_type` e `discount_value` são OBRIGATÓRIOS aqui e mesmo assim não
 * são campo de formulário — eles saem da arte escolhida. O backend confere o
 * TIPO contra o template (`_ensure_template_agrees`) e **não confere o VALOR**:
 * escolher a arte de 10% e mandar 7% grava, anuncia 10% na vitrine e desconta
 * 7% no checkout. A trava é nossa, e mora em `coupons/coupon-model.ts`.
 */
export type CouponCreate = Schemas['CouponCreate'];

/**
 * O corpo da edição — parcial no contrato, revalidado INTEIRO no backend.
 *
 * `update_admin` mescla o corpo sobre o cupom gravado e roda
 * `CouponCampaignFields.model_validate(merged)`, então um campo que não veio
 * ainda pode reprovar a chamada. Quem monta manda a campanha toda.
 */
export type CouponUpdate = Schemas['CouponUpdate'];

/**
 * A ARTE da vitrine — o desenho que já traz o valor impresso ("10% OFF",
 * "R$ 5 OFF", "FRETE GRÁTIS").
 *
 * São da PLATAFORMA: não há rota que os cadastre, não há `restaurant_id` neles,
 * e o lojista não sobe imagem. `image_url` vem pronta porque quem monta a URL
 * do bucket é o backend (`build_storage_url`) — remontá-la aqui seria a segunda
 * cópia da configuração do Supabase.
 *
 * `discount_value` é anulável por causa de `free_delivery`, onde não há valor a
 * imprimir.
 */
export type CouponTemplate = Schemas['CouponTemplateResponse'];

/** `percent`, `fixed` ou `free_delivery` — sempre lido da arte, nunca digitado. */
export type CouponDiscountType = Coupon['discount_type'];

/**
 * QUEM ENXERGA O CUPOM — `public`, `segment` ou `private`.
 *
 * Substituiu `is_public` na revisão `20260828_0043` do backend, e SEM ALIAS: o
 * booleano não existe mais em corpo nenhum. A troca não é de nome — o booleano
 * tinha dois valores e um deles (`false`) era um cupom que ninguém conseguia
 * usar; aqui os três são utilizáveis, e o que muda é por onde o cliente chega.
 *
 * O apelido sai do enum GERADO pelo mesmo motivo de `CustomerSegment`: é o que
 * faz `Record<CouponVisibility, ...>` acender no `npm run typecheck` no dia em
 * que a plataforma criar um quarto valor, em vez de a lista mostrar uma linha
 * sem etiqueta.
 */
export type CouponVisibility = Coupon['visibility'];

// --- a equipe do restaurante (Usuários) -----------------------------------

/**
 * O usuário como a LISTA o traz — e ele é maior que o `AdminUser` de cima.
 *
 * São dois schemas de propósito, e confundi-los custaria caro nos dois
 * sentidos: `AdminUserResponse` (o apelido `AdminUser`) é QUEM ENTROU, e sai no
 * login e no `/me`; este é a ficha de OUTRA pessoa, e só existe na tela do
 * dono sobre a própria equipe.
 *
 * O que só existe aqui: `password_changed_at` e `created_at`. O primeiro é
 * NULO para quem nunca trocou a senha desde a revisão 0013 — o estado de todo
 * usuário antigo — e isso NÃO significa pendência: quem responde "precisa
 * trocar?" é `must_change_password`, que está nos dois schemas.
 */
export type AdminUserDetail = Schemas['AdminUserDetailResponse'];

/**
 * O corpo do cadastro. `extra="forbid"` do outro lado: campo desconhecido é
 * 422, não uma chave ignorada em silêncio.
 *
 * `branch_id` é OPCIONAL PARA OS TRÊS PAPÉIS, e nulo significa "todas as
 * filiais do restaurante" — não "sem filial". Para `owner` o campo não muda
 * nada: `build_admin_scope` ignora a filial de quem é dono ("dono não se prende
 * a filial"), e é por isso que o formulário não o oferece nesse papel.
 */
export type AdminUserCreate = Schemas['AdminUserCreate'];

/**
 * O corpo da edição — parcial de verdade, ao contrário do de cupom.
 *
 * O backend faz `model_dump(exclude_unset=True)` e aplica campo a campo, sem
 * revalidar o objeto inteiro. Logo o corpo mínimo é o certo aqui: mandar o que
 * não mudou é reenviar por cima do que outra aba gravou.
 *
 * `email` NÃO ESTÁ NELE, e a tela não o oferece — ver `api/users.ts`.
 */
export type AdminUserUpdate = Schemas['AdminUserUpdate'];

/**
 * A resposta de criar E de redefinir senha: a ficha mais a senha em claro.
 *
 * É A ÚNICA VEZ QUE A SENHA TEMPORÁRIA EXISTE FORA DO BCRYPT. Não há rota que a
 * devolva de novo; segunda via é gerar OUTRA por `reset-password`, que revoga a
 * anterior. Quem recebeu a primeira fica com uma senha morta — e é isso que o
 * diálogo precisa dizer antes de deixar alguém fechá-lo.
 */
export type AdminUserCreated = Schemas['AdminUserCreatedResponse'];

/**
 * OS TRÊS PAPÉIS DE GENTE, tirados do enum GERADO — nunca de uma união escrita
 * à mão com as três strings.
 *
 * É o que faz `Record<PapelDePessoa, string>` acender no `npm run typecheck` no
 * dia em que o backend acrescentar um quarto papel de pessoa. Uma união copiada
 * continuaria compilando e o papel novo apareceria sem rótulo no seletor.
 *
 * `print_agent` não está aqui porque não está no contrato: o Literal do backend
 * é `owner | manager | attendant`, e a conta de máquina tem recusa própria com
 * mensagem explicando que ela nasce por `scripts/create_admin_user.py`.
 */
export type PapelDePessoa = AdminUserCreate['role'];

/**
 * O corpo da troca da própria senha.
 *
 * Os três campos são obrigatórios, e o mínimo de 12 caracteres é cobrado só em
 * `new_password` — o login aceita senha de qualquer tamanho de propósito, para
 * que quem tem uma senha curta cadastrada consiga entrar e trocá-la.
 *
 * A RESPOSTA NÃO TRAZ TOKEN NOVO. Trocar a senha grava `password_changed_at`, e
 * isso REVOGA o token que fez a chamada: a resposta chega, e a requisição
 * seguinte é 401. Quem chama precisa refazer o login — ver
 * `pages/ChangePasswordPage.tsx`.
 */
export type ChangePasswordBody = Schemas['ChangeAdminPasswordRequest'];

// --- relato de erro ------------------------------------------------------

/**
 * O relato como o painel o envia.
 *
 * `extra="forbid"` no backend: restaurante, filial e usuário saem do TOKEN, e
 * mandar qualquer um deles no corpo é 422. Os limites de tamanho dos campos
 * NÃO saem daqui — o contrato publica os quatro como tipo seco. Eles estão em
 * `erro/error-report.ts`, com a origem nomeada.
 */
export type CreateErrorReport = Schemas['CreateErrorReportRequest'];

/**
 * O comprovante: o id e a hora, e mais nada.
 *
 * O texto NÃO volta, e é decisão do backend: ecoar o relato já redigido faria
 * a tela mostrar `[redigido]` no lugar do que a pessoa acabou de digitar, e
 * ela reescreveria achando que perdeu.
 */
export type ErrorReport = Schemas['ErrorReportResponse'];

/**
 * O corpo de criação de um grupo de complemento.
 *
 * As REGRAS dele não saem daqui: `min_select`/`max_select` são inteiros soltos
 * no contrato, e a validação cruzada (máximo ≥ mínimo, obrigatório exige mínimo
 * ≥ 1) mora num `model_validator` do Pydantic, que não vira schema. Ela está em
 * `menu/option-groups.ts`, com a origem nomeada.
 */
export type OptionGroupCreateBody = Schemas['AdminOptionGroupCreate'];

/** Todos os campos opcionais — mas o painel manda todos. Ver `option-groups.ts`. */
export type OptionGroupUpdateBody = Schemas['AdminOptionGroupUpdate'];

/**
 * O corpo de criação de uma opção.
 *
 * `additional_price` entra como `number | string` e SAI como `number`
 * (`AdminOptionResponse`). O painel manda número, que é como o `price` do
 * produto atravessa no mesmo módulo — dois formatos de dinheiro no mesmo
 * cardápio é como um dos dois começa a chegar errado.
 */
export type OptionCreateBody = Schemas['AdminOptionCreate'];

/**
 * ============================================================================
 * O ENTREGADOR
 * ============================================================================
 *
 * A TAXA POR CORRIDA É O QUE A LOJA PAGA, e não o frete que o cliente paga. Os
 * dois usam a mesma fórmula (`base + km × por_km`) e vivem em lugares
 * diferentes de propósito: o frete está nas cinco colunas de `Branch`, esta
 * está em rota própria com permissão própria. O contrato é explícito — "nenhum
 * numero que o CLIENTE paga muda com isto".
 *
 * A resposta traz `number | null`; o corpo aceita `number | string | null` e o
 * painel manda STRING, como todo dinheiro daqui.
 */
export type CourierFee = Schemas['AdminBranchCourierFeeResponse'];
export type CourierFeeUpdate = Schemas['AdminBranchCourierFeeUpdate'];

/**
 * O CADASTRO DO ENTREGADOR. `branch_id` está no CREATE e não no UPDATE — quem
 * serve duas lojas tem dois cadastros, e o `AdminCourierUpdate` é
 * `extra="forbid"`: a filial num PATCH é 422, não campo ignorado.
 */
export type Courier = Schemas['AdminCourierResponse'];
export type CourierCreate = Schemas['AdminCourierCreate'];
export type CourierUpdate = Schemas['AdminCourierUpdate'];

/**
 * O PAR QUE SAI UMA VEZ SÓ. `link_token` e `access_code` em claro existem
 * apenas nesta resposta — nenhuma rota os mostra de novo, e gerar outro par
 * mata o anterior na hora.
 */
export type CourierAccess = Schemas['AdminCourierAccessResponse'];

/**
 * A ATRIBUIÇÃO. `AssignmentResultItem` é UM POR PEDIDO do corpo, na mesma
 * ordem — a rota responde 200 mesmo com itens recusados, e quem decide é o
 * `ok` de cada um. `AssignmentErrorCode` é enum no contrato de propósito: o
 * painel escreve a frase por CÓDIGO, nunca casando o texto.
 */
export type AssignmentBatch = Schemas['AdminAssignmentBatchResponse'];
export type AssignmentResultItem = Schemas['AdminAssignmentResultItem'];
export type AssignmentErrorCode = Schemas['AssignmentErrorCode'];
export type Assignment = Schemas['AdminAssignmentResponse'];

/**
 * Quem está com um pedido. OS DOIS CAMPOS NULOS SÃO 200 e significam "ninguém
 * ainda" — estado normal, não erro. O 404 da rota é o pedido que este lojista
 * não alcança, e são coisas diferentes.
 */
export type OrderCourier = Schemas['AdminOrderCourierResponse'];
