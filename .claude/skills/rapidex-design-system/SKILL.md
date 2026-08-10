---
name: rapidex-design-system
description: Regras visuais do painel do lojista Rapidex — tokens, os cinco níveis de tipografia, a escala de seis degraus, os quatro planos, cor, densidade, enquadramento e movimento. Leia ANTES de escrever qualquer tela, componente ou CSS novo em src/, e antes de mexer em src/styles/tokens.css. Também aplicável ao revisar uma tela existente ou ao decidir uma cor, um espaçamento, um raio ou uma animação.
---

# Design system do Rapidex

Rapidex é uma plataforma white-label de pedidos online. Este sistema cobre o
**painel do lojista** (`admin.pederapidex.com`): quadro de pedidos em tempo
real, cardápio, configurações e a tela de cozinha.

**O que este painel é:** uma ferramenta de operação densa e confiante — a
família do Linear, do dashboard da Stripe, do da Vercel. Um lojista abre isto
às 22h de sábado com a cozinha cheia, no desktop do balcão e no celular no meio
do salão. Ele precisa bater o olho e saber quantos pedidos, o que está
atrasado, o que acabou. **Cada pixel gasto em decoração é um pixel a menos de
pedido na tela.**

**O que ele não é:** dashboard de SaaS genérico com cartão branco, sombra e
muito ar. Padding generoso, cinza neutro e raio grande em tudo são "seguros" —
e seguro é exatamente a sensação de inacabado.

**"Premium" aqui significa PRECISÃO** — alinhamento, ritmo, contraste. Não
sombra, não degradê, não animação de entrada.

Intocáveis: o **laranja da marca** (`--ember`) e a **escala de sete status de
pedido** (`--st-*`). Todo o resto deste documento pode ser rediscutido com uma
tela na mão.

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

# 1. Tipografia: cinco níveis, e só cinco

**Inter, e só ela.** Sans neutra de interface, sem personalidade própria, com
numeral tabular de verdade. Não há fonte mono no sistema: preço em monoespaçada
lê como trecho de código no meio do cardápio, e o alinhamento que ela existia
para resolver o `tnum` da Inter já resolve.

| #   | Nível            | Classe       | Corpo/entrelinha | Peso | Caixa     | Tinta     | Onde                                             |
| --- | ---------------- | ------------ | ---------------- | ---- | --------- | --------- | ------------------------------------------------ |
| 1   | Título de página | `.t-title`   | 20 / 26          | 650  | normal    | `--ink`   | **um por tela**, no alto à esquerda              |
| 2   | Título de seção  | `.t-section` | 14 / 20          | 600  | normal    | `--ink`   | cartão, coluna, aba, grupo, diálogo              |
| 3   | Rótulo           | `.t-label`   | 11 / 14          | 600  | MAIÚSCULA | `--ink-3` | nome de campo, cabeçalho de coluna, grupo da nav |
| 4   | Corpo            | `.t-body`    | 13 / 18          | 400  | normal    | `--ink`   | o conteúdo                                       |
| 5   | Auxiliar         | `.t-aux`     | 12 / 16          | 400  | normal    | `--ink-3` | ajuda, meta, hora, contagem, rodapé              |

**A prova: bata o olho em qualquer texto da tela e diga qual nível ele usa.** Se
não der para dizer, o texto está errado — não falta um nível.

- O contraste entre níveis vem de **corpo + peso + caixa + tinta juntos**, nunca
  de um só. Corpo (13) e auxiliar (12) diferem em 1px porque quem os separa de
  verdade é a tinta.
- Maiúscula e `--ink-3` fazem parte do nível 3, não são opção: é o que permite
  ao rótulo ser 11px sem competir com o valor que ele nomeia.
- Cada classe declara corpo, entrelinha, peso, espacejamento **e tinta** juntos.
  Meia definição — corpo aqui, cor lá no componente — é como um nível vira
  quatro variantes em quatro telas.
- Os tokens (`--tt-*`, `--ts-*`, `--tl-*`, `--tb-*`, `--ta-*`) existem para
  compor um nível dentro de outra regra. Fora disso, use a classe.
- **Nunca escolha tamanho e peso caso a caso.** É exatamente isso que dá a
  sensação de inacabado: quatro tamanhos de "título" em quatro telas.

## Número é o mesmo nível com outra métrica

**Todo número que se compara** — dinheiro, tempo decorrido, nº de pedido,
contagem — sai em numeral tabular:

- `.num` — tabular **e** alinhado à direita. É o padrão para uma COLUNA de
  dinheiro numa lista ou numa tabela.
- `.tnum` — só tabular, para número que vive dentro de uma frase ou de um
  cartão.

Sem isso, "R$ 9,90" e "R$ 192,90" começam em abscissas diferentes e o olho
reancora a cada linha.

## A Cozinha é a exceção, e é a única

`src/kitchen/` quebra a escala de propósito: é um monitor pendurado na parede,
lido a dois metros por quem está com as mãos ocupadas, sem navegação lateral e
sem barra do topo. Ela tem três corpos próprios (`--k-num`, `--k-item`,
`--k-meta`), declarados como exceção em `tokens.css`.

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

