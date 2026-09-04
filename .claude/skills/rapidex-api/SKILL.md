---
name: rapidex-api
description: Convenções de integração com a API do Rapidex — contrato gerado, o que fazer quando a rota não existe, e as armadilhas que o typecheck NÃO pega (dia da semana 0=segunda, preço com adicional já embutido, escopo de filial pelo token, cópia como entrada repetida que não se deve deduplicar, a regra que só está na descrição da rota e não no schema, a validação cruzada que o Pydantic faz e o /openapi.json NÃO publica, o PATCH validado sobre a MESCLA com o banco, o falso do e2e mais frouxo que o backend, e o erro cujo `detail` é objeto — a tela mostra o número HTTP no lugar da frase que o backend mandou). Leia ANTES de escrever qualquer tela, hook ou função que consuma rota, e antes de mexer em src/api/. Também aplicável ao ler um campo novo de uma resposta, ao montar um filtro por data ou por dia da semana, ao decidir o que fazer com um 4xx, e ao investigar bug de valor errado na tela.
---

# Integração com a API do Rapidex

O painel do lojista (`admin.pederapidex.com`) fala com uma API só,
`https://api.pederapidex.com`, e fala por um caminho só: `src/api/client.ts`.

Este documento cobre duas coisas de naturezas diferentes, e vale saber qual é
qual:

- **As regras de processo** (§1 a §3) — o que fazer antes de escrever consumo
  de rota. O compilador cobra essas.
- **As armadilhas** (§4) — casos em que o código compila, os tipos batem, e o
  número na tela está errado mesmo assim. Nenhuma ferramenta cobra essas. É
  para elas que este arquivo existe.

## A regra que vale mais que as outras

**Nenhum tipo de request ou de response é escrito à mão.** Todos saem de
`src/api/generated/openapi.d.ts`, que é gerado com `npm run api:generate` a
partir do `/openapi.json` publicado pelo backend.

O arquivo gerado é versionado de propósito — o `npm ci` do CI não pode depender
de a API estar no ar —, mas **não é editável**. Um campo acrescentado à mão lá
dentro some na próxima geração, e some em silêncio.

---

# 1. Rode `npm run api:generate` antes de escrever consumo de rota nova

Antes da primeira linha de qualquer chamada nova:

```bash
npm run api:generate
npm run typecheck
```

O primeiro comando rebaixa o contrato publicado e roda o Prettier nele. O
segundo diz se alguma coisa que o painel já usava mudou de nome ou de forma
enquanto ninguém olhava.

**Por que antes e não depois:** escrever a chamada primeiro significa escrever
contra a memória de como o contrato era. Se o campo mudou, o erro aparece
depois de a tela inteira já estar montada em cima do nome velho — e o conserto
deixa de ser uma linha para virar uma varredura. Gerar primeiro custa dez
segundos e transforma "esse campo se chama assim, eu acho" em uma consulta ao
arquivo.

Se `api:generate` alterar o `openapi.d.ts`, **commite essa mudança separada** da
tela que a motivou. Um diff de 300 linhas de contrato misturado com 40 de tela
esconde as duas.

---

# 2. Nunca declare contrato à mão

Não escreva `type X = { campo: string }` para descrever request ou response.
Não estenda um tipo gerado com um campo que você espera que exista. Não use
`as` para forçar um objeto do backend a uma forma que o contrato não descreve.

O único lugar onde nomes de tipo aparecem é `src/api/types.ts`, e ele **só dá
apelido**:

```ts
export type OrderDetail = Schemas['OrderDetailResponse'];
```

Nenhuma lista de campos, nenhum campo acrescentado, nenhum campo opcionalizado.
Assim, quando o backend renomeia algo, `npm run typecheck` acende em `types.ts`
e nos pontos de uso — em vez de a tela continuar compilando e mostrar vazio.

## Isto não é regra de estilo. Já custou dois bugs

Entre 2026-08-08 e 2026-08-10 existiu um `src/api/contract-pending.ts`: um
arquivo com tipos escritos à mão para rotas que o backend já tinha entregue mas
o `/openapi.json` ainda não publicava. Ele era cuidadoso — marcava o que era
suposição, tinha até uma asserção de tipo que quebrava o build no dia em que o
contrato publicasse cada rota.

**Não adiantou.** Quando o contrato saiu, dois nomes estavam errados:

| Escrito à mão (errado) | O nome real no contrato      | O que a tela fazia                       |
| ---------------------- | ---------------------------- | ---------------------------------------- |
| `group_name_snapshot`  | `option_group_name_snapshot` | grupo de adicional sem rótulo na comanda |
| `print_sector_id`      | `printing_sector_id`         | 404 na rota, setor nunca gravava         |

