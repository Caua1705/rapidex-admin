---
name: rapidex-design-system
description: Fonte de verdade visual do Admin Rapidex. Use ao criar, alterar ou revisar UI em src/, especialmente shell, tokens, componentes, telas operacionais, responsividade, tema escuro e acessibilidade. Não use para mudar regras de negócio, contratos, API ou backend.
---

# Design system do Admin Rapidex

Este documento descreve o painel que EXISTE, não o que se pretende construir.
Cada número aqui está em `src/styles/tokens.css`, cada componente está em
`src/ds/`, e cada regra tem um arquivo que a aplica. Se algo daqui divergir do
código, o código está certo e este documento está velho — corrija o documento,
nunca crie uma segunda linguagem visual para contornar a divergência.

Código de referência:

| Camada         | Arquivo                                                     |
| -------------- | ----------------------------------------------------------- |
| Tokens         | `src/styles/tokens.css` — o único lugar com valor literal   |
| Reset e foco   | `src/styles/reset.css`                                      |
| Tipografia     | `src/styles/typography.css` — as classes `.t-*`             |
| Primitivos CSS | `src/styles/primitives.css` — botão, campo, aviso, etiqueta |
| Componentes    | `src/ds/`                                                   |
| Moldura        | `src/layout/AppShell.*`                                     |
| Galeria viva   | `/ui`, só em desenvolvimento (`src/ui-gallery/`)            |

## Limites invariáveis

Trabalho de interface pode reorganizar markup e composição, mas preserva:

- hooks, estados, efeitos, callbacks e permissões;
- endpoints, requests, payloads, query params e respostas esperadas;
- autenticação, autorização, rotas reais e redirecionamentos;
- estados e transições de pedidos, pagamentos e cardápio;
- cálculos, filial, cashback, cupons, WhatsApp e integrações;
- dados reais. Não criar exemplos, APIs, rotas ou funções inexistentes.

O backend continua sendo a autoridade mesmo quando a UI antecipa uma restrição.
Páginas "Em breve" são estado vazio honesto, nunca tela falsa: sem botão morto,
sem número de exemplo, sem barra de progresso.

## A direção — "Refinada"

Três direções visuais foram construídas lado a lado e comparadas na tela (uma
tabela sóbria, um quadro de cartões arredondados e um console escuro denso). A
escolhida foi a primeira, e ela se resume em sete decisões. Todas as seções
seguintes são consequência delas.

**1. A tipografia é a hierarquia.** IBM Plex Sans, autohospedada. Quem separa
título de dado é corpo, peso e tinta — nunca caixa alta, nunca cor.

**2. Neutros frios.** Cinza com um grão de azul, do papel ao carvão. O frio
afasta os neutros do laranja da marca, e é o que permite a decisão 4.

**3. A lateral é clara.** Ela era escura nos dois temas, e era a peça que mais
fazia o painel ler como console de servidor. Hoje ela segue o tema.

**4. O laranja tem UM emprego: a ação primária.** Botão de aceitar, de avançar
o pedido, de salvar, de criar. Ele NÃO pinta navegação, seleção, foco, rótulo,
borda, ícone, gráfico ou destaque decorativo. Uma cor que aparece em oito
lugares não destaca nenhum.

**5. Pedido é linha, não cartão.** Onze cartões são onze molduras disputando a
mesma atenção. A linha põe os campos em colunas alinhadas e deixa o alinhamento
fazer o trabalho que a moldura fazia.

**6. A tela é uma FOLHA.** Não existe cartão branco flutuando sobre chão cinza.
O plano da página é `--surface` do começo ao fim; quem dá começo e fim a um
bloco é um FIO e o respiro. Cartão sobre chão é a estética de painel
administrativo de biblioteca pronta, e ela saiu inteira nesta rodada.

**7. No celular a linha não dobra — ela troca de desenho.** A leitura por
coluna é o ganho inteiro da direção e ela some assim que a linha dobra em duas.
No telefone a densidade importa menos (o dono quer ver os 3 novos, não os 33),
então lá vale legibilidade e alvo de toque.

Princípios de decisão, quando estética competir com operação, nesta ordem:
clareza operacional, legibilidade, hierarquia, consistência, velocidade de uso,
acessibilidade, acabamento, identidade, estética.

O painel não deve parecer ERP antigo, template administrativo genérico,
wireframe, projeto acadêmico ou SaaS azul-cinza sem identidade. Premium aqui
significa alinhamento, ritmo, proporção e microinteração — nunca glassmorphism,
gradiente decorativo, blur, sombra pesada ou cartão para toda informação.

## Tipografia

**IBM Plex Sans Variable**, autohospedada por `@fontsource-variable/ibm-plex-sans`
(importada em `src/main.tsx`, sem CDN). Ela substituiu a Inter porque a
neo-grotesca neutra por definição não tem defeito e não tem voz; a Plex tem osso
de grotesca de engenharia sem virar sotaque, e é ela que faz a mesma escala ler
como INSTRUMENTO. `eslint.config.js` barra qualquer outra família no `.tsx`;
`scripts/check-design-tokens.mjs` barra família monoespaçada em qualquer `.css`.

Cinco níveis, e só cinco. Cada classe declara corpo, entrelinha, peso,
espacejamento e tinta juntos — meia definição é como um nível vira quatro
variantes em quatro telas.

