---
name: rapidex-design-system
description: Fonte de verdade visual do Admin Rapidex. Use ao criar, alterar ou revisar UI em src/, especialmente shell, tokens, componentes, telas operacionais, responsividade, tema escuro e acessibilidade. Não use para mudar regras de negócio, contratos, API ou backend.
---

# Design system do Admin Rapidex

> **AVISO — FASE 1 DE UMA NOVA DIREÇÃO VISUAL ESTÁ NO CÓDIGO (2026-08-20).**
>
> Os tokens, os primitivos e DUAS telas (Pedidos e Minha loja › Geral) já
> seguem a direção nova; o resto do painel ainda não foi propagado, e este
> documento ainda descreve a direção ANTERIOR. Enquanto a fase 3 não o
> reescreve, a fonte de verdade das escolhas estéticas é
> `src/styles/tokens.css` — leia o cabeçalho dele antes de confiar nas seções
> de Tipografia, Espaçamento, Raios, Superfícies e Cor daqui.
>
> O que já divergiu: escala tipográfica (título 24/700, seção 15/600, rótulo
> 12/600 em `--ink-3`), raios (4/6/8/12/16), alturas de controle (36/30/44),
> separação por TOM em vez de borda (`--card-edge`), sombra só onde há elevação
> (`--shadow-card` é `none`), neutros quentes e `--ember` em `#c2410c`.
>
> O que NÃO mudou e continua valendo: os limites invariáveis, a semântica de
> status, a disciplina de tokens, contraste medido, `focus-visible`, movimento
> reduzido e a regra de reutilização.

Este documento descreve o painel implementado. O código de referência está em
`src/styles/tokens.css`, `src/styles/primitives.css`, `src/ds/`, `src/layout/`
e nos estilos das páginas. Se uma regra daqui divergir do código, corrija a
divergência; não crie uma segunda linguagem visual por página.

## Limites invariáveis

Trabalho de interface pode reorganizar markup e composição, mas preserva:

- hooks, estados, efeitos, callbacks e permissões;
- endpoints, requests, payloads, query params e respostas esperadas;
- autenticação, autorização, rotas reais e redirecionamentos;
- estados e transições de pedidos, pagamentos e cardápio;
- cálculos, filial, cashback, cupons, WhatsApp e integrações;
- dados reais. Não criar exemplos, APIs, rotas ou funções inexistentes.

Antes de alterar um componente funcional, identifique essas fronteiras. O
backend continua sendo a autoridade mesmo quando a UI antecipa uma restrição.

## Identidade

O Admin Rapidex é software comercial de operação e gestão de restaurantes.
Deve transmitir confiança, velocidade, organização, precisão e estabilidade.
O usuário precisa reconhecer em segundos onde está, o que requer atenção e
qual ação é segura.

Personalidade:

- profissional e direta, sem ser impessoal;
- densa quando a operação exige e calma nas áreas de gestão;
- contemporânea, mas resistente a modismos;
- claramente Rapidex pelo uso disciplinado da marca, não por decoração.

Princípios de decisão, nesta ordem:

1. clareza operacional;
2. legibilidade e hierarquia;
3. consistência e velocidade de uso;
4. acessibilidade;
5. responsividade e acabamento;
6. identidade e estética.

O painel não deve parecer ERP antigo, template administrativo genérico,
wireframe, projeto acadêmico, equipamento industrial ou SaaS azul-cinza sem
identidade. Premium significa alinhamento, ritmo, proporção e microinteração;
não significa glassmorphism, gradiente decorativo, blur, sombra pesada ou card
para toda informação.

## Tipografia

A interface usa **Inter Variable**, autohospedada por
`@fontsource-variable/inter`. Ela permanece por legibilidade, boa métrica em
controles densos e numerais consistentes — não por herança visual.

Há cinco níveis compartilhados:

| Papel                | Tokens                                         | Uso                               |
| -------------------- | ---------------------------------------------- | --------------------------------- |
| Título de página     | `--tt-size: 26px`, `--tt-line: 34px`, peso 650 | um por rota                       |
| Título de seção/card | `--ts-size: 16px`, `--ts-line: 24px`, peso 600 | seções, painéis e dialogs         |
| Label                | `--tl-size: 12px`, `--tl-line: 16px`, peso 600 | campos, colunas, metadados fortes |
| Corpo                | `--tb-size: 14px`, `--tb-line: 20px`, peso 400 | dados e texto principal           |
| Auxiliar             | `--ta-size: 13px`, `--ta-line: 18px`, peso 400 | hints, horários e notas           |

Regras:

