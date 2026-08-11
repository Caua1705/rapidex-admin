---
name: rapidex-design-system
description: Regras visuais do painel do lojista Rapidex — a direção Brasa, os cinco níveis de tipografia mais a mono do número, a escala de seis degraus, os quatro planos, o console, cor, densidade, enquadramento e movimento. Leia ANTES de escrever qualquer tela, componente ou CSS novo em src/, e antes de mexer em src/styles/tokens.css. Também aplicável ao revisar uma tela existente ou ao decidir uma cor, um espaçamento, um raio ou uma animação.
---

# Design system do Rapidex

Rapidex é uma plataforma white-label de pedidos online. Este sistema cobre o
**painel do lojista** (`admin.pederapidex.com`): quadro de pedidos em tempo
real, cardápio, configurações e a tela de cozinha.

## A direção: BRASA

**A COZINHA ÀS 22H, VISTA DE DENTRO.** A referência não é software: é o
equipamento da cozinha — o forno combinado, a impressora térmica, o display do
timer, a etiqueta gravada na chapa de aço. Um lojista abre isto no sábado à
noite com a cozinha cheia, no desktop do balcão e no celular no meio do salão.

**O que este painel não é:** dashboard de SaaS genérico. Padding generoso,
cinza-azulado neutro e raio grande em tudo são "seguros" — e seguro é
exatamente a sensação de inacabado. Também não é o oposto disso: não é
brutalismo nem tema de terminal. É **instrumento**.

As quatro decisões que fazem a direção, e que valem mais que qualquer regra
específica deste documento:

1. **Escuro é o chão, e o escuro é quente.** Preto de fuligem, com marrom por
   baixo. Nunca cinza-azulado de editor de código — um `#1a1a1a` ao lado destes
   tons lê como um buraco azul no meio da tela. O claro existe inteiro e é o
   modo de dia.
2. **O número é monoespaçado, e isso é o sotaque.** Dinheiro, hora, tempo
   decorrido e nº de pedido, em JetBrains Mono. É a letra da comanda térmica e
   do display do forno, e a continuidade entre a tela e o papel é o que faz o
   balcão e a cozinha falarem do mesmo pedido. **Fora desses quatro, não** — e
   o que faz uma tela parecer máquina não é ela, é o rótulo. Ver §1.
3. **A brasa é o único degradê.** Ele pinta a barra de maturação do pedido —
   latão quando entra, brasa quando estoura. É a única escala contínua da tela,
   e ler "está esquentando" de longe é o trabalho dela. Qualquer outro degradê
   no projeto é erro, inclusive um segundo uso deste.
4. **A lateral é um console, e ele é escuro nos dois temas.** A navegação é
   equipamento, não página. Ver §3.

**"Premium" aqui continua significando PRECISÃO** — alinhamento, ritmo,
contraste. O que mudou é que agora a tela também tem sotaque.

Intocável: a **escala de sete status de pedido** carrega significado e não
matiz de gosto. Todo o resto deste documento pode ser rediscutido com uma tela
na mão. As três direções que disputaram esta (Brasa, Papel, Sinal) estão em
`design/direcoes/`, completas e medidas — trocar é uma conversa, não um
recomeço.

## A regra que vale mais que as outras

**Todo valor de cor, corpo de fonte e raio vem de `src/styles/tokens.css`.** Em
qualquer outro arquivo é `var(--token)`. Um hexadecimal, um `rgb()`, um `hsl()`
ou um nome de cor fora daquele arquivo é erro de lint — `npm run lint` roda
`scripts/check-design-tokens.mjs` nos `.css`.

Se um token faltar para a tela que você está fazendo, **o token está errado,
não a tela**: acrescente-o em `tokens.css` (nos dois temas), com o par de
contraste medido em `scripts/check-contrast.mjs`, em vez de escrever o valor
solto.

---

# 1. Tipografia: cinco níveis, mais a mono do número

**Space Grotesk na interface.** Grotesca com terminais cortados na diagonal e
aberturas fechadas — ela tem desenho próprio, ao contrário de uma neo-grotesca
neutra, e é ela que dá à tela o ar de placa de equipamento.