| Nível | Classe       | Tokens                                 | Uso                                |
| ----- | ------------ | -------------------------------------- | ---------------------------------- |
| 1     | `.t-title`   | 22px / 28 / 600 / −0.022em / `--ink`   | título de página — um por rota     |
| 2     | `.t-section` | 15px / 22 / 600 / −0.01em / `--ink`    | cartão, coluna, aba, diálogo       |
| 3     | `.t-label`   | 12px / 16 / 600 / +0.004em / `--ink-3` | nome de campo, cabeçalho de coluna |
| 4     | `.t-body`    | 14px / 20 / 400 / −0.006em / `--ink`   | o conteúdo                         |
| 5     | `.t-aux`     | 13px / 18 / 400 / −0.002em / `--ink-3` | ajuda, meta, hora, contagem        |

Além deles existe `.t-crumb` (13 / 600 / `--ink-2`): o nome da seção aberta
DENTRO de uma tela, que é a continuação do título e não um segundo título.

A prova de revisão: bata o olho em qualquer texto da tela e diga qual nível ele
usa. Se não der para dizer, o texto está errado — não falta um nível.

Regras:

- **Caixa alta com tracking não existe no sistema.** Nem na navegação, nem em
  cabeçalho de coluna. `check-design-tokens.mjs` barra `text-transform: uppercase`
  fora de `tokens.css`.
- **Pesos:** 400, 500, 550, 600, 700 (`--w-regular` … `--w-bold`). O 550
  (`--w-strong`) existe por causa da Plex: entre 500 e 600 há um degrau grande, e
  o NOME de uma linha de lista (cliente, produto) precisa ficar acima do corpo
  comum sem chegar ao peso de título. Ele é o peso do nome em `OrderRow`,
  `CustomersPage` e `MenuPage` — os três usam o mesmo.
- **Números de alta prioridade:** `--row-time-*` (16/20) é o cronômetro da linha
  de pedido e o total do detalhe do pedido; `--metric-*` (28/34) é o número do
  painel de Desempenho. Não há um terceiro.
- **`.tnum`** trava a métrica tabular; **`.num`** acrescenta alinhamento à
  direita. Eles valem em quatro casos e só neles: dinheiro, hora, tempo
  decorrido e nº de pedido. Contagem numa frase ("12 itens") não leva.
- **A Cozinha é a única exceção de corpo** (`--k-num` 34, `--k-item` 18), e o
  motivo é físico — ver "Cozinha" mais abaixo.

## Espaçamento

Sete degraus, e nada fora deles: `--sp-4`, `--sp-8`, `--sp-12`, `--sp-16`,
`--sp-20`, `--sp-24`, `--sp-32`.

- **4** dentro de um controle: ícone ↔ texto, rótulo ↔ campo;
- **8** entre controles irmãos; padding de linha densa;
- **12** entre campos de uma mesma linha;
- **16** padding de bloco;
- **20** entre blocos de uma seção;
- **24** entre seções, e o respiro lateral da tela (`--page-pad`);
- **32** topo de tela e estado vazio — o único degrau generoso.

Não existem `--sp-2` nem `--sp-6`, e é de propósito. Medidas de CONTEÚDO (largura
de coluna, faixa de gráfico, altura de barra) não são espaçamento e moram em
tokens próprios — `--col-*`, `--chart-*`, `--w-*`.

Os aliases legados `--s-1`…`--s-7` e os `--section-size`/`--weight-semibold` da
direção anterior **não existem mais**. Um alias sem consumidor não é
compatibilidade: é uma segunda maneira de escrever a mesma coisa, esperando
alguém escolher a errada.

## Raios

`--r-xs: 3`, `--r-chip: 5`, `--r-field`/`--r-control: 7`, `--r-card: 10`,
`--r-sheet: 14`, `--r-round: 999`.

O raio diz o TAMANHO do objeto, não o gosto de quem o escreveu:

- **xs** — o quadrado do checkbox, a ponta da coluna do gráfico;
- **chip** — etiqueta, cápsula, contador;
- **field / control** — botão, campo, segmento;
- **card** — bloco, menu flutuante, balão ancorado num controle;
- **sheet** — o que ocupa a tela: diálogo e a folha do celular.

Não inventar um raio por componente. `check-design-tokens.mjs` barra
`border-radius` com valor solto fora de `tokens.css`.

## Superfícies, fios e elevação

### Os planos

| Token                | Papel                                                          |
| -------------------- | -------------------------------------------------------------- |
| `--surface`          | **a folha** — o plano de toda tela do painel                   |
| `--surface-raised`   | o que SOBE: menu, balão, diálogo, gaveta, barra de salvar      |
| `--surface-muted`    | agrupamento: trilho do segmentado, palco de amostra            |
| `--surface-selected` | seleção sem moldura — cinza frio, nunca a marca                |
| `--field`            | o plano do que se PREENCHE                                     |
| `--bg`               | o chão do SHELL, e a única tela que o usa como plano é o login |
| `--nav-*`            | a navegação — família própria, ver "Shell"                     |
| `--k-*`              | a Cozinha — paleta saturada, um valor por tema, ver "Cozinha"  |

`--bg` **não é plano de página**. Toda tela autenticada é uma folha em
`--surface`; o login é a exceção porque ali não há tela por baixo, há uma janela
com um cartão centrado.

### A regra de separação, na ordem

1. **TOM** — o padrão. Um degrau de plano já é começo e fim de bloco.
2. **FIO** — quando o limite é operável (campo), quando uma lista precisa de
   régua entre linhas, quando um grupo precisa de começo, ou quando o tom não
   chega (tema escuro: `--card-edge`).
