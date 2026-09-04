# Pedidos ao backend, prontos para colar

Cada item aqui é uma coisa que o painel não consegue fazer e que **não se
resolve do lado de cá**. O formato é o de sempre: o que falta, por que o painel
precisa, e o que já existe no backend que torna o pedido barato.

---

## 1. `DELETE /admin/products/{id}` e `DELETE /admin/categories/{id}`

> **Cole daqui para baixo.**

Falta apagar item e categoria do cardápio. Hoje o painel só sabe **desativar**
(`is_active: false`), e desativar resolve o cliente — o item some da vitrine —
mas não resolve o lojista: a linha errada continua na lista dele, todo dia, para
sempre. Uma categoria criada com o nome errado fica na barra do cardápio até
alguém entrar no banco.

**Isso não é hipótese de tela.** É o item C.1 da auditoria do painel, e a única
saída hoje é `DELETE` na mão, no banco de produção.

**O modelo de dados já está pronto para isso**, e é o que torna o pedido barato:

- `order_items.product_id` é **nullable**, e tudo que o histórico precisa já
  está congelado na própria linha do item vendido —
  `product_name_snapshot`, `product_description_snapshot`,
  `unit_price_snapshot`, `catalog_key_snapshot`, `product_code_snapshot`;
- `admin_report_repository.py:205` já diz, por escrito, que
  _"`product_id` e nullable na tabela (produto pode ter sido apagado)"_ — o
  relatório de mais vendidos agrupa por `catalog_key_snapshot`, e não pelo id;
- `SET NULL` já é o arranjo usado em `customer_address_id`,
  `admin_error_reports.branch_id` e `admin_error_reports.admin_user_id`.

**O que falta de fato são duas linhas e uma rota.** A FK
`order_items.product_id → products.id` está declarada **sem `ondelete`**
(`order_item_model.py:18`), então um `DELETE` hoje estoura `IntegrityError` —
vira 500 — em qualquer produto que já tenha sido vendido uma vez. O pedido é:

1. migração pondo `ondelete="SET NULL"` nessa FK (e na equivalente da
   categoria, se houver);
2. `DELETE /admin/products/{id}` e `DELETE /admin/categories/{id}`, com o mesmo
   escopo de papel do `PATCH` correspondente.

Se apagar categoria com item dentro for para ser recusado, um **409 com frase**
("Esvazie a categoria antes de apagá-la") resolve — o painel já sabe mostrar a
frase de um 409, e é assim que ele trata o nome repetido de setor e a forma de
pagamento repetida.

**O que NÃO estou pedindo, e vale dizer para ninguém gastar sprint nisso:**
idempotência no `POST`. Ver o item 2 abaixo.

---

## 2. Idempotência no `POST /admin/products` — **NÃO precisa**

Isto entrou na lista por engano meu, e fica registrado para não voltar.

A suspeita era: o painel diz "não gravou" sobre um item que gravou, o lojista
aperta de novo, e nasce a segunda linha no cardápio do cliente. **O backend já
barra isso**, e barra bem:

- `uq_products_branch_slug` (revisão `20260820_0026`) é único em
  `(branch_id, slug)`, e `slug` deriva do nome;
- `AdminMenuService._ensure_product_slug_is_free` confere antes e responde
  **409 "Já existe um produto com esse nome nesta filial"** — com frase, em vez
  de deixar o `IntegrityError` virar 500;
- categoria tem o par exato: `uq_categories_branch_slug` e o 409
  "Já existe uma categoria com esse nome nesta filial".

Ou seja, o clique repetido já é uma recusa legível, não uma linha nova. O que
sobrava era **do lado do painel** — ele dizia "não gravou" sobre um item criado,
e o lojista batia no 409 logo em seguida, lendo duas frases que se contradizem.
Isso foi consertado em `8d96520`, na tela.

**Uma consequência a registrar:** o painel nunca exercitou esses dois 409, e o
falso do e2e **não os dubla** — ele monta o slug e insere, sem conferir nada. É
um caso do §4.10 da skill `rapidex-api` (o falso mais frouxo que o backend), e
está sendo fechado na rodada do Cardápio.

---

## 3. Outras lacunas de rota já levantadas (auditoria C.1)