| #   | Nível            | Classe       | Corpo/entrelinha | Peso | Caixa     | Tinta     | Onde                                              |
| --- | ---------------- | ------------ | ---------------- | ---- | --------- | --------- | ------------------------------------------------- |
| 1   | Título de página | `.t-title`   | 19 / 24          | 700  | normal    | `--ink`   | **um por tela**, no alto à esquerda               |
| 2   | Título de seção  | `.t-section` | 16 / 22          | 600  | normal    | `--ink`   | cartão, faixa, diálogo, **nome de item de lista** |
| 3   | Rótulo           | `.t-label`   | 11 / 14          | 600  | MAIÚSCULA | `--ink-3` | nome de campo, cabeçalho de faixa, grupo da nav   |
| 4   | Corpo            | `.t-body`    | 14 / 20          | 400  | normal    | `--ink`   | o conteúdo                                        |
| 5   | Auxiliar         | `.t-aux`     | 13 / 18          | 400  | normal    | `--ink-3` | ajuda, meta, hora, contagem, rodapé               |

**A prova: bata o olho em qualquer texto da tela e diga qual nível ele usa.** Se
não der para dizer, o texto está errado — não falta um nível.

- **Corpo é 14 e auxiliar é 13 por causa da DISTÂNCIA DE LEITURA.** A escala
  anterior (13 e 12) foi calibrada olhando um laptop a 50cm; este painel é lido
  no balcão, muitas vezes de pé, mais longe, e por alguém que pode ter
  cinquenta anos. Os outros três níveis NÃO subiram junto: se tudo subisse, a
  hierarquia seria a mesma com a tela mais cheia, e o que se ganha em
  legibilidade se perderia em quantos pedidos cabem na dobra.
- O contraste entre níveis vem de **corpo + peso + caixa + tinta juntos**, nunca
  de um só. Corpo (14) e auxiliar (13) diferem em 1px porque quem os separa de
  verdade é a tinta.
- **UM ELEMENTO POR LINHA CARREGA O PESO.** Nome do produto, preço e rótulo
  todos em semibold na mesma linha é o mesmo que nenhum em semibold: sem um
  ponto de entrada, o olho varre a linha inteira. Escolha qual dos três é a
  resposta da tela e deixe os outros dois em 400.
- Maiúscula e `--ink-3` fazem parte do nível 3, não são opção — é o que permite
  a ele ser 11px sem competir com o valor que nomeia.
- Cada classe declara corpo, entrelinha, peso, espacejamento **e tinta** juntos.
  Meia definição — corpo aqui, cor lá no componente — é como um nível vira
  quatro variantes em quatro telas.
- **Nunca escolha tamanho e peso caso a caso.** É exatamente isso que dá a
  sensação de inacabado: quatro tamanhos de "título" em quatro telas.

## A mono, e a coleira dela

**`.tnum` e `.num` trocam a LETRA, não o nível.** Elas pintam JetBrains Mono, e
pintam exatamente quatro coisas:

| O quê           | Por quê                                                             |
| --------------- | ------------------------------------------------------------------- |
| dinheiro        | é conferido no caixa, e alinha em coluna                            |
| hora            | "20:41" é lido contra a hora da linha de cima                       |
| tempo decorrido | é o número que decide o que fazer primeiro, comparado linha a linha |
| nº de pedido    | é o mesmo "#1042" que sai na comanda térmica de 48 colunas          |

**Fora desses quatro, não use — e a lista é literal.** Não entram: minuto de
configuração ("25–35 min" do prazo de preparo), quantidade ("2×"), telefone,
CEP, coordenada, quilômetro, contagem. Todos são números; nenhum se compara
descendo uma coluna, e em mono eles só emprestam ao painel um sotaque de
terminal que custa legibilidade.

**Não é a mono que dá aparência de máquina a uma tela** — é o rótulo em caixa
alta com peso alto e espacejamento largo. O nível 3 já foi 10px/700/0.1em e
imitava tão bem uma monoespaçada que a tela inteira parecia estar nela.

