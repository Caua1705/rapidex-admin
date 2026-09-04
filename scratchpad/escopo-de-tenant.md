# Varredura de escopo de tenant no painel

> Data: 2026-09-04, na `main`.
>
> O backend varreu as 82 rotas dele com iscas. O painel nunca tinha passado por
> varredura nenhuma — é a única das três pontas do produto que não tinha.
>
> **Resultado: nenhum defeito.** As duas perguntas do enunciado têm a mesma
> resposta, e ela é "não". O que esta rodada entrega, então, é a régua — porque
> "não achei nada" só vale alguma coisa quando dá para repetir a medição, e
> porque o que hoje está certo por três invariantes pode deixar de estar com uma
> linha.

## As duas perguntas, respondidas

**1. Existe tela ou chamada em que o restaurante ou a filial venha de algo que o
cliente controla — URL, estado local, parâmetro — em vez de vir da sessão?**

Não, e por três motivos independentes, cada um bastando sozinho:

| Invariante                                                                                                        | Onde ele mora                                               |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **O restaurante nunca viaja.** Nenhuma rota `/admin` o aceita; ele está dentro do JWT                             | contrato (§4.3), e a Regra A cobra que o painel não o mande |
| **Nenhuma tela recebe id pelo endereço.** O roteador não tem UM parâmetro, e não há `useSearchParams`             | `src/App.tsx`, e a Regra D                                  |
| **A filial ativa só é escolhida da lista do servidor.** `activeBranchId` nasce vazia e só muda por `selectBranch` | `SessionProvider`, e a Regra C                              |

**2. O painel oferece algum botão que alcança dado de outro restaurante ou de
outra filial?**

De outro restaurante, não — não há por onde. **De outra filial, sim: um, e de
propósito** — a busca do gêmeo do cardápio (`useTwinSearch`), que procura o
mesmo item nas outras lojas para parear a `catalog_key`. Ela é legítima e é
limitada pelo mesmo funil de todo o resto: a lista de onde buscar é
`useSession().branches`, ou seja, o que o token alcança. Está preso em teste.

## A lista mecânica

Saída de `node scripts/check-escopo.mjs --lista`, medida e não estimada.

### 33 funções de `src/api/` carregam filial

| Onde a filial viaja | Quantas | Exemplos                                                        |
| ------------------- | ------- | --------------------------------------------------------------- |
| `path`              | 14      | `fetchBusinessHours`, `listPaymentMethods`, `setBranchOpen`     |
| `path+corpo`        | 9       | `updateBranch`, `pauseDelivery`, `requestPrintTest`             |
| `query`             | 9       | `listCategories`, `listProducts`, `listReviews`, `listCouriers` |
| `corpo`             | 1       | `reorderCategories`                                             |

### 41 pontos de uso, e a origem de cada um

- **36 tiram o id da sessão** — `branchId` vindo de `useResolvedBranch()` /
  `useAdoptedBranch()` (que devolvem `branch?.id`, sempre um id presente em
  `branches`), `branch.id` no laço da busca do gêmeo, ou `activeBranchId`.
- **5 são repasse de parâmetro** — `useBranchOperation` grava com `alvo`
  (`setBranchOpen`, `setBranchOrderTypes`, `pauseDelivery`,
  `updateBranchSettings`) e `useReviews` lê com `filtros`. O id não NASCE ali:
  em `OperationTab` ele é `linha.branch_id`, que veio de
  `GET /admin/branches/operation`. Régua estática nenhuma segue isso a olho —
  quem fecha esses cinco é a isca do e2e, que olha o id que de fato saiu.

**O corte que importa e que a lista deixa ver:** o `activeBranchId` CRU só vai
para rota de `query` (Pedidos, Clientes, Avaliações, Desempenho, Cozinha,
relatório do entregador, `branches/operation`) — onde vazio significa "todas as
que eu enxergo", que é um escopo válido. Toda rota com `{branch_id}` no PATH
recebe o id já resolvido por `useResolvedBranch`, que o procura em `branches`
antes de devolvê-lo. O único ponto que poderia furar isso — `usePrepRange`, que
recebe `activeBranchId` e chama uma rota de path — tem `if (!branchId) return`.

### 7 origens controladas pelo cliente, todas com razão escrita

