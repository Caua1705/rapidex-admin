---
name: rapidex-design-system
description: Regras visuais do painel do lojista Rapidex — aplicação de administração clara e familiar (Inter, sem caixa alta, raio 6/8/10/12, elevação sutil), os cinco níveis de tipografia mais o número tabular por classe (sem mono), a escala de sete degraus, os quatro planos, o console, cor (a brasa é avara — nunca em checkbox/rádio), densidade, enquadramento e movimento. Leia ANTES de escrever qualquer tela, componente ou CSS novo em src/, e antes de mexer em src/styles/tokens.css. Também aplicável ao revisar uma tela existente ou ao decidir uma cor, um espaçamento, um raio ou uma animação.
---

# Design system do Rapidex

Rapidex é uma plataforma white-label de pedidos online. Este sistema cobre o
**painel do lojista** (`admin.pederapidex.com`): quadro de pedidos em tempo
real, cardápio, configurações e a tela de cozinha.

## A direção: APLICAÇÃO DE ADMINISTRAÇÃO

**O VOCABULÁRIO QUE UM DONO DE RESTAURANTE JÁ RECONHECE.** A referência não é
equipamento, não é papel, não é sinalização de transporte: é o software de
gestão que o lojista já abre todo dia — o PDV, o ERP, a planilha da
contabilidade. Ele abre este painel no sábado à noite com a cozinha cheia, no
desktop do balcão e no celular no meio do salão, e não deveria precisar
decifrar um sotaque visual para achar o botão de aceitar um pedido.

**O que este painel não é:** um instrumento com identidade própria. Uma
direção anterior (Brasa) tentou exatamente isso de propósito — "a cozinha às
22h, vista de dentro", com referência em equipamento — e o resultado foi
preciso mas errado de alvo: cinco decisões, cada uma defensável sozinha
(tipografia de display, raio quase reto, superfície sem sombra, paleta
bege/marrom, ícone de traço reto com ponta cortada), somaram o efeito de placa
gravada em chapa de aço. Nenhuma delas é ruim isolada; a soma é que lê como
máquina. Este painel também não é o oposto disso — não é brutalismo nem tema
de terminal, e "clara e familiar" não é sinônimo de "sem cuidado": um painel
com padding decorativo, hierarquia solta ou contraste frouxo é tão errado
quanto um que grita "equipamento".

As decisões que fazem a direção, e que valem mais que qualquer regra
específica deste documento:

1. **A letra é Inter — uma neo-grotesca de UI sem desenho próprio.** É
   exatamente o oposto do critério da direção anterior, que buscava uma letra
   com sotaque de propósito. Autohospedada (`@fontsource-variable/inter`),
   sem CDN.
2. **Caixa alta com tracking saiu do sistema por completo.** Nem na sidebar,
   nem no cabeçalho de faixa do quadro de pedidos — os dois únicos lugares que
   ainda a usavam. O rótulo (nível 3) é caixa de frase em toda parte. Ver §1.
3. **O raio é 6 / 8 / 10 / 12, não 2 / 3 / 4.** Canto quase vivo é vocabulário
   de wireframe e de terminal — e era o menos suspeito dos cinco culpados
   originais, porque cada tela isolada parecia "só precisa". Ver §3.
4. **Cartão parado tem sombra sutil, junto com a borda.** "Sombra só no que
   flutua" fazia todo cartão em repouso ler como caixa contornada e plana —
   wireframe, não produto acabado. A sombra nova é quase imperceptível; o que
   ela resolve é a textura, não o peso. Ver §3.
5. **O número é tabular só onde precisa comparar.** Dinheiro, hora, tempo
   decorrido e nº de pedido levam `.tnum`/`.num` — a mesma Inter, só com
   `font-variant-numeric: tabular-nums`. Fora desses quatro lugares, não há
   mais numeral tabular ligado por padrão: ele saiu do `body` inteiro em
   `reset.css`, porque todo dígito da tela com largura uniforme — inclusive em
   texto corrido — também é parte do que lia como painel de instrumento.
   **Nenhuma `font-family` monoespaçada sobrevive em lugar nenhum do painel**
   (é erro de lint, `scripts/check-design-tokens.mjs`). Ver §1.