3. **SOMBRA** — só quando há elevação de verdade, isto é, quando o elemento
   passa POR CIMA de outro conteúdo: menu, balão, diálogo, gaveta, barra
   grudenta, cartão do login.

Três fios, três trabalhos:

- `--line` separa (régua de lista, divisão de seção);
- `--line-strong` ABRE um grupo (primeira linha de um bloco, cabeçalho de
  coluna sobre os dados, total sobre as parcelas);
- `--line-control` contorna o que se opera, e é o único medido contra as
  superfícies (WCAG 1.4.11).

`--card-edge` é transparente no claro e `--line` no escuro. Ele existe para que
"borda em tudo" acabe sem precisar de um bloco `[data-theme="dark"]` por
componente.

**Não existe sombra de bloco parado.** O token `--shadow-card` foi removido
justamente porque valia `none` — e um token que vale `none` é um convite a
alguém lhe dar um valor. Sobraram dois: `--shadow-lift` (o segmento ativo do
segmentado) e `--shadow-raised` (o que flutua de verdade).

## Cor

Valores literais existem SÓ em `src/styles/tokens.css`. `npm run lint` cobra
isso nos dois lados: `check-design-tokens.mjs` no CSS, `eslint.config.js` no
TS/TSX. `check-contrast.mjs` mede 180 pares nos dois temas contra a WCAG 2.2 AA
e falha o build se algum reprovar — ao criar uma combinação nova, acrescente o
par lá.

### A marca

`--ember` / `--ember-press` / `--on-ember`. Um emprego: **a ação primária**.
`.btn--primary`, o botão que avança o pedido, o "Novo item", o "Salvar".

O que ela deixou de pintar nesta rodada, e para onde cada uso foi:

| Uso antigo                  | Hoje                                         |
| --------------------------- | -------------------------------------------- |
| item ativo da navegação     | `--nav-active` + peso 600 + fio `--nav-rail` |
| linha/pedido selecionado    | `--surface-selected`                         |
| anel de foco                | `--focus`, que é `--ink`                     |
| sublinhado da aba ativa     | `--ink`                                      |
| seleção de texto            | `--surface-selected`                         |
| faixa do topo do login      | removida                                     |
| fim do degradê de maturação | `--danger`                                   |
| borda do campo em foco      | `--focus`                                    |

Não existe mais `--ember-wash`: um wash da marca é, por construção, um convite a
espalhar a marca.

A regra de revisão é literal: **se você escreveu `var(--ember)` e o elemento não
é a ação primária da tela, o token está errado.**

### Semântica de estado

`--ok` (no ar, à venda, variação para cima), `--alert` (esperando, atenção),
`--danger` + `--danger-press` + `--on-danger` (perigo, variação para baixo),
`--info` (isto é uma nota, não um problema). Cada um responde a UMA pergunta e
nenhum é decorativo.

### Status do pedido

Sete estágios: pendente (ocre), aceito (marinho), preparando (ametista), pronto
(verde), entrega (petróleo), concluído (ardósia), cancelado (carmim). Fundas e
dessaturadas de propósito — elas são lidas a 60cm ao lado de texto, numa tela
quase sem cor.

Quem pinta um status **não escolhe matiz**: põe `is-<estágio>` no elemento e lê
`--st` e `--st-wash`. Assim o chip, o fio da linha, o contador da faixa e o
cartão da Cozinha saem sempre da mesma fonte, e acrescentar um estágio é
acrescentar um token.

Nenhum estado pode depender só de cor (WCAG 1.4.1): combine sempre texto,
posição, forma ou ícone.

## Shell

`src/layout/AppShell.*`. Três formas, e a regra é sempre a mesma — a informação
não desaparece, ela troca de lugar.

| Largura  | Navegação                                                            |
| -------- | -------------------------------------------------------------------- |
| ≥ 1180px | lateral de 212px, com nomes e grupos escritos                        |
| 768–1179 | trilha de ícones de 68px; o nome vive no `title` e no leitor de tela |
| < 768px  | barra INFERIOR de quatro alvos; "Mais" abre o resto numa folha       |

A lateral é um plano do TEMA (`--nav-*`): no claro, um degrau acima do chão; no
escuro, um degrau abaixo dele. O item ativo é dito por três coisas sem cor:
tinta cheia, peso 600 e um fio de 2px na margem. É a mesma gramática do bloco de
estágio na tabela de Pedidos, da categoria aberta no Cardápio e da seção aberta
em Minha loja — um fio à esquerda diz "este é o grupo aberto".

A barra do topo do shell mede `--topbar-h` (52px) e carrega o seletor de filial
e a conta. Ela fica em `--z-shell`, ACIMA da faixa da tela (`--z-sticky`): as
duas são grudentas, e com a mesma camada a lista de filiais abria atrás do
filtro de Pedidos e o clique ia parar no filtro.

## A faixa de 52px

`src/ds/PageBar.tsx`. **Toda tela do painel começa com ela**, e é a peça que faz
seis telas lerem como um produto.

```tsx
<PageBar title="Pedidos" aside={<Tabs … />} meta={<contadores />}>
  <OrdersFilters … />
</PageBar>
```

O que ela garante, igual em todas: o título nasce na mesma horizontal, as
ferramentas ficam à direita na mesma linha e sem moldura, o limite de baixo é um
fio de 1px, e ela gruda no topo enquanto o conteúdo rola.