O detalhe que importa: a asserção protegia a **rota**, não o **campo**. Nome de
campo inventado tem a mesma forma de nome de campo certo — o TypeScript
concorda com os dois. O arquivo foi apagado em `ba4054c` e nada equivalente
deve voltar.

**A conclusão prática:** um tipo escrito à mão não é "provisório". Ele é uma
segunda fonte de verdade que ninguém reconcilia, e o custo dele não aparece no
dia em que é escrito — aparece semanas depois, na tela, com o lojista olhando.

---

# 3. Rota que não existe: pare e avise

Se `npm run api:generate` não trouxer a rota de que a tela precisa, **a tela não
começa**. Não invente o caminho, não invente o corpo, não escreva o overlay
"por enquanto".

O que fazer, nesta ordem:

1. Confira que o contrato está atualizado (rode `api:generate` de novo — pode
   ser cache seu, não ausência do backend).
2. Procure a funcionalidade com outro nome. `print-sectors` não existia;
   `printing-sectors` existia. Meia hora de busca teria evitado o segundo bug
   da tabela acima.
3. **Se não existir mesmo: pare e diga.** Relate ao usuário qual rota falta,
   para qual tela, e o que dá para entregar sem ela. Entregue todo o resto.

Adivinhar o caminho de uma rota produz código que compila, monta, chama e toma
404 — e o 404 aparece na mão do lojista, não na sua. Um aviso de trinta
segundos vale mais que a tela inteira escrita contra uma rota imaginária.

---

# 4. As armadilhas que o typecheck não pega

As sete abaixo compilam. Os tipos batem. O número na tela é que está errado —
ou a lista vem duas vezes, ou a tela afirma uma coisa que ninguém conferiu.

As quatro primeiras são sobre o VALOR (dia, preço, escopo, recorte). As três
últimas são sobre o SIGNIFICADO: o que a repetição de uma linha quer dizer
(4.5), o que a prosa da rota diz e o schema não (4.6), e o erro que o painel não
sabe ler (4.7).

## 4.1 Dia da semana: o backend conta 0 = segunda, o JS conta 0 = domingo

O campo `weekday` (em `BusinessHourResponse` e `BusinessHourInput`) segue o
`datetime.weekday()` do Python:

| `weekday`  | 0   | 1   | 2   | 3   | 4   | 5   | 6   |
| ---------- | --- | --- | --- | --- | --- | --- | --- |
| Backend    | Seg | Ter | Qua | Qui | Sex | Sáb | Dom |
| `getDay()` | Dom | Seg | Ter | Qua | Qui | Sex | Sáb |

`Date#getDay()` **nunca** entra direto num `weekday`. A conversão tem um lugar
só, `backendWeekday()` em `src/store/business-hours.ts`:

```ts
export function backendWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}
```

**Por que este erro é pior do que parece:** os dois lados usam um `number` de 0
a 6. Nenhum dos dois reclama de nada. O sintoma é a loja abrir no dia errado —
deslocada em um, o ano inteiro, até alguém tentar comprar num domingo fechado.

A ordem da grade na tela é segunda→domingo, igual à do backend, e a lista
`WEEKDAYS` do mesmo arquivo é a **única** fonte de rótulo de dia.

### E há uma SEGUNDA volta: qual dia, antes ainda de numerá-lo

`backendWeekday(date)` converte a numeração — e responde no fuso de quem lhe
entrega a data. `backendWeekday(new Date())` é, portanto, **o dia do
APARELHO**, e era assim que a barra de pedidos lia o prazo de preparo do dia.

Num tablet de balcão em modo quiosque com o fuso errado, ou num notebook trazido
de outro estado, o painel lê a linha de horário do **dia errado**: mostra o prazo
de terça numa segunda. E o erro é silencioso pelo mesmo motivo do primeiro — os
dois dias existem, e nenhum dos dois reclama.

**Hoje "que dia é hoje" tem função própria:** `weekdayDaOperacao()`, no mesmo
arquivo. Ela passa pelo TEXTO da data no fuso da operação e só então numera.
`backendWeekday` continua existindo para converter uma data que você JÁ tem.

**A regra curta:** data conhecida → `backendWeekday`. "Hoje" → `weekdayDaOperacao`.

**E o fuso, em geral.** A operação roda em `America/Fortaleza`
(`OPERATION_TIMEZONE`, em `src/orders/format.ts`) e os filtros
`start_date`/`end_date` são AAAA-MM-DD no dia **da operação**, não no do
navegador. Quem monta filtro por data usa `src/orders/order-filters.ts`. E todo
formatador de data em `src/` declara `timeZone` — `npm run lint` cobra isso
(`scripts/check-fuso.mjs`), porque o pino de fuso do portão ESCONDE esta classe
de defeito em vez de acusá-la. Ver `revisao` §11.

## 4.2 `unit_price_snapshot` já inclui os adicionais

Em `OrderItemResponse`, o `unit_price_snapshot` sai do backend **com os
adicionais de `option_groups` já somados** (`OrderService._build_order_item`).