**Contagem não é mono, e não precisa de classe nenhuma:** `reset.css` já liga
numeral tabular no `body` inteiro. "12 itens" ao lado do nome de uma categoria
é uma frase com um número dentro — ele alinha e continua na letra da interface.
Campo de formulário segue a mesma lista: preço, taxa e valor por km levam
`.tnum` porque são reais; telefone, CEP e coordenada não levam.

`.num` acrescenta o alinhamento à direita, que é o que faz uma COLUNA de
dinheiro ler como coluna. Número dentro de uma frase usa `.tnum`.

## A Cozinha é a exceção, e é a única

`src/kitchen/` quebra a escala de propósito: é um monitor pendurado na parede,
lido a dois metros por quem está com as mãos ocupadas, sem navegação lateral e
sem barra do topo. Ela tem corpos próprios (`--k-num`, `--k-item`, `--k-meta`),
declarados como exceção em `tokens.css`.

**Isso não autoriza escala grande em nenhuma outra tela.** Se uma tela do painel
"precisa" de 20px de corpo, o problema é outro.

---

# 2. Espaçamento: seis degraus e nenhum valor solto

| Token     | Valor | Trabalho                                              |
| --------- | ----- | ----------------------------------------------------- |
| `--sp-4`  | 4px   | dentro de um controle: ícone ↔ texto, rótulo ↔ campo  |
| `--sp-8`  | 8px   | entre controles irmãos; padding de linha densa        |
| `--sp-12` | 12px  | padding de cartão; entre campos de uma mesma linha    |
| `--sp-16` | 16px  | entre blocos de uma seção; respiro lateral da tela    |
| `--sp-24` | 24px  | entre seções                                          |
| `--sp-32` | 32px  | topo de tela e estado vazio — o único degrau generoso |

**Escolha o degrau abaixo do que o instinto pede.** O instinto foi treinado em
página de marketing; aqui embaixo tem fila de pedido.

- **Nenhum número solto em `padding`, `margin` ou `gap`.** As únicas exceções são
  larguras de coluna de grade (que são medida de conteúdo) e as alturas de
  controle declaradas em `tokens.css`.
- **Não existe `--sp-2`, `--sp-20` nem `--sp-40`**, e a falta deles é
  proposital: eram exatamente por onde cada bloco escolhia o próprio ritmo.
- **Campo, rótulo e ajuda têm espaçamento idêntico em toda tela**: `.field` (ou
  `.ds-field`) já entrega isso. Não recomponha um campo à mão, e **não invente
  um segundo nome de classe para a ajuda** — é `.field__hint`, em todo lugar.

---

# 3. Superfície: quatro planos, mais o console

| Token              | Papel                                                       |
| ------------------ | ----------------------------------------------------------- |
| `--bg`             | o chão: área de trabalho e barra do topo                    |
| `--surface`        | onde o trabalho acontece: cartão, coluna, lista             |
| `--surface-raised` | o que sobe um degrau: menu, diálogo, folha, barra de salvar |
| `--line`           | a régua, quando o tom não basta                             |

Mais `--field`, o plano do que se PREENCHE, que afunda.

- **Um bloco que tem tom próprio não leva borda** — com uma exceção: no raio de
  2px, um retângulo só de preenchimento perde a forma contra `--surface` no
  tema claro, então cartão e etiqueta levam um fio de `--line` junto com o tom.
  Contornar tudo continua sendo o que faz a tela parecer wireframe.
- **A exceção declarada é o campo de texto.** Fora de um cartão ele some no
  fundo, então ele — e só ele — leva contorno de `--line-control`, o único da
  paleta que passa dos 3:1 da WCAG 1.4.11.
- **Sem blur, sem glassmorphism.** Overlay é véu sólido semi-opaco (`--scrim`).
- **Um degradê no sistema inteiro**, e é a barra de maturação (`--grad-brasa`).
  Um segundo uso dele é erro.