- `title` — nível 1, um por rota.
- `crumb` — o nome da seção aberta DENTRO da tela ("Minha loja › Horários").
- `aside` — o que vive com o título: abas, etiqueta de estado, ressalva de escopo.
- `meta` — o grupo do meio: contadores.
- `children` — as ferramentas.

**Não existe subtítulo explicando a tela.** Quem abre "Clientes" sabe o que é a
tela, e a frase custava uma dobra por turno para explicar o óbvio uma vez. O que
existe é ressalva: uma frase que diz o que a tela NÃO tem, ou até onde a
configuração alcança. Essa fica.

A faixa ENVOLVE quando aperta — as ferramentas descem para uma segunda fileira
de 34px alinhada à direita. Ela é um `container` de consulta chamado `barra`,
porque o que decide se está apertada é a largura DELA e não a da janela: em
1440 com o painel de detalhe aberto ela tem 828px.

## Componentes

A consistência vem do componente base. Se a diferença entre duas telas nasce do
primitivo, conserte o primitivo. **Não existe segunda implementação** de botão,
campo, busca, seleção, chave, aba, etiqueta, tabela, linha de pedido, chip de
status, diálogo ou faixa de título — e quando existiu, foi assim que se
resolveu: a variante entrou no componente (`SearchField variant="barra"`,
`Tabs variant="barra"`, `StatusChip label`), não uma cópia na página.

### Botão — `primitives.css`

Alturas 34 / 28 (`--sm`) / 44 no toque. Variantes reais: padrão, `--primary`,
`--danger`, `--ghost`, `--ghost-danger`, `.icon-btn`, `--block`.

Sem relevo: plano chapado, um fio, sem `box-shadow`. Peso 500 no comum e 600 no
primário — numa barra com sete controles, sete rótulos em semibold são sete
títulos disputando a mesma linha. **Se dois primários aparecem juntos, um deles
não é a ação**: é uma alternativa, e alternativa é `.btn` comum.

O destrutivo tem tinta própria (`--on-danger`) e escurece ao ser pressionado —
não inverte para fundo claro, que fazia o botão parecer desligado no instante
em que o dedo estava nele.

### Campo — `primitives.css` e `ds/Input`

`.input`/`.textarea` (classe) e `Input`/`Textarea`/`Select`/`SearchField`/`RangeInput`
(componentes) compartilham altura, corpo, raio, plano, contorno e os cinco
estados. Um formulário não pode ter dois tamanhos de campo conforme quem o
escreveu usou o componente React ou a classe.

- Papel branco com um fio `--line-control`; sem baixo-relevo, sem fundo cinza.
- **No foco o fio vira tinta cheia** e ganha o anel. Nunca a marca.
- Rótulo é nível 3; **o VALOR é que se lê** (nível 4, `--ink`).
- Placeholder não substitui rótulo.
- **A largura do campo é medida de CONTEÚDO**: `--w-numero` (92), `--w-dinheiro`
  (168), `--w-faixa` (236), `--w-texto-curto` (320). Um campo de dinheiro com
  900px de largura é o sintoma mais visível de formulário cru — a caixa promete
  um endereço e recebe "20,00".

`SearchField` tem duas formas: `caixa` (padrão) e `barra`, que tira o contorno e
deixa um fio embaixo. A segunda é a que vive dentro da `PageBar`, onde uma caixa
de quatro lados no meio de uma linha de texto é o objeto que faz a faixa ler
como bloco.

### Escolha e chave — `ds/Choice`, `ds/Switch`

Checkbox e rádio marcados usam `--mark-bg`/`--mark-ink`, nunca a marca: um
checkbox ligado não é a ação primária da tela. O desenho do check e do ponto é
CSS puro em `currentColor` — nada de imagem, nada de SVG com cor literal.

A chave é única (`ds/Switch`) e comunica estado por posição, cor (`--ok`) e nome
acessível. O erro de um grupo usa `--danger`, não a matiz de um estágio de
pedido.

### Abas e segmentado

`ds/Tabs` muda o CONTEXTO da tela: sublinhado de 2px em tinta cheia no ativo,
teclado de setas (roving tabindex), sublinhado que desliza. `variant="barra"`
ocupa a altura inteira da faixa de 52px e abre mão da própria régua, porque
quem já desenha o fio ali embaixo é a `PageBar`.

`.seg` (segmentado) escolhe UMA alternativa dentro do mesmo contexto: trilho
`--surface-muted`, segmento ativo em `--surface` com peso e `--shadow-lift`.
Nenhum dos dois usa a marca — aba ativa é onde a pessoa ESTÁ, não o que ela deve
fazer.

### Etiqueta, chip de status e badge

`.tag` é uma palavra sobre um plano de agrupamento, sem contorno. `StatusChip` é
o chip de estágio: fundo `--st-wash`, ponto na matiz e **texto em tinta comum**
— isso é medido, porque as três matizes mais claras da escala reprovariam sobre
o próprio wash. `label` sobrescreve a palavra (para separar "Recusado" de
"Cancelado") e nunca a matiz.

Não transformar todo metadado em chip.

### Tabela — `ds/DataTable`

Desktop: colunas reais, **cabeçalho como rótulo sobre um fio `--line-strong`**
(não uma faixa cinza), alinhamento numérico à direita, hover tonal, linha de
`--row-dense-h`. `--tabela-pad` controla o respiro lateral: `--sp-16` dentro de
um bloco, `--page-pad` numa tabela que corre até a margem.

No celular a tabela deixa de ser tabela: cada linha vira bloco e o cabeçalho da
coluna reaparece ao lado do valor por `content: attr(data-col)`. Não se resolve
tabela estreita com rolagem horizontal — some justamente a primeira coluna, que
é a que identifica a linha.