# 3. Superfície: quatro planos, separados por tom

| Token              | Papel                                                               |
| ------------------ | ------------------------------------------------------------------- |
| `--bg`             | o chão: área de trabalho, lateral e barra do topo                   |
| `--surface`        | onde o trabalho acontece: cartão, coluna, lista                     |
| `--surface-raised` | o que sobe um degrau: cartão dentro de coluna, menu, diálogo, folha |
| `--line`           | a régua, quando o tom não basta                                     |

Mais `--field`, o plano do que se PREENCHE, que afunda.

- **A moldura é o chão.** Lateral e barra do topo saem em `--bg`, o mesmo tom da
  área de trabalho; quem as separa é um fio de 1px. Assim `--surface` fica
  reservado ao conteúdo, e um cartão nunca disputa plano com a navegação.
- **Um bloco que tem tom próprio não leva borda.** Contornar tudo é o que faz a
  tela parecer wireframe. Se um bloco precisou de borda para se ver, ele está no
  plano errado.
- **A exceção declarada é o campo de texto.** Fora de um cartão ele some no
  fundo, então ele — e só ele — leva contorno sempre, em `--line-control`, que é
  o único da paleta que passa dos 3:1 da WCAG 1.4.11.
- **Sem gradiente, sem blur, sem glassmorphism.** Overlay é véu sólido
  semi-opaco (`--scrim`).
- **Sombra só no que flutua** — menu, diálogo, folha lateral, barra de salvar.
  Cartão parado na página não tem sombra em tema nenhum.
- **Sem ilustração, imagem de fundo ou textura.** O único elemento pictórico é o
  logo. Foto de prato é conteúdo do lojista: placeholder discreto até haver foto.
- **Raio apertado**: `--r-chip` (4px) no que é controle, `--r-field` (6px) no que
  é superfície, `--r-card` (8px) no que flutua. `--r-round` só em ponto, etiqueta
  e interruptor.

### Tema

**Escuro é o tema principal.** Claro é **o mesmo conjunto semântico** com as
superfícies invertidas, sob `[data-theme]` no `<html>` — nunca uma segunda
paleta. A escada de tom no escuro é mais aberta que no claro de propósito: no
claro o branco do cartão se destaca sozinho; no escuro, dois cinzas a 4% de
distância viram um borrão e o cartão desaparece.

Ao escrever CSS, **nunca** escreva uma regra específica de tema. Se precisou de
`[data-theme="dark"] .minha-classe`, o token que você usou é o errado.

---

# 4. Cor com avareza

**A pergunta antes de pintar qualquer coisa: que informação essa cor carrega?**
Se a resposta for "fica bonito" ou "diferencia visualmente", a cor sai.

1. **O laranja da marca aparece em três lugares e mais nenhum:** botão primário
   (`.btn--primary`), indicador do item ativo da navegação, anel de foco. Nunca
   em texto de corpo, em ícone neutro, em fundo de seção ou em ênfase.
   Da mesma família do foco vem o único uso derivado: o texto selecionado
   (`::selection`) e o realce de um segundo na linha que acabou de se mover.
   **O laranja nunca é TEXTO sobre `--ember-wash`**: não existe um laranja que
   passe em AA nos dois temas sem deixar de ser o laranja da marca. Onde a marca
   marcaria um item ativo, use tinta cheia + um degrau de tom + um trilho de 2px.
2. **A escala de status pinta status de pedido e mais nada.** Não use uma matiz
   de status para categorizar o que não é estado de pedido (tipo de entrega,
   forma de pagamento). Quem traduz status do backend para estágio visual é
   `stageOf()` em `orders/order-status.ts`; o elemento leva `is-<estágio>` e lê
   `--st` / `--st-wash`. Nenhum componente escolhe matiz.
3. **`--ok` = "no ar / à venda / confirmado".** Interruptor ligado, loja aberta,
   ponto de conexão viva. Nunca como palavra escrita ao lado do controle que já
   diz a mesma coisa.
4. **`--alert` = "esperando / atenção".** Cronômetro que entrou na janela,
   observação do item na cozinha, aviso.
5. **`--danger` = perigo.** Cancelar, excluir, pagamento recusado, pedido
   estourado. (O estágio `cancelado` da escala de status usa a mesma matiz: fim
   de linha e perigo são a mesma leitura.)
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
- **Lateral de `--sidebar-w` (208px)**, agrupada por rótulo (nível 3), sem linha
  divisória entre grupos — o vão já separa. Abaixo de 1024px vira trilha de
  ícones (`--sidebar-rail`); abaixo de 640px sai da tela e vira barra inferior.
- **Barra do topo de `--topbar-h` (48px)**, com o seletor de filial sempre
  visível, mesmo com uma filial só.
- **Exceções propositais ao teto**: o quadro de pedidos e a Cozinha, que rolam na
  horizontal e usam a tela toda.
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
  lugar diferente conforme o comprimento do nome.