O `additional_price_snapshot` de cada opção vem **para conferência**: é o que se
mostra ao lado da opção quando o cliente pergunta de onde saiu o preço. Ele
**não entra em conta nenhuma**.

```
item.total  =  unit_price_snapshot × quantity        ← certo
item.total  = (unit_price_snapshot + Σ adicionais) × quantity   ← ERRADO
```

Somar de novo faz o item aparecer mais caro do que o pedido cobrou — e o painel
passa a discordar do que o cliente pagou, que é a pior forma deste bug.

Quem lê adicional usa `readOptionGroups()` em `src/orders/order-options.ts`, que
já devolve os grupos prontos para exibir e não faz aritmética de preço.

## 4.3 O escopo de filial vem do token

**Nenhuma rota `/admin/*` aceita restaurante por path ou por query.** O JWT do
lojista carrega o restaurante, e o backend resolve o escopo sozinho.

Consequências práticas:

- `GET /admin/branches` devolve **as filiais que este lojista enxerga**. Quem
  está preso a uma filial recebe só ela — o seletor do cabeçalho já vem
  resolvido sem a tela conhecer a regra.
- Filtro sem `branch_id` significa "todas as filiais que eu enxergo", nunca
  "todas as filiais da plataforma". Não há vazamento a proteger na tela.
- `branch_id` no path (`/admin/branches/{branch_id}/...`) é outra coisa: é
  escolher **qual** filial, dentro do escopo que o token já delimitou.

**Cuidado com um falso positivo:** existem rotas `/restaurants/{restaurant_slug}`
e `/restaurants/{restaurant_slug}/menu` no contrato. Elas são a **API pública da
vitrine** (o cliente final, sem autenticação). O painel não usa nenhuma delas.
Encontrar essas rotas não é motivo para concluir que a regra acima está errada.

### O nome do restaurante está em `GET /admin/restaurant`, e em mais lugar nenhum

`GET /admin/restaurant` (PESSOAS) devolve `AdminRestaurantProfileResponse`:
`id`, `name`, `slug`, `description` e `assistant_notes`. É de lá que
`src/auth/restaurant-label.ts` tira o nome que o shell mostra, e a função a
chamar é `fetchRestaurantProfile()` em `src/api/store.ts`.

**Continua não estando em lugar nenhum além dela.** Nem o JWT, nem
`GET /admin/auth/me` (que só traz `restaurant_id`), nem `GET /admin/settings`.
E o campo se chama `name`, não `restaurant_name` — este último não existe em
resposta `/admin` nenhuma.

`/admin/restaurant` e `/admin/settings` NÃO SÃO DUAS VISTAS DO MESMO RECURSO, e
confundi-los é o erro que esta seção passou a existir para evitar:

| Rota                | Tabela                | O que é                           |
| ------------------- | --------------------- | --------------------------------- |
| `/admin/settings`   | `restaurant_settings` | os PADRÕES que cada filial herda  |
| `/admin/restaurant` | `restaurants`         | a MARCA, que filial nenhuma herda |

O PATCH de cada uma é SOMENTE_DONO, e `name` e `slug` **não são graváveis** por
nenhum dos dois: o slug é a URL pública do cardápio, e trocá-lo por PATCH
quebraria em silêncio todo link já salvo no mundo.

**A logo ainda não veio.** `restaurants.logo_path` existe no banco e `logo_url`
é servido, mas só na API PÚBLICA da vitrine. Enquanto ela não sair em `/admin`,
o ladrilho do shell leva as iniciais do nome.

> Até `ea1c9e3` (2026-08-23) esta seção dizia o contrário — que nome nenhum
> chegava a `/admin` e que por isso o topo do painel DERIVAVA a identificação da
> filial principal (`is_main`). A rota apagou a derivação, e com ela o corte no
> travessão que existia para tirar o nome de bairro de dentro do
> `display_name` da filial.

## 4.4 O cardápio é da FILIAL, e a leitura sem recorte devolve ele duas vezes

Desde as revisões `20260820_0026`/`0027` do backend, **produto, preço,
disponibilidade e categoria são da filial**. Não há herança e não há
sobrescrita: a picanha do Centro e a da Aldeota são duas linhas independentes,
com dois ids e dois preços.

Isto contradiz o parágrafo acima de um jeito que custa caro, e a diferença é a
razão de esta seção existir:

| Rota                                       | Sem `branch_id`                                   |
| ------------------------------------------ | ------------------------------------------------- |
| `GET /admin/orders`, `/admin/customers`    | todas as filiais do token — o recorte é uma opção |
| `GET /admin/categories`, `/admin/products` | **o cardápio de cada loja, somado num só**        |

