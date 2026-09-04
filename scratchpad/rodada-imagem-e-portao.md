# A rodada da banda, do complemento e do portão de deploy

**04/09/2026, na `main`.** Cinco itens, todos com o portão lido sem pipe e o
e2e em execução isolada. Commits: `aa3785f`, `636a1f9`, `d40bcaa`, `82e7a49`,
`3c5b19a`, `c058c69`.

---

## 1. As imagens em tamanho original — o item que estava custando dinheiro

### O que foi medido, e não estimado

Contra o bucket de produção (`mqanpwnrjjqcswzhcplc.supabase.co`), com as URLs
reais do cardápio público do piloto (`/restaurants/junior-da-picanha/menu`, que
é rota sem autenticação):

| O que                                    | Original     | Depois    | Fator     |
| ---------------------------------------- | ------------ | --------- | --------- |
| **Cardápio, maior categoria (26 fotos)** | **2.440 KB** | **70 KB** | **34,8×** |
| Catálogo inteiro (135 fotos)             | 12.338 KB    | 358 KB    | 34,5×     |
| Foto no diálogo de edição (uma)          | ~100 KB      | ~4 KB     | ~25×      |
| Artes de cupom na lista (3 do piloto)    | 62 KB        | 4,3 KB    | 14,3×     |

**A economia por carregamento da tela de cardápio é 2.370 KB.** A foto típica é
1024×1024 WebP de ~100 KB, desenhada num quadrado de 44px.

### A conta de 11 sítios não bate — são 4

O backend contou 11. Conferido arquivo por arquivo (`revisao` §10), `src/` tem
SEIS `<img>`, e só QUATRO recebem URL de bucket:

| Arquivo                          | Classe              | CSS    | Pedido  |
| -------------------------------- | ------------------- | ------ | ------- |
| `menu/ProductRow.tsx:197`        | `item__thumb`       | 44×44  | 88×88   |
| `menu/ProductImageField.tsx:226` | `foto__atual`       | 56×56  | 112×112 |
| `coupons/CouponsPage.tsx:446`    | `cupons__miniatura` | 56×36  | 112×72  |
| `coupons/ArtePicker.tsx:115`     | `arte__imagem`      | 160×90 | 320×180 |

Os outros dois não têm o que transformar: `ProductImageField.tsx:293` é o
`URL.createObjectURL` da foto que o lojista acabou de escolher (arquivo local,
ainda não subiu), e `ui/RapidexLogo.tsx:26` é asset estático.

**E não há mais nenhum escondido**: no contrato, os únicos schemas de `/admin`
com campo de imagem são `AdminProduct*Response`, `ProductImageResponse` e
`CouponTemplateResponse`. `BannerResponse` e `logo_url` são da vitrine pública,
que o painel não consome, e não existe rota de banner em `/admin`.

### QUATRO VARIANTES, e a conta delas é o custo

Cada par (largura, altura) distinto é objeto novo no cache do Supabase. As
quatro caixas saem do CSS, com o arquivo nomeado ao lado, e cada uma é o DOBRO
do retângulo — densidade 2, fixa, sem `srcset`: uma segunda densidade dobraria a
conta de variantes para poupar ~1,5 KB numa miniatura de 3 KB.

### A ARMADILHA MEDIDA, e ela teria subido quebrada

`?width=112` SOZINHO devolve **112×1024**: o Supabase reescala a largura e deixa
a altura no original. São 12.344 bytes de uma imagem espremida contra 4.090 do
112×112 correto — e o `object-fit: cover` do CSS ESCONDERIA a deformação na
tela. O defeito viveria como três vezes mais banda, calado. As duas dimensões
vão sempre, e há teste com o número medido no comentário.

### O contrato continua verdadeiro

`types.ts` dizia que o painel não monta URL de bucket. Continua não montando:
`ds/image-url.ts` REESCREVE `/object/public/` → `/render/image/`, sem conhecer
host, bucket nem caminho, e devolve INTACTO tudo que não tenha a forma de
`build_storage_url`. A distinção entre montar e reescrever está escrita lá.

### O que ficou de fora, e é decisão do dono

**`public/logo-mark.png`: 555 KB em 1254×1254, desenhado a 22–32px no shell, em
toda tela do painel.** Não é Supabase (é banda da Vercel) e encolher o master da
marca é decisão de quem cuida dela. Medido e não tocado.

---

## 2. O "Filial" sem nome no WhatsApp

`AdminWhatsAppService.list_channels` monta o mapa de nomes com
`list_active_by_restaurant` e a lista de canais com `list_by_restaurant` (sem
filtro): o canal de uma filial DESATIVADA volta com `branch_name: null`.

**E dá para afirmar que é desativada, não "dado faltando":** as duas consultas
são do mesmo restaurante (escopo pelo token), então um `branch_id` sem nome não
pode ser de outro restaurante nem id inválido. Por isso a palavra é "Filial
desativada", e não "Outra filial" — o precedente de `filialLabel` em Usuários
cobre um id que pode não resolver por vários motivos; aqui o motivo é um só.

