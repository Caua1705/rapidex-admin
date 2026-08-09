# Rapidex — Painel do Lojista

Painel web onde o restaurante acompanha e toca os pedidos do dia. Esta entrega
cobre **login**, a **tela de pedidos** (quadro por status, detalhe, mudança de
status e tempo real por SSE), o **cardápio** (categorias, itens, esgotado e
ordem), **Minha loja** (abrir/fechar, configurações do restaurante, cadastro da
filial, horários, entrega e formas de pagamento) e a **Cozinha** (tela cheia,
três colunas, um botão por cartão). Clientes, relatórios e impressão ficam para
depois.

As rotas: `/pedidos`, `/cardapio`, `/minha-loja` e `/cozinha`. A Cozinha é a
única tela autenticada FORA do `AppShell` — ela usa a tela inteira, sem
navegação lateral, porque é lida de longe.

O painel não é white-label: a identidade na tela é a do **Rapidex**. O nome do
restaurante aparece só para o lojista saber em qual sessão está.

---

## Como rodar

Precisa de **Node 20 ou mais novo**.

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
npm run dev               # abre em http://localhost:5173
```

O login é o mesmo do backend: `POST /admin/auth/login`. O restaurante sai do
JWT — o painel nunca manda `restaurant_id` em lugar nenhum.

### Scripts

| Comando                | O que faz                                                  |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento                                |
| `npm run build`        | Confere os tipos e gera `dist/`                            |
| `npm run preview`      | Serve o `dist/` como em produção                           |
| `npm run lint`         | ESLint (com as regras do design system) + aderência de cor |
| `npm run lint:tokens`  | Só a aderência de cor nos `.css`                           |
| `npm run format`       | Prettier (escreve); `format:check` só confere              |
| `npm run typecheck`    | TypeScript sem gerar arquivo                               |
| `npm test`             | Testes unitários (Vitest)                                  |
| `npm run e2e`          | Teste de ponta a ponta (Playwright)                        |
| `npm run e2e:install`  | Baixa o Chromium do Playwright (uma vez por máquina)       |
| `npm run api:generate` | **Regera o cliente da API** a partir do `/openapi.json`    |

---

## Variáveis de ambiente

Só existe uma:

| Variável            | Obrigatória | Exemplo                       |
| ------------------- | ----------- | ----------------------------- |
| `VITE_API_BASE_URL` | não         | `https://api.pederapidex.com` |

- **Sem barra no final.** `https://api.../` viraria `//admin/orders`.
- Se não for definida, o painel usa `https://api.pederapidex.com`.
- Para apontar para o backend na sua máquina: `VITE_API_BASE_URL=http://localhost:8000`.

O prefixo `VITE_` não é decoração: só variável com esse prefixo chega ao
navegador. E como ela vai para dentro do JavaScript entregue ao usuário,
**nunca coloque segredo aqui** — o token de sessão é obtido no login, em runtime.

---

## Estrutura de pastas

Pasta por **assunto da tela**, não por tipo de arquivo. Não existe `components/`,
`hooks/`, `utils/` genéricos: mexer nos pedidos é mexer em `src/orders/`, e
pronto. O cardápio entrou exatamente assim, em `src/menu/`, sem tocar em nada de
`src/orders/`.

