---
name: rapidex-design-system
description: Regras visuais do painel do lojista Rapidex — tokens, escala tipográfica, espaçamento, cor, densidade, movimento e conteúdo. Leia ANTES de escrever qualquer tela, componente ou CSS novo em src/, e antes de mexer em src/styles/tokens.css. Também aplicável ao revisar uma tela existente ou ao decidir uma cor, um espaçamento, um raio ou uma animação.
---

# Design system do Rapidex

Rapidex é uma plataforma white-label de pedidos online. Este sistema cobre o
**painel do lojista** (`admin.pederapidex.com`): quadro de pedidos em tempo
real, cardápio, configurações e a tela de cozinha.

**O que este painel é:** uma ferramenta de operação densa e confiante — a
família do Linear, do dashboard da Stripe, do da Vercel. Um lojista abre isto
às 22h de sábado com a cozinha cheia. **Cada pixel gasto em decoração é um
pixel a menos de pedido na tela.**

**O que ele não é:** dashboard de SaaS genérico com cartão branco, sombra e
muito ar. Padding generoso, cinza neutro e raio grande em tudo são "seguros" —
e seguro é exatamente a sensação de inacabado.

Fonte histórica: `design/_ds/rapidex-design-system-c214e0d9-.../`. Aquele
material foi gerado a partir da logo, sem ver o código, e é conservador demais
para uma ferramenta de operação. **Este arquivo manda; quando os dois
divergirem, é ele que vale.** Intocáveis do material original: o laranja da
marca e a escala de status de pedido.

## A regra que vale mais que as outras

**Toda cor vem de `src/styles/tokens.css`.** Em qualquer outro arquivo é
`var(--token)`. Um hexadecimal, um `rgb()`, um `hsl()` ou um nome de cor
(`white`, `red`) fora daquele arquivo é erro de lint — `npm run lint` roda
`scripts/check-design-tokens.mjs` nos `.css`.

Se um token faltar para a tela que você está fazendo, **o token está errado,
não a tela**: acrescente-o em `tokens.css` (nos dois temas) em vez de escrever
o valor solto.

---

# 1. Tipografia: cinco níveis, e só cinco

Todo texto do painel é um destes cinco. A prova: **bata o olho em qualquer
texto da tela e diga qual nível ele usa.** Se não der para dizer, o texto está
errado — não falta um nível.

| # | Nível             | Classe       | Corpo/entrelinha | Peso | Caixa      | Cor        | Onde                                            |
| - | ----------------- | ------------ | ---------------- | ---- | ---------- | ---------- | ----------------------------------------------- |
| 1 | Título de página  | `.t-title`   | 20 / 26          | 700  | normal     | primary    | **um por tela**, no alto à esquerda              |
| 2 | Título de seção   | `.t-section` | 14 / 20          | 700  | normal     | primary    | cabeçalho de cartão, de coluna, de aba, de grupo |
| 3 | Rótulo            | `.t-label`   | 11 / 14          | 600  | MAIÚSCULA  | tertiary   | nome de campo, cabeçalho de coluna, grupo da nav |
| 4 | Corpo             | `.t-body`    | 13 / 18          | 400  | normal     | primary    | o conteúdo                                       |
| 5 | Auxiliar          | `.t-aux`     | 12 / 16          | 400  | normal     | tertiary   | ajuda, meta, rodapé, contagem, hora              |

O contraste entre níveis vem de **peso + caixa + cor**, não de três pontos de
corpo. Título de página e título de seção são o mesmo peso e cores iguais; o
que os separa é o tamanho e o fato de haver **um só** do primeiro.

- **13px de corpo, não 15.** A versão anterior deste documento pedia 15px "por
  ser lido a um braço de distância". Errado para o painel: ele é operado com o
  mouse na mão, a 50cm, e 15px é o que empurrava metade da lista para fora da
  tela. Quem é lido a dois metros é a Cozinha, e ela tem escala própria.
- **Nunca escolha tamanho e peso caso a caso.** É exatamente isso que dá a
  sensação de inacabado: quatro tamanhos de "título" em quatro telas.
- Os tokens (`--type-<nível>-size|line|weight|tracking`) existem para compor um
  nível dentro de outra regra — uma célula que é rótulo mas herda a cor do
  status, por exemplo. Fora disso, use a classe.
- **Nada acima de `--text-xl` no painel.** `--text-lg`, `--text-2xl` e
  `--text-3xl` existem para uma tela só: a Cozinha (ver §7).