- títulos são compactos; não criar hero type em tela administrativa;
- produto, cliente e seção têm peso 600 quando são o ponto de entrada;
- labels usam caixa de frase; caixa alta com tracking não pertence ao sistema;
- dinheiro, hora, tempo e número de pedido usam `.tnum`; colunas numéricas
  usam também `.num` para alinhamento à direita;
- não usar fonte monoespaçada por estética;
- KPIs usam `--metric-size: 28px` e tickets usam
  `--ticket-time-size: 20px`;
- somente a Cozinha usa a escala de distância: número 34px, item 18px e meta
  15px.

## Espaçamento

A escala única é 4, 8, 12, 16, 20, 24 e 32px:
`--sp-4` a `--sp-32` ou os aliases semânticos `--s-1` a `--s-7`.

- 4–8px: relação interna de controle;
- 12–16px: irmãos, linhas e padding compacto;
- 20–24px: blocos e seções;
- 32px: estados vazios e respiro excepcional.

Não introduzir degraus casuais para corrigir uma página. Larguras de coluna e
medidas de gráfico podem ser específicas quando descrevem o conteúdo.

## Raios

- `--r-xs: 5px`: checkbox e controles muito pequenos;
- `--r-chip: 8px`: tags e cápsulas;
- `--r-control` / `--r-field: 10px`: botões, inputs e segmentados;
- `--r-card: 14px`: cards, tabelas e grupos;
- `--r-sheet: 18px`: dialogs, menus e sheets;
- `--r-round`: avatar, pontos e contadores circulares.

Raios comunicam escala do objeto. Não inventar um raio por componente.

## Superfícies

Planos semânticos:

- `--bg`: chão da aplicação;
- `--surface`: trabalho estável, como cards, listas e topbar;
- `--surface-raised`: conteúdo acima do fluxo, como drawer, dialog e menu;
- `--surface-muted`: agrupamento, cabeçalho de tabela e hover discreto;
- `--surface-selected`: seleção sem moldura agressiva;
- `--field`: área editável;
- `--console-*`: sidebar e navegação móvel.

Aplicação:

- sidebar: console escuro nos dois temas;
- topbar: `surface`, borda inferior e `--shadow-shell`;
- cards: `surface`, borda `--line` e `--shadow-card` apenas quando o bloco
  precisa de começo e fim;
- tabelas: uma superfície externa, cabeçalho muted e linhas separadas;
- drawers/dialogs/menus: `surface-raised` e `--shadow-raised`;
- campos: `field` com contorno `--line-control`;
- filtros: uma única superfície agrupadora, não um card por controle.

Evite cards dentro de cards. Use espaço e mudança tonal antes de acrescentar
borda; use sombra quando houver elevação real ou quando a superfície precisar
se separar do chão. Bordas estruturam listas, campos e limites relevantes —
não contornam toda frase.

## Cor

### Claro

- background `#f5f6f7`;
- surface `#ffffff`;
- muted `#eef0f2`;
- texto `#191c20`, apoio `#4d535b`, auxiliar `#69717b`;
- marca `#b83f08`, pressed `#943205`, wash `#fff0e6`.

### Escuro

- background `#101216`;
- surface `#171a1f`;
- raised `#20242b`;
- muted `#20242a`;
- texto `#f5f7fa`, apoio `#c1c6ce`, auxiliar `#949ca8`;
- marca `#ff7a2f`, pressed `#ff9a62`, wash `#32180b`.

### Semântica

Use somente tokens:

- sucesso `--ok` / `--ok-wash`;
- atenção `--alert` / `--alert-wash`;
- perigo `--danger` / `--danger-wash`;
- informação `--info` / `--info-wash`;
- estágios de pedido `--st-*` e `--st-*-wash`.

O laranja marca ação primária, navegação ativa, seleção e foco. Não colore
checkbox/radio, toda superfície ou dado sem significado. Nenhum estado pode
depender apenas de cor: combine texto, ícone, posição, ponto ou forma.

Valores literais de cor ficam exclusivamente em `tokens.css`. O lint de tokens
e o verificador de contraste cobram essa fronteira.

## Shell global

O shell tem três formas:

- **≥1180px:** sidebar de 232px com logo, grupos, nomes e “Em breve”;
- **768–1179px:** rail de 72px com ícones e nomes acessíveis;
- **<768px:** sidebar vira barra inferior de quatro destinos; “Mais” abre uma
  sheet com toda a navegação restante.

