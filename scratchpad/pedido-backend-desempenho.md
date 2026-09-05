# Pedido ao backend — o que a tela de Desempenho precisa e não tem

Prompt pronto para colar no repositório `pedeaqui_back`. Contexto de quem lê:
o painel (`rapidex-admin`) refez a tela de Desempenho em 2026-09-04 e, das
cinco perguntas do dono, duas e meia não têm dado no backend. Este arquivo é
o que falta, escrito no regime das seis rotas de relatório que já existem.

---

## O prompt

> Preciso de três rotas novas de relatório para o painel do lojista, todas no
> regime das seis que já existem em `src/api/endpoints/admin_reports.py` e
> `src/services/admin_report_service.py`:
>
> - `start_date` e `end_date` obrigatórios (AAAA-MM-DD, no dia da operação,
>   `America/Fortaleza`), `_validate_period` como está;
> - `branch_id` opcional que **só restringe** — ausente é "todas as filiais
>   que o token alcança";
> - `ensure_pode_ler_dinheiro`: GERENCIA com `branch_id`, o restaurante inteiro
>   só para o dono;
> - `ReportPeriod` e `MetricComparison` como estão (`change_percent` nulo
>   quando o anterior foi zero);
> - dinheiro como `Decimal` serializado em string, `quantize_money`;
> - cancelados, recusados e estornados **fora** de tudo que é "faturado", como
>   em `sales_summary`;
> - `description` da rota com a regra de negócio escrita, como as outras (o
>   painel lê a descrição, não só o schema);
> - teste em `tests/` cobrindo o recorte de filial e o período anterior.
>
> ### 1. `GET /admin/reports/sales-by-hour` — faturamento e pedidos por hora do dia
>
> Resposta:
>
> ```
> {
>   restaurant_id, branch_id, period,
>   revenue_total: "0.00", orders_count: 0,
>   hours: [ { hour: 0..23, revenue_total: "0.00", orders_count: 0 } ]   // as 24 SEMPRE
> }
> ```
>
> As 24 horas sempre, com zero, somando todos os dias do período, pela hora
> LOCAL do `created_at` do pedido (`America/Fortaleza`, não UTC — um pedido das
> 22h de sexta é 22h, não 1h de sábado). Mesmo critério de "faturado" do
> `sales-by-day`.
>
> Por quê: o painel só consegue "hora" hoje lendo `GET /admin/orders` paginado,
> e faz isso só para cancelamento (poucos pedidos). Para "a que horas eu vendo"
> num mês seriam centenas de páginas. O pico do dia decide escala de cozinha e
> de entregador, e é a pergunta operacional que a tela não responde.
>
> Se couber na mesma rodada: `weekday_hours: [{ weekday, hour, revenue_total,
orders_count }]`, com `weekday` 0 = segunda como em `BusinessHourResponse`,
> para o mapa dia × hora. Se não couber, só as 24 já resolvem.
>
> ### 2. `GET /admin/reports/customers` — quem comprou, e o cashback no período
>
> Resposta:
>
> ```
> {
>   restaurant_id, branch_id, period, previous_period,
>   customers_count:            MetricComparison,   // clientes distintos com pedido faturado no período
>   new_customers_count:        MetricComparison,   // cujo PRIMEIRO pedido faturado (de sempre) cai no período
>   returning_customers_count:  MetricComparison,   // já tinham pedido faturado antes do período
>   new_revenue_total:          "0.00",             // faturado pelos novos
>   returning_revenue_total:    "0.00",             // faturado pelos recorrentes
>   cashback: {
>     earned_total:             MetricComparison,   // crédito gerado no período (cashback_transactions)
>     redeemed_total:           MetricComparison,   // resgatado em pedidos faturados do período (orders.cashback_redeemed_amount)
>     orders_with_redeem_count: number,             // pedidos faturados que usaram saldo
>     configured: boolean                           // há regra valendo no recorte (o `source != "none"` de cashback-rules)
>   }
> }
> ```
>
> "Novo" é **pelo período do relatório** — o primeiro pedido faturado da vida
> do cliente cai dentro de `[start_date, end_date]` —, e não a janela RFV de 30
> dias do `segment` de `/admin/customers` (`RFV_NEW_WINDOW_DAYS`). O painel
> conferiu: em "7 dias" o segmento diria "novo" para quem estreou há três
> semanas, e por isso não o usa. Identidade do cliente: a mesma de
> `admin_customer_service` (`customer_id`, e o telefone para quem pediu sem
> conta), para que "12 clientes" aqui e na tela de Clientes contem as mesmas
> pessoas. Com `branch_id`, "primeiro pedido" é o primeiro NA FILIAL ou no
> restaurante? Decida e escreva na descrição — o painel vai repetir o que ela
> disser.
>
> Por quê: "quem compra" é a única das cinco perguntas do dono que o painel não
> consegue tocar. `cashback_redeemed_amount` existe pedido a pedido só em
> `/reports/commission` (SOMENTE_DONO, sem paginação), e "gerado" não existe em
> resposta nenhuma do `/admin`. Sem `configured`, "R$ 0,00 resgatados" não
> distingue "ninguém usa" de "ninguém ligou".
>
> ### 3. `GET /admin/reports/operations` — os tempos entre os carimbos
>
> Fonte: `order_status_history.created_at`, por pedido faturado do período.
>
> Resposta:
>
> ```
> {
>   restaurant_id, branch_id, period, orders_count,
>   accept_minutes:   { median, p90, average, orders_count },   // pending → accepted
>   prep_minutes:     { median, p90, average, orders_count },   // accepted → ready
>   delivery_minutes: { median, p90, average, orders_count },   // out_for_delivery → completed (só entrega)
>   late_orders_count: number,          // `ready` depois de `accepted` + `delivery_prep_time_max` do PRÓPRIO pedido
>   late_orders_percent: "0.0" | null   // sobre os pedidos com `prep_minutes` medido; nulo sem denominador
> }
> ```
>
> `orders_count` em cada bloco porque nem todo pedido passa por todos os
> estágios (retirada não tem `delivery_minutes`; pedido aceito e cancelado não
> tem `prep`). Minutos como número com uma casa. Mediana e p90 ANTES de média:
> um pedido esquecido três horas não pode virar "preparo médio de 40 min".
> `late_orders_count` mede contra o prazo que o pedido PROMETEU
> (`orders.delivery_prep_time_max`, congelado no pedido), não contra a
> configuração atual da filial.
>
> Por quê: "a operação está boa" hoje se responde só por cancelamento e por
> avaliação. O tempo de preparo é a promessa que a loja faz ao cliente na
> vitrine e ninguém mede se ela é cumprida.
>
> ### Depois de publicar
>
> Rode o `/openapi.json` e me avise: o painel gera o contrato de lá
> (`npm run api:generate`) e nenhum tipo é escrito à mão.