Na segunda linha o resultado é 200, o JSON é válido e nada acende. O que aparece
é a tela dobrada: "Promoções 10 / Promoções 10" na barra de categorias, cada
item duas vezes na lista. Foi assim que o defeito chegou ao painel.

**Por isso `listCategories` e `listProducts` (`src/api/menu.ts`) exigem
`branchId` na assinatura** — um recorte esquecido volta a ser erro de
compilação em vez de uma lista dobrada na mão do lojista.

Nas escritas o campo é obrigatório de verdade:

| Rota                              | Onde a filial entra                                                    |
| --------------------------------- | ---------------------------------------------------------------------- |
| `POST /admin/categories`          | **no corpo**, obrigatório (422 sem ela)                                |
| `PATCH /admin/categories/reorder` | **no corpo**, obrigatório; a lista completa é a da filial              |
| `POST /admin/products`            | **não vai** — a filial vem da categoria (`category_id` já a determina) |
| `PATCH /admin/products/{id}`      | `category_id` só aceita categoria da MESMA filial (400)                |

**Produto não muda de filial.** Quem quer o mesmo item na outra loja cria um lá
com a mesma `catalog_key` — campo opcional, texto livre, único dentro da filial,
que existe para o relatório somar as duas lojas numa linha. Ele **não tem
semântica de herança**: nada lê `catalog_key` para decidir preço ou
disponibilidade.

### `catalog_key`: as regras moram em `src/menu/catalog-key.ts`

O diálogo do produto tem o campo "mesmo item em outra loja" — ele procura o
gêmeo pelo NOME nas outras filiais e copia a chave. **Não escreva a lógica de
chave em outro lugar**; as três regras abaixo compilam nas duas direções e
erradas produzem um relatório menor do que devia, sem erro em tela nenhuma:

1. **A chave do par é a do GÊMEO** (`pairWith`), e quando ele não tem nenhuma, é
   o `id` DELE — a convenção da migração. Usar o id do produto que está sendo
   criado dá uma chave que não pareia com nada.
2. **Gêmeo sem chave precisa RECEBER a chave** (`twinKeyToWrite`), num
   `PATCH /admin/products/{id}` feito ANTES de gravar o nosso. Gravar só de um
   lado é parear com ninguém. É o caso normal: só o que a migração copiou nasce
   pareado.
3. **Desfazer o par manda `null` explícito** (`catalogKeyBody`), nunca a ausência
   do campo — a mesma regra de `printing_sector_id`.

E o rascunho de edição sai de `productDraftFrom` (`menu-model.ts`): o corpo do
PATCH manda `catalog_key` sempre, então um rascunho montado à mão que esqueça a
chave **desfaz o pareamento de um item porque alguém corrigiu o preço dele**.

---

## 4.5 Cópia é ENTRADA REPETIDA, e deduplicar apaga a informação

`GET /admin/orders/{order_id}/print-jobs` devolve as vias de um pedido. A
filial que pediu **duas** vias do cliente recebe **dois itens idênticos, um
atrás do outro** — não existe campo `copies`.

O motivo está no contrato e é bom: **não existe atualização remota do agente de
impressão.** Ele é um `.exe` instalado à mão na máquina do balcão, e uma versão
nova é uma visita por loja. Repetindo a entrada, a mudança vale hoje em toda
instalação já em campo, inclusive nas anteriores à revisão que a criou.

Isso obriga a tela a fazer duas coisas opostas ao mesmo tempo:

- **agrupar para EXIBIR** — três blocos de texto idênticos empilhados são lidos
  como defeito do painel, não como "saem três vias";
- **NUNCA deduplicar a CONTAGEM** — "2 vias" é a informação, e é a única
  resposta ao lojista que ligou perguntando por que gastou o dobro de bobina.

`agruparVias()` (`orders/print-jobs.ts`) faz as duas, e agrupa só o que é
**consecutivo**: as vias vêm "na ordem em que devem sair", e juntar duas iguais
separadas por uma terceira reordenaria a bobina na tela — que é exatamente o que
o lojista está conferindo quando abre aquilo.

**O padrão, para além deste caso:** um `new Set(...)` ou um `uniqBy` no caminho
de uma lista do backend compila, não quebra teste nenhum, e some com um número
que alguém precisa. Antes de deduplicar, pergunte se a repetição é ruído ou é o
dado.

---

## 4.6 Leia a DESCRIÇÃO da rota, não só o schema dela

O nome e a forma de uma rota descrevem o que ela devolve. O que ela **significa**
está na prosa que o backend escreveu — e no Rapidex essa prosa costuma trazer a
regra de negócio inteira.

**O caso que originou esta seção.** `print-jobs` parece histórico de impressão:
tem `order_id`, tem uma lista de vias, tem setor e impressora. Não é. A descrição
diz, com todas as letras:

> A rota nao marca nada como impresso. Reimprimir e a operacao mais comum do
> balcao (papel picotou, comanda molhou), e ela precisa ser um simples GET
> repetido.