## Número é outra coisa

**Todo número que se compara em coluna** — nº do pedido, preço, total,
cronômetro, contagem — usa a mono tabular e **alinha à direita**:

- `.num` — mono tabular **e** `text-align: right`. É o padrão para dinheiro e
  para nº de pedido numa lista ou numa tabela.
- `.mono` — só a mono tabular, para número que não vive em coluna (o "25 min"
  dentro de um cartão).

Sem isto, "R$ 9,90" e "R$ 192,90" começam em abscissas diferentes e o olho
reancora a cada linha. Texto de UI comum usa a sans (Manrope).

---

# 2. Espaçamento: oito degraus e nenhum valor solto

| Token       | Valor | Trabalho                                                     |
| ----------- | ----- | ------------------------------------------------------------ |
| `--space-1` | 2px   | folga de cabelo: rótulo empilhado sobre o valor               |
| `--space-2` | 4px   | dentro de um controle: ícone ↔ texto; rótulo ↔ campo          |
| `--space-3` | 8px   | entre controles irmãos; padding de linha densa                |
| `--space-4` | 12px  | padding de cartão; entre campos da mesma linha                |
| `--space-5` | 16px  | entre blocos de uma seção; respiro lateral da tela            |
| `--space-6` | 24px  | entre seções                                                  |
| `--space-7` | 32px  | topo de tela, estado vazio                                    |
| `--space-8` | 48px  | estado vazio grande — o único degrau generoso que sobrou      |

**Escolha o degrau abaixo do que o instinto pede.** O instinto foi treinado em
página de marketing; aqui embaixo tem fila de pedido.

Regras que caem disso:

- **Nenhum número solto em `padding`, `margin` ou `gap`.** A única exceção são
  larguras de coluna de grade (`104px`, `28px`), que são medida de conteúdo, e
  alturas de controle declaradas em `global.css`.
- **Campo, rótulo e ajuda têm espaçamento idêntico em toda tela**: `.field` já
  entrega isso (`gap: --space-2`). Não recomponha um campo à mão.
- Faixa horizontal da tela (barra, cabeçalho, rodapé) usa
  `padding: --space-3 --space-5`. O respiro lateral mora no elemento PAI, e as
  faixas de dentro são `.container` puro, para que as bordas de todas alinhem.

---

# 3. Superfície: separada por tom, não por borda

A escada, de baixo para cima:

| Token             | Papel                                                  |
| ----------------- | ------------------------------------------------------ |
| `--bg-sunken`     | o que afunda dentro do cartão: campo, miniatura, tag    |
| `--bg-app`        | o chão da área de trabalho                             |
| `--bg-chrome`     | a moldura que não é conteúdo: lateral e barra do topo   |
| `--bg-surface`    | onde o trabalho acontece: cartão, coluna, linha de lista |
| `--bg-surface-2`  | o que flutua por cima: menu, diálogo, popover           |

- **Um cartão que tem tom próprio não leva borda.** Contornar tudo é o que faz
  a tela parecer wireframe. Borda existe para o que o tom não resolve: contorno
  de campo e régua entre linhas de uma lista (`--border-subtle`).
- **Sem gradiente, sem blur, sem glassmorphism.** Overlay é véu sólido
  semi-opaco (`--bg-overlay`).
- **Sombra só no que flutua** — menu, diálogo, folha lateral. Cartão parado na
  página não tem sombra em tema nenhum.
- **Sem ilustração, imagem de fundo ou textura.** O único elemento pictórico é
  o logo (`public/logo-mark.png`). Foto de prato é conteúdo do lojista:
  placeholder quadrado discreto até haver foto real.
- **Raio apertado**: `--radius-sm` (4px) no que é controle, `--radius-md` (6px)
  no que é superfície, `--radius-lg` (10px) só no que flutua sobre a tela
  inteira. `--radius-full` só em ponto, badge e switch.
- **Hover em item interativo** clareia no escuro e escurece no claro — os dois
  saem de `--bg-hover`, então a regra é uma só.
- **Pressionado**: `scale(.98)`, sem cor extra.

### Tema

Escuro é o padrão. Claro é **o mesmo conjunto semântico** com as superfícies
invertidas, sob `[data-theme="light"]` no `<html>` — nunca uma segunda paleta.
No claro a escada inverte de luminosidade (a moldura fica mais escura que a
área de trabalho) mas o papel de cada token continua o mesmo.