6. **A brasa é o único degradê.** Ele pinta a barra de maturação do pedido —
   latão quando entra, brasa quando estoura. É a única escala contínua da
   tela, e ler "está esquentando" de longe é o trabalho dela. Qualquer outro
   degradê no projeto é erro, inclusive um segundo uso deste.
7. **A lateral continua um console escuro nos dois temas** — a única peça da
   direção anterior que sobrevive por inteiro. Uma navegação escura ao lado de
   conteúdo claro é um padrão comum de aplicação de administração (editor de
   código, várias ferramentas internas), não um sinal de "equipamento". Ver
   §3.

**"Premium" continua significando PRECISÃO** — alinhamento, ritmo, contraste —
e padding decorativo continua proibido. O que mudou é o alvo: a tela não tenta
mais soar como chapa de aço, tenta soar como o melhor sistema de gestão que o
lojista já usou.

Intocável: a **escala de sete status de pedido** carrega significado e não
matiz de gosto. Todo o resto deste documento pode ser rediscutido com uma tela
na mão. As duas direções alternativas que disputaram esta (Papel, Sinal) estão
em `design/direcoes/`, completas e medidas — nenhuma das duas atendia à
maioria dos critérios desta troca (tipografia neutra, raio de aplicação,
superfície neutra, elevação sutil, ícone de traço suave): Papel tem raio ZERO
(mais reto que a Brasa, não menos) e título em serifa de display; Sinal tem
neutro frio (quebra o viés quente que este sistema preserva) e chip em cápsula
total. A base desta direção é a Brasa, com os cinco pontos acima trocados.

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

# 1. Tipografia: cinco níveis, mais o número tabular

**Inter na interface.** Neo-grotesca de UI, sem desenho próprio — ao contrário
de uma grotesca de display, ela não empresta sotaque a nada que renderiza
nela. É esse anonimato que faz a tela ler como aplicação comum. Autohospedada
via `@fontsource-variable/inter` (importada em `src/main.tsx`), sem CDN.

| #   | Nível            | Classe       | Corpo/entrelinha | Peso | Caixa   | Tinta     | Onde                                              |
| --- | ---------------- | ------------ | ---------------- | ---- | ------- | --------- | ------------------------------------------------- |
| 1   | Título de página | `.t-title`   | 20 / 28          | 600  | normal  | `--ink`   | **um por tela**, no alto à esquerda               |
| 2   | Título de seção  | `.t-section` | 15 / 22          | 600  | normal  | `--ink`   | cartão, faixa, diálogo, título de bloco, **nome de item de lista** |
| 3   | Rótulo           | `.t-label`   | 12 / 16          | 600  | normal  | `--ink-3` | separador de grupo da sidebar, cabeçalho de faixa do quadro de pedidos |
| 4   | Corpo            | `.t-body`    | 14 / 20          | 400  | normal  | `--ink`   | o conteúdo                                        |
| 5   | Auxiliar         | `.t-aux`     | 13 / 18          | 400  | normal  | `--ink-3` | ajuda, meta, hora, contagem, rodapé               |

**CAIXA ALTA COM TRACKING SAIU DO SISTEMA POR COMPLETO.** Os dois únicos
lugares que ainda a usavam — o separador de grupo da sidebar e o cabeçalho de
faixa do quadro de pedidos — passaram a usar o nível 3 em caixa de FRASE, como
qualquer outro rótulo. A distinção continua vindo do peso e da tinta de apoio,
não de gritar em maiúscula. `scripts/check-design-tokens.mjs` varre todo
`.css` fora de `tokens.css` atrás de `text-transform: uppercase` — é erro de
lint, igual à mono.