- **Sombra só no que flutua** — menu, diálogo, folha lateral, barra de salvar.
  Cartão parado na página não tem sombra em tema nenhum.
- **Sem ilustração, imagem de fundo ou foto.** O único elemento pictórico é o
  logo. Foto de prato é conteúdo do lojista: o slot fica como contorno
  tracejado até haver foto — nunca como bloco preenchido, que numa lista sem
  fotos vira uma coluna de buracos.
- **Uma textura, e ela não se vê:** `--hachura`, a 45° e a 2% de opacidade, no
  console. Ela dá matéria à chapa sem virar desenho atrás do texto.
- **Raio apertado**: `--r-chip` (2px) no que é controle, `--r-field` (3px) no que
  é superfície, `--r-card` (4px) no que flutua. `--r-round` só em ponto de
  status e ponto de conexão — o interruptor é retangular.

### O console

**A lateral (e, no celular, a barra inferior) é escura nos DOIS temas.** É a
decisão de enquadramento desta direção: a navegação é equipamento, não página.
No claro, uma lateral bege ao lado de uma área bege faz o painel perder a
moldura que o faz parecer instrumento.

Ela tem tokens próprios (`--console-*`, bloco 9b de `tokens.css`) que **não são
redefinidos no tema escuro** — lá eles já são aqueles. E eles têm pares próprios
em `check-contrast.mjs`: um plano que não inverte é justamente o que escapa da
revisão de contraste, porque ninguém pensa nele ao mexer na paleta do claro.

O item ativo leva **tinta cheia + trilho de brasa de 2px + halo curto**
(`--console-active`). Três sinais, e o laranja em nenhum deles é texto.

### Tema

**Escuro é o tema principal.** Claro é **o mesmo conjunto semântico** com as
superfícies invertidas, sob `[data-theme]` no `<html>` — nunca uma segunda
paleta. A escada de tom no escuro é mais aberta que no claro de propósito: no
claro o papel do cartão se destaca sozinho; no escuro, dois tons a 4% de
distância viram um borrão e o cartão desaparece.

Ao escrever CSS, **nunca** escreva uma regra específica de tema. Se precisou de
`[data-theme="dark"] .minha-classe`, o token que você usou é o errado. (Regra de
CONTEXTO é outra coisa e é legítima: `.shell__brand .logo__wordmark` usa a tinta
do console porque a marca está dentro dele.)

---

# 4. Cor com avareza

**A pergunta antes de pintar qualquer coisa: que informação essa cor carrega?**
Se a resposta for "fica bonito" ou "diferencia visualmente", a cor sai.

1. **A brasa aparece em três lugares e mais nenhum:** botão primário
   (`.btn--primary`), indicador do item ativo (navegação, aba, âncora, categoria
   selecionada), anel de foco. Nunca em texto de corpo, em ícone neutro, em
   fundo de seção ou em ênfase.
   **No tema claro ela é mais escura que a do selo, e isso é medido, não gosto:**
   sobre o bege da página, o laranja do selo dá 2,2:1 e reprova nos 3:1 do anel
   de foco. O selo continua o mesmo; o token da interface diverge dele. No
   escuro os dois se reencontram.
   **A brasa nunca é TEXTO sobre `--ember-wash`**: não existe um laranja que
   passe em AA nos dois temas sem deixar de ser o laranja da marca.
2. **A escala de status pinta status de pedido e mais nada.** Ela é de METAL E
   CHAMA — latão, aço, ametista, verde, ciano, neutro, vermelho — e **evita o
   laranja de propósito**: o laranja é da marca, e um status laranja disputaria
   com o botão primário na mesma tela. Não use uma matiz de status para
   categorizar o que não é estado de pedido. Quem traduz status do backend para
   estágio visual é `stageOf()` em `orders/order-status.ts`; o elemento leva
   `is-<estágio>` e lê `--st` / `--st-wash`. Nenhum componente escolhe matiz.
3. **`--ok` = "no ar / à venda / confirmado".** Interruptor ligado, loja aberta,
   ponto de conexão viva. Nunca como palavra escrita ao lado do controle que já
   diz a mesma coisa.
