# Os 46 caminhos de escrita do painel, e quem os exercita

> Levantamento pedido depois do defeito do app do cliente: nenhum cliente logado
> conseguia salvar endereço — 422 em toda tentativa, e a tela dizia "continuará
> disponível neste aparelho". Ninguém pegou porque **nenhum teste exercitava a
> escrita**.
>
> Data: 2026-09-02, na `rodada/painel-2`.

## Como foi medido — e por que a primeira medição foi jogada fora

A primeira tentativa cruzou o nome da função (`createPaymentMethod`) com o texto
dos arquivos de teste. Ela disse **19 escritas sem teste**, e estava errada: eu
tinha escrito teste para duas delas nesta mesma rodada. O nome da função não
aparece num e2e que passa pela tela.

A medição que vale é do que o **falso realmente serviu**: uma instrumentação
temporária em `fake-api.ts` gravou `(método, caminho, status)` de cada resposta
durante a suíte inteira — **3.858 respostas** — e o cruzamento é com isso.

**E ela também estava cega na primeira volta.** O registro vivia dentro de
`json()`, e três respostas do falso não passam por ali: os dois `204` (DELETE
de forma de pagamento e de sobrescrita de cashback) e o `multipart` da foto.
Resultado: quatro rotas apareceram como "sem teste" — duas delas com testes que
eu tinha acabado de escrever. **Foi isso que denunciou a cegueira**, e é o
motivo de este documento contar as três medições em vez de só a última.

| Medição                           | "sem nenhum teste"                      |
| --------------------------------- | --------------------------------------- |
| heurística por nome de função     | 19 — **descartada**                     |
| instrumentação só no `json()`     | 4 — **cega nos 204**                    |
| instrumentação em todas as saídas | **2** — e as duas conferidas no arquivo |

## O resultado

**46 escritas. 0 sem nenhum teste. 25 exercitadas só no caminho feliz.**

| Momento                                             | sem teste | só caminho feliz |
| --------------------------------------------------- | --------- | ---------------- |
| primeira medição                                    | 2         | 37               |
| depois das escritas de dinheiro                     | 0         | 32               |
| depois de "o que decide se a loja vende"            | 0         | 25               |
| depois de "a comanda que não sai"                   | 0         | 22               |
| depois de fechar a impressão inteira                | 0         | 19               |
| depois das unicidades do cardápio                   | 0         | 16               |
| depois de fechar o cardápio (menos os complementos) | 0         | 13               |
| depois do CARDÁPIO INTEIRO                          | 0         | 10               |
| depois de Equipe e conta                            | 0         | **7**            |

> **A régua subcontava, duas vezes.** Ela lia só o que o FALSO serviu, e uma
> recusa dublada com `page.route` nunca chega lá — eram 6 invisíveis. Corrigida
> a primeira vez, ela ainda procurava o padrão só entre **aspas simples**, e os
> testes que montam a rota com o id da filial usam **crase** — mais 4
> invisíveis. Um número que subconta é pior que nenhum: ele manda refazer
> trabalho já feito.

### As 2 que não tinham teste nenhum — CONSERTADAS nesta rodada