**Rótulo de campo de formulário não é o nível 3.** Ele já foi — caixa alta,
muito espaçado — e era metade do que dava a um formulário de sete campos ar de
console de comando. Hoje é `.field__label`/`.ds-field__label` (13/18, peso
500, `--ink-2`, caixa normal, sem tracking): mais claro que a ajuda abaixo
dele, mais escuro que o corpo do campo, sem precisar gritar. A mesma ideia
vale para rótulo de contexto pequeno fora de formulário (o "Preparo"/"Entrega"
da barra de filtro, o rótulo de um grupo de adicionais, o qualificador de uma
linha de lista densa) — 13px, sem caixa alta, na tinta que o contexto já
pedia (em geral `--ink-3`).

**Badge é frase comum.** "Em breve", o nome de uma etiqueta, o status escrito
no painel de detalhe do pedido — nenhum leva caixa alta. A cor e a forma
(ponto, filete) já carregam a distinção; caixa alta em cima disso só soma
ruído.

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
- `--ink-3` faz parte do nível 3, não é opção — é o que permite a ele ser 12px
  sem competir com o valor que nomeia. Caixa alta NÃO faz mais parte dele: ela
  saiu do sistema por completo (ver "A direção").
- Cada classe declara corpo, entrelinha, peso, espacejamento **e tinta** juntos.
  Meia definição — corpo aqui, cor lá no componente — é como um nível vira
  quatro variantes em quatro telas.
- **Nunca escolha tamanho e peso caso a caso.** É exatamente isso que dá a
  sensação de inacabado: quatro tamanhos de "título" em quatro telas.

## O número é tabular só onde a classe está aplicada

**`.tnum` e `.num` travam a MÉTRICA, não trocam a letra.** Uma direção
anterior chegou a usar JetBrains Mono para dinheiro, hora, tempo decorrido e
nº de pedido; isso saiu — na prática lia como terminal de servidor. Hoje as
duas classes são só `font-variant-numeric: tabular-nums` na mesma Inter do
resto da tela. **Nenhum `font-family` monoespaçada sobrevive em lugar nenhum
do painel** — é erro de lint (`scripts/check-design-tokens.mjs` varre todo
`.css` fora de `tokens.css` atrás de `mono|jetbrains|menlo|consolas` em
`font-family`).

**`font-variant-numeric: tabular-nums` NÃO está mais ligado no `body`
inteiro.** Ele já foi global em `reset.css`, e isso fazia todo dígito da
tela — inclusive em texto corrido, uma quantidade, um CEP — ocupar largura
uniforme. Era parte do que dava à interface a sensação de painel de
instrumento, mesmo sem nenhuma mono à vista. Hoje ele vale só onde `.tnum`/
`.num` estão aplicadas, e a lista de onde aplicá-las continua sendo
exatamente quatro coisas:

| O quê           | Por quê                                                             |
| --------------- | ------------------------------------------------------------------- |
| dinheiro        | é conferido no caixa, e alinha em coluna                            |
| hora            | "20:41" é lido contra a hora da linha de cima                       |
| tempo decorrido | é o número que decide o que fazer primeiro, comparado linha a linha |
| nº de pedido    | é o mesmo "#1042" que sai na comanda térmica de 48 colunas          |

**Fora desses quatro, não use — e a lista é literal.** Não entram: minuto de
configuração ("25–35 min" do prazo de preparo), quantidade ("2×"), telefone,
CEP, coordenada, quilômetro, contagem. Todos são números; nenhum se compara
descendo uma coluna. Aplicar `.tnum` fora da lista não faz mais nada visível
hoje que o tabular não está ligado no `body` inteiro — o número volta a ler
como texto comum —, mas continua sendo a classe errada: ela documenta "este
número se compara com o de cima ou de baixo", e um minuto de configuração
não se compara.

**Nunca foi a mono que dava aparência de máquina a uma tela.** Era o rótulo
em caixa alta com peso alto e espacejamento largo — e essa caixa alta saiu do
sistema por completo, não só dos dois lugares que ainda a usavam (separador
de grupo da sidebar, cabeçalho de faixa do quadro de pedidos). Ver "A
direção".

