# Auditoria do painel — 2026-09-02

Item 6 da rodada. **Leitura, sem conserto.** Nada aqui virou commit de código;
o que estiver errado continua errado de propósito, para ser priorizado por
quem manda.

Método: o `openapi.json` do backend (checkout irmão `../pedeaqui_back`, commit
`2f19afa`) cruzado com as chamadas reais de `src/api/*.ts`, mais leitura do
`src/` inteiro. Os números foram medidos, não estimados — e **todo achado que
saiu de uma contagem de `grep` foi conferido no arquivo antes de virar item
desta lista**. Dois não sobreviveram à conferência e estão marcados como tal
(ver D.4 e a linha riscada em C.1): eles ficam no documento de propósito, porque
uma auditoria que só mostra o que confirmou não deixa ninguém calibrar o quanto
confiar no resto dela.

**O tamanho do que foi lido:** 39.264 linhas de `src/` (fora testes e
contrato), 12.142 de contrato gerado, 10.806 de teste unitário, 10.879 de e2e.
104 caminhos no backend, 82 pares (método, rota) em `/admin`.

---

## a) O que o backend oferece e o painel não usa

**73 dos 82 pares `/admin` são chamados.** Sobram nove, e só **quatro** são
lacuna de verdade — as outras cinco não são para o painel:

| Rota                                           | Situação                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/orders/stream`                     | ✅ usada, por `EventSource` em `useOrderStream.ts` (não passa pelo `openapi-fetch`, por isso não aparece na varredura) |
| `POST /admin/print-agent/heartbeat`            | ✅ correto não usar — é a MÁQUINA falando, não o painel                                                                |
| `POST /admin/print-agent/printers`             | ✅ idem                                                                                                                |
| `GET /admin/orders/{id}/print-jobs`            | **fechada nesta rodada** (`c9b80df`)                                                                                   |
| `GET /admin/products/{id}/option-groups`       | ⛔ **LACUNA**                                                                                                          |
| `POST /admin/products/{id}/option-groups`      | ⛔ **LACUNA**                                                                                                          |
| `PATCH /admin/option-groups/{group_id}`        | ⛔ **LACUNA**                                                                                                          |
| `POST /admin/option-groups/{group_id}/options` | ⛔ **LACUNA**                                                                                                          |
| `POST /admin/error-reports`                    | ⛔ **LACUNA**                                                                                                          |

### A.1 — Os complementos são SÓ LEITURA no painel (4 rotas paradas)

É a maior de todas, e ela é maior do que "faltam quatro rotas".

O `ProductDialog` LISTA os grupos de complemento e deixa **ligar e desligar uma
opção que já existe** (`PATCH /admin/options/{option_id}`). Ele não cria grupo,
não cria opção, não muda `is_required`, `min_select` nem `max_select`, e não
muda o preço de um adicional. O próprio arquivo diz isso em comentário, como
decisão de escopo — mas o backend entregou as quatro rotas e ninguém voltou.

**A consequência operacional:** montar uma pizza com "Escolha o tamanho"
(obrigatório, 1 de 1) e "Adicionais" (opcional, 0 de 5) é hoje um chamado para
o suporte. E não é um caso raro: é o cardápio de qualquer pizzaria,
hamburgueria ou açaí — os três formatos que mais entram numa plataforma dessas.

**Quanto tempo parada:** as rotas de grupo já estavam no contrato quando
`required-groups.ts` foi escrito (ele lê `unavailable_by_required_group`, do
mesmo lote). Ordem de grandeza: semanas, como a de impressão.

### A.2 — `POST /admin/error-reports`, e o painel sem rede de segurança

A rota existe para o lojista relatar o que aconteceu: história, log que a tela
capturou, qual tela, e opcionalmente o nº do pedido. Ela mascara credencial que
apareça no texto e apaga tudo em 90 dias. Está pronta e **o painel não a
chama**.

Ela cruza com um achado do item (d): **não existe `ErrorBoundary` em lugar
nenhum do `src/`** (varredura por `ErrorBoundary|componentDidCatch`: zero
ocorrências). Uma exceção de render num sábado à noite dá **tela branca**, sem
mensagem, sem "recarregar", e sem nada chegando ao suporte. As duas coisas são
a mesma frente: quem constrói a borda de erro é quem tem para onde mandar o
relato.

---

## b) O que o painel pede e o backend não tem

**Nenhuma rota inventada.** O cruzamento não achou um único caminho chamado
pelo painel que não exista no contrato — o que faz sentido: `paths` é um tipo
gerado, e um caminho errado não compila. Aqui o compilador está fazendo o
trabalho dele.

Campo inexistente também não: `src/api/types.ts` só dá apelido para
`Schemas[...]`, e a varredura por `as ` forçando forma não achou nenhum caso em
resposta de API.

**Mas há um erro que o painel LÊ ERRADO, e ele é o achado mais grave da
auditoria:**

### B.1 — 🔴 Cancelar pedido em produção NÃO FUNCIONA, e a mensagem é um número

`PATCH /admin/orders/{order_id}/cancel` a partir de `preparing` exige
`confirm_prepared_order: true`. Sem ele responde **428**, e o contrato diz com
todas as letras que **isso não é erro**: _"o painel abre o diálogo de
confirmação e reenvia"_.

O painel manda `confirm_prepared_order: false` **fixo** (`src/api/orders.ts:146`)
e **não tem o segundo diálogo**. O comentário do arquivo já registra a pendência
com honestidade. Mas há uma segunda camada que o comentário não previu:

O corpo do 428 é `{ detail: { code, message, order_status } }` — `detail` é um
**objeto**. `readDetailMessage` (`src/api/errors.ts`) só sabe ler `detail` como
_string_ ou como _lista de validação do Pydantic_. Objeto cai fora, e o painel
usa o texto genérico de `fallbackMessageFor(428)`:

> **"A requisição falhou (428)."**

Ou seja: o backend preparou um `message` "pronta para ser mostrada no diálogo
de confirmação do painel", e o lojista recebe um número HTTP.

**O que isso é na vida real:** a partir do momento em que alguém aperta "Iniciar
preparo", **o pedido não pode mais ser cancelado pelo painel**. Nem por dono,
nem por gerente. Cliente ligou desistindo às 20h10, a comida está na chapa, e a
única saída é ligar para o suporte. Isso vale para os estados `preparing`,
`ready` e `out_for_delivery` — que é a maior parte da vida de um pedido.

São dois consertos, e o segundo é de uma linha:

1. o diálogo "a comida já foi feita — cancelar mesmo assim?" que reenvia com
   `true`, usando `order_status` para dizer se é "já está em preparo" ou "já
   saiu para entrega";
2. `readDetailMessage` passar a ler `detail.message` quando `detail` for objeto.
   Isso sozinho já troca "A requisição falhou (428)" pela frase em português que
   o backend mandou.

### B.2 — Erros que nunca disparam

- `fallbackMessageFor(404)` = "Não encontrado." Nenhuma rota `/admin` que o
  painel chama devolve 404 num caminho normal — ela é fallback de fallback. Não
  é defeito, é código morto barato.
- `PrintTestResponse.agent_is_online` é lido e usado (bom): o painel avisa
  quando o teste foi enfileirado para uma máquina desligada.

---

## c) O que só dá para fazer com SQL na mão

Cada uma destas é um chamado para o dono do produto. Separadas pelo motivo, que
muda o conserto:

### C.1 — Falta rota no backend (o painel não tem o que chamar)

| O que                                  | Por quê                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Criar uma filial**                   | Não existe `POST /admin/branches`. Só `GET` da lista e `GET/PATCH` de uma. Abrir a segunda loja é um `INSERT` na mão.                                                                                                                                                                |
| **Apagar categoria**                   | Não existe `DELETE /admin/categories/{id}`. Categoria criada errada fica na barra para sempre.                                                                                                                                                                                       |
| **Apagar produto**                     | Não existe `DELETE /admin/products/{id}`. Dá para desativar — mas o item errado continua na lista do lojista, todo dia.                                                                                                                                                              |
| **Apagar setor de impressão**          | Não existe `DELETE /admin/printing-sectors/{id}`.                                                                                                                                                                                                                                    |
| ~~Desligar um usuário~~                | **NÃO é lacuna** — conferido: `AdminUserUpdate` tem `is_active`, e `UsersPage.tsx:236` já mostra "Desativar / Reativar". Fica registrado porque `DELETE` de fato não existe, e a ausência dele aqui é a decisão certa: apagar a linha levaria junto o histórico de quem mudou o quê. |
| **Apagar cupom**                       | Não existe `DELETE`. É decisão declarada (desligar é o `PATCH`), não lacuna.                                                                                                                                                                                                         |
| **Credencial do gateway de pagamento** | Não há rota `/admin` nenhuma. É linha de banco. Ver `rodada-painel.md` §6.2.                                                                                                                                                                                                         |
| **Logo do restaurante**                | `logo_path` existe no banco e `logo_url` é servido, mas **só na API pública da vitrine**. O painel não tem por onde subir nem por onde ver.                                                                                                                                          |
| **Nota fiscal**                        | Não existe nem tabela. É frente inteira.                                                                                                                                                                                                                                             |

### C.2 — A rota EXISTE e o painel não usa (conserto é só de tela)

| O que                                         | Rota parada                                    |
| --------------------------------------------- | ---------------------------------------------- |
| **Criar grupo de complemento**                | `POST /admin/products/{id}/option-groups`      |
| **Editar grupo** (obrigatório, min/max, nome) | `PATCH /admin/option-groups/{group_id}`        |
| **Criar uma opção dentro do grupo**           | `POST /admin/option-groups/{group_id}/options` |

Estas três são as mais caras da lista inteira, porque são as mais frequentes: o
cardápio muda toda semana, a filial abre uma vez por ano.

---

## d) O que quebra com dono de restaurante real

Não técnico, no celular, com pressa, no meio do movimento.

### D.1 — 🔴 Não dá para cancelar um pedido em produção

Ver B.1. É o pior da lista pela combinação: acontece no pico, é irreversível
pelo outro lado (o cliente já desistiu), e a mensagem que aparece é um número.

### D.2 — 🔴 Tela branca sem rede de segurança

Zero `ErrorBoundary` no `src/`. Qualquer exceção de render — um campo novo que
o backend passou a mandar `null`, um `.map` em `undefined` — apaga a tela
inteira. No sábado, no celular, sem nada escrito e sem nada chegando ao
suporte. E a rota de relato (`POST /admin/error-reports`) está pronta e parada.

### D.3 — 🟠 Duas ações destrutivas sem confirmação

O item 2.1 da rodada mandou pôr diálogo em "Recusar pedido", e ele está lá. As
duas abaixo passaram batido e são da mesma família:

| Onde                          | O quê                                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PaymentMethodsTab.tsx:78,95` | `onRemove={(method) => void payment.remove(method.id)}` — **DELETE direto no clique**. Apagar "Pix" da filial derruba a forma de pagamento da vitrine na hora, e desfazer é recadastrar. Contagem de `confirm                                                  | Modal | dialog` no arquivo inteiro: **0**. |
| `CashbackPage.tsx:160`        | `onClick={() => void regra.apagarSobrescrita()}` → `deleteBranchCashbackRule` (`useCashbackRule.ts:132`) — **DELETE direto**. O rótulo ("Voltar a herdar a regra da rede") é honesto sobre o efeito; o clique é que não tem volta. Contagem no arquivo: **0**. |