Ao escrever CSS, **nunca** escreva uma regra específica de tema. Se precisou de
`[data-theme="light"] .minha-classe`, o token semântico que você usou é o
errado.

---

# 4. Cor com avareza

**A pergunta antes de pintar qualquer coisa: que informação essa cor carrega?**
Se a resposta for "fica bonito" ou "diferencia visualmente", a cor sai.

1. **O laranja da marca aparece em três lugares e mais nenhum:** botão primário
   (`.btn--primary`), indicador do item ativo da navegação, anel de foco. Nunca
   em texto de corpo, em ícone neutro, em fundo de seção ou em ênfase.
   Da mesma família do foco, e pelo mesmo motivo ("é aqui que você mexeu"), vêm
   os dois únicos usos derivados: o texto selecionado (`::selection`) e o
   realce de um segundo na linha que o lojista acabou de mover. Nenhum dos dois
   é permanente na tela — se ficasse, seria ênfase, e ênfase é o que esta regra
   proíbe.
2. **A escala de status pinta status de pedido e mais nada.** Não use uma matiz
   de status para categorizar o que não é estado de pedido (tipo de entrega,
   forma de pagamento): confunde com a coluna do quadro da mesma cor.
3. **Verde = "no ar / à venda".** Só o interruptor de disponibilidade, o de
   loja aberta e o ponto de conexão viva. Nunca como rótulo escrito ao lado do
   interruptor: se o controle já diz, a palavra colorida é ruído.
4. **Âmbar = "esperando / atenção".** Cronômetro que entrou na janela,
   observação do item na cozinha, aviso.
5. **Vermelho nunca é status.** É só perigo e alarme: cancelar, desativar,
   pagamento recusado, pedido estourado.
6. **O resto é neutro.** Etiqueta, ícone, contagem, meta: `--text-secondary` ou
   `--text-tertiary`.

Estado positivo geralmente não precisa de palavra nenhuma. "DISPONÍVEL" em
verde ao lado de um interruptor verde ligado, em toda linha da lista, é a mesma
informação três vezes — o interruptor fica, o rótulo sai, e sobra texto só nos
estados que **não** são o normal ("Esgotado", "Inativo").

Os neutros têm **viés quente** (o preto é `#0A0908`, com sombra de marrom). Não
introduza cinza-azulado de SaaS genérico.

---

# 5. Densidade e layout

- **Sidebar de `--sidebar-width` (220px)**, agrupada por rótulo pequeno e fino
  (`.t-label`), **sem linha divisória** entre grupos — o vão já separa. Abaixo
  de 900px vira trilha de ícones de `--sidebar-rail` (56px), sem drawer: no
  meio do turno, um menu que precisa ser aberto é um clique a mais por troca.
- **Barra do topo de `--topbar-height` (48px)**, com o seletor de filial sempre
  visível, mesmo com uma filial só.
- **Lista de dados é grade, nunca flex com `space-between`.** Só a coluna do
  nome é fluida; preço, estado e ação têm largura fixa e ficam na mesma
  abscissa em todas as linhas. Com `space-between`, cada linha ancora o olho
  num lugar diferente conforme o comprimento do nome.
- **Linha de lista densa**: alvo de ~32px (miniatura de 24px,
  `padding-block: --space-2`). O que estoura essa altura é empilhar rótulo em
  cima de controle — ponha lado a lado. Em `max-width: 720px` a densidade cede
  e a linha vira alvo de dedo.
- **Ação secundária aparece no hover da linha**, sem caixa (`.btn--ghost`), e
  **continua visível quando recebe foco de teclado** (`:focus-within`). Uma
  coluna de botões contornados compete com o dado que a pessoa veio ler.
- **Nada de informação duas vezes na mesma tela.** Se o contador está no
  cabeçalho da coluna, ele não está também num cartão de resumo em cima —
  escolha o lugar onde o olho já está.
- **Conteúdo dentro de `.container`** (1400px). Exceções propositais: o quadro
  de pedidos e a Cozinha, que rolam na horizontal e usam a tela toda.
- Board kanban: colunas `flex: 1 0 232px` com `max-width: var(--column-max)` —
  crescem para ocupar a sobra, nunca encolhem (card espremido quebra em duas
  linhas e acaba com a leitura de longe).

---

# 6. Movimento