**Contagem não leva `.tnum`.** "12 itens" ao lado do nome de uma categoria é
uma frase com um número dentro, não um valor que se compara com o de baixo —
a lista dos quatro casos continua sendo literal. Campo de formulário segue a
mesma lista: preço, taxa e valor por km levam `.tnum` porque são reais e
comparáveis; telefone, CEP e coordenada não levam.

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

# 2. Espaçamento: sete degraus e nenhum valor solto

| Token     | Valor | Trabalho                                              |
| --------- | ----- | ----------------------------------------------------- |
| `--sp-4`  | 4px   | dentro de um controle: ícone ↔ texto, rótulo ↔ campo  |
| `--sp-8`  | 8px   | entre controles irmãos; padding de linha densa        |
| `--sp-12` | 12px  | entre campos de uma mesma linha                       |
| `--sp-16` | 16px  | padding de cartão                                     |
| `--sp-20` | 20px  | entre blocos de uma seção; respiro lateral da tela    |
| `--sp-24` | 24px  | entre seções                                          |
| `--sp-32` | 32px  | topo de tela e estado vazio — o único degrau generoso |

**`--sp-20` é novo.** A instrução que ocupava este lugar — "escolha o degrau
abaixo do que o instinto pede" — saiu: ela foi calibrada para uma direção que
mirava instrumento, onde apertar um degrau sempre lia como mais preciso. Uma
aplicação de administração comum tem mais fôlego: o padding de cartão subiu
de 12 para 16, e o respiro entre blocos de seção (e `--page-pad`) subiu de 16
para 20 — o degrau novo existe para não confundir os dois usos.

- **Nenhum número solto em `padding`, `margin` ou `gap`.** As únicas exceções são
  larguras de coluna de grade (que são medida de conteúdo) e as alturas de
  controle declaradas em `tokens.css`.
- **Não existe `--sp-2` nem `--sp-40`**, e a falta deles é proposital: eram
  exatamente por onde cada bloco escolhia o próprio ritmo.
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

- **COR DE STATUS É FILETE, NÃO MOLDURA.** A borda do cartão é neutra; o
  estágio entra num filete de 2px na borda esquerda, ou no ponto do cabeçalho
  da faixa. O ticket já teve a moldura inteira pintada em 3px da cor do estágio
  — num quadro de doze cartões isso dava doze retângulos coloridos, e a cor
  deixava de dizer "este está em preparo" para virar o fundo da tela.
- **Os washes (`--st-*-wash`) são um SUSSURRO**, a um passo do plano em que se
  apoiam. Eles dizem "isto é de outra natureza", nunca viram bloco de cor: a
  faixa de "aguardando pagamento" já dominou o cartão inteiro com um oliva
  forte, e num quadro em que quase todo pedido de Pix passa por esse estado,
  metade da tela ficava pintada.
- **Um bloco que tem tom próprio não leva borda** — com uma exceção: cartão e
  etiqueta levam um fio de `--line` junto com o tom, porque um preenchimento
  sozinho contra `--surface` no tema claro (as duas superfícies quase brancas)
  ainda perde a forma sem ele. Contornar tudo continua sendo o que faz a tela
  parecer wireframe — a diferença é que agora a sombra sutil do cartão (ver
  abaixo) também ajuda a separá-lo do fundo, então a borda não carrega o
  trabalho sozinha.
- **A exceção declarada é o campo de texto.** Fora de um cartão ele some no
  fundo, então ele — e só ele — leva contorno de `--line-control`, o único da
  paleta que passa dos 3:1 da WCAG 1.4.11.
- **Sem blur, sem glassmorphism.** Overlay é véu sólido semi-opaco (`--scrim`).
- **Um degradê no sistema inteiro**, e é a barra de maturação (`--grad-brasa`).
  Um segundo uso dele é erro.
