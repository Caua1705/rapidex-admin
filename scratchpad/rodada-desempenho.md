# Rodada: refazer Desempenho

Estado: **entregue**. Portão verde (format, lint, typecheck, 1287 unidades, 432
e2e).

O pedido, em uma linha: _"a tela está feia e parece um relatório de texto, não
um dashboard — quero o padrão visual de um produto SaaS sério, usando as cores e
tokens que JÁ existem"._

O levantamento que abriu a rodada (o que a tela mostrava, as rotas que o backend
já tinha e o painel não usava, e as três rotas pedidas) está preservado em
`scratchpad/pedido-backend-desempenho.md`. Este arquivo registra **o que foi
feito e o que eu decidi sozinho**.

---

## 1. O que ficou na tela, de cima para baixo

| #   | Bloco                                | De onde vem                                                        |
| --- | ------------------------------------ | ------------------------------------------------------------------ |
| 1   | Faixa de 52px                        | título · período (7 / 30 / Escolher…)                              |
| 2   | **Quatro cartões**                   | `summary` + `cancellations` (× 2 períodos) + `sales-by-day`        |
| 3   | **Gráfico de linha**                 | `sales-by-day` nos dois períodos, faturamento \| pedidos           |
| 4a  | **Composição** (rosca)               | `summary.breakdown` + `commission.orders[]` (cashback resgatado)   |
| 4b  | **As filiais** \| Entrega × retirada | N × `summary?branch_id` \| `summary.order_types`                   |
| 5a  | **Produtos mais vendidos**           | `/reports/products`, top 5 com barra proporcional                  |
| 5b  | **Como pagam**                       | `/reports/payment-methods`, top 5                                  |
| 6   | **O que não virou venda**            | `/reports/cancellations` + a hora de entrada (`GET /admin/orders`) |
| 7   | Escopo e limites                     | sessão + o que o backend não devolve                               |

**Nenhuma rota nova.** Duas chamadas foram acrescentadas, e as duas são a mesma
rota com outro intervalo: `cancellations` no período anterior (para o delta do
quarto cartão). `payment-methods` e o extrato de comissão já eram carregados a
cada abertura de tela e agora são DESENHADOS — a primeira produzia no máximo uma
frase condicional, o segundo só um total.

---

## 2. As decisões que eu tomei sozinho

### 2.1 CARTÃO nesta tela, FOLHA no resto do painel