4. **`--alert` = "esperando / atenção".** Aviso, setor inconsistente, e o fundo
   do aviso que impede o preparo.
5. **`--danger` = perigo.** Cancelar, excluir, pagamento recusado. (O estágio
   `cancelado` usa a mesma matiz: fim de linha e perigo são a mesma leitura.)
6. **O resto é neutro.** Etiqueta, ícone, contagem, meta: `--ink-2` ou `--ink-3`.

Os neutros têm **viés quente**. Não introduza cinza-azulado de SaaS genérico.

---

# 5. Estados: hover, foco e desabilitado saem dos tokens

Todo elemento operável tem os três, e nenhum componente escolhe o seu próprio:

- **Hover**: `--hover` (e `--active` na pressão). Os dois são derivados da
  TINTA, então funcionam nos dois temas com uma regra só — no claro escurecem,
  no escuro clareiam, porque `--ink` já inverteu.
- **Foco**: anel de `--focus-width` em `--focus`, declarado uma vez em
  `reset.css` para `:focus-visible`. Componente que zera o `outline` sem repor
  outro é o jeito mais comum de um sistema perder a navegação por teclado —
  `design/shots/acabamento.spec.ts` varre isso em todas as rotas.
- **Desabilitado**: `--disabled-opacity` e `cursor: not-allowed`. Nunca esconder
  o controle: o que some ninguém reativa.

---

# 6. Nenhum controle nativo

O `<select>` do sistema operacional é o sinal mais forte de "não terminado" que
existe: ele não aceita a tipografia, nem o raio, nem o tom das superfícies.

- **Seletor**: `ds/Select`. Gatilho estilizado, lista com superfície própria,
  opção escolhida com check (cor sozinha não passa em 1.4.1), teclado inteiro
  (setas, Home/End, Enter, Esc, Tab) e fechamento por clique fora. Duas
  propriedades para os casos fora do formulário: `bare` (gatilho sem caixa, para
  quem vive numa barra) e `display` (conteúdo próprio no gatilho).
- **Segmentado** (`.seg`): quando as opções são POUCAS E FIXAS — o período do
  quadro de pedidos. O estado fica visível sem abrir nada, que é o que uma barra
  de filtro precisa ser. Acima de cinco opções, ou com opções vindas do backend,
  é `ds/Select`: um segmentado de doze teclas vira uma parede.
- **Caixa de marcar e rádio**: `ds/Checkbox` e `ds/Radio`. O `<input>` continua
  nativo — teclado e leitor de tela vêm dele — mas com `appearance: none` ele
  não desenha nada, e o `accent-color` do sistema some.
- **Barra de rolagem**: fina, do tom da linha, revelada no ponteiro
  (`reset.css`).
- **Hora e data** continuam sendo campo nativo, e é a única concessão: o seletor
  do sistema é o que a mão já sabe operar. O ícone do navegador é rebaixado a
  afixo discreto em `primitives.css`.

Nos testes, `selectOption()` não serve para nada — use `e2e/seletor.ts`.

---

# 7. Enquadramento

**A coluna de conteúdo começa logo depois da lateral.** O teto de largura é
medido A PARTIR do fim dela (`--page-max`), nunca centrado no viewport:
`margin-inline: auto` num container de largura máxima abre, em 1900px, 300px de
faixa vertical vazia entre a lateral e a primeira letra — o defeito que mais faz
um painel parecer quebrado.

- **`--page-pad` é o respiro lateral de TODA tela**, e o mesmo no topo. Um valor
  por tela faz o título pular de lugar a cada troca de seção.
- **Uma tela, um teto.** Título, abas e conteúdo dividem a mesma largura máxima.
  Uma régua de aba que corre 340px além da borda dos cartões lê como dois blocos
  desalinhados.
- **Console de `--sidebar-w` (212px)**, agrupado por rótulo (nível 3) com um fio
  correndo até a borda. Abaixo de 1024px vira trilha de ícones
  (`--sidebar-rail`); abaixo de 640px sai da tela e vira barra inferior.