| Onde                            | O quê                    | Toca tenant?                                                                                                  |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `auth/session-storage.ts` ×3    | token + linha do usuário | **não recorta nada** — o restaurante está dentro do JWT, e o `branch_id` guardado não é lido por tela nenhuma |
| `orders/useNewOrderSound.ts` ×2 | alerta mudo              | booleano do aparelho                                                                                          |
| `theme/theme.ts` ×2             | claro/escuro             | dois literais, conferidos ao ler                                                                              |

## A ferramenta, que é o que fica

Duas metades, e nenhuma sozinha é a varredura.

### `scripts/check-escopo.mjs` — a estática (roda no `npm run lint`)

Cinco regras, com a fuga declarada `// escopo-ok: <razão>` no lugar, no mesmo
desenho do `check-fuso`:

| Regra | O que ela recusa                                                                 |
| ----- | -------------------------------------------------------------------------------- |
| A     | `restaurant_id` escrito numa requisição                                          |
| B     | `localStorage`, `useParams`, `location.search`, `postMessage`… sem razão escrita |
| C     | `selectBranch` fora dos três lugares que escolhem da lista do servidor           |
| D     | rota do painel com parâmetro no endereço                                         |
| E     | filial cuja origem não se segue até `useSession()`                               |

Ela alcança o que teste nenhum alcança: o caminho que ninguém percorre.

### `e2e/escopo.spec.ts` + o gravador no falso — a dinâmica, com iscas

O falso passou a olhar **toda requisição interceptada** (não uma lista de rotas:
a rota nova entra na varredura sem ninguém lembrar dela) e anota quatro coisas:

1. **isca** — um dos dois ids que resposta nenhuma deste falso devolve saiu na rede;
2. **restaurante** — `restaurant_id` viajou;
3. **filial-fora-do-token** — id de filial que não é uma das duas do escopo;
4. **cardapio-sem-recorte** — `GET /admin/categories|products` sem `branch_id`.

A quarta é a que não parece de escopo e é a mais cara do painel: ela responde
200, com JSON válido, somando as duas lojas — o cardápio em dobro (§4.4). É
vazamento entre FILIAIS, e nada acende porque é a resposta certa para a pergunta
errada.

**As iscas são PLANTADAS, não esperadas.** Um id que o falso nunca serve, o
painel nunca teria como mandar por acidente — um teste que só esperasse por ele
não poderia falhar. Então elas entram onde a pessoa de fato escreve: a barra de
endereço (`?branch_id=…&restaurant_id=…&branchId=…#branch=…` em cada uma das 20
telas) e a sessão gravada no `localStorage` (filial, restaurante e o papel de
dono trocados à mão, como alguém montaria com o DevTools aberto).

**E a régua é provada por mutação**, no primeiro teste do arquivo: quatro
requisições feitas à mão de dentro da página disparam as quatro anotações. Sem
ele, o zero dos outros sete seria indistinguível de um gravador que não olha.

Os oito casos: a prova da régua; as 20 telas com "todas as filiais"; as 20 com a
SEGUNDA filial escolhida (não a principal — com a Matriz, um id esquecido cairia
no mesmo valor da resolução automática e o teste passaria por sorte); a isca na
URL; a isca no `localStorage`; o cardápio de uma filial sem o item da outra; a
busca do gêmeo lendo a outra loja de propósito; e a comanda seguindo a filial DO
PEDIDO.

## Duas coisas que a varredura encontrou e que não são defeito

Ficam escritas porque as duas são a resposta a uma pergunta que alguém vai
refazer:

1. **`OrderDetailPanel` é o único lugar do painel onde a filial de uma chamada
   sai de uma RESPOSTA, e não da sessão**: `detail.branch_id` vai para a comanda,
   porque a impressora é a da loja que recebeu o pedido — não a da loja escolhida
   no cabeçalho. Com "todas as filiais" aberta, que é o estado normal de quem
   opera duas lojas, o pedido da Zona Norte pergunta pelo programa DELA. Tem
   teste próprio, porque um "nenhuma fuga" que nunca abriu um pedido de outra
   loja não teria olhado justamente este ponto.