Uma tela escrita contra o schema teria escrito **"comanda impressa"**. E essa
palavra, no passado, faria o lojista parar de procurar o defeito exatamente no
momento em que a comanda não saiu — que é o pior desfecho possível para uma tela
que existe para o contrário.

Três perguntas que só a descrição responde, e todas mudam a tela:

| Pergunta                                    | Exemplo real                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A resposta vazia é erro ou é resposta?      | `jobs: []` = a filial zerou as contagens. Não é falha de carregamento.                             |
| A resposta PARCIAL tem significado próprio? | só `type: 'customer'` = pagamento online não confirmou, a via de produção é ordem de preparo       |
| O 202/428 quer dizer o quê?                 | `print-test` responde 202 = **enfileirado**, não impresso (por isso `agent_is_online` na resposta) |

**Na prática:** antes de escrever a tela, leia
`d.paths['<rota>'].<método>.description` e a `description` de cada schema que ela
devolve. São dois minutos, e é onde mora metade do que a tela precisa dizer.

---

## 4.7 Erro com `detail` estruturado — o painel mostra o número, não a frase

`api/errors.ts` sabe ler `detail` como **string**, `detail` como **lista de
validação do Pydantic** e `{ error: { message } }`. Uma quarta forma existe no
contrato: **`detail` como OBJETO**.

**O caso, consertado em 2026-09-02 — e ele custou semanas de vida assim.**
`PATCH /admin/orders/{id}/cancel` a partir de `preparing` responde **428** com
`{ detail: { code, message, order_status } }`, e o contrato avisa que isso **não
é erro**: "o painel abre o diálogo de confirmação e reenvia". O `message` vem
"pronta para ser mostrada no diálogo de confirmação do painel".

`readDetailMessage` devolvia `null` para objeto, e o lojista lia
**"A requisição falhou (428)."** Efeito: a partir de "Iniciar preparo", o pedido
não podia mais ser cancelado pelo painel — nem por dono, nem por gerente.

Hoje `readDetailMessage` lê `detail.message` quando `detail` é objeto (depois
do ramo da lista de validação de propósito: aquela também é objeto para o
`typeof`, e é o `Array.isArray` que separa as duas), e o segundo clique mora
em `orders/cancel-confirmation.ts`. **O que fica de aviso é o resto:** o 428
respondia isso desde que entrou no contrato, e nada no repositório ficava
vermelho — ver §4.10.

**A regra:** um status 4xx que o contrato descreve como "não é erro, o painel
faz X" é uma **funcionalidade escrita como resposta HTTP**. Tratá-lo como falha
genérica não perde a mensagem — perde a funcionalidade.

Ao escrever consumo de rota nova, confira no contrato se ela declara 4xx com
schema PRÓPRIO (qualquer coisa que não seja `HTTPValidationError`). Se declara,
esse caminho precisa de tratamento nomeado, e o `catch` genérico não serve.

---

## 4.8 A validação que NÃO VIRA SCHEMA — Pydantic tem duas metades

`npm run api:generate` traz tudo o que o `/openapi.json` publica. Ele **não traz
o que o Pydantic valida fora do schema**, e são duas coisas distintas:

**(a) Os limites de campo.** `Field(min_length=1, max_length=4000)` vira
`"type": "string"` seco em várias rotas do Rapidex. O painel recebe `string` e
não sabe o teto.

**(b) As regras CRUZADAS.** `@model_validator(mode="after")` não tem
representação em JSON Schema. Elas somem inteiras.

**Os casos vivos, e cada um com o preço:**

| Onde                                 | A regra que só existe no Pydantic                                 | O que custa não conferir                                                                         |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `AdminOptionGroupFields`             | `max_select >= min_select`; `is_required` exige `min_select >= 1` | 422 depois de o lojista preencher seis campos, com a mensagem do Pydantic em inglês              |
| `CreateErrorReportRequest`           | `description` 1–4000, `error_log` **20000**, `screen` 200         | 422 **na tela de relatar o erro** — a última porta que restava, e a pilha do React passa dos 20k |
| `CancelOrderRequest.reason`          | 3–300                                                             | já era conhecido: `orders/cancel-reason.ts`                                                      |
| `AdminOptionCreate.additional_price` | `ge=0`                                                            | preço negativo recusado no clique                                                                |

**A decisão do repositório, e ela é a mesma sempre:** o número é escrito à mão,
**num lugar só**, com a ORIGEM NOMEADA no comentário — a classe do Pydantic de
onde ele saiu. Isso **não** contraria "nada de contrato se escreve à mão",
porque isto não é contrato: é o que o contrato não publica. Os três lugares
onde isso mora hoje: `orders/cancel-reason.ts`, `erro/error-report.ts` e
`menu/option-groups.ts`.

