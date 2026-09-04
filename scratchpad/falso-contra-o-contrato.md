# O falso conferido contra o contrato — item (e.4) da auditoria

> Data: 2026-09-04, na `main`.
>
> O enunciado da rodada nomeou a causa antes de mim: **o falso foi corrigido à
> mão seis vezes nas últimas rodadas, e isso é o sintoma.** A causa é não haver
> ligação nenhuma entre `e2e/fake-api.ts` e `src/api/generated/openapi.d.ts`.

## O que existia — e a promessa que o cabeçalho fazia sem cumprir

`fake-api.ts` abria dizendo, palavra por palavra:

> os tipos vêm de `src/api/generated/openapi.d.ts`, então uma mudança de
> contrato no backend quebra este arquivo no `npm run typecheck`.

Era **meia verdade**, e a metade que faltava é o item (e.4) inteiro:

| O que havia                                                                          | O que ele conferia                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| apelidos à mão (`type Category = Schemas['AdminCategoryResponse']`)                  | que o SCHEMA existe. Não que ele seja o schema DAQUELA rota                |
| `json(route, status, body: unknown)`                                                 | **nada.** `unknown` aceita qualquer coisa                                  |
| 39 expressões regulares de caminho escritas à mão (`/^\/admin\/branches\/([^/]+)$/`) | nada — segunda fonte de verdade dos caminhos, a família do `print-sectors` |
| 24 formas de corpo de request escritas à mão (`as { minutes: number }`)              | nada — contrato à mão, que a skill `rapidex-api` §2 proíbe no `src/`       |

Dos 192 pontos em que o falso responde, **85 eram sucesso e cerca de 35 deles
eram literal de objeto solto**: nenhum campo conferido contra rota nenhuma.

## O que foi feito: `e2e/contrato.ts`

Uma peça só, com duas metades, e as duas importam:

- **de compilação** — `responder(route, metodo, rota, status, corpo)` tipa o
  corpo por `paths[rota][metodo]['responses'][status]`. A rota é
  `keyof paths`: um caminho que o backend renomeou **não compila**. Status que o
  contrato não declara vira `never` — a chamada não compila e quem escreve
  precisa dizer, em `recusar`, que aquele status sai do serviço e não do
  contrato.
- **de execução** — a rota e o método NOMEADOS são conferidos contra a
  requisição que chegou. Nomear a rota certa deixou de ser disciplina e virou
  condição para o teste passar.

As cinco portas, e cada nome diz o que ela abre mão de conferir:

| Função                    | Quando                                                       | O que confere             |
| ------------------------- | ------------------------------------------------------------ | ------------------------- |
| `responder`               | status declarado no contrato (2xx, e o 428 do cancelamento)  | corpo + rota + método     |
| `recusar`                 | 4xx/5xx que só existem no serviço (400, 403, 404, 409, 500)  | rota + método + **frase** |
| `recusarEmQualquerMetodo` | o 404 de "este id não existe", antes do ramo do método       | rota                      |
| `recusarSemRota`          | as três redes anteriores ao caminho (401, 403, não simulada) | nada, e diz isso no nome  |
| `semCorpo`                | os quatro 204                                                | rota + método             |

Mais duas que tiram contrato escrito à mão de circulação:

- **`casar(path, rota)`** substituiu as 39 expressões regulares e devolve os
  parâmetros **com o nome que o contrato lhes deu** (`{ branch_id }`, não `[1]`);
- **`corpoDe(route, metodo, rota)`** substituiu as 24 formas de request escritas
  à mão pelo `requestBody` do contrato.

**A conferência de FRASE do `recusar` é a que não vem do contrato e vale a
mesma coisa:** o corpo precisa ser um dos quatro formatos que
`src/api/errors.ts` sabe ler. Um formato inventado no falso faz o teste afirmar
uma frase que produção nunca manda — e esconde justamente o caso em que o
lojista lê o número HTTP no lugar da frase (o 428, que custou semanas).

## O que a amarra ACHOU — seis divergências que estavam verdes

Nenhuma destas quebrava teste. É esse o ponto.

| Onde                                              | O que o falso servia                         | O que o contrato diz                                                |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `POST /admin/couriers/{id}/access`                | **201**                                      | só **200**. O `unwrap` do painel aceita qualquer 2xx, e ninguém viu |
| `PUT .../delivery-time-bands`                     | espalhava o corpo recebido na linha guardada | `max_distance_km` entra `number \| string` e **sai `number`**       |
| `POST /admin/products`                            | espalhava o corpo, e `price` idem            | `price` entra `number \| string` e sai `number`                     |
| `POST /admin/products`                            | não gravava `unavailable_by_required_group`  | é **obrigatório** na resposta, e `required-groups.ts` o lê          |
| `PATCH .../printing-sector` (item e categoria)    | lia o campo como se sempre viesse            | é **opcional** no corpo, e ausente vale por `null` (= não imprimir) |
| `GET .../cashback-rules` e `POST .../assignments` | `source: string`, `error: string`            | são ENUM: três valores e cinco. Um sexto inventado passaria         |