A skill de design diz, na decisão 6, que a tela é uma folha e que **não existe
cartão**. O pedido desta rodada pede cartão com todas as letras ("cartões com
fundo sutilmente elevado, canto arredondado consistente, sombra leve").

**Decidi pelo cartão, e escopei a exceção.** O motivo que a torna defensável: a
regra da folha foi escrita olhando para telas de UMA natureza (uma lista, um
formulário), e ali ela continua valendo — Pedidos, Cardápio, Clientes e Minha
loja não usam cartão nenhum. Desempenho é oito blocos de naturezas diferentes na
mesma página, e sem um limite desenhado eles leem como uma coluna contínua de
texto: que é literalmente o defeito que o pedido nomeia.

**Sem token novo.** O relevo é `--surface-raised` + `--line` + `--shadow-lift` +
`--r-card`, todos existentes. `--shadow-lift` é a sombra curta do segmento ativo
do segmentado, não `--shadow-raised` (que é para o que passa POR CIMA de outro
conteúdo). No tema claro os dois planos são o mesmo branco e quem separa é o fio
mais a sombra; no escuro o plano sobe um degrau.

O componente é `ds/Card`, que **existia e não tinha nenhum consumidor** — era o
cartão da direção anterior. Ele ganhou o relevo, uma variante `denso` (o cartão
de métrica) e um `testId`. A skill de design foi corrigida junto: o documento
descreve o painel que EXISTE.

### 2.2 O 4º cartão é CANCELAMENTO, e não cashback concedido

O pedido lista "Cashback concedido" como quarto indicador. **Ele não existe em
resposta nenhuma de `/admin`** — nem no `SalesBreakdown`, nem no resumo, nem em
rota própria. O que existe é o **resgatado**, pedido a pedido em
`CommissionReportItem.cashback_redeemed_amount`, e ele é SOMENTE_DONO: um quarto
cartão que some para a gerência quebraria a grade de quatro.

O cancelamento entra no lugar porque responde à mesma natureza de pergunta
(dinheiro que saiu), vale para os dois papéis e tem comparação. O **cashback
resgatado ficou na composição**, com esse nome — que é outro fato, e a diferença
entre os dois é dinheiro.

### 2.3 "Pedidos por bairro" saiu, e "Como pagam" ocupou o lugar

`AdminOrderListItem` **não traz endereço nenhum**; `neighborhood` só existe em
`OrderDetailResponse`, um pedido por vez, e nenhuma rota de relatório agrega por
bairro. Ler o bairro de um mês seria uma requisição por pedido. Ver §4.

No lugar entrou a distribuição de formas de pagamento, que já era carregada e
nunca desenhada. A taxa de cada meio é diferente e o dinheiro em espécie é troco
e risco: é resposta, não preenchimento.

### 2.4 O agrupamento é DIA ou SEMANA — a hora não existe

O pedido fala em "agrupamento por hora / dia / semana". Hora não existe:
`admin_report_service.py` não tem `extract(hour)` nem `date_trunc` em lugar
nenhum, e o mais fino que o backend entrega é o dia.

Dia até 31 pontos, semana acima disso (`DIAS_ATE_AGRUPAR_POR_SEMANA`). O corte é
de legibilidade: 31 pontos numa faixa de 1200px dão 38px por ponto; 90 dão 13, e
aí a linha vira ruído. A semana é somada no painel, por POSIÇÃO na série e não
por segunda-feira de calendário — é o mesmo alinhamento que a comparação entre
os dois períodos usa.

### 2.5 O freio da variação: base mínima de 5 e teto de ±999%

`readChangeComBase` (`report-model.ts`), com teste próprio.

- **Menos de 5 pedidos no período anterior → não há percentual.** O corte é o do
  pedido, e o número tem nome (`BASE_MINIMA_PARA_VARIACAO`). A régua: abaixo de
  cinco, um pedido a mais ou a menos move a variação em vinte pontos ou mais.
- **O que aparece no lugar não é um travessão mudo**: é a base ("1 pedido no
  período anterior"), que é a resposta verdadeira para "por que não tem variação
  aqui".
- **Acima de ±999% a tela escreve "mais de +999%"**, com a direção preservada.
- O mesmo freio vale para as linhas de "As filiais": a loja que abriu semana
  passada tem base de dois pedidos.

**Estendi o corte à TAXA, e não só à variação** (`taxaTemBase`). O caso que
obrigou: num período sem venda com dois pedidos cancelados,
`cancellation_rate_percent` vem `"100.0"` — certo, e ilegível como manchete de
28px. A tela mostra a contagem e o valor, que é a informação de verdade.

### 2.6 O estado vazio mantém a FORMA e troca o CONTEÚDO

A primeira versão desta rodada substituía a página inteira por uma frase num
cartão. **Estava errado**, e o print mostrou: mil pixels de nada, sem nenhuma
pista do que aquela tela mostra quando há venda.

O que ficou:

- a afirmação no topo ("Nenhum pedido foi faturado neste período") mais os
  pedidos excluídos;
- **os quatro cartões, com TRAVESSÃO** — não "R$ 0,00", que é um faturamento de
  zero reais afirmado com todas as letras, e é a leitura que faz o lojista achar
  que o painel quebrou;
- **cada bloco com uma linha dizendo o que apareceria ali** — o pedido, ao pé da
  letra;
- o gráfico não desenha linha rente ao chão nem régua de zero a zero, e a tabela
  equivalente de zeros também não é desenhada;
- "As filiais" com todas as lojas zeradas vira a mesma linha: comparar duas
  lojas que não venderam é desenhar um empate que não houve.

### 2.7 A prosa: de doze frases para duas

O pedido é literal — "corte o texto explicativo; um dashboard se explica pela
forma". Sobraram duas, e cada uma diz o que a FORMA não diz:

1. **o veredito**, como legenda do gráfico: ele nomeia a CAUSA por dia ("puxado
   para baixo por segunda"), que a linha desenha e não escreve;
2. **o contraste entre filiais**: a rede caiu 6,8% sem que nenhuma loja tenha
   caído 6,8% — uma subiu 14,5% e a outra caiu 25,5%. Sem essa frase o dono
   procura a causa na rede inteira.

Saíram da tela: ticket-ou-volume, dia fraco, concentração, volume sem receita,
desconto, retirada, pagamento, hora do cancelamento, cancelamento, e os três
grupos de produto (campeões / promissores / repensáveis).

**`insights.ts` e `product-quadrants.ts` continuam no repositório, inteiros e
testados, sem consumidor na tela.** Não os apaguei porque a decisão de aposentar
uma regra de leitura é de produto, não de forma, e o pedido era sobre forma. Um
e2e conta as frases (`sobraram DUAS frases de leitura na tela inteira`) para que
a poda não se desfaça uma frase de cada vez.

**Se elas continuarem sem consumidor na próxima rodada, apague as duas.** Código
morto com bilhete é código morto.

### 2.8 Coisas menores, decididas e registradas

- **O rótulo do cartão NÃO é caixa alta.** O pedido diz "rótulo pequeno em
  maiúscula discreta"; o sistema não tem esse nível, e
  `scripts/check-design-tokens.mjs` barra `text-transform: uppercase` fora de
  `tokens.css`. Quem faz o trabalho é `.t-label` (12/600/`--ink-3`).
- **O seletor de filial não foi duplicado no cabeçalho da tela.** Ele mora na
  barra do shell, e dois lugares para escolher a mesma coisa é como os dois
  passam a discordar. O que a tela ganhou foi a linha de escopo, no pé.
- **Sem biblioteca de gráfico.** Os três desenhos (linha, minissérie, rosca) são
  SVG à mão, com cor por token e classe: tema escuro de graça, `check-contrast`
  continua valendo, e nenhum KB novo. A área do gradiente é um `<linearGradient>`
  cujas paradas leem `--ink` pela FOLHA — cor no atributo seria literal no TSX, e
  o ESLint barra.
- **A rosca não tem paleta categórica.** As fatias são `--ink`, `--ink-2` e
  `--ink-3`, a mesma escada de tinta da tipografia, na ordem do tamanho. A
  informação é o comprimento do arco; a tinta só separa um arco do vizinho.
- **O miolo da rosca carrega o denominador** (o bruto). Sem ele, "89,5%" é fatia
  de um número que a tela não escreve em canto nenhum.
- **A cor inverte num lugar só**: o cartão de cancelamento. A SETA continua
  apontando para onde o número foi — inverter as duas faria o desenho mentir.
- **Esqueleto, não girador.** Ele desenha a forma que vai chegar, e o `@keyframes`
  tem desligamento próprio sob `prefers-reduced-motion` (os tokens `--motion-*`
  não alcançam uma animação declarada em `animation:`).
- **A minissérie ancora no ZERO**, e não no mínimo da série: comprimir entre
  mínimo e máximo é o truque que faz uma semana de R$ 400, 410 e 405 virar um
  zigue-zague de topo a base.

---

## 3. O que mudou fora de `src/performance/`

| Arquivo                                | O quê                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `src/ds/Card.tsx` / `.css`             | o relevo, a variante `denso`, o `testId`. Não tinha consumidor antes.       |
| `scripts/check-contrast.mjs`           | 3 pares novos: `--ok`/`--danger`/`--ink-2` sobre `--surface-raised`         |
| `.claude/skills/rapidex-design-system` | a seção de Desempenho e a exceção do cartão                                 |
| `e2e/fake-api.ts`                      | `lojaNova()`, o extrato de comissão com as 54 linhas, cancelamento anterior |
| `e2e/papeis.spec.ts`                   | a comissão é só do dono — mesma regra, forma nova                           |

O extrato de comissão vinha com `orders: []` e `orders_count: 54` — um falso mais
frouxo que o backend (§4.10 da skill `rapidex-api`). Com a lista vazia, a linha
de cashback da composição nunca era desenhada e o caminho ficava sem teste.

---

## 4. O que ficou BLOQUEADO por falta de rota

Os três primeiros já estavam pedidos em
`scratchpad/pedido-backend-desempenho.md`; o quarto é novo desta rodada.

1. **Cashback CONCEDIDO** (o crédito gerado na venda). Não existe em resposta
   nenhuma de `/admin`. O painel só alcança o RESGATADO, somando
   `cashback_redeemed_amount` do extrato de comissão — SOMENTE_DONO.
2. **Faturamento por HORA.** Nenhuma rota de relatório desce abaixo do dia.
3. **Quem compra (novo × recorrente) e o tempo de preparo.**
4. **Pedidos por BAIRRO — NOVO.** `AdminOrderListItem` não traz endereço nenhum.
   O pedido ao backend está no fim de `pedido-backend-desempenho.md`.

Os quatro estão escritos na tela, no pé, em uma linha — não numa seção vazia com
título anunciando o nada.

---

## 5. Para a próxima sessão

- **Olhe as capturas antes de mexer**:
  `CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --workers=1`.
- **A poda da prosa é frágil por natureza.** O e2e que conta as frases é a
  fechadura; se você precisar acrescentar uma, acrescente também a razão pela
  qual a FORMA não dá aquela resposta.
- **`insights.ts` e `product-quadrants.ts` estão sem consumidor** — ver §2.7.
- O `Card` do design system agora tem relevo. Se alguma tela operacional passar a
  usá-lo, a decisão 6 da skill precisa ser revisitada de novo, não contornada.