- **Barra do topo de `--topbar-h` (46px)**, com o seletor de filial sempre
  visível, mesmo com uma filial só.
- **Exceções propositais ao teto**: o quadro de pedidos e a Cozinha usam a tela
  toda — quanto mais largura, mais pedidos na dobra. Só a Cozinha rola na
  horizontal; o quadro de pedidos não rola de lado em largura nenhuma (§8).
- Verifique em **1440, 1900 e 2560** — `design/shots/enquadramento.spec.ts` mede
  a distância entre a lateral e o conteúdo e falha acima de 100px.

## Truncar

Truncar é legítimo quando falta espaço; o defeito é truncar quando **sobra**.
Quando dois textos dividem uma linha, decida no flex QUEM cede: o que
identifica é `flex: 0 0 auto`, o que desempata é `flex: 1 1 auto` com
`min-width: 0`. Sem isso os dois encolhem juntos e o nome da filial vira "M…"
ao lado de um endereço inteiro.

---

# 8. Densidade e conteúdo de lista

- **Lista de dados é grade, nunca flex com `space-between`.** Só a coluna do
  nome é fluida; preço, estado e ação têm largura fixa e ficam na mesma
  abscissa em todas as linhas. Com `space-between`, cada linha ancora o olho num
  lugar diferente conforme o comprimento do nome. **A coluna do nome tem teto**
  (`--page-max` na lista): num monitor de 27", o preço ia parar a 900px do item
  que ele precifica.
- **Linha de lista densa é para CONFERÊNCIA** — o que se percorre procurando
  uma exceção: alvo de ~32px. **Lista que se LÊ é outra coisa**: o cardápio é
  onde o lojista procura um item pelo nome entre sessenta, então a linha tem
  44px e o nome sai no nível 2. Comprimida, ela cabia mais itens e nenhum era
  achado rápido.
- **Linha densa**: alvo de ~32px. O que estoura essa altura é empilhar
  rótulo em cima de controle — ponha lado a lado. Em `max-width: 720px` a
  densidade cede e a linha vira alvo de dedo.
- **Ação secundária é ícone SEM CAIXA**, revelada no hover da linha, e
  **continua visível no foco de teclado** (`:focus-within`). No toque ela é
  permanente. Revele por `@media (hover: none), (max-width: 900px)` — só
  `hover: none` não dispara no Chromium sem emulação de toque, e a régua de
  alvo mede por largura.
- **O interruptor indica estado; ele não é a ação da página.** Trilho de 28×16,
  retangular, com o alvo de toque inteiro no botão em volta.
- **Nada de informação duas vezes na mesma tela.** Se o contador está no
  cabeçalho da faixa, ele não está também num resumo em cima — e um total que é
  a SOMA de contadores visíveis na mesma dobra também é a mesma informação.
- **Nada idêntico em toda linha de uma lista.** "DISPONÍVEL" ao lado de um
  interruptor ligado, "Não imprimir" em toda linha da coluna de setor: a palavra
  que se repete não distingue nada, só ocupa a largura do que muda. Escreva só o
  estado que **não** é o normal. **A regra vale em escala de seção também**: a
  mesma caixa de aviso repetida em cinco seções da mesma página é o mesmo
  defeito (ver `StorePage`, onde ela é dita uma vez só).
- **Faixa/lista vazia não escreve nada** quando o contador ao lado já diz zero.
  O fio da faixa já mostra que ela existe. O "Carregando…" fica: aí a lista
  vazia ainda não é uma afirmação.
- **O quadro é de faixas, não de colunas**, e **a faixa quebra em linhas, não
  rola.** Grade com `auto-fill` e largura mínima de leitura: os cartões ocupam
  quantas linhas precisarem, e em 390px isso dá uma coluna sem nenhuma regra a
  mais. **Nenhum scroll horizontal em Pedidos** — a faixa já rolou, e com treze
  pedidos em "Novos" sete apareciam e o resto saía pela direita, inclusive o
  mais antigo, que é justamente o que precisa ser visto primeiro. Ninguém
  arrasta uma faixa para o lado num sábado cheio. Se faltar largura, o que cede
  é a quantidade de colunas, nunca a visibilidade de um pedido.