A topbar mede 64px e agrupa seletor de filial, conta, tema e logout. Em desktop,
conta usa avatar, nome e papel; em mobile, controles secundários se contraem,
mas não perdem a função. O conteúdo inicia na mesma régua horizontal da topbar.

Item ativo usa fundo discreto, maior peso e indicador laranja. Itens futuros
continuam navegáveis e honestamente marcados; nunca recebem páginas ou dados
falsos.

## Componentes

### Button

Alturas 38px, 32px compacto e 44px no toque. Variantes reais: padrão,
`primary`, `danger`, `ghost`, `ghost-danger`, ícone e largura total. Todo botão
tem hover, active, focus-visible, disabled e loading quando a ação já o fornece.
Links com aparência de botão usam a mesma classe e não sublinham.

### Input, textarea e select

Compartilham altura, fonte, raio, field surface, border e foco. Labels ficam
acima; hint e erro ficam próximos do campo que qualificam. Placeholder não
substitui label. Select custom mantém semântica de teclado; date inputs nativos
são aceitos quando preservam acessibilidade.

### Checkbox, radio e switch

Checkbox/radio marcados usam `--mark-bg` e `--mark-ink`, não a marca. Switch é
único (`src/ds/Switch`), mede 36×20px e comunica estado por posição, cor e label
acessível. Não duplicar implementações.

### Tabs e segmented control

Tabs mudam contexto de página e usam linha inferior no ativo. Segmented control
escolhe uma alternativa compacta dentro do mesmo contexto; tem fundo muted e
segmento ativo em surface. Ambos usam `aria-pressed` ou semântica equivalente.

### Badge, tag e chip

Servem para estado curto, modalidade, pagamento ou contagem. A forma é compacta
e a tinta é semântica. Não transformar todo metadado em chip. Status de pedido
usa texto mais o estágio visual.

### Card

Card agrupa informação com relação forte e limite útil. Use `src/ds/Card`
quando a anatomia cabe em header/body/actions. Não embrulhar seções apenas para
preencher o fundo.

### Tabela e linha de lista

`src/ds/DataTable` é a base. Desktop usa colunas reais, header muted, alinhamento
numérico à direita, hover tonal e linha de 48–64px. Mobile transforma a linha
em bloco rotulado; não resolve tabela inteira com scroll horizontal. Produto ou
cliente é o ponto de entrada. Ações secundárias aparecem no hover/foco em mouse
e permanecem visíveis no toque.

### OrderTicket

Existe um único ticket em `src/ds/OrderTicket`; `OrderCard` apenas traduz dados
da API. Hierarquia:

1. estágio e tempo decorrido;
2. total;
3. cliente;
4. número e horário;
5. entrega/retirada, pagamento e alerta.

O estágio usa trilho lateral e cor semântica. Seleção usa
`surface-selected` e inset da marca, sem moldura pesada. Pagamento ainda não
confirmado aparece como alerta compacto; não pintar o card inteiro.

### Filtros

Filtros relacionados ocupam uma superfície única. Período e busca vêm primeiro;
controles operacionais e conexão formam o segundo grupo. Em mobile eles quebram
por grupo e mantêm largura integral onde necessário.

### Drawer de pedido

`OrderDetailPanel` mede 420px e é uma coluna permanente em desktop, evitando
reflow do quadro entre seleções. Abaixo de 1280px só aparece com seleção e
flutua sobre o quadro; abaixo de 720px vira tela cheia. Dentro,
separe operação, cliente, entrega, itens, financeiro, histórico e ações por
ritmo e linhas, não por cards aninhados. Total e ação seguinte devem ser fáceis
de localizar; footer é persistente.

### Sheet, dialog e menu

Sheet nasce do rodapé e preserva safe area. Dialog centraliza no desktop e vira
bottom sheet no mobile. Menu flutua próximo ao gatilho. Todos usam scrim,
elevação, fechamento acessível, Escape/foco conforme a implementação e movimento
curto que explica origem/destino.

### Tooltip, toast e skeleton

Não há framework global para esses três. Ao trabalhar numa superfície que já
os possua, use tokens de raised surface, meta type e movimento curto. Não crie
toast, skeleton ou tooltip apenas para decorar nem substitua feedback persistente
necessário. `title` pode explicar controle desabilitado simples; informação
essencial deve estar visível.

### Empty state, loading e alert

Estado vazio diz o que ocorreu e, somente se já existe ação real, como sair.
Loading não inventa conteúdo. Alertas usam `info`, `warn` ou `error`, ficam
próximos da origem e preservam `role` adequado. Não repetir o mesmo alerta em
cada seção.

## Telas

### Pedidos

