# Rapidex Design System

Rapidex é uma plataforma white-label de pedidos online para restaurantes. Este design system cobre o **painel do lojista** (admin.pederapidex.com): kanban de pedidos em tempo real, cardápio, configurações da loja e cozinha. Usado no balcão (desktop) e no celular durante o serviço — é um painel operacional, não um site de marketing.

**Fontes fornecidas:** um único asset de marca (`uploads/ChatGPT Image 28 de jul. de 2026, 01_09_50.png` → `assets/logo-mark.png`) e notas do usuário sobre tema, cor de status e densidade. Nenhum código-fonte, Figma ou baralho de slides foi anexado — este sistema foi construído a partir da marca + das notas, não de uma implementação existente. Se houver um repositório ou arquivo Figma do admin.pederapidex.com, anexe-o para que os componentes e telas sejam recalibrados com os valores reais.

## Índice
- `tokens/` — cores, tipografia, espaçamento, raio, sombra (`styles.css` importa tudo)
- `assets/logo-mark.png` — único asset de marca fornecido
- `guidelines/*.card.html` — especificações de fundação (cores, tipo, espaçamento, marca)
- `components/core/` — Button, IconButton, Tag, Input, Select, Checkbox, Switch, Card
- `components/navigation/` — Sidebar, BranchSelector, Tabs
- `components/feedback/` — Toast, Dialog, Tooltip
- `components/domain/` — StatusBadge, OrderCard, KanbanColumn (primitivas específicas do domínio de pedidos)
- `ui_kits/painel-lojista/` — recriação clicável do painel: Pedidos (kanban), Cardápio, Configurações
- `SKILL.md` — versão portátil para uso como skill

## Componentes
**Core:** Button (primary/secondary/ghost/danger), IconButton, Tag, Input, Select, Checkbox, Switch, Card
**Navigation:** Sidebar (fixa desktop / vira drawer no mobile), BranchSelector (seletor de filial no header), Tabs
**Feedback:** Toast, Dialog, Tooltip
**Domain (Pedidos):** StatusBadge (7 estágios), OrderCard, KanbanColumn

**Adições intencionais:** nenhuma fonte de componentes (Figma/codebase) foi fornecida, então este é um conjunto padrão dimensionado às necessidades do painel — os primitivos de domínio (StatusBadge, OrderCard, KanbanColumn) foram adicionados porque a tela central do produto (kanban de pedidos) depende deles.

## Substituições sinalizadas
- **Fontes:** nenhum arquivo de fonte foi fornecido. Usamos Manrope (UI) + IBM Plex Mono (números tabulares) via Google Fonts como aproximação — troque em `tokens/typography.css` se a marca tiver uma tipografia própria.
- **Ícones:** nenhum sistema de ícones foi fornecido. Usamos um conjunto mínimo de ícones de linha (stroke 2px, 24px) desenhados sob medida em `ui_kits/painel-lojista/Icons.jsx` — substitua por Lucide/Heroicons ou o ícone real da marca se houver um.
- **Logo:** apenas uma imagem de logo foi fornecida (selo com fundo preto embutido). Não existe wordmark nem versão monocromática — não foram inventadas.

## Fundamentos de conteúdo
- **Idioma:** português do Brasil, direto e operacional — frases curtas, verbos no infinitivo ou imperativo ("Aceitar pedido", "Cancelar pedido?", "Salvar alterações").
- **Tratamento:** o painel fala com o lojista na terceira pessoa implícita das ações ("Novo pedido recebido"), não em "eu/você" conversacional — é um painel de trabalho, não um assistente.
- **Números sempre concretos:** "Tempo estimado: 25 min", nunca "em breve". Preço sempre com "R$" e vírgula decimal (R$ 47,80).
- **Sem emoji.** É uma ferramenta de operação de cozinha/balcão sob pressão de tempo — emoji reduziria a legibilidade e destoaria do tom técnico.
- **Confirmações de risco são diretas e sem eufemismo:** "Cancelar pedido?" / "Esta ação não pode ser desfeita." — nunca minimizado ou brincalhão.
- **Rótulos de status são substantivos/particípios curtos:** Pendente, Aceito, Preparando, Pronto, Saiu para entrega, Concluído, Cancelado — nunca frases longas.

