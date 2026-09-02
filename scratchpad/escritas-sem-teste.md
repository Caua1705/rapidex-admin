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

| Momento                                  | sem teste | só caminho feliz |
| ---------------------------------------- | --------- | ---------------- |
| primeira medição                         | 2         | 37               |
| depois das escritas de dinheiro          | 0         | 32               |
| depois de "o que decide se a loja vende" | 0         | 25               |
| depois de "a comanda que não sai"        | 0         | **22**           |

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

1. ~~**A comanda que não sai**~~ — feitas: `printing-sectors` (o 409 de nome
   repetido criado por OUTRA aba, que a conferência local não tem como ver),
   `printing-sectors/{id}` (o 404 de setor apagado no meio) e
   `products/{id}/printing-sector` (o **400 "é de outra filial"**, que a
   auditoria já nomeava: setor é POR FILIAL, e o produto salva nome e preço por
   uma rota e o setor por outra — se a segunda falhar calada, o diálogo fecha e
   a comanda sai no setor errado). Sobram `print-settings`, `printing-sector`
   de categoria e `print-test`.
2. **Cardápio** — produto, categoria, complemento, reordenação, foto. Erra uma
   tela, não um valor cobrado.
3. **Equipe e conta** — `updateAdminUser`, `resetAdminUserPassword`,
   `changePassword`. `createAdminUser` já tem o 409.
4. **O resto** — `delivery-time-bands`, `restaurant`, `settings`,
   `stream-ticket`, os dois DELETE.

E uma nota de método para quem seguir: várias recusas do backend são
**inalcançáveis pelo painel**, porque a tela valida antes. Isso não é buraco —
é a tela fazendo o trabalho dela. O que se procura é o caminho em que o backend
recusa e o painel **não sabia**.

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