**O detalhe que faz do primeiro o pior dos dois:** na mesma linha, a dois
controles de distância, existe um `Switch` que faz a versão REVERSÍVEL da mesma
coisa — "desativar" a forma de pagamento. Um interruptor que se desfaz e um
"Excluir" que não se desfaz, lado a lado, na mesma linha de uma lista, num
painel operado com o polegar. É exatamente o desenho que o item 2.1 desta rodada
mandou desfazer no pedido ("o botão fica do lado do aceitar") — e ele continua
inteiro em Loja › Pagamento.

### D.4 — ✅ Estado de carregamento: NÃO é problema (e a primeira medição minha estava errada)

Fica escrito porque o enunciado pediu "o que não tem estado de carregamento", e
porque o caminho até a resposta certa é a lição:

**A primeira varredura foi por `isLoading|Carregando|Spinner` e acusou cinco
páginas com zero.** Conferindo uma a uma, as cinco estavam certas:

- `LoginPage` tem `submitting` e escreve **"Entrando…"** com o botão
  desabilitado (`LoginPage.tsx:88-90`) — o grep é que não conhecia o nome da
  variável;
- `ChangePasswordPage`, idem;
- `StoreIndexPage` e `StoreSectionPage` **não carregam nada**: são o roteador
  das seções, e quem lê da API é cada aba;