E conferir na tela não é desconfiança do backend: é o lojista ver o limite
**antes** de clicar, e a mensagem sair em português.

**Como achar:** abra a classe no `src/schemas/` do backend e leia os
`Field(...)` e os `@model_validator`. `grep -n "model_validator" -A 20` na
classe do corpo que você vai mandar leva trinta segundos.

---

## 4.9 O PATCH é validado sobre a MESCLA, e por isso ele leva o formulário inteiro

Uma rota de edição do Rapidex pode validar o **resultado da mescla** com o que
está no banco, e não o corpo que chegou. `AdminOptionGroupUpdate` é assim: os
sete campos são opcionais, e o `model_validator` roda sobre `{...gravado,
...corpo}`.

**A consequência, e ela é contraintuitiva:** um PATCH "mínimo" — só o campo que
mudou — pode ser **recusado por causa de um campo que a tela nem mostrou**.
Ligar `is_required: true` num grupo cujo `min_select` gravado é `0` é 422, e o
corpo enviado não tem nada de errado nele.

**A regra:** quando a rota valida a mescla, o painel manda **o formulário
inteiro**. Assim o que ele validou é exatamente o que o backend vai validar, e
some junto a classe do item 2 da `revisao` ("campo que some no corpo do PATCH").

Isso **não** contradiz o `null` explícito de `§5 · null que é escolha`: lá o
assunto é o SIGNIFICADO de cada valor; aqui é QUANTOS campos vão. Um formulário
que representa a coisa inteira manda a coisa inteira, com os `null` que ela
tiver.

**E o teste precisa provar o corpo, não o resultado.** Olhando só o objeto
gravado, "mandou os sete campos" e "mandou só o que mudou" são
indistinguíveis — por isso `e2e/fake-api.ts` guarda `optionGroupBodies`, como já
guardava `adminUserBodies` pelo motivo inverso.

---

## 4.10 O falso não pode ser mais frouxo que o backend

`e2e/fake-api.ts` é escrito por nós, e é essa a força e o buraco dele. **Um
dublê que não tem o caso nunca acusa que a tela não o trata.**

Aconteceu três vezes, e as três foram achadas nesta rodada:

- **o 428 do cancelamento** — o falso nunca o devolvia, e 251 testes de e2e
  ficavam verdes sobre um painel que não conseguia cancelar pedido em produção;
- **os grupos de complemento** — `GET /admin/products/{id}` devolvia
  `option_groups: []` sempre, então o interruptor de opção, o aviso de "item
  fora de venda" e o diálogo de confirmação **existiam no código e nunca tinham
  sido exercitados**;
- **as validações cruzadas** — um falso que aceitasse `max_select < min_select`
  deixaria o painel mandar o que produção recusa.

**A regra, ao acrescentar rota ao falso:** reproduza **os erros que ela
responde**, com o corpo do backend letra por letra, e **as validações que ela
cobra**. Um falso que só sabe o caminho feliz transforma o e2e num teste de que
a tela desenha, não de que ela funciona.

### A forma de escrever isso: `e2e/contrato.ts`

Desde 2026-09-04 o falso não responde nada por conta própria. Toda saída passa
por `e2e/contrato.ts`, e a forma é sempre a mesma:

```ts
const filial = casar(path, '/admin/branches/{branch_id}/print-settings');
if (filial) {
  const body = corpoDe(route, 'patch', '/admin/branches/{branch_id}/print-settings');
  return responder(route, 'patch', '/admin/branches/{branch_id}/print-settings', 200, corpo);
}
```

- **o literal da rota é `keyof paths`** — caminho renomeado no backend não
  compila, e caminho inventado nunca compilou;
- **`responder` tipa o corpo** por `paths[rota][metodo].responses[status]`;
  status que o contrato não declara vira `never`, o que empurra para `recusar` e
  faz você DIZER que aquele status sai do serviço, não do contrato;
- **a rota e o método são conferidos em execução** contra a requisição que
  chegou. Uma resposta compartilhada por dois métodos (a leitura e a gravação de
  `print-settings` terminam na mesma) sai do `method` do ramo, com um ternário —
  fixar um dos dois derruba o teste com a frase inteira na tela;
- **`recusar` recusa corpo de erro que `src/api/errors.ts` não sabe ler.** Um
  formato inventado no falso faz o teste afirmar uma frase que produção nunca
  manda, e esconde o caso do §4.7.

Isso fecha a deriva de **forma** (campo renomeado, status que não existe, enum
com um sexto valor). **Não fecha a de regra**, que é o assunto desta seção: o
índice único, o `@model_validator` e o 409 escrito à mão no serviço não estão no
`/openapi.json`, e continuam saindo da leitura do backend. Ver
`scratchpad/falso-contra-o-contrato.md` para o que a amarra achou e o que ficou
de fora.

---

---

# 5. Os erros que já aconteceram, com o nome real de cada campo