## Fundamentos visuais
- **Tema escuro é o padrão**, tema claro usa exatamente os mesmos tokens semânticos (`[data-theme="light"]` sobrescreve `--bg-*`, `--text-*`, `--border-*`, `--shadow-elevation`). Nunca há uma segunda paleta — só a inversão de superfícies.
- **Cor de marca (laranja) é escassa por design:** botão primário, item ativo da sidebar, anel de foco. Nunca usada em texto de corpo, ícones neutros ou como cor de fundo de seções grandes.
- **A escala de status de pedido é inteiramente separada do laranja de marca** — 7 matizes (âmbar, azul, violeta, verde-água, magenta, verde, cinza-quente) espalhados pela roda de cores para que nenhum status compita visualmente com o CTA primário. Vermelho nunca é usado como status; é reservado só para ações perigosas (cancelar, excluir, pagamento recusado).
- **Neutros têm leve viés quente** (não cinza-azulado) — o preto de fundo (`#0B0A09`) tem uma sombra de marrom escuro, não é preto/cinza frio de SaaS genérico. Isso mantém o painel alinhado ao laranja da marca em vez de competir com ele.
- **Sem gradientes.** Superfícies são cores sólidas; elevação no tema escuro vem de um degrau de luminosidade + borda de 1px, não de sombra (sombra é invisível sobre preto). No tema claro, elevação usa sombra suave de dois níveis (`--shadow-elevation`).
- **Números em fonte monoespaçada tabular** (`font-mono-tabular`) sempre que há comparação visual em coluna: número do pedido, valor total, cronômetro, tabela de preços do cardápio. Texto de UI comum usa a sans (Manrope).
- **Cantos moderados, não pill-shaped por padrão:** botões e cards usam raio 6–14px; só badges/tags/switches usam raio total (`--radius-full`).
- **Cards:** fundo `--bg-surface`/`--bg-surface-raised`, borda de 1px sutil, sem sombra pronunciada no escuro. Hover em itens interativos usa um overlay de branco translúcido (`--bg-hover` ~4% opacidade), nunca escurece — o fundo já é quase preto.
- **Estado de pressionado:** `scale(.98)` sutil no Button, sem mudança de cor adicional além do estado ativo.
- **Sem blur/glassmorphism.** É um painel funcional de alta densidade — overlays (Dialog) usam um véu sólido semi-opaco (`--bg-overlay`), não `backdrop-filter`.
- **Sem ilustração, sem imagem de fundo, sem textura.** O único elemento pictórico é o logo. Fotos de pratos (quando existirem) devem ser tratadas como conteúdo do lojista, não da marca — usar placeholders quadrados discretos até ter fotos reais.
- **Layout:** sidebar fixa 240px no desktop (colapsa para 72px ou vira drawer no mobile), header de 64px fixo no topo com o seletor de filial sempre visível (mesmo com uma única filial). Board kanban rola horizontalmente; colunas de 280px de largura fixa.
- **Densidade:** texto de corpo em 15px (não 14px "SaaS padrão") para permanecer legível a distância no balcão; números-chave (pedido/valor) sobem para 17–20px e usam peso 700.

## Iconografia
Nenhum sistema de ícones foi fornecido (sem sprite, sem ícone-fonte no material de origem). Usamos um conjunto mínimo autoral de ícones de linha — stroke 2px, grade 24px, cantos arredondados — para navegação e ações (pedidos, cardápio, cozinha, configurações, sino, busca, imprimir, editar, mais). Ficam em `ui_kits/painel-lojista/Icons.jsx`. Nenhum emoji é usado em nenhum lugar do produto. Recomendação: se a marca adotar uma biblioteca (Lucide, Phosphor), trocar por essa fonte mantendo o mesmo peso de traço (2px) para não alterar a densidade visual.