- **CARTÃO PARADO TEM SOMBRA SUTIL, JUNTO COM A BORDA — não no lugar dela.**
  "Sombra só no que flutua" já foi a regra, e o preço era todo cartão em
  repouso ler como caixa contornada e plana: exatamente o registro de
  wireframe que esta direção quer evitar. `--shadow-card` é quase
  imperceptível de propósito — o que ela resolve é a textura da superfície,
  não o peso dela. O que flutua (menu, diálogo, folha, barra de salvar) segue
  levando `--shadow-raised`, visivelmente mais forte: a hierarquia entre
  "parado" e "flutuando" continua existindo, só que os dois agora têm alguma
  sombra, não um com e outro sem.
- **Sem ilustração, imagem de fundo ou foto.** O único elemento pictórico é o
  logo. Foto de prato é conteúdo do lojista: o slot fica como contorno
  tracejado até haver foto — nunca como bloco preenchido, que numa lista sem
  fotos vira uma coluna de buracos.
- **Uma textura, e ela não se vê:** `--hachura`, a 45° e a 2% de opacidade, no
  console. Ela dá matéria ao plano sem virar desenho atrás do texto.
- **Raio de aplicação, não de wireframe**: `--r-chip` (6px) no que é controle,
  `--r-field` (8px) no que é superfície interna, `--r-card` (10px) no que
  descansa na página, `--r-sheet` (12px) no que sobe mais um degrau (diálogo,
  folha, menu). `--r-xs` (4px) é a única exceção menor, só na caixa do
  checkbox (18px — pequena demais para o raio de chip). `--r-round` é a
  cápsula: ponto de status, ponto de conexão, e o interruptor (trilho e
  botão) inteiro. A escala anterior (2 / 3 / 4) era canto quase vivo — o
  culpado mais forte e o menos suspeito do efeito de instrumento, porque cada
  tela isolada parecia "só precisa de um pouco mais apertado".
- **`--r-control` (8px) não é mais exceção** — hoje ele coincide com
  `--r-field`. O segmentado (`.seg`) e o stepper (os botões +5/+10/−5 do
  preparo) continuam sem borda de repouso: o que os separa do fundo é
  `--field` (o mesmo plano que os campos afundam), não uma linha.

### O console

**A lateral (e, no celular, a barra inferior) é escura nos DOIS temas.** É a
única peça inteira que sobrevive da direção anterior: uma navegação escura ao
lado de conteúdo claro é um padrão comum de aplicação de administração — não
é, sozinha, o que lia como instrumento.

Ela tem tokens próprios (`--console-*`, bloco 9b de `tokens.css`) **com um
valor por tema**, não compartilhado entre os dois. Isso é uma correção, não só
uma preferência: um console que só existia no bloco claro (raiz `:root`) e
nunca era redefinido no escuro herdava o MESMO valor nos dois temas — e o dia
em que esse valor subiu para resolver o salto de tom no claro, ele passou a
ficar mais CLARO que o chão do tema escuro, e a moldura sumiu lá sem que
ninguém tocasse no bloco escuro. Cada tema declara o seu, sempre mais escuro
que a própria `--bg` daquele tema, e os dois têm pares próprios em
`check-contrast.mjs`.

**No claro, o console é carvão neutro-quente — não sépia.** Uma versão
anterior chegou a `#221d19`, e por cima do laranja da marca aquele tanto de
marrom lia como sépia; o valor atual mantém o mesmo grau de escurecimento com
menos saturação de marrom.

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
   **Checkbox e rádio marcados não são um quarto lugar** — já foram, em
   `ds/Choice.css`, e um formulário de configuração inteiro em quadradinhos
   laranja é exatamente a decoração que a regra de avareza proíbe. A marca é
   `--mark-bg`/`--mark-ink` (fixos nos dois temas, como `--console-*`): um
   quadrado escuro com o traço em quase-branco. `design/shots/acabamento.spec.ts`
   varre `.ds-choice__box:checked` nos dois temas atrás desse vazamento
   especificamente.
   **No tema claro ela é mais escura que a do selo, e isso é medido, não gosto:**
   sobre o fundo claro da página, o laranja do selo reprova nos 3:1 do anel de
   foco. O selo continua o mesmo; o token da interface diverge dele. No escuro
   os dois se reencontram.
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
  não desenha nada, e o `accent-color` do sistema some. A caixa leva `--r-xs`
  (4px): pequena demais (18px) para o raio de chip parecer proporcional.