- **Componente de conteúdo não decide a própria largura**; quem decide é o
  container. `ds/OrderTicket` já teve `width: 236px` fixo, e o preço era que
  toda tela que o usasse precisava desfazer a regra para encaixá-lo numa grade.

---

# 9. Movimento

**Animação só onde comunica mudança de estado.** Nada de entrada decorativa,
parallax ou transição de página. Os casos legítimos hoje: o botão do
interruptor deslizando, a linha esmaecendo ao desativar, o realce da categoria
que trocou de posição, o pulso do ponto de conexão, o pulso da barra de
maturação estourada, a entrada do painel de detalhe e da barra de salvar.

Escreva as durações com `var(--motion-fast)` / `var(--motion-base)`: sob
`prefers-reduced-motion: reduce` esses tokens já viram `0s`, e a tela troca de
estado instantaneamente em vez de não trocar. `@keyframes` com `animation:`
precisa de um `@media (prefers-reduced-motion: reduce) { animation: none }`
próprio. Nada pisca acima de 3Hz (WCAG 2.3.1).

---

# 10. Rota que não existe é página "em implementação"

A navegação mostra o produto inteiro, inclusive o que ainda não foi construído —
esconder um item não faz o lojista deixar de procurá-lo. O item aparece com peso
reduzido e a etiqueta "em breve", **é clicável**, e leva a uma página com
**título e uma frase do que vai fazer. Nada mais.** Sem botão falso, sem dado
inventado, sem barra de progresso.

**Nunca invente rota de API nem tela com dado fabricado para preencher espaço.**

---

# 11. Ícones e texto

**Um conjunto, em `src/ds/icons.tsx`.** Já houve dois (`ds/` e `ui/`) com seis
nomes repetidos e desenhos diferentes; se você encontrar dois nomes para a mesma
coisa, um dos dois é para apagar.

O traço desta direção: **grade de 24, traço 1,75, ponta reta (`square`), canto
vivo (`miter`)**, `stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`.
É desenho de chapa cortada — a ponta redonda é o que dava ao conjunto anterior o
ar simpático que esta direção não quer. Ícone é `--ink-3` e **não tem caixa**;
só o hover ou o foco desenham fundo.

**Ícone desenhado dentro de uma tela é o começo de um segundo conjunto.** Se
falta um, ele nasce no arquivo de ícones.

**Nenhum emoji, em lugar nenhum do produto.**

- **Português do Brasil**, direto e operacional. Verbos no infinitivo ou
  imperativo: "Aceitar pedido", "Cancelar pedido?", "Salvar alterações".
- O painel fala das **ações**, não em "eu/você": "Novo pedido recebido", não
  "Você recebeu um pedido".
- **Números sempre concretos**: "Tempo estimado: 25 min", nunca "em breve".
  Preço com `R$` e vírgula decimal — use `formatCurrency`.
- **Confirmação de risco é direta e sem eufemismo**: "Esta ação não pode ser
  desfeita."
- **Rótulos de status são substantivos/particípios curtos**: Pendente, Aceito,
  Preparando, Pronto, Saiu para entrega, Concluído, Cancelado.
- **Placeholder de campo vazio diz POR QUE não há valor**, quando há um motivo:
  "Depende da filial" é verdade; "Escolher…" num campo que não tem o que
  oferecer é mentira.

---

# 12. Componentes deste repo

`src/ds/` (Select, Checkbox, Radio, Input, Field, Switch, StatusChip, Card,
DataTable, Sheet, Tabs, **OrderTicket**, MaturationBar, icons), `src/ui/`
(Modal, RapidexLogo) e as classes de `src/styles/primitives.css`:

| Classe                                                                            | O quê                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `.t-title` `.t-section` `.t-label` `.t-body` `.t-aux`                             | os cinco níveis de tipografia                                      |
| `.tnum` `.num`                                                                    | a mono do número (tempo, dinheiro, nº) / com alinhamento à direita |
| `.btn` `.btn--primary` `.btn--danger` `.btn--ghost` `.btn--sm` `.icon-btn`        | botões (`--control-h`; `--sm` menor)                               |
| `.seg` `.seg__opt`                                                                | segmentado, para 2–5 opções fixas                                  |
| `.field` `.field__label` `.field__hint` `.field__error-text` `.input` `.textarea` | formulário                                                         |
| `.alert--error` `.alert--warn` `.alert--info`                                     | avisos                                                             |
| `.tag`                                                                            | etiqueta neutra                                                    |
| `.muted` `.faint` `.sr-only` `.conn`                                              | utilitários                                                        |

**UM componente por coisa.** `ds/OrderTicket` é o único pedido do sistema;
`orders/OrderCard` só traduz `OrderListItem` para as propriedades dele.
`ds/Switch` é o único interruptor (use `hideLabel` dentro de uma linha de
lista). **Reaproveite antes de criar**: um segundo botão com padding próprio é
como a densidade começa a desandar.

---

# Checklist antes de dar uma tela por pronta

Qualquer "não" é conserto, não ressalva.

- [ ] `npm run lint` limpo (aderência de token + contraste medido nos dois temas)
      e `npm test` verde.
- [ ] `npx playwright test` verde (o e2e).
- [ ] **Sobrou algum controle de formulário nativo?**
- [ ] **Existe faixa vertical vazia com mais de 100px entre a lateral e o
      conteúdo, em qualquer largura?**
- [ ] **Alguma informação aparece duas vezes na mesma tela?**
- [ ] **Alguma informação se repete, idêntica, em toda linha de uma lista — ou
      em toda seção da página?**
- [ ] **Todo espaçamento vem da escala, ou sobrou valor solto no CSS?**
- [ ] **Dá para nomear qual dos cinco níveis tipográficos cada texto usa?**
- [ ] **A mono está SÓ em tempo decorrido, dinheiro, nº de pedido e campo
      numérico?**
- [ ] **Alguma cor está lá por decoração, e não por significado?**
- [ ] **Todo elemento interativo tem hover e foco visíveis?**
- [ ] **Algum texto trunca onde havia espaço de sobra?**
- [ ] **As colunas de conteúdo alinham entre si e com o cabeçalho?**
- [ ] **No mobile (390px), alguma coisa quebra ou fica ilegível?**
- [ ] **O tema escuro tem o mesmo cuidado do claro — e o console continua legível
      nos dois?**
- [ ] Nenhuma regra CSS específica de tema.
- [ ] Nenhum emoji; nenhuma rota inventada; nenhum degradê além da maturação.
- [ ] Animação só onde há mudança de estado, com `prefers-reduced-motion`.

## As réguas automáticas

Quatro delas não dependem de olhar:

```
npx playwright test -c design/shots/shots.config.ts acabamento     # nativos, foco, truncamento, alvo de toque
npx playwright test -c design/shots/shots.config.ts enquadramento  # o vão entre lateral e conteúdo em 1440/1900/2560
npx playwright test -c design/shots/shots.config.ts cabecalho      # quem trunca no cabeçalho
npx playwright test -c design/shots/shots.config.ts telas          # o lote de prints, dois temas + celular
```

`shots.config.ts` reconstrói o bundle a cada execução — é a régua do resultado
final. Enquanto se mexe no CSS, use `dev.config.ts`, que reaproveita o
`npm run dev` já aberto e roda em segundos:

```
npm run dev -- --port 5199 --host 127.0.0.1
npx playwright test -c design/shots/dev.config.ts
```

Os prints saem em `design/shots/out/<SHOT_TAG>/`.

## As outras duas direções

`design/direcoes/papel/` e `design/direcoes/sinal/` continuam completas —
tokens, componentes e as três telas nos dois temas, cada uma medida nos mesmos
106 pares de contraste. Elas não são rascunho: são a alternativa pronta se esta
direção não se sustentar com o painel em uso.