Sem detalhamento aqui — estão na auditoria com o motivo de cada uma. Em ordem
do que mais dói:

| O que                         | Falta                                            |
| ----------------------------- | ------------------------------------------------ |
| **Criar filial**              | não existe `POST /admin/branches`                |
| **Apagar setor de impressão** | não existe `DELETE /admin/printing-sectors/{id}` |
| **Logo do restaurante**       | `logo_path` só é servido na API da vitrine       |
| **Credencial do gateway**     | nenhuma rota `/admin`; hoje é linha de banco     |
| **Nota fiscal**               | não existe nem tabela                            |

**O WhatsApp saiu desta lista em 05/09/2026.** O backend entregou
`GET`/`POST /admin/whatsapp/channels` e
`DELETE /admin/whatsapp/channels/{channel_id}`, e a tela foi construída — ver
`scratchpad/rodada-whatsapp.md`. Fica registrado o que a linha dizia antes,
porque o engano é fácil de repetir: o contrato de 2026-09-03 já trazia
`/webhooks/whatsapp`, e ele é a **entrada da Meta no backend**, não a
configuração do lojista. Uma rota com o nome certo no caminho errado não é a
rota que a tela precisa.

**Integrações também saiu**, e por outro motivo: o item foi removido do menu em
vez de virar tela. As três coisas que o `soon` dela prometia ou não estão sendo
construídas ou já moram em outro lugar do painel — o porquê está em
`src/layout/nav.ts`.

---

## 4. `whatsapp_channels`: há quanto tempo este número está fora?

> **Cole daqui para baixo.**

A tela de WhatsApp mostra, para cada número, **desde quando ele está no ar** — e
para o canal desligado pelo painel ela não mostra data nenhuma, porque não há
data verdadeira para mostrar. É a única célula do painel que fica em branco por
falta de dado, e o dono pergunta exatamente isso: _"faz quanto tempo que este
número parou?"_.

**São duas coisas, e a primeira é um defeito pequeno com efeito grande.**

### 4a. `connected_at` ANDA quando alguém desconecta

`AdminWhatsAppChannelView.connected_at` não é coluna: `_channel_view` o monta
como `canal.updated_at or canal.created_at`
(`admin_whatsapp_service.py:236`), e `updated_at` tem `onupdate=func.now()`
(`whatsapp_model.py`). `AdminWhatsAppService.disconnect` escreve
`is_active = False` na linha — então **o próprio 200 do `DELETE` já volta com
`connected_at` valendo o instante da desconexão**.

O docstring do campo diz o contrário, e diz o certo: _"Quando o canal foi
cadastrado. Reconectar reescreve, porque o que a tela pergunta é 'desde quando
este número está no ar'"_. Reconectar deve reescrever; **desligar não**.

O painel não tem como contornar isso — para ele os dois casos são o mesmo
`connected_at`. O que ele faz hoje é esconder a data no estado `disabled`, e
esconder é o menos errado dos três desfechos possíveis (a primeira versão da
tela escreveu "No ar desde 25/08" embaixo de "Desligado no painel"; a segunda
escreveu "Conectado em 25/08", que é pior porque soa exata).

**O conserto é uma linha**: `connected_at` sai de uma coluna própria (escrita no
`_criar` e no `upsert`, e só neles) em vez de `updated_at`. Ou, se preferir não
acrescentar coluna, `disconnect()` deixa de tocar a linha por atribuição comum e
passa a fazer um `UPDATE` que não mexe em `updated_at` — mas aí a próxima
escrita que alguém acrescentar recria o problema em silêncio, e por isso a
coluna é a forma que se defende sozinha.

### 4b. Falta `disabled_at`

Hoje o schema tem `disconnected_at` para a desconexão da META e **nada** para a
nossa. As duas saídas já são duas colunas (`is_active` e `disconnected_at`), com
o comentário do modelo explicando por quê — e é justamente essa simetria que
falta fechar: uma tem "desde quando", a outra não.

O que a tela faria com ela: **"Fora desde 28/08, 19:40"** no canal desligado,
igual ao que ela já escreve no desconectado pela Meta. É a resposta a "faz
quanto tempo que este número parou", que hoje só existe se alguém lembrar.

**O pedido, então:**

