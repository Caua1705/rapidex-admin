---
name: rapidex-design-system
description: Regras visuais do painel do lojista Rapidex — tokens, cor, tipografia, densidade, movimento e conteúdo. Leia ANTES de escrever qualquer tela, componente ou CSS novo em src/, e antes de mexer em src/styles/tokens.css. Também aplicável ao revisar uma tela existente ou ao decidir uma cor, um espaçamento, um raio ou uma animação.
---

# Design system do Rapidex

Rapidex é uma plataforma white-label de pedidos online. Este sistema cobre o
**painel do lojista** (`admin.pederapidex.com`): kanban de pedidos em tempo
real, cardápio, configurações e cozinha. É usado no balcão (desktop) e no
celular durante o serviço — **é um painel operacional, não um site de
marketing**. Quem lê está de pé, com pressa, às vezes a um metro da tela.

Fonte: `design/_ds/rapidex-design-system-c214e0d9-9d0d-4c89-a2fa-a40733347892/`
(`readme.md`, `_ds_manifest.json`, `tokens/`, `_adherence.oxlintrc.json`).
Este arquivo é a versão operacional dessas regras para o código deste repo.

## A regra que vale mais que as outras

**Toda cor vem de `src/styles/tokens.css`.** Em qualquer outro arquivo é
`var(--token)`. Um hexadecimal, um `rgb()`, um `hsl()` ou um nome de cor
(`white`, `red`) fora daquele arquivo é erro de lint — `npm run lint` roda
`scripts/check-design-tokens.mjs` nos `.css` e as regras do
`_adherence.oxlintrc.json` nos `.ts/.tsx`.

Se um token faltar para a tela que você está fazendo, **o token está errado, não
a tela**: acrescente-o em `tokens.css` (nos dois temas) em vez de escrever a cor
solta.

## Tokens

Todos definidos em `src/styles/tokens.css`, consolidados de `tokens/*.css` do DS.

| Grupo           | Tokens                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superfícies     | `--bg-app` `--bg-surface` `--bg-surface-raised` `--bg-surface-sunken` `--bg-overlay` `--bg-hover` `--bg-active`                                            |
| Borda           | `--border-subtle` `--border-default` `--border-strong`                                                                                                     |
| Texto           | `--text-primary` `--text-secondary` `--text-tertiary` `--text-disabled` `--text-on-brand` `--text-on-status`                                               |
| Marca (laranja) | `--brand` `--brand-hover` `--brand-active` `--brand-soft-bg` `--brand-soft-fg` `--focus-ring`                                                              |
| Perigo          | `--danger` `--danger-hover` `--danger-active` `--danger-soft-bg` `--danger-soft-fg`                                                                        |
| Status (7)      | `--status-pending-h` `--status-accepted-h` `--status-preparing-h` `--status-ready-h` `--status-delivering-h` `--status-completed-h` `--status-cancelled-h` |
| Elevação        | `--shadow-elevation` `--shadow-sm` `--shadow-md` `--shadow-lg` `--shadow-focus`                                                                            |
| Tipografia      | `--font-sans` `--font-mono`; `--text-xs…--text-3xl` + `--leading-*`; `--weight-regular…--weight-extrabold`                                                 |
| Espaçamento     | `--space-1…--space-20` (base 4px)                                                                                                                          |
| Raio            | `--radius-sm` (6) `--radius-md` (10) `--radius-lg` (14) `--radius-xl` (20) `--radius-full`                                                                 |
| Movimento       | `--motion-fast` `--motion-base` `--motion-ease`                                                                                                            |

### Tema

Escuro é o padrão. Claro é **o mesmo conjunto semântico** com as superfícies
invertidas, sob `[data-theme="light"]` no `<html>` — nunca uma segunda paleta.
O escuro é o `:root` puro, sem atributo. Quem alterna é
`src/theme/` (`ThemeProvider`, `ThemeToggle`, chave `rapidex-admin.theme`);
`index.html` aplica o tema antes do primeiro pixel para não haver flash.

Ao escrever CSS, **nunca** escreva uma regra específica de tema. Se precisou de
`[data-theme="light"] .minha-classe`, o token semântico que você usou é o
errado.

### Status: use a classe, não a matiz

`tokens.css` define `.status-<chave>`, que expõe `--status`, `--status-bg` e
`--status-fg`. Ponha a classe no elemento e leia as variáveis:

```tsx
<header className={`column__header status-${status}`}>   {/* pending, accepted, … */}
```

```css
.column__dot {
  background: var(--status);
}
.column__badge {
  background: var(--status-bg);
  color: var(--status-fg);
}
```

Chaves: `pending` `accepted` `preparing` `ready` `delivering` `completed`
`cancelled`, mais os apelidos do backend `out_for_delivery` (= delivering) e
`rejected` (= cancelled). São 7 matizes, não 9.

## Cor: as três regras que mais se quebram

1. **O laranja é escasso.** Só três lugares: botão primário (`.btn--primary`),
   item ativo da navegação, anel de foco. Nunca em texto de corpo, ícone neutro
   ou fundo de seção grande.
2. **A escala de status é separada do laranja** — 7 matizes espalhadas pela roda
   para que nenhum status compita visualmente com o CTA. Não use uma matiz de
   status para categorizar algo que não é estado de pedido (tipo de entrega,
   forma de pagamento): isso confunde com a coluna do kanban da mesma cor.
   Exceção herdada do mockup: verde de `completed` e âmbar de `pending` marcam
   estados afirmativo/em-espera fora do pedido (disponível/esgotado, conexão).
3. **Vermelho nunca é status.** É só ação perigosa: cancelar, desativar,
   pagamento recusado.

Os neutros têm **viés quente** (o preto é `#0B0A09`, com sombra de marrom). Não
introduza cinza-azulado de SaaS genérico.

## Superfície e forma

- **Sem gradientes.** Superfícies são cores sólidas.
- **Elevação no escuro** = degrau de luminosidade + borda de 1px. Sombra sobre
  preto é invisível; por isso `--shadow-elevation` é `none` no escuro e vira
  sombra suave de dois níveis no claro.
- **Sem blur / glassmorphism.** Overlay é véu sólido semi-opaco
  (`--bg-overlay`), não `backdrop-filter`.
- **Sem ilustração, imagem de fundo ou textura.** O único elemento pictórico é o
  logo (`public/logo-mark.png`, selo com fundo preto embutido — não existe
  wordmark nem versão monocromática; não invente uma). Fotos de prato são
  conteúdo do lojista: placeholder quadrado discreto até haver foto real.
- **Cantos moderados**: 6–14px em botões e cards. `--radius-full` só em
  badge, tag e switch.
- **Hover em item interativo** clareia (`--bg-hover`, ~4%), nunca escurece — o
  fundo já é quase preto.
- **Pressionado**: `scale(.98)`, sem mudança de cor além do estado ativo.

## Tipografia e densidade

- Texto de corpo em **15px** (`--text-base`), não os 14px "padrão SaaS": o
  painel é lido a distância, no balcão.
- Números-chave (nº do pedido, total) sobem para 17–20px com peso 700.
- **Todo número que se compara em coluna** — nº do pedido, preço, total,
  cronômetro, tabela de preços do cardápio — usa a mono tabular: classe `.mono`
  (ou `.font-mono-tabular`). Texto de UI comum usa a sans (Manrope).
- Fontes: Manrope (UI) e IBM Plex Mono (números), carregadas por `<link>` no
  `index.html`. São aproximações sinalizadas pelo DS — se a marca tiver
  tipografia própria, troque em `tokens.css`.

## Layout

- Sidebar fixa de 240px no desktop; colapsa para trilha de ícones de 72px em
  tela estreita.
- Header de 64px fixo no topo.
- Board kanban rola horizontalmente; colunas de largura fixa.

## Movimento

**Animação só onde comunica mudança de estado.** Nada de entrada decorativa,
parallax ou transição de página. Os casos legítimos hoje: o botão do switch
deslizando ao esgotar/repor, a linha esmaecendo ao desativar, o realce da
categoria que trocou de posição, o pulso do ponto de conexão reconectando.

Escreva as durações com `var(--motion-fast)` / `var(--motion-base)`: sob
`prefers-reduced-motion: reduce` esses tokens já viram `0s`, e a tela troca de
estado instantaneamente em vez de não trocar. `@keyframes` com `animation:`
precisa de um `@media (prefers-reduced-motion: reduce) { animation: none }`
próprio.

## Ícones

Conjunto autoral de linha: **stroke 2px, grade 24px, cantos arredondados**,
`stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`. Ver
`src/menu/icons.tsx`. Se a marca adotar uma biblioteca (Lucide, Phosphor),
troque mantendo os 2px para não alterar a densidade visual.