- `ComingSoonPage` não tem o que carregar.

Refeita a medição com os nomes que o repositório de fato usa
(`isSending|isSaving|submitting|Salvando|Enviando|disabled=`), **as onze abas de
Loja e os dez diálogos têm todos algum estado de envio ou de carregamento.** O
mínimo é `TemporaryPasswordDialog` (1), e é o certo: ele não chama nada, só
mostra a senha uma vez.

**A lição, e ela vale para o resto deste documento:** contar ocorrência de
palavra é bom para ACHAR onde olhar e péssimo para CONCLUIR. Um "0" aqui teria
mandado consertar uma tela que não está quebrada — que custa mais caro que a
auditoria toda.

### D.5 — 🟡 O tempo real pode parar em silêncio

`useOrderStream.ts` é a peça mais bem-feita do painel nesse aspecto: ticket de
30s, reconexão própria com espera crescente, `online`/`offline` do navegador, e
recarga da lista inteira a cada reabertura (porque o cursor se perde). O
indicador de conexão aparece na barra.

O buraco que sobra: **conexão ABERTA que parou de entregar**. Proxy que
bufferiza, rede de operadora que segura o socket — o `onerror` nunca dispara, o
status continua `live`, e o quadro para de receber pedido sem que nada acuse.
Um relógio de "sem evento há N minutos" fecharia isso. É o menos provável dos
cinco e o mais difícil de descobrir quando acontece.

### D.6 — 🟡 A ausência do dado não se distingue da falha

`useCustomerHistory` engole o erro de propósito, e a decisão está bem
argumentada (é dado de apoio). Mas o padrão está se espalhando: vale conferir
caso a caso que "não apareceu" nunca significa "falhou" numa informação que o
lojista use para decidir.

### D.7 — ✅ O que está BOM, e não deve ser mexido

Para a lista não parecer que só há defeito:

- **A hierarquia dos botões do pedido.** Um avanço, uma saída, o rótulo em
  verbo. É o melhor trabalho do painel e resolveu três defeitos de uma vez.
- **O mapa de papéis GERADO do backend.** Ele não pode envelhecer sozinho, e
  isso é raro. As duas exceções (preço no corpo, filial na query) estão
  nomeadas em vez de silenciosas.
- **A recusa do `print_agent` no login**, inclusive derrubando quem já estava
  dentro de antes da frente.
- **`PUT` de horários e `reorder` de categorias mandando a lista completa.**
  São as duas rotas que apagam o que não vier no corpo, e as duas têm função
  própria (`weekPayload`, `categoryIdsForReorder`) para não deixar escolha.

---

## e) O estado do portão

### 🔴 E.0 — O portão estava FECHADO, e ninguém tinha reparado

O achado mais desconfortável desta seção, porque ele invalida em parte tudo o
que ela mede.

`npm run format:check` é o **primeiro** `run` do job `verificar` no
`.github/workflows/ci.yml`. Ele estava **vermelho em 41 arquivos** no head da
`dev`. Passo que falha derruba o job e os seguintes **não rodam** — ou seja,
`lint`, `typecheck`, `test` e `build` **não estavam sendo executados pelo CI**.

Não é deriva de versão: o `prettier` está travado em **3.9.6** no
`package-lock.json` há vários commits (conferido em cinco commits do lock, todos
3.9.6). São 41 arquivos que entraram sem passar pelo `npm run format` — a maior
parte estourando o `printWidth: 100` em assinatura de função e em literal de
texto longo.

**Este foi consertado** (`2f1be6d`), à parte da auditoria, porque não é achado de
produto: é o portão, e o enunciado desta rodada manda entregar item verde. A
mudança é só a saída do próprio Prettier — nenhuma linha de comportamento.