1. `connected_at` para de andar no `disconnect` (item 4a);
2. `disabled_at TIMESTAMPTZ NULL`, escrito no `disconnect` e limpo no `upsert`
   junto de `disconnected_at`;
3. `disabled_at` em `AdminWhatsAppChannelView`, ao lado de `disconnected_at`.

**O que NÃO estou pedindo:** quem desligou. O painel não tem tela de auditoria e
não há onde mostrar isso — e um campo de autor sem tela é o `changed_by` de
novo, que era texto livre vindo do cliente e saiu do contrato.

---

## 5. `GET /admin/branches`: a filial arquivada some do painel inteiro

> **Cole daqui para baixo.**

**Antes do pedido, a separação, porque são duas coisas e só uma delas é lacuna.**

**DESATIVAR filial é decisão consciente, e está escrita.** `AdminBranchUpdate`
não aceita `is_active`, e o docstring diz por quê com todas as letras:
_"desativar filial e operacao de plataforma, nao de lojista — some do app de
todo mundo e deixa pedido em aberto sem cozinha"_. **Concordo, e não estou
pedindo para mudar isso.** O painel não deve ter esse botão.

**VER a filial arquivada é outra coisa, e essa parte não está decidida em lugar
nenhum.** `AdminSettingsService.list_branches` chama
`branch_repository.list_active_by_restaurant`, então `GET /admin/branches`
**nunca** devolve uma filial arquivada — nem para o dono, que enxerga a rede
inteira por definição. Nenhum comentário do backend justifica esconder; o que
está justificado é só não deixar mexer.

**A prova de que é lacuna, e não regra, está no próprio contrato:**
`AdminBranchResponse` **publica `is_active`** — um campo booleano que, nesta
rota, só pode valer `true`. Um campo que nunca varia é um campo que alguém
pretendeu que variasse.

**E o painel já acredita nisso.** `src/menu/catalog-key.ts` tem DOIS filtros
`is_active !== false` sobre a lista de filiais, com a razão escrita ao lado
(_"oferecer o item de uma loja que saiu do ar é oferecer um pareamento que não
vai aparecer em relatório nenhum"_). Os dois são código morto: eles filtram uma
lista que nunca contém uma filial inativa. Um dos dois lados está errado sobre o
que essa rota devolve.

**O que isso custa hoje, em três lugares:**

1. **A pessoa presa à filial arquivada vira "Outra filial"** em Usuários
   (`users-model.ts:170`). O dono não consegue dizer de qual loja ela é. O
   comentário de lá supõe que isso "só acontece com dado velho" — não é: a
   filial arquivada é o caso normal disso.
2. **O canal de WhatsApp da filial arquivada aparece sem nome.**
   `AdminWhatsAppService.list_channels` monta o mapa de nomes com
   `list_active_by_restaurant` e a lista de canais com `list_by_restaurant`
   (sem filtro) — então a linha volta com `branch_name: null` e sem par em
   `branches`. O dono vê um número conectado, num lugar sem nome, de uma loja
   que ele não enxerga.
3. **A varredura de escopo do painel não alcança o caso**, porque ele não
   existe no falso do e2e — e não existe no falso porque não existe na rota.

**O pedido é o menor possível:** que a listagem consiga devolver a arquivada,
**só para leitura**.

    GET /admin/branches?include_inactive=true

O painel filtra: o seletor do topo continua oferecendo só as ativas (arquivada
não é lugar de operar), e quem passa a usar a lista completa é o rótulo — a
coluna de filial em Usuários, o "onde vale" do canal de WhatsApp, e os dois
filtros de `catalog-key.ts`, que deixam de ser código morto.

**O que torna o pedido barato:** o repositório **já tem a consulta sem filtro** e
já tem a razão escrita para ela existir — `get_by_id_and_restaurant`, criada para
a reimpressão de comanda de pedido de loja desativada ("_reimprimir a comanda é
a operação mais comum do balcão, e ela não pode parar de funcionar porque a loja
foi desativada depois_"). É a mesma necessidade, na listagem em vez de no id: o
que já aconteceu continua precisando de nome depois que a loja fecha.

**O que NÃO estou pedindo:** que a arquivada volte a aparecer no seletor de
filial, em Operação, no Cardápio ou em qualquer tela de escrita. Ela não é lugar
de operar — é nome de coisa que já aconteceu.