## D. `GET /admin/reports/neighborhoods` — o faturamento por bairro

> **Acrescentado em 2026-09-05, na rodada que refez a tela.** O pedido do dono
> tinha um bloco "Pedidos por bairro: top 5 com faturamento, pedidos e ticket
> médio", e ele **não tem como ser desenhado hoje**. A tela foi entregue sem
> ele, e a ausência está escrita no pé da página.
>
> **O que falta, exatamente:** `AdminOrderListItem` — o item da listagem de
> pedidos — não traz endereço nenhum. `neighborhood` existe em
> `OrderDetailResponse` e nas rotas de entregador, sempre UM pedido por vez.
> Ler o bairro de um mês pelo painel seria uma requisição por pedido; num
> período de 30 dias, centenas.
>
> **Pedido:**
>
> `GET /admin/reports/neighborhoods?start_date&end_date&branch_id?`, GERENCIA,
> mesmo escopo, mesma validação de período e o mesmo
> `ensure_pode_ler_dinheiro` das outras seis.
>
> ```
> {
>   restaurant_id, branch_id, period,
>   revenue_total: "0.00",       // a soma dos bairros listados
>   orders_count: 0,
>   neighborhoods: [{
>     neighborhood: "Aldeota",   // como veio no endereço do pedido
>     city: "Fortaleza",
>     orders_count: 0,
>     revenue_total: "0.00",
>     average_ticket: "0.00",
>     revenue_share_percent: "0.0" | null
>   }]
> }
> ```
>
> **Só ENTREGA**, e a resposta precisa dizer isso: pedido de retirada não tem
> bairro, e somá-lo num balde "sem bairro" faria a maior "região" da tela ser o
> balcão. Se houver pedido de entrega com bairro vazio, ele vem com
> `neighborhood: null` — que a tela escreve como "sem bairro registrado", pela
> mesma regra de `payment_method` nulo (§4 de `report-model.ts`): o pedido
> existe, o dinheiro entrou, e ninguém registrou onde.
>
> Ordenado por `revenue_total` decrescente. Um `limit` opcional seria bom (a
> tela mostra cinco), mas não é necessário: a lista de bairros de um
> restaurante cabe numa resposta.
>
> **Por quê:** é a pergunta de onde ESTENDER ou ENCOLHER a área de entrega, e
> ela decide taxa de entregador e raio. Hoje o lojista responde isso de
> cabeça, olhando comanda.
>
> ### Depois de publicar
>
> Rode o `/openapi.json` e me avise: o painel gera o contrato de lá
> (`npm run api:generate`) e nenhum tipo é escrito à mão.

---

## Pergunta de produto (não é pedido de rota)

**Canal próprio × resto.** É o número que prova o valor do Rapidex ao lojista,
e um dia vai precisar existir. Não é rota que falta: `orders` não tem coluna
de origem, e o backend só enxerga pedido do Rapidex — o "resto" (iFood e
afins) não entra no sistema por porta nenhuma. É decisão de produto do dono do
projeto: gravar `source` no pedido (`storefront` | `assistant` | `whatsapp`)
quando outro caminho passar a criar pedido, e/ou uma entrada manual do
faturamento de fora. Registrado em 2026-09-04; a tela não desenha a seção até
isso ser decidido.