- **Interruptor**: `ds/Switch`. Trilho e botão em `--r-round` — a cápsula que
  qualquer aplicação comum já usa para este controle, não mais um retângulo.
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

## Tela com muitas seções vira ROTA, não âncora

Uma configuração de seis formulários não cabe numa tela. Minha loja já foi
**seis abas** (cada uma escondia um formulário atrás de um clique, e conferir
duas custava perder o contexto), depois **coluna única com âncoras** (tudo na
página, rolagem longa, e o rodapé de uma seção encostando no cabeçalho da
seguinte), depois **âncoras com recolhimento** — que era remendo: escondia o
problema e cobrava um clique para ver o que já estava carregado.

O que resolve é **uma seção, uma rota** (`/minha-loja/entrega`), com a lista da
esquerda como navegação de verdade:

- o endereço identifica a tela — dá para mandar um link ao suporte, e o F5
  volta onde estava;
- o botão voltar do navegador funciona entre seções;
- cada página monta só o SEU formulário. A coluna única montava seis, com seis
  leituras de API, para mostrar um.

**O preço, e ele é real:** o Ctrl+F deixa de varrer a configuração inteira. Em
troca, a navegação da esquerda continua listando as seções o tempo todo — o
mapa não sumiu, só deixou de ser um sumário de rolagem.

A navegação da seção **não imita a lateral do produto**: sem ícone, sem caixa,
sem plano próprio. Uma diz em que parte do produto você está; a outra, em que
parte de uma tela.

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
  uma exceção: alvo de `--row-dense-h` (36px). **Lista que se LÊ é outra
  coisa**: o cardápio é onde o lojista procura um item pelo nome entre
  sessenta, então a linha tem `--row-read-h` (48px) e o nome sai no nível 2.
  Comprimida, ela cabia mais itens e nenhum era achado rápido.
- **Linha densa**: alvo de `--row-dense-h` (36px). O que estoura essa altura é
  empilhar rótulo em cima de controle — ponha lado a lado. Em
  `max-width: 720px` a densidade cede e a linha vira alvo de dedo.
- **Ação secundária é ícone SEM CAIXA**, revelada no hover da linha, e
  **continua visível no foco de teclado** (`:focus-within`). No toque ela é
  permanente. Revele por `@media (hover: none), (max-width: 900px)` — só
  `hover: none` não dispara no Chromium sem emulação de toque, e a régua de
  alvo mede por largura.
- **O interruptor indica estado; ele não é a ação da página.** Trilho de 28×16,
  em cápsula (`--r-round`), com o alvo de toque inteiro no botão em volta.
- **Nada de informação duas vezes na mesma tela.** Se o contador está no
  cabeçalho da faixa, ele não está também num resumo em cima — e um total que é
  a SOMA de contadores visíveis na mesma dobra também é a mesma informação.
- **Nada idêntico em toda linha de uma lista.** "DISPONÍVEL" ao lado de um
  interruptor ligado, "Não imprimir" em toda linha da coluna de setor: a palavra
  que se repete não distingue nada, só ocupa a largura do que muda. Escreva só o
  estado que **não** é o normal. **A regra vale em escala de seção também**: a
  mesma caixa de aviso repetida em cinco seções da mesma página é o mesmo
  defeito (ver `StorePage`, onde ela é dita uma vez só). **E vale em escala de
  quadro**: o aviso "aguardando pagamento — não preparar" do ticket
  (`ds/OrderTicket`) já foi uma tarja de borda a borda embaixo do cartão — com
  treze pedidos na mesma aba e quase todo Pix passando por esse estado, os
  treze repetiam a mesma tarja e o quadro lia como listra, não como aviso.
  Hoje ele é um badge pequeno na mesma linha dos badges de Entrega/Pix: ainda
  impossível de não ver num cartão, sem virar padrão repetido numa coluna
  inteira.
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
- **COLUNA DE DETALHE VAZIA COLAPSA, NÃO RESERVA ESPAÇO PARA UMA FRASE.** O
  painel de detalhe de Pedidos (`OrderDetailPanel`) já reservou 380px —
  perto de um terço da tela em 1280px — só para explicar o que a coluna faz,
  antes de qualquer pedido selecionado. Sem seleção, ela vai a `width: 0` e a
  grade de faixas ao lado (`auto-fill`) usa a largura inteira sozinha; ao
  selecionar um pedido, ela entra com a mesma transição de largura que
  qualquer painel do sistema usa para comunicar mudança de estado (§9). A
  regra vale para qualquer coluna de detalhe futura no mesmo formato: o
  estado vazio de uma coluna lateral permanente não é o lugar para uma frase
  de ajuda — é o lugar para não estar lá.

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