**Animação só onde comunica mudança de estado.** Nada de entrada decorativa,
parallax ou transição de página. Os casos legítimos hoje: o botão do switch
deslizando ao esgotar/repor, a linha esmaecendo ao desativar, o realce da
categoria que trocou de posição, o pulso do ponto de conexão reconectando, o
piscar do cronômetro que estourou.

Escreva as durações com `var(--motion-fast)` / `var(--motion-base)`: sob
`prefers-reduced-motion: reduce` esses tokens já viram `0s`, e a tela troca de
estado instantaneamente em vez de não trocar. `@keyframes` com `animation:`
precisa de um `@media (prefers-reduced-motion: reduce) { animation: none }`
próprio.

---

# 7. A Cozinha é a exceção, e é a única

`src/kitchen/` quebra a densidade do resto de propósito: é um monitor pendurado
na parede, lido a dois metros por quem está com as mãos ocupadas, sem
navegação lateral e sem barra do topo. Lá o nº do pedido vai a `--text-3xl`, o
item a `--text-2xl` e o botão ocupa o cartão inteiro.

**Isso não autoriza escala grande em nenhuma outra tela.** Se uma tela do
painel "precisa" de 20px de corpo, o problema é outro.

---

# 8. Rota que não existe é página "em implementação"

A navegação mostra o produto inteiro, inclusive o que ainda não foi construído
— esconder um item não faz o lojista deixar de procurá-lo. O item aparece com
peso reduzido e a etiqueta "em breve", **é clicável**, e leva a uma página com
**título e uma frase do que vai fazer. Nada mais.** Sem botão falso, sem dado
inventado, sem barra de progresso, sem "80% pronto".

Nunca invente rota de API nem tela com dado fabricado para preencher espaço.

---

# 9. Ícones e conteúdo

Conjunto autoral de linha: **stroke 2px, grade 24px, cantos arredondados**,
`stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`. Ver
`src/ui/icons.tsx`. Ícone é `--text-tertiary` e **não tem caixa** — só o hover
ou o foco desenham fundo.

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

---

# 10. Componentes deste repo

`src/ui/` (`Modal`, `Switch`, `RapidexLogo`) e as classes utilitárias de
`src/styles/global.css`:

| Classe                                            | O quê                                             |
| ------------------------------------------------- | ------------------------------------------------- |
| `.t-title` `.t-section` `.t-label` `.t-body` `.t-aux` | os cinco níveis de tipografia                 |
| `.btn` `.btn--primary` `.btn--danger` `.btn--ghost` `.btn--sm` `.icon-btn` | botões (28px; `--sm` 24px)|
| `.field` `.field__label` `.field__hint` `.input` `.select` `.textarea` `.checkbox` | formulário |
| `.alert--error` `.alert--warn` `.alert--info`     | avisos                                            |
| `.tag`                                            | etiqueta neutra                                   |
| `.mono` `.num`                                    | número tabular / número tabular alinhado à direita |
| `.muted` `.faint` `.container` `.sr-only` `.conn` | utilitários                                       |

**Reaproveite antes de criar**: um segundo botão com padding próprio é como a
densidade começa a desandar.

---

# Checklist antes de dar uma tela por pronta

Estas são as perguntas da revisão; qualquer "não" é conserto, não ressalva.

- [ ] `npm run lint` limpo (inclui a aderência de cor) e `npm test` verde.
- [ ] **Existe alguma informação exibida duas vezes na mesma tela?**
- [ ] **Todo espaçamento vem da escala** — nenhum `padding: 20px` solto.
- [ ] **Dá para nomear qual dos cinco níveis cada texto usa?**
- [ ] **Alguma cor está lá por decoração e não por significado?**
- [ ] **As colunas de conteúdo alinham entre si e com o cabeçalho?**
- [ ] **No mobile (390px), alguma coisa quebra ou fica ilegível?**
- [ ] Dinheiro e nº de pedido em `.num` (tabular, à direita).
- [ ] Testada nos dois temas, sem nenhuma regra CSS específica de tema.
- [ ] Laranja só no CTA primário, na navegação ativa e no foco.
- [ ] Nenhum emoji; nenhuma rota inventada.
- [ ] Animação só onde há mudança de estado, com `prefers-reduced-motion`.
- [ ] Foco visível com `--focus-ring` em tudo que é operável por teclado.

Para conferir de verdade: `npx playwright test -c design/shots/shots.config.ts`
fotografa cada tela em 1440px (claro e escuro) e 390px em
`design/shots/out/<SHOT_TAG>/`.