| Rota                                      | O que faltava                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PUT /admin/branches/{id}/cashback-rules` | Os três `PUT` de cashback que a suíte disparava eram todos do escopo **restaurante**. O da FILIAL nunca tinha sido chamado. |
| `POST /admin/categories`                  | O botão "Nova categoria" existe na barra desde sempre, e nenhum teste jamais o clicou.                                      |

O primeiro é a mesma forma exata do defeito do app: **existia um teste que
conferia o AVISO** ("a filial que herda avisa que salvar CRIA uma sobrescrita")
**e parava antes do clique** — que é onde o defeito moraria.

Cada uma ganhou dois testes: o caminho feliz e a **recusa**.

### As recusas dubladas, e o falso que era mais frouxo que o backend

Para dublar a recusa como o backend recusa, o falso precisou ficar mais estrito
em dois lugares — que é a armadilha §4.10 da skill `rapidex-api`:

- **filial inexistente** no `PUT`/`DELETE`/`GET` de cashback da filial:
  `AdminCashbackService._get_branch` responde **404 "Filial não encontrada"**
  quando ela não existe ou quando o papel não a alcança. O falso aceitava
  qualquer id.
- **nome da categoria** de 1 a 120: está no Pydantic
  (`AdminCategoryCreate.name`) e sai como `string` seco no `/openapi.json`. O
  falso aceitava qualquer tamanho.

## As 37 exercitadas só no caminho feliz

Elas **não** são a mesma emergência das duas acima — a escrita é disparada por
teste, então um 422 sistemático apareceria. O que falta é a prova de que a tela
**mostra a frase do backend** quando ele recusa, em vez de dizer que salvou.

As nove que já têm recusa dublada, para servir de forma:

| Rota                                      | Recusa exercitada  |
| ----------------------------------------- | ------------------ |
| `PATCH /admin/orders/{id}/cancel`         | 409, **428**       |
| `PATCH /admin/orders/{id}/status`         | 409                |
| `POST /admin/coupons`                     | 409                |
| `POST /admin/users`                       | 409                |
| `PATCH /admin/branches/{id}/prep-time`    | 409                |
| `PATCH /admin/products/{id}/availability` | 500                |
| `PUT .../cashback-rules` (filial)         | 404 — nesta rodada |
| `POST /admin/categories`                  | 422 — nesta rodada |
| `DELETE .../cashback-rules`               | 404                |

### Atacadas nesta rodada — dinheiro primeiro

Três, e as três precisaram do falso ficando MAIS ESTRITO, que é o padrão que
esta rodada inteira repetiu:

| Rota                                        | Recusa dublada | O que ela é                                                              |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `POST /admin/branches/{id}/payment-methods` | **409**        | forma repetida (fluxo+tipo+bandeira). O falso não sabia recusar          |
| `PATCH /admin/payment-methods/{id}`         | **404**        | forma apagada por outra aba enquanto esta estava aberta                  |
| `PATCH /admin/branches/{id}`                | **422**        | faixa de frete invertida, validada sobre a MESCLA, com `detail` de TEXTO |

A terceira é a mais sutil, e ela existe porque a tela **avisa e deixa salvar**:
`checkDeliveryConfig` acusa "a taxa máxima está abaixo da mínima", mas
`handleSave` não olha esse aviso. Existe um caminho em que o lojista salva e o
backend nega — e até agora ninguém tinha provado que a frase dele chega à tela.

O que os três provam, além do status: **a frase do backend aparece** (nunca "A
requisição falhou (409)"), **o formulário não some** com o que foi digitado, e
**a barra não anuncia sucesso**.

### A segunda camada: o que decide se a loja VENDE

Depois do dinheiro vem esta, e ela merece a segunda posição por um motivo
específico: **uma recusa engolida aqui não erra um número na tela — ela faz o
lojista acreditar que a loja está aberta quando ela não está.** E o sintoma
disso é a AUSÊNCIA de pedido, que não acende alarme nenhum.

As quatro passam pelo mesmo `_get_branch` do backend, que responde **404
"Filial não encontrada"** quando ela some ou quando o papel deixa de alcançá-la
— outra pessoa desativou a filial, ou o dono restringiu o gerente a outra loja.

| Rota                       | O que o teste prende                                           |
| -------------------------- | -------------------------------------------------------------- |
| `PATCH .../store-status`   | o interruptor **VOLTA** — a tela não afirma um estado recusado |
| `PATCH .../order-types`    | a chave volta, e o erro é **da linha**: a outra filial opera   |
| `PATCH .../delivery-pause` | o diálogo **não fecha**, e nenhuma pausa é anunciada           |
| `PUT .../business-hours`   | a barra não diz "salvo", e o PUT nem sai                       |

O primeiro é o que mais importa: `useBranchOperation` só adota a linha que o
backend **devolveu**, nunca a que ele pediu. Um toggle otimista deixaria a loja
"fechada" na tela e aberta no mundo.

**As recusas de horário que NÃO entraram, e por quê:** `faixas se sobrepõem`,
`não misture faixa fechada com aberta` e `mais de N períodos` são inalcançáveis
pelo painel — ele monta uma faixa por dia, de uma grade fixa de sete.

**A priorização para o que sobra**, do mais caro ao menos: as escritas que
mexem em dinheiro ou em cadastro que o cliente vê —
as 25 restantes, na ordem:

1. ~~**A comanda que não sai**~~ — **FECHADA (2026-09-03).** Antes:
   `printing-sectors` (o 409 de nome repetido criado por OUTRA aba, que a
   conferência local não tem como ver), `printing-sectors/{id}` (o 404 de setor
   apagado no meio) e `products/{id}/printing-sector` (o **400 "é de outra
   filial"**, que a auditoria já nomeava: setor é POR FILIAL, e o produto salva
   nome e preço por uma rota e o setor por outra). Agora as três que faltavam —
   `print-settings`, `print-test` e `categories/{id}/printing-sector`. Ver
   "A rodada da impressão" abaixo.
2. ~~**Cardápio**~~ — **FECHADO (2026-09-03).** As três unicidades, a foto, os
   dois `reorder`, o `PATCH /admin/categories/{id}` e as três de complemento.
   Ver "A rodada do cardápio" abaixo.
3. ~~**Equipe e conta**~~ — **FECHADO (2026-09-03).** `updateAdminUser` (400 do
   único dono, pela lista velha), `resetAdminUserPassword` (404) e
   `changePassword` (400 "Senha atual incorreta"). `createAdminUser` já tinha o 409. Ver "A rodada da equipe" abaixo.
4. **O resto** — `delivery-time-bands`, `restaurant`, `settings`,
   `stream-ticket`, os dois DELETE.

E uma nota de método para quem seguir: várias recusas do backend são
**inalcançáveis pelo painel**, porque a tela valida antes. Isso não é buraco —
é a tela fazendo o trabalho dela. O que se procura é o caminho em que o backend
recusa e o painel **não sabia**.

## A rodada da impressão (2026-09-03) — e o defeito que ela achou no caminho

Três recusas presas, e **um bug** que nenhuma delas tinha ido procurar.

### O bug: a segunda escrita negava a primeira, e o cardápio ganhava um gêmeo

`saveProduct` pode ser DUAS escritas: `POST /admin/products` cria a linha e
`PATCH /admin/products/{id}/printing-sector` aponta o setor (rota própria —
`AdminProductUpdate` não tem o campo). Elas dividiam um `catch`, e a recusa da
SEGUNDA fazia a função devolver `null` — que quem chama lê como "não gravou".

O diálogo não fechava, com nome e preço ainda escritos.

> **CORREÇÃO (mesma data, depois do commit `8d96520`).** Ao escrever o pedido
> de backend, a fonte desmentiu metade disto. O commit e a primeira versão desta
> seção diziam que o segundo "Salvar" criava o segundo "X-Tudo" no cardápio do
> cliente, com conserto só no banco. **Não cria.**
> `uq_products_branch_slug` + `AdminMenuService._ensure_product_slug_is_free`
> respondem **409 "Já existe um produto com esse nome nesta filial"** — a mesma
> proteção existe para categoria. O clique repetido é uma recusa legível, não
> uma linha nova.
>
> **O defeito e o conserto continuam valendo, e o motivo muda para melhor:** o
> painel afirmava "não gravou" sobre um item criado, e a pessoa que apertasse de
> novo levava um 409 dizendo que o item **já existe**. Duas frases que se
> contradizem na mesma tela, em dois cliques — e nenhuma delas responde a única
> pergunta que importa ali, que é se o item está no cardápio ou não.
>
> A lição é a mesma da hipótese derrubada logo abaixo, e é por isso que as duas
> ficam escritas: **eu supus a gravidade em vez de ler a fonte.** O que a leitura
> custou foram cinco minutos; o que ela evitou foi um pedido de backend errado
> (idempotência no `POST`) que já estava a caminho de ser mandado.

A recusa é alcançável e tem frase própria — **400 "O setor de impressão é de
outra filial"**, quando a filial do cabeçalho muda entre abrir o diálogo e
salvar. Hoje a tela diz _"Item criado. O setor de impressão NÃO foi gravado: …
Abra o item e escolha o setor de novo."_ — que é a frase que responde à pergunta
do lojista (o item está lá?) e diz o que fazer com o que faltou.

**Na EDIÇÃO a mesma falha continua devolvendo `null` de propósito**, e a
diferença é idempotência: lá o segundo "Salvar" regrava o mesmo item e tenta o
setor de novo, que é o laço certo. Aqui ele criaria linha nova.

### As três recusas

| Rota                                   | Recusa | O que o teste prende                              |
| -------------------------------------- | ------ | ------------------------------------------------- |
| `PATCH .../print-settings`             | 404    | a frase aparece, nada diz "salvo", o texto fica   |
| `POST .../print-test`                  | 404    | **nenhuma** das duas frases de sucesso aparece    |
| `PATCH /categories/{id}/print…-sector` | 400    | o diálogo NÃO fecha, e nenhum item mudou de setor |

O 404 das duas primeiras é o de `_get_branch`: a filial sai do alcance do token
entre abrir a aba e salvar. O resto do que o backend recusa nelas a tela já
barra antes (as vias saem de uma lista de 0 a 5) — e recusa inalcançável não é
buraco, é a tela fazendo o trabalho dela.

A terceira é a mais cara, e não pelo status: é a ação em LOTE, a que move a
categoria inteira num clique. Fechar o diálogo na recusa deixaria a tela na
lista velha, com o setor antigo em cada linha e nada dizendo que os itens
continuam onde estavam.

### A hipótese que o teste derrubou — e por que ela está escrita aqui

A rodada começou atrás de outra coisa: o §7 de `ausencia.md` ("escrita que
gravou e se reporta como falha") parecia estar em **três** lugares de
`useMenu` — `saveCategory`, `saveProduct` e `applySectorToCategory` —, porque
nos três o `await` da releitura está dentro do `try` da escrita.

**Não está.** `loadCategories` e `loadProducts` tratam o próprio erro e **não
relançam**: elas nunca alcançaram aquele `catch`. Dois consertos foram escritos,
e os dois foram desfeitos quando o e2e recusou a reproduzir o defeito — o
sintoma nunca apareceu porque não existia.

A lição vale mais que os dois consertos: **a forma do código não é o defeito.**
`await escrita(); await releitura();` num `try` só é a assinatura do §7, e aqui
ela é inofensiva porque a segunda função engole. O que separou os dois casos foi
escrever o teste ANTES de acreditar no diagnóstico. A anotação ficou no
cabeçalho de `useMenu`, para quem for "consertar" isso daqui a seis meses.

---

## A rodada do cardápio (2026-09-03) — o falso mais frouxo na regra mais velha

O cardápio tem **três índices únicos por filial**, todos da revisão
`20260820_0026`, e em todos os três o backend escreve o 409 à mão antes de
inserir — em vez de deixar o `IntegrityError` virar 500 — porque o painel
precisa de uma frase:

| Índice                           | Frase do backend                                             |
| -------------------------------- | ------------------------------------------------------------ |
| `uq_categories_branch_slug`      | Já existe uma categoria com esse nome nesta filial           |
| `uq_products_branch_slug`        | Já existe um produto com esse nome nesta filial              |
| `uq_products_branch_catalog_key` | Já existe um produto com essa chave de catálogo nesta filial |

**O painel nunca tinha visto nenhuma das três**, e o motivo é o §4.10 da skill
`rapidex-api`: o falso montava o slug e inseria, e a chave de catálogo ele nem
olhava. Um dublê mais frouxo que produção deixa o e2e verde sobre uma tela que
toma 409 na mão do lojista — e aqui isso valia para a regra mais antiga da tela.

O falso ficou estrito (`slugFake`, espelhando `utils/normalization.slugify`, e
`chaveRepetida`), e **nenhum dos 33 testes de cardápio que já existiam
quebrou** — que é o sinal de que a regra nova não é invenção, é a que já valia.

### O que cada teste prende

- **categoria repetida** — o 409 aparece, o diálogo fica com o nome digitado, e
  a barra não ganha a segunda "Lanches";
- **o slug é que colide, não o nome** — "X Salada!" e "X-Salada" são o mesmo
  item para o backend. É a asserção que separa um falso que compara `name` cru
  de um que faz o que produção faz;
- **a chave de catálogo repetida** — e este prende uma ORDEM de escritas. Parear
  carimba o gêmeo primeiro, de propósito ("a falha dele é a que ainda dá para
  desfazer"). O teste prova o que essa decisão vale: a tentativa saiu, o backend
  recusou, e **nenhum item novo nasceu**. Na ordem inversa sobraria um item com
  chave que não pareia com ninguém, e o relatório voltaria a contar as duas
  lojas separadas sem nenhuma tela ficando errada;
- **a foto recusada** — e aqui o desfecho certo é o OPOSTO do resto da tela: o
  recorte NÃO é descartado. Descartá-lo obrigaria a escolher o arquivo e
  reenquadrar de novo por causa de uma piscada de rede.

Provado por mutação: afrouxar de volta a conferência do slug no falso derruba o
teste da categoria repetida.

### A reordenação, e o botão que não dava para apertar

As duas rotas de `reorder` são a **única escrita otimista do cardápio**: a barra
troca de ordem antes de o backend responder. O preço disso é que a recusa
precisa DESFAZER — sem a volta, o painel mostra uma ordem que o backend
rejeitou, e o cardápio do cliente sai numa ordem e o do lojista em outra, sem
nada aceso. É o `sort_order` divergente, a família que abriu `ausencia.md`.

A recusa tem um caso só e ele é alcançável: **a lista velha.** As duas exigem a
lista COMPLETA e respondem 400 quando falta alguém — outra aba criou uma
categoria, esta arrasta sem saber. Os dois testes novos prendem a mensagem **e a
volta**, que é a metade que faltava.

O falso passou a cobrar as duas listas, com as frases do backend palavra por
palavra. A de produto ele **inventava** ("A lista precisa ter todos os produtos
da categoria." em vez de "Envie todos os produtos da categoria na nova ordem"),
e a de categoria ele não cobrava de jeito nenhum: descartava em silêncio os ids
que não achava. Um dublê que inventa a frase é o mesmo defeito do dublê frouxo
com outra roupa — o teste passa a afirmar uma frase que produção nunca manda, e
o que estes testes existem para provar é que **a frase do backend** chega à tela.

**E o `PATCH /admin/categories/{id}` destravou um defeito de UI que nada
pegava.** Para escrever a recusa foi preciso clicar em "Editar categoria", que
mora no menu de três pontinhos da régua — e o clique não chegava. A causa:

- `.menu__panel-head` (a régua, que CONTÉM o menu) é `position: sticky` com
  `z-index: --z-sticky`, e isso **cria contexto de empilhamento**;
- o `--z-popover` de `.actions-menu__list` fica preso ao valor da régua;
- `.menu__columns` (a fileira de rótulos) também está em `--z-sticky` e vem
  DEPOIS no DOM — então ela pintava por cima do menu.

O efeito era invisível no desenho e total no uso: a **primeira** linha do menu
caía debaixo da fileira de rótulos e não recebia clique nenhum. A segunda
("Aplicar setor a todos os itens") ficava abaixo da faixa e funcionava — e era
só ela que o e2e apertava. **A cobertura existia e mirava o item errado.**

Conserto: `.menu__columns` desce um degrau
(`calc(var(--z-sticky) - 1)`). As duas grudam em alturas diferentes e nunca se
sobrepõem, então a ordem entre elas era livre; o que não era livre é o popover
que mora dentro de uma delas. Derivado do token de propósito — o que importa é
o degrau, não o número.

Isso é da mesma família dos onze da skill `revisao` (controle preso ao
`:hover`, alvo menor que 44px): **um controle que existe e não se usa.** Nenhum
script do portão pega, e o e2e só pegaria se apertasse aquele item — que é
exatamente o que ele passou a fazer.

### Os complementos, e a irmã que o §7 não tinha pegado

`ausencia.md` §7 consertou `gravar()` em `OptionGroupsSection`: gravar e reler
deixaram de dividir um `catch`, porque a releitura que caía era relatada como
escrita que falhou. **A função logo acima, `alternarOpcao`, tinha o mesmo
defeito e ninguém olhou** — a varredura da época mirou `gravar`, achou, e parou.

E esta é pior que a dela:

```ts
await setOptionActive(optionId, isActive); // gravou
await recarregar(); // esta caiu
```

Com o `catch` compartilhado, a tela escrevia erro **com o interruptor no estado
ANTIGO** — quem o desenha é a lista, e a lista não tinha mudado. Do balcão isso
é "não deu certo", e a reação natural é clicar de novo. Só que o segundo clique
manda o valor **oposto**: ele DESFAZ a gravação que funcionou.

Não é duplicata, é **reversão silenciosa** — e o que este interruptor decide é
se a opção sai de venda, que num grupo obrigatório tira o item inteiro do
cardápio do cliente. É camada 2 com outra roupa.

**O conserto usa a resposta que já vinha e ninguém aproveitava.**
`PATCH /admin/options/{id}` responde a OPÇÃO — o próprio `api/menu.ts` diz, no
comentário de `createOption`, que quem desenha a lista deve acrescentar o que
voltou "como `setOptionActive` faz". Só que aqui ninguém fazia: descartava a
resposta e relia. Agora a opção entra na lista ANTES da releitura
(`comOpcaoTrocada`, função pura, quatro casos unitários), e a releitura fica
valendo pelo que ela acrescenta de fato: o efeito INDIRETO
(`unavailable_by_required_group`), que é do produto e não da opção.

### Os dois formatos de erro da mesma seção

O 422 de `update_option_group` tem `detail` de **TEXTO** — o serviço monta
`"; ".join(...)` à mão, porque a validação acontece sobre a MESCLA com o banco e
o 422 automático do Pydantic não a alcança. O 422 do `POST` de opção, dez linhas
abaixo na mesma tela, tem `detail` de **LISTA**.

Dois formatos na mesma seção, e a frase precisa chegar nos dois. É a família do
`detail` que não é string da skill `revisao`: quando `messageFromUnknownError`
não sabe ler o formato, o lojista lê o número HTTP no lugar da frase que o
backend mandou pronta. Os testes novos afirmam o formato de cada um, e não só o
status.

### O que este achado diz sobre o método

As três unicidades **não estavam na lista de escritas sem teste** — elas
estavam contadas como "só caminho feliz", que é uma categoria mais branda. A
régua media o que o falso serviu, e o falso nunca serviu um 409 que ele não
sabia produzir. **Uma régua que só conta o que o dublê sabe fazer não vê o que
o dublê não sabe.**

É o mesmo buraco que a auditoria descreve em e.4, chegando por outro caminho: o
que protege contra ele não é ler o `openapi.json` (nenhuma dessas três regras
está lá — índice único não vira schema), é ler o **serviço** do backend antes de
escrever a recusa. Foi o que a skill `rapidex-api` já mandava fazer.

---

## A rodada da equipe (2026-09-03)

Esta tela é a que mais **impede antes**: as guardas do dono barram na tela o que
o backend recusaria com 400, e por isso quase toda recusa daqui é inalcançável —
o que está certo, e não é buraco. Sobraram três caminhos em que a tela **não tem
como saber**.

| Rota                                    | Recusa | Por que a tela não sabe                     |
| --------------------------------------- | ------ | ------------------------------------------- |
| `PATCH /admin/auth/password`            | 400    | quem sabe a senha atual é o backend         |
| `PATCH /admin/users/{id}`               | 400    | a guarda local lê a lista, e ela envelhece  |
| `POST /admin/users/{id}/reset-password` | 404    | a pessoa pode ter saído do alcance do token |

**A primeira é a recusa mais alcançável de todas as rodadas**, e a única que não
depende de outra aba: o lojista digita a senha atual errada. E é a tela em que a
pessoa está PRESA quando a senha é temporária — sem passar por ela não se chega
a Pedidos. Uma recusa engolida ali não é um campo errado, é alguém sem acesso ao
painel no meio do turno. O teste prende a frase, a permanência na rota e os dois
campos preenchidos: quem precisa corrigir UM campo não pode ser obrigado a
redigitar três.

**A terceira tem o desfecho mais específico da tela:** o diálogo da senha
temporária existe para mostrar UMA credencial UMA vez. Aberto sem ela, o dono
confirmaria que copiou o que não existe, fecharia, e a pessoa do outro lado do
telefone ficaria sem senha — com a anterior possivelmente já derrubada. O teste
afirma que **nenhum diálogo abre**.

### O teste que eu escrevi errado, e o conserto

A primeira versão da segunda prova dublava o 400 do "único dono ativo" **ao
rebaixar um gerente**. Passava verde — e não provava nada: o backend nunca manda
essa recusa para um gerente, porque `_ensure_keeps_an_active_owner` sai cedo
para quem não é dono.

É exatamente o defeito que esta mesma rodada apontou no falso duas seções acima:
**afirmar uma frase que produção nunca manda naquele caminho.** Um dublê que
inventa a recusa e um teste que inventa o cenário custam a mesma coisa — a
suíte fica verde sobre uma tela que ninguém exercitou.

A versão que ficou **planta um segundo dono ativo** antes de entrar. Com dois na
lista, a guarda local deixa rebaixar um (e é o certo); a outra aba desativa a
primeira dona nesse meio-tempo, e aí o 400 é o que o backend de fato responde.
Sem o segundo dono a guarda barra antes e a requisição nem sai — o teste passaria
sem exercitar nada, provando só que a tela sabe o que ela já sabia.

---

## Como refazer o levantamento

A instrumentação é temporária de propósito — ela grava num arquivo por variável
de ambiente e não deve viver no falso. Para repetir:

1. registrar `(método, caminho, status)` em **todas** as saídas do falso
   (`json()`, os `204` e o `multipart` — foi a lição desta vez);
2. `DIAG_ESCRITAS=<arquivo> npx playwright test`;
3. cruzar com as `export async function` de `src/api/*.ts` que chamam
   `apiClient.POST|PATCH|PUT|DELETE`.

E, no fim, **conferir cada achado no arquivo** antes de escrevê-lo aqui. As duas
primeiras medições passariam por boas se eu não tivesse feito isso.