Esta é a lista de referência. Antes de escrever um nome de campo de memória,
procure-o aqui.

## Nome de campo

| Errado (já usado)     | **Certo**                        | Onde                                          |
| --------------------- | -------------------------------- | --------------------------------------------- |
| `group_name_snapshot` | **`option_group_name_snapshot`** | `OrderItemOptionGroupResponse`                |
| `print_sector_id`     | **`printing_sector_id`**         | corpo do PATCH de setor, e no produto         |
| `updated_count`       | **`updated_products`**           | `CategoryPrintingSectorResponse`              |
| `changed_by`          | _(não existe mais)_              | corpo do PATCH de status — sai do token agora |

Sobre `changed_by`: foi **removido** do contrato porque era texto livre vindo do
cliente — o histórico do pedido registrava qualquer autor que o painel quisesse
escrever. Hoje quem mudou sai do token. Mandar o campo não quebra (o Pydantic
ignora chave desconhecida), só não tem efeito nenhum — o que é pior que quebrar.

## Nome de rota

| Errado (já usado) | **Certo**                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `print-sectors`   | **`printing-sectors`**                                                                      |
| —                 | `PATCH /admin/orders/{order_id}/cancel` é rota própria, não `PATCH /status` com `cancelled` |

## Os snapshots do pedido, com o nome exato

Tudo em `OrderItemResponse` e abaixo é _snapshot_: congelado como estava no
cardápio no dia da venda, porque o lojista renomeia e reprecifica depois e a
comanda de ontem precisa continuar dizendo o que foi vendido.

```
OrderItemResponse
  product_name_snapshot          rótulo do item
  product_code_snapshot          código, se houver
  product_description_snapshot
  unit_price_snapshot            JÁ COM OS ADICIONAIS (§4.2)
  quantity
  total
  observation
  option_groups[]  →  OrderItemOptionGroupResponse
                        option_group_id                 (não existe `id` aqui)
                        option_group_name_snapshot      rótulo do grupo
                        options[]  →  OrderItemOptionResponse
                                        id
                                        option_id
                                        option_name_snapshot        rótulo da opção
                                        additional_price_snapshot   só conferência
```

O grupo **não tem** campo `id` — a chave dele é `option_group_id`. A opção tem
os dois, `id` e `option_id`, e são coisas diferentes: `id` é a linha do pedido,
`option_id` é a opção do cardápio.

## Corpos que não aceitam o que parece óbvio

| Rota                                | O que NÃO está no corpo       | Como se faz                                  |
| ----------------------------------- | ----------------------------- | -------------------------------------------- |
| `PATCH /admin/products/{id}`        | `printing_sector_id`          | `PATCH /admin/products/{id}/printing-sector` |
| `PATCH /admin/products/{id}`        | `image_path`                  | `POST /admin/products/{id}/image`            |
| `PATCH /admin/products/{id}`        | `slug`                        | não se edita: é URL pública                  |
| `PATCH /admin/payment-methods/{id}` | `payment_flow`, `method_type` | desativa a linha e cria outra                |
| `PATCH /admin/settings`             | `is_open`                     | `PATCH /admin/settings/store-status`         |

`image_path` e `slug` ficaram de fora por segurança, não por esquecimento: como
texto livre, o primeiro deixaria o painel apontar o produto para qualquer objeto
do Storage — inclusive de outro restaurante — e o segundo é endereço público.

`printing_sector_id` não está nem em `AdminProductUpdate` nem em
`AdminProductCreate`, mas **está** em `AdminProductResponse` — é por isso que a
lista do cardápio consegue mostrar a coluna de setor mesmo sem o PATCH aceitar o
campo. Ler a resposta e concluir que o PATCH aceita é um erro fácil de cometer.

**Um caso é convenção, não restrição:** `is_available` existe nos dois lados —
está em `AdminProductUpdate` **e** tem rota própria
(`PATCH /admin/products/{id}/availability`). Use a rota própria mesmo assim. É a
ação mais frequente do dia ("acabou a costela"), e um corpo de um campo só não
tem como reenviar preço velho por cima de uma edição aberta em outra aba. Vale
para toda esta seção: mandar o objeto inteiro para mudar um campo desfaz o
trabalho de quem estava editando.

## Rotas que substituem em vez de editar

- **`PUT /admin/branches/{id}/business-hours` troca a semana INTEIRA.** Dia
  ausente da lista = dia fechado. Mandar só os dias que o lojista mexeu não
  edita de menos: **apaga o resto da semana.** Monte o corpo com `weekPayload()`
  (`src/store/business-hours.ts`), que sempre devolve os 7 dias.