2. **`filialLabel` já trata a filial fora da vista.** `GET /admin/users` é do
   RESTAURANTE (não aceita `branch_id`), então uma linha pode apontar para uma
   filial que o token não lista. O painel escreve **"Outra filial"** —
   `users-model.ts:170`. O id cru não chega à tela, e ninguém tenta segui-lo.

3. **O papel desenhado vem da sessão gravada até o `/me` responder.** Adulterar
   o `localStorage` troca o que a tela DESENHA por um instante; o teste da isca
   prende a outra metade, que é a que importa: nenhuma chamada muda de escopo por
   causa disso, e o seletor volta a oferecer só as filiais do servidor. Não é
   escopo de tenant — é a família "permissão que existe na tela e não na rota" da
   skill `revisao`, e aqui ela está do lado certo.

## Pendência aberta: a deriva de REGRA do falso do e2e

**Anotada, não construída** — a rodada anterior (`aac5995`) fechou a deriva de
FORMA e deixou esta explicitamente em aberto.

**O que é:** `e2e/contrato.ts` amarra o falso ao `/openapi.json` — nome de campo,
tipo, enum, status declarado. O que o contrato **não publica** continua sem
amarra nenhuma:

- **índice único** (`uq_products_branch_slug`, `uq_categories_branch_slug`,
  `uq_products_branch_catalog_key`) — não vira schema;
- **`@model_validator(mode="after")`** — `max_select >= min_select`,
  `is_required` exigindo `min_select >= 1`, a faixa de frete validada sobre a
  MESCLA: nenhum tem representação em JSON Schema;
- **limites de campo** que o Pydantic tem e o `/openapi.json` emite como `string`
  seco (`description` 1–4000, `error_log` 20000, `reason` 3–300);
- **o 409/400 escrito à mão no serviço**, que não aparece em rota nenhuma.

**O preço de não ter:** o falso fica MAIS FROUXO que o backend, o e2e fica verde,
e a recusa chega na mão do lojista. Foi o que custou as seis correções à mão das
rodadas de 02 e 03 de setembro.

**O que seria preciso, e é por isso que não foi feito de improviso:**

1. **Versionar o `/openapi.json`**, não só o `openapi.d.ts`. Hoje
   `scripts/api-generate.mjs` baixa o JSON e joga fora depois de gerar os tipos;
   o `.json` tem as palavras-chave que o `.d.ts` perde (`maxLength`, `minimum`,
   `pattern`, `required`). Custo: um arquivo a mais no repositório e uma linha no
   gerador.
2. **Um validador de request no falso** — o `corpoDe` de hoje devolve o tipo; o
   que falta é conferir o VALOR contra o schema (ajv ou equivalente) e responder
   422 como o Pydantic responderia. Fecha os limites de campo, e só eles.
3. **As regras que não estão nem no JSON** (índice único, validador cruzado,
   409 do serviço) continuam saindo da leitura do backend, à mão. O que dá para
   fazer por ferramenta é OBRIGAR a leitura: uma lista, gerada do
   `../pedeaqui_back`, de toda classe com `@model_validator` e de todo índice
   único, com a rota correspondente — e o falso declarando, por rota, quais delas
   ele encena. O que faltasse apareceria como lacuna nomeada em vez de ausência.

**A decisão de fazer (e quanto) não é minha.** O item 3 é o que vale mais e é o
maior; o 1 é uma linha e destrava o 2.

## Para a próxima sessão

- A varredura se repete com `npm run lint` (a estática) e
  `npx playwright test e2e/escopo.spec.ts` (as iscas). Nenhuma das duas precisa
  de backend.
- **Tela nova**: se ela precisar de UMA filial, o id sai de
  `useResolvedBranch()`/`useAdoptedBranch()`, nunca de `activeBranchId` cru —
  aquele vale para as rotas de query, onde vazio é "todas as que eu enxergo".
- **Se algum dia o painel passar a ler a barra de endereço** para abrir já numa
  filial (é a mudança mais provável de todas: um link de WhatsApp para "os
  pedidos da Aldeota"), a isca da URL fica vermelha na hora. Isso não quer dizer
  que a mudança é errada — quer dizer que a filial lida da URL precisa ser
  procurada em `branches` antes de virar recorte, e que o teste passa a afirmar
  isso em vez do "não lê".