`caption` não é opcional; pode ser visualmente escondida, nunca ausente.

### Linha de pedido — `ds/OrderRow`

A unidade da lista, e o único componente de pedido do sistema. Não é uma
`<table>`: a linha inteira é UMA ação (abrir o detalhe), e a única forma de uma
tabela ter linha clicável é pendurar `onClick` numa `<tr>` — que é como uma tela
perde o teclado. Aqui a linha é um `<button>` em `display: grid`.

Hierarquia, na ordem em que um funcionário no pico precisa dela:

1. **estágio** — o fio de 2px na margem + o nome, escrito uma vez por bloco;
2. **tempo** — tabular, o maior corpo da linha, com a barra de maturação;
3. **cliente** — 14/550;
4. **pedido** — nº e hora de entrada;
5. **modalidade**;
6. **pagamento** — forma e situação, e o único lugar onde a linha levanta a voz;
7. **valor** — tabular, à direita.

A grade (`--grade-pedido`) é declarada UMA vez na lista e herdada por todas as
linhas, inclusive as do histórico: duas grades separadas é como a coluna do
valor começa a desalinhar entre um bloco e outro.

**Dois layouts, e só dois.** O largo e o COMPACTO, que entra por
`@container lista (max-width: 700px)` — no telefone e também com o painel de
detalhe aberto. O compacto NÃO é a linha larga dobrada: é outro desenho, com
76px de alvo de toque, tempo/cliente/valor na primeira fileira e
estágio·nº·hora·modalidade·pagamento na segunda, em 12px. O limiar de 700px foi
medido: as seis colunas de largura fixa somam 568px e os vãos mais o respiro
lateral somam 72, então abaixo de 700 o nome do cliente fica com menos de 60px —
e uma coluna de 60px não é uma coluna.

Cada `--col-*` é medida de CONTEÚDO, e é assim que ela deve ser ajustada: 104
cabe "Em preparo" com o fio e o recuo da margem, 140 cabe "Aguardando pagamento"
em 12px, 92 cabe "R$ 1.240,00". Encolher uma delas por gosto é como a célula
quebra em três linhas e estica a linha inteira.

`orders/OrderLine` é só o tradutor de `OrderListItem` para as propriedades da
linha — essa fronteira é o que permite ao `ds/` compilar sem depender do
`openapi.d.ts` gerado.

### Barra de maturação — `ds/MaturationBar`

O único ornamento permitido, e ela carrega DADO: um fio de 3px sob o tempo
decorrido que preenche contra a janela de preparo da loja. Degradê contínuo
(`--grad-maturacao`), de ardósia a ocre a carmim — não a marca, porque ela mede
ESTADO. Acima de 85% ela pulsa (a única animação de repetição do sistema,
abaixo de 3Hz por WCAG 2.3.1). Sem janela configurada ela não aparece: uma
barra sem régua mediria o nada.

### Folha, diálogo, menu e balão

`ui/Modal` centraliza no desktop e vira folha de rodapé no celular. `ds/Sheet` é
a navegação do telefone. Menu ancorado (`ds/Select`, o menu de ações do
Cardápio) e balão ancorado (o ajuste de preparo, o balão do gráfico) usam
`--surface-raised`, `--r-card` e `--shadow-raised`, saem do fluxo e ficam em
`--z-popover`. **Um popover escrito no TSX sem folha de estilo vira um bloco cru
no meio da barra** — foi exatamente o que aconteceu com `.prep__popover` antes
desta rodada.

### Avisos e estados

`.alert--info` / `--warn` / `--error`: sem moldura, porque o wash já é a
moldura, e com `role` adequado. Ficam próximos da origem e não se repetem por
seção.

Estado vazio diz o que aconteceu e, só se existir ação real, como sair.
Carregando não inventa conteúdo — e "nenhum resultado" só é uma afirmação
DEPOIS de carregar. Agrupamento vazio não é desenhado: um cabeçalho anunciando
zero custa uma dobra por turno.

## Telas

### Pedidos — `src/orders/`

A tela operacional principal, e a que a direção resolve primeiro. O diagnóstico
que abriu a rodada: o primeiro pedido começava a ~500px do topo, atrás de
título, subtítulo, abas com régua própria, um cartão de filtros de 130px e três
cabeçalhos de faixa.

**DUAS FAIXAS, PORQUE SÃO QUATRO NATUREZAS.** Tudo já morou numa faixa só, na
ordem em que foi escrito — e quatro coisas diferentes dividindo a mesma régua
não têm hierarquia nenhuma. O sintoma mais visível era o contador de estágio
numa fileira e o filtro de período em outra, sendo que os dois falam do MESMO
recorte.

| Faixa                | Altura                  | Grupos                                                                                                                                        |
| -------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — A TELA           | 52px (`ds/PageBar`)     | **navegação** (título e abas) à esquerda; **ação** (sino, atualizar) na margem direita                                                        |
| 2 — A LISTA E A LOJA | 40px (`.orders__barra`) | **recorte** (busca · período · contadores) à esquerda; depois de um fio, **promessa** (preparo com o ajuste · entrega · tempo real) à direita |

A regra que decide o grupo é uma pergunta: **isto recorta a lista?** Período,
busca e contadores sim — os contadores são o RESULTADO do recorte, e é por isso
que descer com o período foi o conserto principal. Preparo, entrega e tempo real
não recortam nada: eles descrevem a LOJA, e misturados com o período davam a
impressão de que ajustar o preparo mudaria a lista. Atualizar e o sino não se
leem, se apertam — e sobem para o canto em que toda tela do painel põe a ação.