- **Linha de lista densa**: alvo de ~32px. O que estoura essa altura é empilhar
  rótulo em cima de controle — ponha lado a lado. Em `max-width: 720px` a
  densidade cede e a linha vira alvo de dedo.
- **Ação secundária é ícone SEM CAIXA**, revelada no hover da linha, e
  **continua visível no foco de teclado** (`:focus-within`). No toque ela é
  permanente — não existe hover para revelá-la. Uma coluna de botões
  contornados compete com o dado que a pessoa veio ler.
- **O interruptor indica estado; ele não é a ação da página.** Trilho de 28×16,
  desenho pequeno e alvo de toque inteiro. Um por linha no tamanho anterior
  fazia dele o elemento mais pesado da lista.
- **Nada de informação duas vezes na mesma tela.** Se o contador está no
  cabeçalho da coluna, ele não está também num resumo em cima — e um total que é
  a SOMA de contadores visíveis na mesma dobra também é a mesma informação.
- **Nada idêntico em toda linha de uma lista.** "DISPONÍVEL" ao lado de um
  interruptor ligado, "Não imprimir" em toda linha da coluna de setor, "3 itens
  / 1 item" ao lado de cada categoria: a palavra que se repete não distingue
  nada, só ocupa a largura do que muda. Escreva só o estado que **não** é o
  normal.
- **Coluna/lista vazia não escreve nada** quando o contador ao lado já diz zero.
  "Nenhum pedido" em cinco colunas ao mesmo tempo é ruído em toda a largura da
  tela, no lugar onde o próximo pedido vai aparecer. O "Carregando…" fica: aí a
  lista vazia ainda não é uma afirmação.
- Board kanban: colunas `flex: 1 0 232px` com `max-width: var(--column-max)` —
  crescem para ocupar a sobra, nunca encolhem.

---

# 9. Movimento

**Animação só onde comunica mudança de estado.** Nada de entrada decorativa,
parallax ou transição de página. Os casos legítimos hoje: o botão do
interruptor deslizando, a linha esmaecendo ao desativar, o realce da categoria
que trocou de posição, o pulso do ponto de conexão, o piscar do cronômetro que
estourou, a entrada do painel de detalhe e da barra de salvar.

Escreva as durações com `var(--motion-fast)` / `var(--motion-base)`: sob
`prefers-reduced-motion: reduce` esses tokens já viram `0s`, e a tela troca de
estado instantaneamente em vez de não trocar. `@keyframes` com `animation:`
precisa de um `@media (prefers-reduced-motion: reduce) { animation: none }`
próprio.

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

Conjunto autoral de linha: **stroke 2px, grade 24px, cantos arredondados**,
`stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`. Ver
`src/ui/icons.tsx`. Ícone é `--ink-3` e **não tem caixa** — só o hover ou o foco
desenham fundo.

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
DataTable, Sheet, Tabs, OrderTicket, MaturationBar), `src/ui/` (Modal, Switch,
RapidexLogo) e as classes de `src/styles/primitives.css`:

| Classe                                                                            | O quê                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `.t-title` `.t-section` `.t-label` `.t-body` `.t-aux`                             | os cinco níveis de tipografia                      |
| `.btn` `.btn--primary` `.btn--danger` `.btn--ghost` `.btn--sm` `.icon-btn`        | botões (`--control-h`; `--sm` menor)               |
| `.field` `.field__label` `.field__hint` `.field__error-text` `.input` `.textarea` | formulário                                         |
| `.alert--error` `.alert--warn` `.alert--info`                                     | avisos                                             |
| `.tag`                                                                            | etiqueta neutra                                    |
| `.tnum` `.num`                                                                    | número tabular / número tabular alinhado à direita |
| `.muted` `.faint` `.sr-only` `.conn`                                              | utilitários                                        |

**Reaproveite antes de criar**: um segundo botão com padding próprio é como a
densidade começa a desandar. Não existe mais um `legacy-bridge.css` — se você
encontrar dois nomes para a mesma coisa, um dos dois é para apagar.

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
- [ ] **Alguma informação se repete, idêntica, em toda linha de uma lista?**
- [ ] **Todo espaçamento vem da escala, ou sobrou valor solto no CSS?**
- [ ] **Dá para nomear qual dos cinco níveis tipográficos cada texto usa?**
- [ ] **Alguma cor está lá por decoração, e não por significado?**
- [ ] **Todo elemento interativo tem hover e foco visíveis?**
- [ ] **Algum texto trunca onde havia espaço de sobra?**
- [ ] **As colunas de conteúdo alinham entre si e com o cabeçalho?**
- [ ] **No mobile (390px), alguma coisa quebra ou fica ilegível?**
- [ ] **O tema escuro tem o mesmo cuidado do claro?**
- [ ] Dinheiro e nº de pedido em numeral tabular.
- [ ] Nenhuma regra CSS específica de tema.
- [ ] Nenhum emoji; nenhuma rota inventada.
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