As duas de dinheiro são a mesma família do item da skill `revisao` — "dinheiro
que atravessa como número quando o vizinho vai como string". Um teto de faixa
mandado como texto ficaria guardado como texto num campo que o contrato declara
numérico, e a tela ordenaria em ordem alfabética sem nada acender.

### E duas que a conferência de EXECUÇÃO pegou — minhas, na própria conversão

Valem mais que as seis de cima, porque provam que a metade de execução não é
enfeite:

1. **`print-settings`**: a leitura e a gravação terminam na MESMA resposta, e a
   conversão a marcou como `patch`. O primeiro GET da tela derrubou 22 testes
   com a frase exata: _"O falso respondeu /admin/branches/{branch_id}/print-settings
   como PATCH, e a requisição foi GET"_. Hoje o método sai do `method` do ramo.
2. **o 404 da filial em `cashback-rules`**: o comentário acima dele já dizia
   "vale para os três métodos", e a conversão o marcou como `get`. Virou
   `recusarEmQualquerMetodo`. Este **nenhum teste pegou** — foi uma varredura
   estática por resposta que nomeia um método cujo `if` já fechou.

## O que isto NÃO cobre — e é a parte que o enunciado merece por escrito

**As seis correções à mão das últimas rodadas não eram desta classe.** Elas
foram o falso ficando MAIS ESTRITO: as três unicidades do cardápio, o `slugFake`,
o 404 de `_get_branch`, o tamanho do nome da categoria, a frase exata dos dois
`reorder`. Nenhuma delas está no `/openapi.json` — índice único não vira schema,
`@model_validator` não vira schema, e o 409 que o serviço escreve à mão não
aparece em rota nenhuma (skill `rapidex-api` §4.8 e §4.10).

Ou seja: **esta rodada fecha a deriva de FORMA, não a de REGRA.** O que ela
muda para a deriva de regra é indireto e real: acrescentar rota ao falso passou
a exigir nomear (rota, método, status) do contrato, e é nesse momento que se
abre a classe do backend para ler os `Field(...)` e os `@model_validator`. O
resto continua sendo leitura do serviço, à mão, como a skill já mandava.

**O que fecharia a de regra**, para quem pegar isto depois: validar o corpo
RECEBIDO contra o schema em tempo de execução exigiria o `/openapi.json` (hoje
só o `.d.ts` é versionado) e um validador. Não foi feito nesta rodada, e não é
decisão minha.

## O preço e o desfecho

- `e2e/contrato.ts` (nova), `e2e/contrato.spec.ts` (nova, 8 casos),
  `e2e/fake-api.ts` (+755 −390).
- **Portão inteiro, sem pipe:** `format:check` 0, `lint` 0, `typecheck` 0,
  `test` 0 (1157 casos), `playwright test` 0 (**391 passaram**, 4 pulados) em
  execução isolada.
- Os 33 testes de cardápio, os 17 de papéis e todo o resto passaram **sem
  alteração nenhuma nos specs** — que é o sinal de que a amarra descreve o que
  o falso já fazia, e não uma regra nova inventada por ela.

### Os 8 casos de `contrato.spec.ts`, e por que eles existem

Eles não provam o caminho feliz: disso os 391 já cuidam. Eles provam que as
conferências **REPROVAM** — rota errada, método errado, corpo de erro que a tela
não sabe ler. Nenhuma delas dispara enquanto o falso está certo, e uma
conferência que nunca falhou é indistinguível de uma que não funciona. É a mesma
lição do `stream-ticket` da rodada passada: um teste que não pode falhar não é
cobertura.

## Para a próxima sessão

- **Acrescentar rota ao falso agora tem uma forma só:** `casar` para o caminho,
  `corpoDe` para o corpo que chega, `responder`/`recusar` para o que sai. Se o
  literal não compilar, a rota não existe com esse nome — pare e confira, não
  invente (skill `rapidex-api` §3).
- **Uma resposta compartilhada por dois métodos** (foi o caso do
  `print-settings`) sai do `method` do ramo, com um ternário. Não fixe um.
- Sobraram **21 `postDataJSON() as Record<string, unknown>`** de propósito: eles
  não afirmam forma nenhuma, e vários existem justamente para o teste conferir
  QUAIS campos o painel mandou (§4.9). Tipá-los apagaria essa informação.
- As três rotas de relatório fora das seis (`/admin/reports/couriers`) e o
  `multipart` da foto continuam com ramo próprio, e está escrito no arquivo por
  quê.