Os contadores aparecem SEMPRE, zerados inclusive — é o que paga o fim das faixas
de agrupamento: "Prontos 0" custa 70px de largura numa linha que já existia, e
custava 40px de altura numa faixa que anunciava o nada. O marcador deles é o
PONTO de `ds/StatusChip`, não o fio de 2px da lista: numa fileira horizontal um
traço vertical entre dois nomes vira um separador, não uma marca de estágio.

Abaixo de 900px de FAIXA (consulta de container, não de janela — em 1440 com o
painel aberto ela tem 828), os dois grupos empilham e o fio que os separa deixa
de ser vertical e passa a ser horizontal.

O estágio é uma **coluna mesclada**: escrito na linha que abre o bloco, com o
fio de cor descendo nas seguintes. Bloco sem pedido não é renderizado.

As ferramentas não abrem nem fecham. Numa tela que fica aberta o turno inteiro,
um filtro atrás de um botão "Filtros" é um filtro que ninguém lembra que ligou —
o lojista jura que sumiu pedido e o que sumiu foi a memória de que ontem ele
deixou o período em "últimos 7 dias".

### Detalhe do pedido — `orders/OrderDetailPanel`

Coluna permanente de 400px à direita: com a janela antiga, abrir o pedido
escondia justamente a lista que diz o que fazer em seguida. Abaixo de 1280px ela
só aparece com seleção e flutua; abaixo de 720px vira tela cheia com os botões
esticados no rodapé.

**A TELA ESCOLHE O PRIMEIRO PEDIDO SOZINHA** na abertura, como o Gmail abre na
primeira conversa: a coluna abria com uma frase explicando o que acontece se
alguém clicar, e isso era um terço da tela gasto para ensinar o clique que o
lojista dá cinquenta vezes por turno. Três condições seguram o comportamento —
só onde o painel é COLUNA (`useDetailColumn`, ≥1280px: no telefone ele é a tela
inteira e abrir Pedidos cairia num detalhe), só uma vez por visita (senão
"Fechar detalhe" seria um botão que não faz nada) e só com a lista carregada.
Sem nenhum pedido na lista, o painel não é renderizado.

O cabeçalho tem a MESMA altura da faixa da lista, e é isso que faz as duas
metades lerem como uma tela só. Dentro, blocos separados por fio: cliente,
endereço, itens, observação, pagamento, histórico. O total leva `--row-time-*` e
peso 700 sobre um fio `--line-strong` — e não é laranja: a brasa marca ação, não
importância.

**O BLOCO DO CLIENTE DIZ QUEM VOLTA SEMPRE**: "Cliente há 3 meses · 12 pedidos",
ou "Primeiro pedido" para quem estreia. É a pergunta que o lojista faz ANTES de
aceitar, e até então ela só existia noutra tela. O dado sai da MESMA rota de
Clientes (`GET /admin/customers`, procurada por telefone) — não há rota nova,
nem número estimado. O casamento é por dígitos (`phoneDigits`), e sem casamento
exato a linha não aparece: histórico da pessoa errada ao lado do endereço de
entrega é pior que histórico nenhum. A leitura é de APOIO, então o erro é
silencioso e a filial é a mesma do quadro — dois números na tela respondendo ao
mesmo recorte.

### Cozinha — `src/kitchen/`

**A única tela com PALETA própria, e o motivo é físico.** Ela é um monitor
pendurado na parede, lido a dois metros por quem está com as mãos ocupadas:

- matiz **dessaturada** perde a identidade antes de perder a luminosidade, e a
  três metros as matizes de status do painel viram mancha cinza — não dá para
  separar "preparando" de "pronto" do outro lado do salão;
- por isso a escala daqui é **saturada**, e a direção dela acompanha o plano.

**ELA SEGUE O TEMA, como todas as outras.** O que muda entre os dois não é
escolha, é a conta do contraste:

| Tema   | A escala                                                      |
| ------ | ------------------------------------------------------------- |
| escuro | **acende**: matiz clara e saturada sobre carvão (`#33d68d`)   |
| claro  | **aprofunda**: matiz funda e saturada sobre papel (`#06663a`) |

`#33d68d` sobre branco dá 1.9:1 e some — não existe verde ao mesmo tempo claro e
legível sobre papel. No claro quem faz o trabalho da luz é a saturação, e é isso
que separa `--k-pronto` de `--st-pronto`: quase a mesma luminosidade, e não a
mesma cor.

Esta escala já foi FIXA no escuro nos dois temas, com o argumento de que um
monitor de parede não acompanha a preferência de quem está no escritório. O
argumento tinha um furo prático: quem administra é a mesma pessoa que pendura o
monitor, e uma tela do painel que ignora o interruptor de tema lê como defeito.

A implementação é reapontar os tokens SEMÂNTICOS dentro de `.kitchen` para a
escala `--k-*`, e não escrever regra por componente: assim `.btn`, `.alert`,
`.conn`, `ds/Switch` e o `is-<estágio>` de `tokens.css` caem na paleta da parede
sozinhos, nos dois temas. A alternativa — um bloco `.kitchen .btn { … }` por
componente — é a que garante que o próximo componente usado ali apareça com a
paleta errada.

O que ela herda do resto do painel é o esqueleto: espaçamento, raios, movimento
e os cinco níveis. O que muda é o corpo de cada nível e a saturação da cor.