A célula ganhou a segunda linha ("Não aparece na sua lista de filiais.") porque
nomear sem explicar troca uma pergunta por outra. O botão "Desconectar" continua
ao lado: o `DELETE` é por CANAL, e desativar a loja não tira do dono o controle
do número.

**O falso já reproduzia o caso** (`nomes[branch_id] ?? null` sobre a lista de
ativas), então o e2e não precisou de ramo novo.

---

## 3. Editar a opção de complemento, com a ordem

### A decisão central: três escritores sobre a mesma rota

    o formulário  -> updateOption        (nome, descrição, preço)
    o interruptor -> setOptionActive     (só is_active)
    as setas      -> setOptionSortOrder  (só sort_order)

Um `updateOption(id, corpoParcial)` único deixaria cada chamador escolher o que
mandar — e o dia em que um montasse o corpo de um rascunho completo, o
interruptor e a posição iriam de carona.

### As duas ausências do corpo do formulário

`is_active` fica de fora porque `checkOpcao` devolve `true` FIXO: reusá-lo
RELIGARIA em silêncio a opção que o lojista desligou no interruptor da mesma
linha — e num grupo obrigatório é ele que tira o item do cardápio.
`sort_order` fica de fora porque quem o move são as setas.

**E as duas só são seguras porque este PATCH é parcial DE VERDADE:**
`update_option` usa `exclude_unset=True` e `AdminOptionUpdate` não tem
`@model_validator`. O vizinho `PATCH /admin/option-groups/{id}` valida a MESCLA
e por isso exige o formulário inteiro (`rapidex-api` §4.9). **As duas rotas são
irmãs e a regra delas é oposta** — conferido no serviço, não suposto do schema.

### A descrição entrou no formulário porque precisava

O corpo leva `description`. Um formulário que não a mostrasse mandaria `null`
toda vez que alguém corrigisse um preço — apagando o texto de outra pessoa, sem
nada em tela (`revisao` §2).

### A ordem: o único lugar da tela sem escrita atômica

**Não há rota de lote.** Categorias e produtos têm `PATCH .../reorder` (lista
completa, uma transação); as opções têm só a unitária. `ordemDasOpcoes` devolve
o que PRECISA ser gravado — vizinhas trocadas dão DUAS escritas —, em série,
para que a falha do meio seja o ponto onde parou.

**Na falha a tela NÃO volta para a ordem anterior**, ao contrário de
`reorderProductTo`: voltar afirmaria que nada gravou, e alguma coisa gravou. Ela
relê e mostra o que EXISTE.

Grupo antigo com tudo em `sort_order: 0` é renumerado inteiro no primeiro
arraste — uma vez só.

### Setas e não arraste

Um grupo tem três a oito opções e vive DENTRO de um diálogo que já rola; um alvo
de arrastar disputaria o gesto com a rolagem no celular. **Com as setas sendo o
caminho único, a WCAG 2.5.7 deixa de ser um problema** — não existe o arraste
para o qual ela pede alternativa. Elas reusam `rail__chevron`, que é de onde vêm
os 44px de alvo no toque, e ficam visíveis sem `:hover` (`revisao` §4).

---

## 4. O buraco de deploy — ele existia, e foi medido antes de fechado

`vercel.json` não tinha bloco `git`; `ci.yml` não tinha job de deploy. A Vercel
publicava a `main` no instante do push, em paralelo com o portão.

**Aqui era pior que no app do cliente:** a regra deste repositório é empurrar
direto na `main`, sem branch e sem PR — não havia proteção de branch onde
pendurar o check.

Fechado pela opção C do `pedeaqui_front`: `git.deploymentEnabled.main = false` +
job `deploy` com **`needs: [verificar, e2e]`** (os dois, e não um — são jobs
irmãos em paralelo, e depender só do primeiro publicaria com o Playwright
vermelho).

`src/deploy-do-portao.test.ts` prende as duas metades, a lista de branches
desligadas (para não matar o preview junto) e o `::error::` que faz o job FALHAR
sem segredo — um `if:` que pulasse o passo devolveria o buraco pelo outro lado.

### ⚠️ O QUE ESTÁ PENDENTE E BLOQUEIA A PUBLICAÇÃO

**Enquanto os três secrets não existirem, NADA é publicado.** O automático já
está desligado e o job falha dizendo qual falta. Em
`github.com/Caua1705/rapidex-admin/settings/secrets/actions`:

| Secret                            | De onde                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `VERCEL_TOKEN`                    | Vercel > conta > Settings > Tokens, no escopo do TIME                          |
| `VERCEL_ORG_ID`                   | Vercel > Project > Settings > General > "Team ID" (`team_…`)                   |
| `VERCEL_PROJECT_ID`               | Vercel > Project > Settings > General > "Project ID" (`prj_…`) — DESTE projeto |
| `VITE_COURIER_APP_URL` (opcional) | o mesmo valor de Environment Variables > Production                            |

Sem o quarto o job publica e AVISA: o bundle sobe sem o botão de gerar acesso do
entregador (o Vite inlina `import.meta.env`; configurar no painel depois não
muda o que já subiu).

---

## 5. A deriva de REGRA do falso — fechada