- **`PATCH /admin/categories/reorder` recebe a lista COMPLETA de ids**, não o
  par (id, posição) do que mudou. Lista parcial apaga a posição de quem ficou de
  fora. Use `categoryIdsForReorder`, que parte de todas as categorias carregadas
  e nunca de uma lista filtrada. **A lista completa é a DA FILIAL**, e
  `branch_id` é obrigatório no corpo (422 sem ele) — ver §4.4.

Nos dois casos o tipo aceita a lista curta sem reclamar.

## `null` que é escolha, não vazio

Em `printing_sector_id`, `null` significa **"não imprimir comanda deste item"** —
é como o lojista desliga a impressão. Não trate como "campo não preenchido" nem
omita o campo do corpo: omitir e mandar nulo teriam que significar coisas
diferentes, e um corpo vazio não diz qual das duas o lojista quis.

---

# 6. Como uma chamada é escrita

## As camadas, e por que a tela não pula nenhuma

```
tela / hook  →  src/api/<domínio>.ts  →  src/api/client.ts  →  API
```

- **A tela nunca importa `apiClient`.** Ela chama a função nomeada de
  `src/api/orders.ts`, `menu.ts`, `store.ts`, `print-sectors.ts` ou `auth.ts`.
  Hoje isso é verdade em todo o `src/` — a única exceção é `useOrderStream.ts`,
  que importa `API_BASE_URL` porque o SSE não passa por `openapi-fetch`.
- **Rota nova de um domínio existente entra no arquivo daquele domínio.** Se
  duas telas usam o mesmo recurso, ele ganha arquivo próprio — foi o que
  aconteceu com os setores de impressão, lidos pelo Cardápio e administrados por
  Minha loja.
- **`unwrap()` para resposta com corpo, `unwrapEmpty()` para 204.** O
  `openapi-fetch` devolve `{ data, error }` sem lançar nada, o que obrigaria
  cada chamada a conferir `error` na mão — e uma conferência esquecida vira tela
  em branco. `unwrap` lança `ApiError`, então quem chama usa try/catch e o erro
  nunca passa despercebido. `unwrap` trata `data === undefined` como falha, então
  um DELETE bem-sucedido precisa de `unwrapEmpty`.

## O que a tela faz com o erro

Sempre `messageFromUnknownError(error)`, de `src/api/errors.ts`. O backend
responde erro de três formatos diferentes (`{detail: "..."}`, lista de validação
do Pydantic, `{error: {message}}`) mais o caso de não haver resposta nenhuma. Ler
o corpo direto na tela produz `[object Object]`.

As mensagens de 409 da máquina de estados já vêm prontas e em português do
backend — passam direto, sem tradução nossa.

## Idempotência

`PATCH /status` e `PATCH /cancel` mandam `Idempotency-Key: crypto.randomUUID()`,
**chave nova a cada clique do lojista**. Ela protege o retry: se a resposta se
perder na rede e o navegador reenviar, o backend devolve a resposta original em
vez de gravar outra linha no histórico do pedido.

Reusar a chave entre cliques diferentes faria o segundo clique virar eco do
primeiro. Não guarde a chave em estado.

## O 401 mora em um lugar só

`client.ts` derruba a sessão em qualquer 401 de requisição autenticada. A tela
não trata 401. A exceção está lá dentro e é de propósito: o 401 do
`POST /admin/auth/login` é "senha errada", não "sessão expirada" — se fosse
tratado igual, a tela de login se recarregaria a cada erro de digitação.

---

# 7. Antes de dar a tela por pronta

```bash
npm run typecheck   # o contrato bate
npm test            # a lógica que erra de verdade
npm run lint        # inclui as regras de design token
```

E a leitura que nenhuma ferramenta faz por você:

- [ ] Rodei `api:generate` **antes** de escrever a chamada?
- [ ] Todo nome de campo saiu do `openapi.d.ts`, e nenhum da memória?
- [ ] Se a tela lê ou grava dia da semana, passei por `backendWeekday()` /
      `WEEKDAYS`?
- [ ] Se a tela mostra preço de item com adicional, ela **não** somou
      `additional_price_snapshot`?
- [ ] Se a tela salva horários ou reordena categorias, mandei a lista
      **completa**?
- [ ] Se alguma rota faltou, eu **avisei** em vez de adivinhar o caminho?
- [ ] Li a `description` da rota e a de cada schema que ela devolve — e a tela
      não afirma nada que a rota não confirme?
- [ ] Se a resposta traz lista, eu sei se a repetição nela é ruído ou é o dado?
- [ ] A rota declara algum 4xx com schema PRÓPRIO? Se declara, esse caminho tem
      tratamento nomeado, e não um `catch` genérico que mostra o número?

E a que vale para a rodada inteira, não para a tela:

- [ ] Rodei a varredura de **rota que o backend entregou e o painel nunca
      chamou** (a receita está no item 9 da skill `revisao`)? Metade do que se
      pediria como tela nova já tem rota pronta esperando — e a outra metade não
      tem rota nenhuma.