O traço desta direção: **grade de 24, traço 1,5, ponta arredondada (`round`),
junta arredondada (`round`)**, `stroke="currentColor"`, `fill="none"`,
`aria-hidden="true"`. É o vocabulário de ícone de aplicação comum — a ponta
reta e o canto vivo que uma direção anterior usava liam como desenho de chapa
cortada, sotaque que este painel não quer mais. Ícone é `--ink-3` e **não tem
caixa**; só o hover ou o foco desenham fundo.

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
| `.tnum` `.num`                                                                    | o número tabular (tempo, dinheiro, nº) / com alinhamento à direita |
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
- [ ] **Sobrou algum `font-family` monoespaçada em algum lugar?** (não deveria
      sobreviver ao lint, mas confira num componente novo antes de rodar)
- [ ] **Sobrou algum `text-transform: uppercase` em algum lugar?** Caixa alta
      saiu do sistema por completo — nem a sidebar nem o cabeçalho de faixa a
      usam mais (não deveria sobreviver ao lint, mesma régua da mono).
- [ ] **Alguma cor está lá por decoração, e não por significado?** Checkbox e
      rádio marcados incluídos — a marca é `--mark-bg`/`--mark-ink`, nunca a
      brasa.
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
npx playwright test -c design/shots/shots.config.ts acabamento     # nativos, foco, truncamento, alvo de toque, brasa no checkbox/rádio
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

## As outras duas direções, e por que nenhuma virou a base

`design/direcoes/papel/` e `design/direcoes/sinal/` continuam completas —
tokens, componentes e as três telas nos dois temas. Quando esta direção trocou
de alvo (instrumento → aplicação de administração), as duas foram avaliadas
contra os cinco critérios da troca antes de qualquer linha de código mudar:

- **Papel** falha em quatro dos cinco: raio **ZERO** ("papel cortado não tem
  canto arredondado") é mais reto que a Brasa que estava saindo, não menos;
  título em Fraunces é serifa de DISPLAY, o oposto de tipografia neutra;
  superfície é bege/marrom de novo, o mesmo problema que esta troca resolve;
  e a regra "sombra só no que flutua" também é dela — sem elevação sutil no
  cartão parado. Só o traço do ícone (1,25, ponta redonda) já apontava na
  direção certa.
- **Sinal** também falha em quatro: tipografia é a família Barlow inteira —
  "desenhada a partir de letreiro de transporte", uma voz própria, não uma
  neo-grotesca neutra; o neutro é **frio de propósito** ("quebra a regra
  antiga de nada de cinza-azulado"), o oposto do viés quente que este sistema
  preserva; o raio do chip é **999px** (cápsula total), mais arredondado do
  que o vocabulário de aplicação comum pede; e o ícone tem traço 2,5, ponta
  reta, geométrico — o oposto de suave. Só a elevação (`--shadow-pop` em vários
  componentes) e o branco de verdade na superfície já apontavam certo.

Nenhuma das duas atendia à maioria dos cinco critérios, então a base desta
direção continuou sendo a Brasa, com os cinco pontos de "A direção" trocados —
não um recomeço a partir de Papel ou Sinal. As duas continuam medidas nos
mesmos 106 pares de contraste de então e continuam sendo a alternativa pronta
se um dia fizer sentido trocar de direção outra vez.