**O que ele ensina, e vale mais que o conserto:** os 948 testes e os 251 de e2e
desta seção são reais e passam **na máquina de quem roda**. O que não estava
acontecendo era ninguém rodá-los automaticamente. Um portão de 1.199 casos atrás
de um passo de formatação quebrado protege exatamente nada.

**Duas coisas a decidir, e nenhuma é minha:**

1. O CI só dispara em `push` para `main` e em `pull_request`. Se o trabalho vai
   direto para a `dev` sem PR, **nada roda até a hora do merge na `main`** — que
   é o pior momento possível para descobrir. Acrescentar `dev` à lista de `push`
   custa uma linha.
2. `format:check` como PRIMEIRO passo é o que transforma um espaço em branco no
   coveiro de todo o resto. Ele deveria ser o ÚLTIMO, ou rodar em job próprio,
   em paralelo.

### Os números

| Camada                           | Arquivos | Casos   |
| -------------------------------- | -------- | ------- |
| Unitário de LÓGICA (`.test.ts`)  | 55       | ~880    |
| Unitário de TELA (`.test.tsx`)   | 8        | ~68     |
| **Total `npm test`**             | **63**   | **948** |
| E2E Playwright (`e2e/*.spec.ts`) | 15       | **251** |

Mais três verificações que não são teste e pegam coisa que teste não pega:
`check-design-tokens.mjs` (cor/corpo/raio/mono soltos), `check-contrast.mjs`
(**190 pares medidos nos dois temas**, WCAG 2.2 AA) e `check-csp-hash.mjs`.

O CI roda `format:check`, `lint`, `typecheck`, `test`, `build` e o e2e completo,
com a API inteira interceptada por `e2e/fake-api.ts` — por isso ele fica verde
com o backend fora do ar. Isso é bom para velocidade e é a origem de um dos
buracos abaixo.

### O que eles cobrem de verdade

**Muito bem:** a lógica pura. 55 arquivos de `.test.ts` cobrindo dia da semana,
preço com adicional, faixas de prazo, segmento de cliente, quadrantes de
produto, chave de catálogo, papéis. É a metade do painel onde o erro é
silencioso, e é justamente a que está protegida. `insights.test.ts` sozinho tem
51 casos.

**Bem:** os caminhos de tela, pelo e2e. 251 testes, incluindo `papeis.spec.ts`
(17) — que é a prova de que esconder por papel funciona de ponta a ponta.

### O que passaria despercebido HOJE

1. 🔴 **O 428 do cancelamento.** É o buraco mais caro, e ele é
   ESTRUTURAL: o e2e fala com `fake-api.ts`, que é escrito por nós. Um fake que
   nunca devolve 428 nunca acusa que o painel não sabe lê-lo. **Nenhum teste,
   de nenhuma camada, exercita um corpo de erro cujo `detail` é objeto** —
   `errors.test.ts` tem 7 casos e cobre string, lista e `error.message`.

2. 🔴 **91 arquivos `.tsx` e 8 testes de tela.** As telas que NÃO têm teste de
   componente incluem `LoginPage`, `OrdersPage`, `MenuPage`, `UsersPage`,
   `CouponsPage`, `PerformancePage`, as onze abas de Loja e os dez diálogos.
   O e2e cobre o caminho feliz de várias delas; o que ninguém cobre é o
   comportamento de borda — resposta vazia, erro no meio do formulário, papel
   sem permissão dentro da tela.

3. 🟠 **Nenhum teste de acessibilidade automatizado.** Contraste tem script
   próprio (190 pares), o resto não: foco preso em diálogo, rótulo de campo,
   `aria-live` em mudança de estado. Há `use-focus-trap.ts`, e nada que prove
   que ele está ligado em todos os dez diálogos.

4. 🟠 **O fake do e2e não é conferido contra o contrato.** `e2e/fake-api.ts`
   tem 10.879 linhas junto com o resto do `e2e/`; se o backend renomear um
   campo, o `openapi.d.ts` muda, o typecheck acende no `src/` — mas o fake
   continua devolvendo o nome velho e o e2e continua verde contra uma API que
   não existe mais. É o mesmo defeito do `contract-pending.ts` que a skill
   proibiu, com outra roupa.