```
src/
  api/          Tudo que fala com o backend
    generated/  openapi.d.ts — GERADO, não edite à mão
    types.ts    apelidos curtos para os tipos gerados
    client.ts   único fetch do app: põe o token e trata o 401 global
    errors.ts   erro da API -> frase em português para a tela
    auth.ts     login e /me
    orders.ts   pedidos, contadores, detalhe, status, cancelamento, tempo de
                preparo, ticket do SSE, filiais
    menu.ts     categorias e produtos do cardápio
    store.ts    configurações do restaurante, filial, horários, entrega e
                formas de pagamento
    contract-pending.ts
                TEMPORÁRIO: as rotas que o backend já entregou e o
                /openapi.json ainda não descreve. Leia o cabeçalho dele.
  auth/         Sessão: provider, guarda de rota, localStorage
  orders/       A TELA DE PEDIDOS inteira (o coração do painel)
    OrdersPage.tsx        junta tudo
    OrdersToolbar.tsx     filtros + situação do tempo real
    StatusColumn.tsx      uma coluna do quadro
    OrderCard.tsx         o card do pedido
    OrderDetailPanel.tsx  o detalhe, fixo à direita do quadro
    CancelOrderDialog.tsx confirmação do cancelamento, pedindo o motivo
    PrepTimeControl.tsx   +5/+10/−5 no tempo de preparo, na barra de cima
    useOrdersBoard.ts     estado da tela (lista, filtros, contadores, ações)
    useOrderStream.ts     consumo do SSE
    useNewOrderSound.ts   alerta sonoro
    usePrepTime.ts        faixa de preparo da filial aberta na tela
    order-status.ts       espelho da máquina de estados do backend
    board-columns.ts      quais colunas existem e o que cai em cada uma
    order-filters.ts      filtros e "este pedido cabe no filtro?"
    order-options.ts      adicionais do item, agrupados para a tela
    cancel-reason.ts      o motivo obrigatório (3 a 300 caracteres)
    prep-time.ts          lê o 409: falta base x filial fechada
    format.ts             dinheiro, hora, rótulos em português
  menu/         A TELA DE CARDÁPIO inteira
    MenuPage.tsx          junta tudo
    CategoryRail.tsx      barra de categorias + subir/descer
    ProductRow.tsx        a linha do item (preço, esgotado, ativo)
    CategoryDialog.tsx    criar/editar categoria
    ProductDialog.tsx     criar/editar item
    useMenu.ts            estado da tela (categorias, produtos, ações otimistas)
    menu-model.ts         ativo x disponível, ordem, preço — as regras testáveis
  store/        A TELA MINHA LOJA (configurações do restaurante e da filial)
    StorePage.tsx         abrir/fechar no topo + as cinco abas
    StoreStatusCard.tsx   abrir e fechar a loja, fora das abas
    GeneralTab.tsx        valor mínimo, tempo estimado, taxa de serviço,
                          entrega/retirada (SEM default_delivery_fee — veja o
                          cabeçalho do arquivo)
    BranchTab.tsx         nome, endereço, contato e lat/long
    HoursTab.tsx          a grade dos 7 dias
    DeliveryTab.tsx       taxa por raio + prévia do frete
    PaymentMethodsTab.tsx formas por fluxo (online / na entrega)
    business-hours.ts     o PUT manda SEMPRE os 7 dias — a regra cara da tela
    delivery-config.ts    base ou por-km nulos = endereço não atendível
    settings-model.ts     números dos formulários (vazio ≠ inválido)
  kitchen/      A TELA DE COZINHA (tela cheia, sem navegação lateral)
    KitchenPage.tsx       as três colunas + o mesmo SSE dos pedidos
    KitchenCard.tsx       cartão grande, com itens e adicionais
    kitchen-board.ts      só 3 estados, não pago fora, um caminho adiante
    useKitchenOrders.ts   carrega por status e busca o detalhe de cada cartão
  theme/        Tema claro/escuro: provider, alternador, persistência
  layout/       Navegação lateral + barra do topo das telas autenticadas
    BranchSelector.tsx    filial da sessão (nome + endereço), no cabeçalho
  pages/        Telas que não são de um assunto só (login)
  ui/           Peças genéricas mínimas (Modal, Switch, logo, ícones)
  styles/       tokens.css (ÚNICO lugar com cor literal) + global.css
e2e/            Playwright: backend falso + caminho crítico, cardápio,
                minha loja e cozinha
scripts/        check-design-tokens.mjs — barra cor fora dos tokens
.claude/skills/rapidex-design-system/
                SKILL.md — as regras visuais, para ler antes de cada tela nova
```