`falso-contra-o-contrato.md` deixou escrito: "validar o corpo RECEBIDO contra o
schema exigiria o /openapi.json e um validador". Feito.

- `npm run api:generate` grava também `e2e/generated/openapi.json` — mesmo
  comando dos dois artefatos, e ele fica em `e2e/` porque 561 KB dentro de
  `src/` iriam para o navegador do lojista num `import` distraído.
- `e2e/schema.ts` valida, e **palavra-chave desconhecida é ERRO**. O contrato
  usa dezenove, nenhuma difícil (sem `allOf`, `oneOf`, `if/then`, `$defs`).
- A conferência mora em **`responder`, não em `corpoDe`**: a regra é "o falso
  não pode responder 2xx a um corpo que a API recusaria". Em `corpoDe` ela
  disparava antes de o ramo poder RECUSAR de propósito — e foi a primeira
  execução que ensinou isso, com o único vermelho de 421 testes sendo o caso em
  que o falso recusa por desenho.

Alcança tamanho, mínimo, padrão, enum, tipo (`integer` ≠ `number`) e
obrigatoriedade em todas as 98 rotas. **Não** alcança índice único,
`@model_validator` nem o 409 escrito à mão — esses continuam saindo da leitura
do backend.

---

## As varreduras que rodei, e o que elas deram

| Varredura                             | Resultado                                                      |
| ------------------------------------- | -------------------------------------------------------------- |
| `revisao` §9 — rota parada            | **limpa.** 94 de 98 chamadas; as 4 sobras são falsos positivos |
| `revisao` §8 — 4xx com schema próprio | 2 rotas, e o achado **não sobreviveu** — ver abaixo            |
| `revisao` §11.5 — relógio nos testes  | 33 candidatos, **todos falsos positivos**                      |

### A quarta sobra da §9 é falso positivo, e a lista deve crescer

Além dos três conhecidos (`GET /admin/orders/stream`, os dois de
`print-agent`), sobrou **`GET /admin/couriers/{courier_id}`**. Ele não é lacuna:
`GET /admin/couriers` devolve uma lista do MESMO `AdminCourierResponse`, com
todos os nove campos. Ler um por id seria uma segunda chamada para saber o que a
primeira já respondeu. **Vale acrescentá-lo à lista de falsos positivos da skill
`revisao` §9**, para a próxima varredura não o reabrir.

### ~~O 428 na rota irmã~~ — riscado, e o motivo

A §8 achou que **DUAS** rotas declaram 428 com `CancelOrderErrorResponse`:
`/cancel` (conhecida, consertada) e **`PATCH /admin/orders/{order_id}/status`**.
O backend confirma por escrito: _"Vale para as DUAS rotas do painel. `PATCH
/status` aceita `status='cancelled'`"_. Parecia o §12 clássico — conserta-se uma
e esquece-se a irmã.

**Não é defeito vivo.** `changeOrderStatus` (a única que chama `/status`) só é
chamada com `avanco.target` ou com `'rejected'`, e nenhum deles é `cancelled`:
o único caminho de cancelar passa por `CancelOrderDialog` → rota própria. E
`rejected` sai de `pending`, que não está em `PREPARED_ORDER_STATUSES`.

**O que sobra de risco, e é pequeno:** `changeOrderStatus(orderId, status:
string)` aceita `string`, então nada no tipo impede alguém de passar
`'cancelled'` ali um dia. Se isso acontecer, o painel mostra a FRASE (o
`readDetailMessage` já lê `detail.message` desde o conserto do 428) mas não
abre o diálogo de confirmação — degrada para "erro com frase certa", não para
"número HTTP". Não foi feito nada; fica escrito.

### As 33 do relógio, e por que nenhuma valia

Todas passam o relógio; o heurístico é que não reconheceu os nomes de variável
(`dentro`, `antes`, `depois`, `instante`, `minutosDepois(...)`). Três eram os
casos `null`/`undefined`/lixo de `daysSince`, que voltam antes de ler relógio
nenhum, e uma estava DENTRO de um comentário. O script está em
`scratchpad/` fora do repositório — se for para virar portão, ele precisa de uma
lista de nomes aceitos, senão é 33 falsos positivos por execução.

---

## O que a próxima sessão precisa saber

1. **O deploy está travado até os secrets existirem** — item 4 acima. É o único
   bloqueio operacional em pé.
2. **O pedido Pix nunca pago entulhando "Novos"** continua sendo decisão de
   produto do dono, e não foi tocado.
3. **`?include_inactive=true` em `GET /admin/branches`** continua pedido ao
   backend (`pedidos-ao-backend.md` §5). O sintoma 2 daquele pedido foi fechado
   nesta rodada (item 2).
4. **`source_label` existe no contrato e a tela NÃO o usa, de propósito** — a
   razão está escrita em `situacaoDaLoja`, no formato que a `revisao` §1 exige
   de um espelho declarado. Se alguém "consertar" isso, some a distinção entre
   "nunca teve número" e "herdaria um que caiu".
5. **A lista de falsos positivos da §9 deve ganhar `GET /admin/couriers/{id}`.**
