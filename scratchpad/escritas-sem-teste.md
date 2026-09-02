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

**46 escritas. 2 sem nenhum teste. 37 exercitadas só no caminho feliz.**

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

**A priorização para a próxima rodada**, do mais caro ao menos: as escritas que
mexem em dinheiro ou em cadastro que o cliente vê —
`PATCH /admin/settings`, `PATCH /admin/restaurant`,
`PATCH /admin/branches/{id}/settings`, `POST /admin/branches/{id}/payment-methods`,
`PATCH /admin/payment-methods/{id}` e `PUT /admin/cashback-rules`. As de
cardápio vêm depois: elas erram uma tela, não um valor cobrado.

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