Sem sidebar, sem filtro, sem busca, sem seletor de período. Nada de cliente,
telefone, endereço ou total: a cozinha monta prato.

### Cardápio — `src/menu/`

Faixa de 52px (título · busca · "Novo item", o único laranja da tela), a frase de
escopo dizendo **de qual loja é o cardápio na tela**, e o corpo em duas colunas:
a de categorias separada por um FIO — a mesma peça que Minha loja usa — e a
lista de itens correndo até a margem. As duas rolam separadas.

**A tela é de UMA filial**, como as seções de filial de Minha loja: ela adota a
filial resolvida no seletor do topo, e o seletor deixa de oferecer "Todas as
filiais" enquanto ela está aberta. Não é preferência de enquadramento — o
cardápio passou a ser da filial no backend, e ali "todas" não é um recorte mais
largo: é o cardápio das lojas somado, com cada categoria e cada item em dobro.
A frase de escopo é o que separa uma coisa da outra antes de o lojista editar um
preço achando que edita nas duas lojas.

A régua da categoria aberta é subordinada à faixa da tela: 44px contra 52, nível
2 contra nível 1. Abaixo de 1024px a coluna de categorias deita e vira fita
rolável; abaixo de 720px o item deixa de ser linha e vira bloco.

**O diálogo do item pergunta "é o mesmo item de outra loja?"** logo depois do que
o item É (nome, preço, categoria, descrição) e antes de como ele se liga à
operação — a pergunta é de identidade e só se responde com o nome já digitado,
que é de onde a busca parte. A busca abre DENTRO do campo, no lugar do botão, e
nunca como um segundo diálogo por cima do primeiro: modal sobre modal esconde o
formulário que a pessoa estava preenchendo, e o Esc de cima fecha os dois. O
plano dela é `--surface-muted` (agrupamento) e sem sombra, porque nada está por
cima de nada. O campo não aparece num restaurante de uma loja só.

### Clientes — `src/customers/`

Faixa de 52px (título · busca · contagem) e uma tabela até a margem. A ressalva
("e-mail e CPF são da conta do cliente na plataforma") fica acima da lista, uma
vez, porque é a pergunta de quem abre a tela.

Não abre o cliente, não linka para os pedidos dele e não ordena por coluna — o
contrato não tem nada disso, e um link impreciso é pior que link nenhum.

### Desempenho — `src/performance/`

Uma tela que RESPONDE, não que exibe. A primeira coisa é uma FRASE, e ela sai de
regras determinísticas sobre o que as rotas devolvem (`insights.ts`) — sem IA,
sem estimativa. Toda frase tem limiar nomeado, e frase cuja condição não bate
não aparece: não existe frase neutra de preenchimento.

A forma, depois desta rodada:

1. **uma banda de topo** com a resposta (22px/500), os três números crus
   (`--metric-*`, com delta em `--ok`/`--danger` mais seta mais sinal) e as
   ressalvas, fechada por um fio `--line-strong`;
2. **o gráfico na largura inteira**, logo abaixo — é a peça que mais faz uma
   tela de relatório ler como painel;
3. **as quatro perguntas em grade de duas colunas**, separadas por fio, que
   volta a uma coluna abaixo de 1100px.

Nenhum cartão. Nenhuma métrica inventada. O gráfico é coluna (magnitude por
categoria discreta), série única, marca neutra, sem legenda; o dia de pico leva
rótulo direto e tinta cheia — a mesma informação que o rótulo já escreve, um
degrau acima na escala de tinta. Dia sem venda tem altura zero, não um mínimo
"para aparecer".

Não filtra por filial, e DIZ isso: nenhuma das rotas aceita `branch_id`, e o
seletor do topo ficaria parecendo um filtro que pegou.

### Minha loja — `src/store/`

Uma seção, uma página, uma rota. Faixa de 52px com o título, o nome da seção
como `crumb`, a ressalva de escopo ao lado e o interruptor de abrir/fechar à
direita — ele fecha UMA filial, a que o cabeçalho está mostrando, e não aparece
em Operação, onde a mesma filial já tem a própria chave na lista.

O corpo é a coluna de seções separada por fio (a mesma peça do Cardápio) e o
formulário. **Uma folha, vários grupos**: o nome do grupo numa coluna própria de
180px à esquerda, os campos em grade à direita, e um fio entre grupos. A barra
de salvar gruda no fim da coluna e é uma das poucas coisas da tela com sombra,
porque ela passa POR CIMA do formulário.

Abaixo de 900px a coluna de seções deita e vira fita rolável.

### Em breve — `pages/ComingSoonPage`

A mesma faixa de 52px, com a etiqueta ao lado do título, e uma frase. É a faixa
que faz esta tela pertencer ao painel em vez de parecer erro de rota. Sem botão
morto, sem número de exemplo, sem barra de progresso.

## Responsividade e enquadramento

Validar 390, 430, 768, 1024, 1280, 1440, 1920 e 2560px.

Os pontos de quebra do sistema:

| Ponto | O que muda                                                   |
| ----- | ------------------------------------------------------------ |
| 640   | `DataTable` volta a ser tabela                               |
| 720   | folhas, diálogos e listas viram bloco / tela cheia           |
| 768   | a navegação sai da barra de baixo e vira trilha de ícones    |
| 900   | a coluna de seções de Minha loja deita                       |
| 1024  | a coluna de categorias do Cardápio deita; densidade de mouse |
| 1100  | a grade de duas colunas de Desempenho volta a uma            |
| 1180  | a lateral do shell ganha os nomes                            |
| 1280  | o painel de detalhe deixa de flutuar e vira coluna           |