Regra que segurou o tamanho dos arquivos: **lógica que dá para testar sem
navegador mora em `.ts` puro** (`order-status.ts`, `order-filters.ts`,
`format.ts`, `board-columns.ts`, `stream-events.ts`, `menu-model.ts`). Os `.tsx`
só desenham. Por isso o teste unitário cobre a parte que erra de verdade sem
precisar montar tela.

---

## Design system

As telas seguem o design system exportado em `design/_ds/`. O que ele virou aqui:

- **`src/styles/tokens.css`** — os tokens consolidados (superfície, borda, texto,
  laranja de marca, perigo e a escala de 7 status, separada do laranja). **É o
  único arquivo do `src/` que pode conter uma cor literal.**
- **Tema claro e escuro pelos mesmos tokens semânticos.** O claro é
  `[data-theme="light"]` no `<html>`, escrito pelo `src/theme/`; o `index.html`
  aplica o tema antes do primeiro pixel para não haver flash no F5.
- **`npm run lint` cobra a aderência**: as regras de
  `design/_ds/.../_adherence.oxlintrc.json` são carregadas direto pelo
  `eslint.config.js` (nada de cópia à mão), e `scripts/check-design-tokens.mjs`
  varre os `.css` atrás de cor solta.
- **Enquadramento**: o conteúdo vive dentro de `.container`
  (`max-width: var(--layout-max)`, 1400px, centralizado) e as listas de dados
  são grade de colunas fixas, não flex com `space-between` — numa tela larga o
  `space-between` joga o preço para o canto oposto ao nome. O quadro de pedidos
  é a exceção: usa a tela toda e limita cada coluna em `--column-max`.
- **`.claude/skills/rapidex-design-system/SKILL.md`** — as regras em prosa
  (cor, densidade, enquadramento, movimento, conteúdo, checklist). Leia antes
  de cada tela nova.

---

## Como o cliente da API é gerado

Nenhum tipo de request ou response é escrito à mão.

```bash
npm run api:generate
```

Esse comando faz duas coisas:

1. `openapi-typescript https://api.pederapidex.com/openapi.json -o src/api/generated/openapi.d.ts`
   baixa o contrato e transforma em tipos TypeScript (`paths` e `components`).
2. Roda o Prettier no arquivo gerado, para o diff no git ficar legível.

Em cima desses tipos, `src/api/client.ts` monta um `openapi-fetch`:

```ts
export const apiClient = createClient<paths>({ baseUrl: API_BASE_URL });
```

Com isso, **caminho, query, corpo e resposta são conferidos pelo compilador**.
Chamar uma rota que não existe, esquecer um parâmetro ou ler um campo que o
backend não manda é erro de `npm run typecheck`, não bug em produção.

`src/api/types.ts` só dá apelidos (`OrderDetail` em vez de
`components['schemas']['OrderDetailResponse']`). Ele é a única lista de campos
que o painel usa — se o backend renomear algo, o erro aparece ali.

**Quando o backend mudar:** rode `npm run api:generate`, depois
`npm run typecheck`, e conserte o que acender vermelho. O arquivo gerado é
versionado de propósito: assim o `npm ci` do CI não depende da API estar no ar.

---

## Como o SSE está sendo consumido

Tudo em `src/orders/useOrderStream.ts` + `src/orders/stream-events.ts`. Quatro
decisões explicam o código:

**1. Ticket, não token.** O `EventSource` do navegador não manda cabeçalho, então
o JWT de 12h teria que ir na URL — e acabaria no log do proxy, no `Referer` e no
histórico. O painel chama `POST /admin/orders/stream-ticket` (autenticado, com
token no header), recebe um ticket de 30 s e abre
`GET /admin/orders/stream?ticket=…`.

**2. A reconexão é nossa.** O `EventSource` reconecta sozinho reusando a **mesma**
URL — com o ticket já vencido, então essa retentativa sempre falharia. Por isso,
a cada `onerror` o painel fecha a conexão, pede um ticket novo e abre de novo,
com espera crescente (1 s, 2 s, 4 s… até 30 s) para não martelar a API quando
ela estiver fora do ar. A conexão também morre sozinha aos 15 min no backend:
para o painel isso é só mais uma reabertura.