**Nenhum emoji, em lugar nenhum do produto.** É ferramenta de cozinha sob
pressão de tempo: emoji reduz legibilidade e destoa do tom técnico.

## Conteúdo

- **Português do Brasil**, direto e operacional. Frases curtas, verbos no
  infinitivo ou imperativo: "Aceitar pedido", "Cancelar pedido?", "Salvar
  alterações".
- O painel fala das **ações**, não em "eu/você" conversacional: "Novo pedido
  recebido", não "Você recebeu um pedido".
- **Números sempre concretos**: "Tempo estimado: 25 min", nunca "em breve".
  Preço sempre com `R$` e vírgula decimal (R$ 47,80) — use `formatCurrency`.
- **Confirmação de risco é direta e sem eufemismo**: "Cancelar pedido?" / "Esta
  ação não pode ser desfeita." Nunca minimizada nem brincalhona.
- **Rótulos de status são substantivos/particípios curtos**: Pendente, Aceito,
  Preparando, Pronto, Saiu para entrega, Concluído, Cancelado.

## Componentes disponíveis

Do DS (`_ds_manifest.json`), com as props que o lint aceita — passar uma prop
não declarada é aviso de `no-restricted-syntax`:

| Componente                                 | Props declaradas                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                   | variant (`primary`\|`secondary`\|`ghost`\|`danger`), size (`sm`\|`md`\|`lg`), icon, iconPosition (`left`\|`right`), disabled, fullWidth, children, onClick, style |
| `IconButton`                               | icon, size (`sm`\|`md`\|`lg`), variant (`ghost`\|`solid`), active, disabled, onClick, label                                                                       |
| `Input`                                    | label, placeholder, value, onChange, type, prefix, error, disabled, size (`sm`\|`md`)                                                                             |
| `Select` / `SelectOption`                  | value, options, onChange / value, label                                                                                                                           |
| `Checkbox`                                 | checked, onChange, label, disabled                                                                                                                                |
| `Switch`                                   | checked, onChange, disabled, label                                                                                                                                |
| `Tag`                                      | children, tone (`neutral`\|`brand`), onRemove                                                                                                                     |
| `Card`                                     | children, padding, style                                                                                                                                          |
| `Sidebar` / `SidebarItem`                  | items, activeId, onSelect / id, label, icon, badge                                                                                                                |
| `BranchSelector` / `Branch`                | branches, activeId, onSelect / id, name, address                                                                                                                  |
| `Tabs` / `TabItem`                         | — / id, label                                                                                                                                                     |
| `Toast`                                    | tone (`info`\|`success`\|`danger`), title, description, onClose                                                                                                   |
| `Dialog`                                   | open, title, children, onClose, actions                                                                                                                           |
| `Tooltip`                                  | label, children                                                                                                                                                   |
| `StatusBadge`                              | status (as 7 chaves), size (`sm`\|`md`)                                                                                                                           |
| `OrderCard` / `OrderItem` / `KanbanColumn` | — / qty, name / title, status, count, children                                                                                                                    |

Neste repo eles existem como componentes locais em `src/ui/` (`Modal`,
`Switch`, `RapidexLogo`) e como classes utilitárias de `src/styles/global.css`
(`.btn`, `.btn--primary`, `.btn--danger`, `.btn--sm`, `.field`, `.input`,
`.select`, `.textarea`, `.alert`, `.tag`, `.mono`, `.faint`, `.muted`,
`.icon-btn`). **Reaproveite antes de criar**: um segundo botão com padding
próprio é como a densidade começa a desandar.

## Checklist antes de dar uma tela por pronta

- [ ] `npm run lint` limpo (inclui a aderência de cor).
- [ ] Nenhuma cor, `rgb()` ou nome de cor fora de `src/styles/tokens.css`.
- [ ] Testada nos dois temas, sem nenhuma regra CSS específica de tema.
- [ ] Espaçamento, raio e tamanho de fonte saem de token, não de número solto.
- [ ] Números comparáveis em coluna estão em `.mono`.
- [ ] Laranja só no CTA primário, na navegação ativa e no foco.
- [ ] Vermelho só em ação perigosa.
- [ ] Nenhum emoji.
- [ ] Animação só onde há mudança de estado, e `prefers-reduced-motion`
      respeitado.
- [ ] Foco visível com `--focus-ring` em tudo que é operável por teclado.