É a tela operacional principal. Em desktop, quadro e painel lateral preservam
largura estável; abaixo de 1280px o detalhe sobrepõe o quadro somente durante a
seleção. Tickets mantêm densidade e são agrupados por estágio. Ordem de leitura:
estágio, tempo, cliente, pedido, modalidade, pagamento e valor. Histórico
continua separado por tab.

### Cozinha

É exceção de distância. Mantém três lanes, cards maiores, ação de largura total
e tipografia `--k-*`. Cada coluna pode ocupar a altura disponível porque é uma
fila operacional; o scroll horizontal é local no viewport estreito, nunca da
página inteira.

### Cardápio

Desktop: categorias em rail de 240px e itens em lista tabular. Produto domina;
preço, setor, situação e ação alinham em colunas. Tablet transforma categorias
em faixa horizontal. Mobile reorganiza cada item sem esconder preço, setor,
estado ou editar.

### Clientes

Busca e contagem formam uma barra. A tabela usa nome/telefone como primeira
célula, valores tabulares e transformação móvel do DataTable. Não inventar
detalhe ou filtros que o backend não fornece.

### Desempenho

A sequência é período, veredito narrativo, KPIs comparáveis, dias, produtos e
composição. Só usa métricas existentes. KPIs são uma grade tipográfica com
separadores, não três cards gigantes. Seções analíticas usam grid quando há
largura e voltam a uma coluna abaixo de 1200px. Variação combina sinal, seta e
cor.

### Minha Loja

Navegação secundária é um rail de 184px em surface, visualmente subordinado à
sidebar. No mobile vira faixa rolável. Cada grupo semântico do formulário usa
uma superfície única; campos diferentes não são unidos por estética. Status da
loja é compacto, com ponto, texto, consequência e switch. Save bar permanece
visível quando o formulário já implementa esse comportamento.

## Responsividade e enquadramento

Validar 390, 430, 768, 1024, 1280, 1440, 1920 e 2560px.

- mobile: padding 16px, controles 44px, bottom navigation e drawers full-screen;
- tablet: sidebar rail, categorias adaptadas e formulários sem esmagamento;
- laptop: densidade preservada, detalhe de pedido flutuante abaixo de 1280px;
- desktop: sidebar completa e conteúdo alinhado à esquerda;
- telas largas: `--page-max: 1600px` limita páginas de leitura; Pedidos e
  Cozinha podem usar mais largura por necessidade operacional.

Não pode existir overflow horizontal global. Scroll lateral é exceção local e
justificada: gráfico longo, faixa de categorias ou quadro de Cozinha. Informação
crítica não some em breakpoint; ela muda de posição ou composição.

## Tema escuro

Dark mode usa os mesmos tokens semânticos e a mesma hierarquia. Não criar bloco
`[data-theme='dark']` por componente. Separação vem de degraus de surface e
linhas mais perceptíveis; sombras têm menor protagonismo. Marca e estados usam
valores próprios para manter contraste. Ambos os temas devem passar no mesmo
teste de contraste e parecer o mesmo produto.

## Interação, movimento e acessibilidade

- foco global: 2px na marca com offset de 2px;
- todos os controles: default, hover, active, focus-visible e disabled;
- alvo mínimo 24px; 44px no mobile;
- labels e nomes acessíveis permanecem mesmo quando um ícone é visual;
- contraste WCAG 2.2 AA medido nos dois temas;
- estado nunca depende somente de cor;
- animações de 140–200ms explicam drawer, menu, switch e seleção;
- `prefers-reduced-motion` reduz transições e animações;
- sem animação de página, bounce, parallax ou fade decorativo.

## Fonte de verdade e validação

Antes de criar componente, procurar em `src/ds/`, `src/ui/` e `src/styles/`.
Corrigir a base quando o defeito é sistêmico. Não duplicar button, select,
switch, input, card, table, ticket, modal ou badge.

Ao concluir mudança visual relevante:

1. executar `npm run lint`, `npm test` e `npx playwright test`;
2. executar `npx playwright test -c design/shots/shots.config.ts`;
3. inspecionar Pedidos com/sem detalhe, Cardápio, Desempenho, Minha Loja,
   Clientes e Cozinha em claro e escuro;
4. inspecionar Pedidos, Cardápio e Minha Loja no mobile;
5. confirmar as oito larguras no teste `responsividade.spec.ts`;
6. fazer uma segunda passagem visual antes de encerrar.

Nunca “corrigir” teste removendo cobertura. Diferencie regressão funcional,
flutuação preexistente, seletor estrutural atualizado e screenshot legitimamente
desatualizada.