**3. `Last-Event-ID` e o cursor perdido.** O navegador só reenvia o
`Last-Event-ID` quando é ele próprio que reconecta; abrindo um `EventSource`
novo, o cursor se perde — e não dá para mandá-lo na URL, porque a rota só aceita
`ticket`. A compensação é o callback `onReconnected`: **depois de toda
reabertura a tela recarrega a lista inteira**, que é o mesmo estado que o replay
entregaria. Só o caminho é outro.

**4. Duplicata e `sync_required`.** A entrega é "ao menos uma vez", então todo
evento passa por `AppliedEventKeys` (`stream-events.ts`), que descarta
`event_key` já visto — é o que evita o mesmo pedido aparecer duas vezes e o
alarme tocar de novo no replay. O evento `sync_required` (painel ficou offline
tempo demais) dispara o mesmo recarregamento completo.

**Offline de verdade:** os eventos `online`/`offline` do navegador entram no
hook. Sem rede o painel não gasta tentativa, marca a situação como "Sem conexão"
(a faixa amarela avisa que pedido novo não vai aparecer sozinho) e reconecta na
hora em que a rede volta, sem esperar o backoff.

**Som:** só toca para `order.created` de pedido que **ainda não estava na tela**.
Alarme por pedido já visto treinaria o lojista a ignorar o som. O áudio é
sintetizado na Web Audio API (não há arquivo para baixar); como o navegador
bloqueia áudio antes de qualquer clique, existe um botão "Ativar som" para o
caso do painel restaurado do localStorage numa TV.

---

## Testes

- **Unitários (Vitest)** — a lógica que erra de verdade: máquina de estados,
  filtros, agrupamento em colunas, formatação, descarte de evento repetido,
  tradução de erro da API, e o card do pedido.
  ```bash
  npm test
  ```
- **E2E (Playwright)** — `e2e/caminho-critico.spec.ts`: login → ver o pedido →
  mudar o status, mais pagamento online não confirmado, transição recusada pelo
  backend (409), pedido novo chegando pelo SSE e 401 derrubando a sessão.
  ```bash
  npm run e2e:install   # uma vez por máquina
  npm run e2e
  ```

O E2E **não chama a API real**: `e2e/fake-api.ts` intercepta as rotas `/admin/*`
e responde com dados em memória. Isso mantém o teste determinístico e o CI verde
mesmo com o backend fora do ar — e, como as respostas falsas são tipadas com o
`openapi.d.ts` gerado, uma mudança de contrato quebra o `typecheck`.

## CI

`.github/workflows/ci.yml` roda em todo push na `main` e em todo pull request:

1. `format:check` → `lint` → `typecheck` → `test` → `build`
2. E2E do Playwright (em job separado; sobe o relatório como artefato se falhar)

---

## Publicar na Vercel

1. **Importe o repositório** em vercel.com → _Add New… → Project_.
2. O `vercel.json` deste repositório já define o que importa
   (framework `vite`, build `npm run build`, saída `dist`) — não precisa mexer
   nas configurações de build na interface.
3. **Variável de ambiente** (Project → Settings → Environment Variables):
   - `VITE_API_BASE_URL = https://api.pederapidex.com`, marcada para
     _Production_, _Preview_ e _Development_.
   - Depois de alterar essa variável é preciso **fazer um redeploy**: ela é
     lida no build, não em runtime.
4. **Rewrite de SPA**: já está no `vercel.json`. Sem ele, abrir
   `https://seu-painel.vercel.app/pedidos` direto (ou dar F5 nessa URL) daria
   404, porque só existe o `index.html`.
5. **CORS no backend**: o domínio da Vercel (`*.vercel.app` e o domínio final)
   precisa estar liberado no CORS da API, senão o navegador barra as chamadas.
   Isso é configuração do backend, não do painel.
6. Opcional: aponte um domínio próprio em Project → Settings → Domains e
   acrescente-o ao CORS do backend.

Não há nada de servidor neste projeto: o build é estático. Não existe segredo
para configurar na Vercel além da URL da API.