**Duas consultas são de CONTAINER, não de janela**, e é uma decisão de projeto:

- `lista` (700px) — a linha de pedido troca de desenho pela largura da LISTA,
  porque o mesmo aperto acontece com o painel de detalhe aberto numa tela de
  1440;
- `barra` (1100px) — a `PageBar` esconde o texto do estado de conexão pela
  largura DELA, pelo mesmo motivo.

Quando um valor é medida de conteúdo e não do sistema (a largura de uma coluna,
a faixa mínima de um gráfico), ele pode ter o ponto de quebra dele — desde que o
motivo esteja escrito na linha.

**Não pode existir overflow horizontal global.** Rolagem lateral é exceção local
e justificada: o gráfico longo de Desempenho, a fita de categorias, a fita de
seções, o quadro da Cozinha. Informação crítica não some em breakpoint; ela muda
de posição ou de composição.

Tetos: `--page-max` (1600px) limita o CONTEÚDO de Clientes, Cardápio e
Desempenho — a folha continua correndo até a margem. `--form-max` (1040px) e o
teto de 1180px das seções largas limitam os formulários de Minha loja. Pedidos e
Cozinha usam a largura toda por necessidade operacional.

## Tema escuro

Os mesmos tokens semânticos, outras superfícies. **Não é "trocar branco por
preto"**: mesmos degraus de plano, mesma hierarquia de tinta, mesma gramática de
separação. O que muda é a direção da luz.

Nenhuma regra de componente pode ser específica de tema. Se você precisou de
`[data-theme="dark"] .minha-classe`, o token que você usou é o errado — é para
isso que existem `--card-edge` e a família `--nav-*`.

Degraus perceptíveis, não fuligem quase-preta uniforme: cada plano se distingue
do vizinho sem depender de sombra, que no escuro quase não aparece. A marca
acende (`#ff8a3d`), `--alert` puxa para o amarelo (em laranja ele faria o olho
ler "ação" onde está escrito "atenção") e os washes são um sussurro.

A Cozinha É redeclarada no bloco escuro: a escala dela inverte a direção da
saturação junto com o plano (ver "Cozinha").

Os dois temas passam no mesmo `check-contrast.mjs` e precisam parecer o mesmo
produto.

## Interação, movimento e acessibilidade

- **Foco:** `--focus` (tinta cheia), 2px, offset 2px, em `focus-visible`. Nunca a
  marca — o foco aparece em todo controle, e a marca em todo controle é a marca
  em lugar nenhum.
- **Estados:** todo controle tem default, hover, active, focus-visible e
  disabled; e loading onde a ação já o fornece.
- **Alvo:** 24px mínimo (WCAG 2.5.8), 44px no celular. No toque nada encolhe.
- **Nome acessível** permanece quando o ícone é o visual; `title` explica
  controle travado, mas informação essencial fica visível.
- **Contraste** WCAG 2.2 AA medido nos dois temas, no `npm run lint`.
- **Estado nunca depende só de cor.**
- **Movimento:** 140ms (`--motion-fast`) e 200ms (`--motion-base`), com
  `--ease`. Eles explicam origem e destino de gaveta, menu, chave e seleção. Sob
  `prefers-reduced-motion` os dois vão a zero — e `@keyframes` com `animation:`
  precisa do próprio desligamento, porque o token não o alcança.
- Sem animação de página, bounce, parallax ou fade decorativo.
- O painel mostra texto escrito pelo CLIENTE FINAL (observação, nota, nome,
  endereço). `eslint.config.js` barra `dangerouslySetInnerHTML`, `innerHTML`,
  `insertAdjacentHTML`, `document.write` e `new Function` em todo o `src/`, teste
  incluído.

## Antes de criar, procure

Em `src/ds/`, `src/ui/` e `src/styles/`. Corrija a base quando o defeito é
sistêmico. Não duplique botão, campo, busca, seleção, chave, aba, etiqueta,
tabela, linha, chip de status, cartão, diálogo ou faixa de título.

Componente novo entra na galeria (`/ui`) **na mesma etapa em que nasce**, com
todos os estados. Se um estado não está lá, ele não foi desenhado.

## Verificação

Ao concluir uma mudança visual relevante:

1. `npm run lint` — ESLint, tokens, contraste e o hash da CSP;
2. `npm test`;
3. `npx playwright test`;
4. `CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --workers=1` — o arnês
   fotografa Pedidos (com e sem detalhe), Cardápio, Clientes, Desempenho, Minha
   loja, Cozinha e "Em breve" em 1440 e 390, claro e escuro, com o mesmo backend
   falso do e2e. As imagens saem em `capturas/`, que é ignorada pelo git: elas
   são para OLHAR numa revisão, não para versionar;
5. **abra as capturas e faça uma segunda passagem** procurando aparência de
   template, excesso de borda, hierarquia fraca, espaço morto, formulário cru,
   tabela antiga, filtro amontoado, valor desalinhado, laranja em excesso e
   mobile improvisado. A primeira versão nunca é a entrega.

Nunca "corrigir" teste removendo cobertura. Quando o comportamento muda de
propósito, a asserção muda de FORMA e continua cobrindo o mesmo requisito — foi
o que aconteceu com o agrupamento vazio: "a coluna não escreve 'Nenhum pedido'"
virou "a coluna não é desenhada".