5. 🟡 **Nada mede performance.** O quadro de pedidos com 300 linhas numa
   quinta-feira de pico não é exercitado por teste nenhum.

6. 🟡 **A tela branca não tem teste porque não tem código.** Sem
   `ErrorBoundary`, não há o que testar — e é por isso que ninguém reparou.

---

## f) As três coisas que eu faria primeiro

Se fosse meu, nesta ordem — e ela **discorda** da lista da rodada, que pedia
WhatsApp e Integrações. As duas estão bloqueadas por falta de backend, e nenhuma
delas é sobre um pedido que está na chapa agora.

> **A zero, que já foi feita:** destravar o CI (E.0). Ela não entra na contagem
> porque não é escolha — com o portão fechado, nenhuma das três abaixo pode ser
> feita com confiança. Falta a decisão de fazer o CI rodar na `dev` também, que
> é uma linha e não é minha.

### 1. Ler `detail` como objeto, e o diálogo do cancelamento em produção

**Por quê:** é o único item da auditoria em que o painel **não faz** uma coisa
que o lojista precisa fazer no meio do turno, e a mensagem que ele recebe é
"A requisição falhou (428)". Todo o resto da lista é "falta uma tela" ou "é mais
arriscado do que devia"; este é "não dá".

**Por que primeiro:** metade do conserto é uma linha em `readDetailMessage`, e
essa metade sozinha já troca o número pela frase em português que o backend
mandou pronta. A outra metade é um diálogo que já tem dois irmãos no mesmo
arquivo (`CancelOrderDialog`, `RejectOrderDialog`) para copiar a forma.

**Custo:** baixo. **Risco de não fazer:** o suporte é você, e o telefone toca no
sábado.

### 2. `ErrorBoundary` + `POST /admin/error-reports`

**Por quê:** hoje qualquer exceção de render é uma tela branca, muda, sem nada
chegando a ninguém. E a rota que existe para consertar isso está parada desde
que entrou no contrato.

**Por que segundo:** ele é a única mudança da lista que **melhora todos os
achados futuros ao mesmo tempo**. Sem borda de erro, cada defeito novo se
manifesta como "sumiu tudo" e chega ao suporte como "o sistema quebrou"; com
ela, chega como um número de relato com o log da tela dentro. É a diferença
entre depurar por telefone e depurar por registro.

**Custo:** baixo (um componente de classe, um `catch`, um POST).

### 3. Os complementos deixarem de ser leitura

**Por quê:** é a maior lacuna de funcionalidade do painel e a que mais gera
chamado recorrente. Quatro rotas prontas e paradas, e o que elas destravam —
"Escolha o tamanho", "Ponto da carne", "Adicionais" — é o cardápio de qualquer
pizzaria, hamburgueria ou açaí. É a diferença entre o lojista montar o cardápio
sozinho e o cardápio ser um serviço que você presta.

**Por que terceiro e não primeiro:** é o maior dos três em trabalho (é um
formulário aninhado, com validação de `min_select`/`max_select` contra o número
de opções ativas, e ele mexe no que `required-groups.ts` já vigia), e nenhum
pedido está parado hoje por causa dele. Os dois de cima são de horas; este é de
dias.

**A quarta, que eu faria junto se desse:** confirmação nas duas ações
destrutivas de D.3. São dois diálogos e o painel já tem o padrão pronto.

---

## O que ficou de fora desta auditoria, e por quê

- **A revisão de design tela a tela.** Existe skill inteira para isso
  (`rapidex-design-system`, 47KB) e três scripts de verificação no `lint`. Uma
  segunda opinião minha aqui seria ruído sobre um sistema que já tem juiz.
- **O backend.** Fora da rodada por escrito (§7 do enunciado). Tudo que este
  documento diz sobre ele é leitura do `openapi.json`, nunca proposta de
  alteração.
- **Pedido Pix nunca pago em "Novos".** Decisão de produto não tomada, fora da
  rodada por escrito. (Nota: `3bf8de4` e `b90874c` já mexeram na região; o pé de
  "Novos" existe.)
