# Rodada do painel — 2ª volta

> **Leia isto ANTES de qualquer coisa ao retomar, e continue do que ele diz —
> nunca da lembrança da sessão.** Ele é atualizado NO MESMO COMMIT do item que
> descreve. Os antecessores são `scratchpad/rodada-painel.md` (o estado da
> rodada anterior) e `scratchpad/auditoria.md` (a lista de defeitos que esta
> rodada consome).

Branch: `rodada/painel-2`, saída de `dev` em `75142ab`.
Início: 2026-09-02.

---

## 0. O ponto de partida, conferido e não presumido

- `rodada/painel` **já está mergeada na `dev`**: `75142ab`, `68c508d`,
  `6eb77c5`, `639cdbe`, `c3c4711` estão todos no histórico da `dev`. Não havia
  merge a fazer.
- `scratchpad/rodada-painel.md` e `scratchpad/auditoria.md` lidos inteiros,
  em especial a AUDITORIA (§f, as três primeiras) e o §9.4 (a intermitente).
- **Os cinco portões, lidos sem pipe, na árvore limpa antes de tocar em nada:**

| Portão                 | Resultado                          |
| ---------------------- | ---------------------------------- |
| `npm run format:check` | `exit 0`                           |
| `npm run lint`         | `exit 0` (190 pares de contraste)  |
| `npm run typecheck`    | `exit 0`                           |
| `npm test`             | `exit 0` — 63 arquivos, 948 testes |
| `npx playwright test`  | **VERMELHO: 1 falhou** (255/4/1)   |

**O portão de base NÃO estava verde**, e a falha não é a do §9.4:
`cozinha.spec.ts:195` (`pedido novo aceito chega sozinho pelo SSE`). Ela virou
o item 0 desta rodada — ver §2.0.

---

## 1. A ORDEM DESTA RODADA, e o porquê dela

A auditoria (§f) escolheu três, e ela **discorda** da lista da rodada anterior.
Esta rodada faz as três na ordem dela, e enfia duas coisas no meio pelo motivo
que está escrito em cada uma.

| #   | Item                                                      | Classe do enunciado | Estado            |
| --- | --------------------------------------------------------- | ------------------- | ----------------- |
| 0   | `cozinha.spec.ts:195` — o SSE, vermelho no portão de base | portão              | ✅                |
| 1   | `detail` objeto + o diálogo do 428 do cancelamento        | (a) e (b)           | ✅                |
| 2   | `ErrorBoundary` + `POST /admin/error-reports`             | (b) e (c)           | ✅                |
| 3   | §3 do enunciado — a varredura de teste dependente de hora | portão              | ✅                |
| 4   | §2 do enunciado — a intermitente de `loja.spec.ts:166`    | portão              | ⚠️ não reproduziu |
| 5   | D.3 — as duas ações destrutivas sem confirmação           | (b)                 | ✅                |
| 6   | Complementos deixarem de ser leitura (4 rotas paradas)    | (c)                 | ⬜                |

**Por que 3 e 4 entram antes de 5 e 6, e não no fim:** eles são o portão. Um
portão que muda de resposta conforme a hora não protege os itens 5 e 6 — ele os
acompanha mentindo. Fazer a varredura depois de escrever o código novo é
descobrir na hora do merge se o vermelho é do código ou do relógio.

**Por que 6 é o último:** a auditoria já disse (§f.3) que ele é o único de dias,
e não de horas. Ele é o mais valioso por funcionalidade e o mais caro; com o
portão confiável antes dele, o que ele quebrar é dele.

---

## 2. Andamento — atualizado a cada item

### 2.0 — `cozinha.spec.ts:195`: o falso dava o evento à conexão da tela ANTERIOR ✅

> Não estava no enunciado. Ela apareceu **na primeira leitura do portão de
> base**, antes de qualquer mudança minha, e item novo não se escreve com o
> portão vermelho embaixo.

**Vermelha vista antes, e não uma vez:** `--repeat-each=10` deu 1 falha em 90;
`--repeat-each=12` deu 2 em 108. A causa foi **provada com o falso
instrumentado**, não deduzida — as duas execuções vermelhas têm a mesma
assinatura, e as verdes têm a ordem inversa:

```
[vermelha]  bilhete#2 pedido; vivas=1        <- a Cozinha pediu o bilhete dela
            waitForStream saiu: vivas=1      <- e se satisfez com a conexão de /pedidos
            push ord-2001: log=0
            abre conexao#2 cursor=1          <- a da Cozinha só chegou DEPOIS do push
            fecha conexao#2 entregou=0       <- nasceu com o cursor adiante do evento

[verde]     abre conexao#2 cursor=0          <- ela chega ANTES
            waitForStream saiu: vivas=2
            push ord-2001: log=0
            fecha conexao#2 entregou=1
```

**A causa, em uma frase:** ao trocar de tela, a conexão SSE da tela anterior
continua pendurada no falso por até **15 segundos** depois de o navegador tê-la
fechado — o handler do Playwright não fica sabendo do `close()`. O antigo
`waitForStream` contava conexões, e `> 0` se satisfazia com esse cadáver.

**Por que só este teste pegava:** ele é o único que empurra um evento logo
depois de **trocar de tela** (`/pedidos` → `/cozinha`). Os outros três pontos de
empurrão tinham o mesmo defeito latente, sem a janela para acioná-lo.

**O conserto, e por que ele não é "esperar mais":**

1. **O bilhete virou geração.** Toda conexão SSE do painel é precedida por um
   `POST /stream-ticket`, e o bilhete viaja na query da conexão. O falso passou
   a numerá-lo, e `serveStream` lê a geração **da URL** — ler o contador dentro
   do handler seria supor a mesma ordem de chegada que criou o defeito.
2. **"Existe conexão" virou "existe conexão do bilhete mais recente."**
3. **O cadáver é ceifado:** conexão de geração superada sai do laço na hora, em
   vez de ocupar o lugar da viva por 15s.
4. **A espera mudou de dono.** Saiu do teste (`await api.waitForStream()`, uma
   linha que quem escreve o próximo teste precisa lembrar) e entrou no
   `pushNewOrder`, que virou assíncrono. `waitForStream` deixou de existir na
   API do falso. **A regra que só mora na cabeça de quem escreve o teste é a
   regra que o próximo esquece** — e era exatamente esse o defeito.

**Prova:** `cozinha.spec.ts --repeat-each=30` → **270 passaram, 0 falharam**
(antes: 1–2 falhas por 90–108). `caminho-critico.spec.ts --repeat-each=15` →
**360 passaram**. Suíte inteira: **256 passaram, 4 pulados, 0 falharam**.

Portão: `format:check 0` · `lint 0` · `typecheck 0` · `test 0` (63 arquivos, 948
testes) · `playwright` 256/4/0. Commit `e4b76c1`.

(vazio: nada feito ainda além da leitura e do portão de base)

---

### 2.1 — O 428 do cancelamento: o pedido em produção voltou a poder ser cancelado ✅

Item 1 da auditoria (§f.1 e §B.1). **A partir de "Iniciar preparo", o pedido não
podia mais ser cancelado pelo painel** — nem por dono, nem por gerente — e a
mensagem que o lojista lia era `A requisição falhou (428)`. Valia para
`preparing`, `ready` e `out_for_delivery`: a maior parte da vida de um pedido.

**Vermelho visto antes, nas três camadas:**

| Camada  | O que foi visto vermelho                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unidade | `readDetailMessage({detail:{...}})` → `expected null`; `buildApiError(428, …)` → `'A requisição falhou (428).'`                                                             |
| unidade | `cancel-confirmation.test.ts` inteiro, com o módulo ainda inexistente                                                                                                       |
| e2e     | `cancelar exige motivo e grava o que foi escrito` — o teste que JÁ EXISTIA, no #1003 que está em preparo, ficou vermelho no instante em que o falso passou a devolver o 428 |

A terceira linha é a que importa mais: **o e2e ficava verde contra um painel que
não conseguia cancelar.** Esse é o buraco estrutural que a auditoria nomeou —
o e2e fala com `fake-api.ts`, que é escrito por nós, e um falso que nunca
devolve 428 nunca acusa que o painel não sabe lê-lo.

**As quatro peças:**

1. **`readDetailMessage` aprendeu `detail` como OBJETO.** É a metade de uma
   linha da auditoria, e ela sozinha já troca o número HTTP pela frase em
   português que o backend manda pronta. Depois do ramo da lista de validação
   de propósito: aquela também é objeto para o `typeof`, e é o `Array.isArray`
   que impede um `detail` de validação mal formado de cair aqui.
2. **`orders/cancel-confirmation.ts`** — novo, puro, 7 casos. Ele confere o
   `code === 'confirmation_required'` em vez de presumir do 428: um 428 de
   outra precondição futura não é coisa que o lojista resolva clicando de novo.
   `order_status` ausente **não** invalida a confirmação — ele só escolhe a
   palavra do título, e recusar o 428 inteiro por falta de um texto deixaria o
   pedido sem poder ser cancelado, que é o defeito de origem.
3. **O desfecho deixou de ser booleano.** São três: `cancelado`,
   `precisa-confirmar`, `falhou`. O do meio **não vira `actionError`** — pintar
   de vermelho a barra do painel diria que algo quebrou, quando o que houve foi
   o backend fazendo uma pergunta.
4. **O diálogo ganhou um segundo passo, em vez de um segundo diálogo.** Três
   motivos, e todos estão escritos no arquivo: o motivo já foi escrito (um
   diálogo novo o descartaria ou o esconderia), no celular este diálogo é a
   tela inteira (dois modais = duas armadilhas de foco e dois "fechar"), e é a
   mesma pergunta ficando mais cara — não outro assunto.

**O texto do aviso é o do BACKEND**, e o painel escreve só o título. O backend
sabe o que o cancelamento custa e essa regra muda lá sem o painel ser
reimplantado; o que ele não tem como saber é a palavra da tela. `order_status`
serve exatamente a isso: a mensagem dele é a mesma para os três estados, e
**"já saiu para entrega"** muda a decisão — a comida não está só feita, está na
rua com o entregador.

**A outra metade da prova, e sem ela a primeira não vale:** um painel que
mostrasse o passo dois SEMPRE também passaria nos testes acima. Por isso há um
e2e do pedido em `accepted` cancelando **num clique só**, com
`cancelamentosRecusadosPorConfirmacao() === 0` — a segunda pergunta vem do
backend, e não de um `if` de status escrito na tela.

**Fora do conserto, uma coisa que estava marcada como pendente e não era:**
`updateOrderStatus` manda `confirm_prepared_order: false` fixo, e isso é
**definitivo**, não um pendente. Aquela rota aceita `status: 'cancelled'`, mas o
painel nunca cancela por ela — `exitActionFor` manda o cancelamento pela rota
própria. O único destino destrutivo que passa por lá é `rejected`, e recusar
pedido pendente nunca precisa de confirmação de comida feita. O comentário
passou a dizer isso.

Portão: `format:check 0` · `lint 0` · `typecheck 0` · `test 0` (**64 arquivos,
958 testes**, eram 63/948) · `playwright` **259 passaram**, 4 pulados, 0
falharam (eram 256).

---

### 2.2 — A borda de erro, e o relato que sai dela ✅

Item 2 da auditoria (§f.2 e §D.2). **Não existia `ErrorBoundary` em lugar nenhum
do `src/`.** Qualquer exceção de render dava tela branca: muda, sem
"recarregar", e sem nada chegando ao suporte. E **a tela branca não tinha teste
porque não tinha código** — é por isso que ninguém tinha reparado.

**Vermelho visto antes:** `erro/error-report.test.ts` com o módulo inexistente.
Para a borda em si o vermelho é o próprio estado anterior do repositório: sem
código não há teste a ficar vermelho, e o e2e novo (`e2e/erro.spec.ts`) prova o
depois contra um defeito que reproduz a forma exata do de produção.

**As sete peças:**

1. **`erro/error-report.ts`** — puro, 9 casos. Ele carrega **os três limites que
   o `/openapi.json` NÃO publica** (`description` 1–4000, `error_log` 20000,
   `screen` 200; todos são `string` seco no contrato). É a mesma situação de
   `cancel-reason.ts` e a mesma decisão. **O que importa de verdade é o
   `error_log`:** a pilha de componentes do React passa de 20.000 caracteres com
   facilidade, e um 422 ali seria erro de validação **na última porta que
   restava**, com a pessoa já tendo digitado o que aconteceu.
2. **O corte do log é na CAUDA.** A causa está na primeira linha e nos primeiros
   quadros; o fim é arcabouço do React, igual em todo erro. E a marca
   `[cortado]` fica no texto — sem ela, quem lê no suporte procuraria por horas
   uma linha que nunca chegou.
3. **`erro/ErrorBoundary.tsx`** — classe, porque `componentDidCatch` não tem
   equivalente em hook. Ela guarda **um sinalizador separado do erro**: com
   "capturou" deduzido de `error !== null`, um `throw null` (código de terceiro
   faz isso) faria a borda desenhar os filhos de novo no render seguinte — a
   tela branca de volta, agora piscando. Esse foi um defeito meu, pego e
   consertado antes do commit; tem teste.
4. **`erro/ErroDaTela.tsx` não lê NADA que possa estar quebrado.** Sem
   `useSession`, sem `useNavigate`, sem hook de dado. E as duas saídas são
   `window.location`, não o roteador: se o que quebrou foi o `BrowserRouter`, um
   `<Link>` seria um link morto na única tela que precisava funcionar.
5. **Ela é montada DUAS vezes, e são dois trabalhos.** Na raiz (`main.tsx`,
   dentro do tema) pega o roteador, a sessão e a moldura. Dentro do `AppShell`,
   em volta do conteúdo da rota, com **`key={pathname}`**: um defeito no
   Cardápio deixa a lateral e as outras oito seções de pé. Sem a chave, o React
   guarda o estado de erro e a próxima seção nasceria quebrada também.
6. **`POST /admin/error-reports`** — a rota estava pronta no backend e o painel
   nunca a chamava. O log e a tela vão **sozinhos**; a pessoa escreve só a
   história. Um relato que dependesse de alguém copiar o traceback de uma tela
   branca é um relato que nunca chega.
7. **O pior caso tem saída.** Envio falhando (rede caindo junto), a tela mostra
   o log em texto copiável para ir pelo WhatsApp. "Não deu para relatar o erro"
   numa tela de erro é onde a confiança acaba.

**O e2e quebra uma tela DE VERDADE**, e a forma da mentira é a do defeito real:
`GET /admin/orders` respondendo **200, JSON válido, `items: null`** — "um campo
que o backend passou a mandar null". Não é rede caída nem 500; o painel já trata
os dois com mensagem. É a resposta que passa por tudo e explode no render. Quatro
testes: a tela com saída, a lateral de pé, a borda não perseguindo a rota
seguinte, e o relato chegando com log e tela.

**Uma duplicação desfeita no caminho:** `navigator.clipboard` + o fallback de
`execCommand` viviam dentro de `OneTimeSecret`. O número do relato precisa da
mesma coisa e pelo mesmo motivo (painel aberto por IP na rede da loja não tem
`navigator.clipboard`), então os dois caminhos foram para `ds/copiar.ts`. Duas
implementações de área de transferência é como um dos dois botões deixa de
funcionar por IP sem ninguém notar.

**Uma premissa minha que estava errada, e o teste a pegou:** o primeiro e2e da
falha de envio usava `expireSession()`. O 401 derruba a sessão e devolve ao
login — que é o comportamento **certo**, e não chega à tela de erro. O caso que
importa é a conexão intermitente, e é ele que o teste usa agora.

Portão: `format:check 0` · `lint 0` · `typecheck 0` · `test 0` (**66 arquivos,
974 testes**, eram 64/958) · `playwright` **263 passaram**, 4 pulados, 0
falharam (eram 259).

---

### 2.3 — §3: a varredura do relógio, e os dois defeitos de PRODUTO que ela achou ✅

O enunciado chamou este item de o mais valioso da rodada, e ele foi — mas não
pelo motivo esperado. **A varredura atrás de teste dependente de hora achou dois
defeitos de produto que os testes estavam escondendo.**

#### A lista completa, por classe

**Classe 1 — teste que lê `new Date()` / `Date.now()` sem injeção**

`grep` por `new Date()` e `Date.now()` em `src/**/*.test.ts*`: **zero**. E isso
não bastava. O risco de verdade não é o teste escrever `Date.now()`; é o teste
**chamar uma função de produção que tem `now` com valor padrão** e não passar
nada — o `grep` vê uma chamada normal.

Escrevi uma varredura que **conta os argumentos de topo** de cada chamada
(respeitando parênteses, colchetes e literais) para 15 funções com `now`
injetável. **Quatro achados**, todos `groupIntoLanes` em `board-lanes.test.ts`.

Eles estavam **certos por acidente do fixture**: `groupIntoLanes` chama
`isPagamentoParado`, e os pedidos do teste têm `payment_status: 'on_delivery'`,
que não está em `PAGAMENTOS_QUE_PODEM_PARAR`. Trocar aquele `on_delivery` por
`pending` — uma linha, por um motivo qualquer — faria as quatro passarem a
comparar `Date.now()` com um `created_at` de 2026-08-07 escrito à mão.
Injetados. A varredura devolve **0** agora.

**Classe 2 — fuso. Aqui é onde estava tudo.**

🔴 **Nenhum dos dois portões fixava o fuso.** A máquina do desenvolvedor é
`America/Sao_Paulo` (UTC-3) e o runner do CI é `ubuntu-latest`, que é **UTC**.
Três horas de desacordo entre as duas metades do portão, sem nada fixando
nenhuma delas — e o painel inteiro conta o dia em `America/Fortaleza`.

Nada estava vermelho por causa disso, e **é exatamente esse o problema**: um
teste que muda de resposta conforme QUEM o roda não é portão, é dado.

Fixado nos dois: `process.env.TZ` em `vite.config.ts` (em `process.env` e não em
`test.env` porque `Date` e `Intl` leem o TZ ao nascer do processo) e
`timezoneId` em `playwright.config.ts`.

> **Uma nota de método:** meu primeiro experimento — rodar com `TZ=Asia/Tokyo`
> no shell — deu verde e eu quase o registrei como prova. Ele era **inválido**:
> uma sonda mostrou `ENVTZ= undefined` dentro do worker, ou seja, o `TZ` do Git
> Bash não chega ao processo do Vitest no Windows. A prova que vale foi apontar
> **o próprio pino** para UTC e rodar a suíte inteira.

🔴 **Com o pino em UTC — o fuso do CI — um teste ficou vermelho:**
`operation-state.test.ts` › "a frase leva o horário de volta". E ele estava
vermelho **pelo motivo certo**, porque escondia um defeito de produto:

> `notaDaPausa` formatava o fim da pausa com
> `toLocaleTimeString('pt-BR', { hour, minute })` — **sem `timeZone`**. Era o
> ÚNICO formatador de data do `src/` sem fuso declarado; todos os outros passam
> `OPERATION_TIMEZONE`.
>
> **Na loja:** o lojista pausa a entrega até as 20:30. Num aparelho com o fuso
> errado — o tablet de balcão em modo quiosque, o notebook trazido de outro
> estado — a linha dizia "Pausada até 23:30". Três horas de mentira sobre
> quando a entrega volta, no único estado do painel que se desfaz sozinho e
> cujo único sintoma é a ausência de pedido.
>
> O teste injetava o `agora` (certo) mas não o fuso, e na máquina de quem o
> escreveu o código errado produzia a string certa.

🔴 **E o pino ESCONDE essa classe.** Com o processo em UTC-3, o código errado
volta a produzir a string certa e nenhum teste acende. Um teste não alcança
isto — só uma regra que olhe o **código**. Daí `scripts/check-fuso.mjs`, ligado
ao `npm run lint` ao lado dos outros três. **Provado vermelho** com o defeito
reintroduzido e verde com o conserto, antes de ser ligado.

🔴 **Segundo defeito de produto, mesma família, achado pela mesma varredura:**
`usePrepRange` lia o dia da semana com `backendWeekday(new Date())` — o dia do
**aparelho**. Painel num fuso errado lê a linha de horário do dia errado e
mostra o prazo de preparo de terça numa segunda. É a armadilha nº 2 do
`CLAUDE.md` com uma volta a mais: lá o perigo era `0 = segunda` contra
`0 = domingo`; aqui é **qual** dia, antes ainda de numerá-lo. Nasceu
`weekdayDaOperacao()`, com três casos — um deles no instante que separa os dois
donos de "hoje" (2h UTC de segunda ainda é domingo à noite na loja).

🟠 **Duas leituras de relógio no falso que o `timezoneId` NÃO alcança.** Os
handlers de `page.route` rodam no **Node** do Playwright, e o `timezoneId` vale
para o navegador. `reportDays` e o dia da semana do PATCH de prep-time contavam
"hoje" em UTC enquanto o painel contava em Fortaleza. Nenhum quebrava hoje — o
limiar de `reportDays` é de dois dias e o falso injeta o mesmo prazo nas sete
linhas —, mas as duas margens são **folga, não projeto**: some assim que alguém
der a um dia um prazo diferente. Os dois passaram a contar pelo `OPERATION_DAY`.

**Classe 3 — virada de dia**

| Teste                                         | Veredito                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `caminho-critico` · pagamento parado          | já consertado em `6eb77c5` (o de 00:00–01:30)                                                                                                    |
| `cozinha.spec.ts:85` · "1h30"                 | **não** depende do dia: a Cozinha filtra por STATUS, sem recorte de data. A margem de 30s é de tempo decorrido, e é documentada no próprio teste |
| `fake-api` · cancelamentos de três dias atrás | já contava por `OPERATION_DAY`                                                                                                                   |

**Classe 4 — espera por tempo em vez de condição**

**Uma ocorrência no repositório inteiro**, e ela fica: `capturas.spec.ts:57`,
`waitForTimeout(350)` antes de tirar a foto. É o único uso legítimo — não há
condição a esperar, só a pintura assentando —, e o arquivo é **pulado no portão**
(`test.skip(!LIGADO)`, só roda com `CAPTURAS=1`). Uma foto 350ms adiantada sai
um pouco diferente; nenhuma asserção depende dela.

E o **quinto** portão ganhou uma classe inteira a menos nesta rodada: a espera
do SSE saiu do teste e virou estrutura no `pushNewOrder` (§2.0).

Portão: `format:check 0` · `lint 0` (**agora com `check-fuso`**) · `typecheck 0`
· `test 0` (**67 arquivos, 978 testes**) · `playwright` **263 passaram**, 4
pulados, 0 falharam.

---

### 2.4 — §2: a intermitente do §9.4 — NÃO REPRODUZIU ⚠️

`loja.spec.ts:166` (`o interruptor do cabeçalho vale nas outras seções`). O §9.4
a viu falhar **1 em 4** execuções da suíte inteira, sem a mensagem na mão.

**O que rodei, com os artefatos preservados:**

| Execução                         | Resultado                            |
| -------------------------------- | ------------------------------------ |
| `loja.spec.ts --repeat-each=20`  | **620 passaram, 0 falharam** (7 min) |
| suíte inteira × 4, sob 4 workers | 263 · 263 · **262+1** · 263          |

A falha da 3ª rodada **não é ela**: foi `loja.spec.ts:476` (formas de pagamento),
e foi **minha** — a árvore já tinha a confirmação de exclusão do §2.5 e o teste
ainda não. Reproduzida isolada e verde depois do teste atualizado. Fica
registrado porque é o tipo de coincidência que vira conclusão errada: um vermelho
no arquivo certo, na hora certa, e que não tem nada a ver.

**Hipótese de por que ela sumiu, e ela NÃO é prova.** O §2.0 mudou o falso do
SSE: antes, cada conexão de tela anterior ficava pendurada num handler do
`page.route` por **até 15 segundos** depois de o navegador tê-la fechado.
`abrirLoja` navega três vezes por teste, e `loja.spec.ts` tem dezenas de testes
sob 4 workers — muitos handlers pendurados ao mesmo tempo. Agora eles são
**ceifados no bilhete seguinte**. Isso alivia a pressão de rotas pendentes, que é
o tipo de coisa de que uma intermitente sob carga se alimenta.

**Mas eu não a vi vermelha, então não afirmo que consertei.**

**Quarentena? Não — e é decisão, não omissão.** Quarentena tira um teste do
portão, e este guarda uma regra viva (o interruptor do cabeçalho opera a filial
exibida, e some em Operação). Tirá-lo com base em **zero** falhas observadas
nesta rodada trocaria um risco hipotético por um buraco real de cobertura. **Não
aumentei timeout**, como o enunciado mandou.

**Para quem retomar:** ela fica como intermitente CONHECIDA e NÃO REPRODUZIDA. Se
voltar, o caminho é a suíte inteira em laço com `--trace=on` — não o arquivo
isolado, que 620 execuções já mostraram ser insuficiente.

---

### 2.5 — D.3: as duas ações destrutivas que não perguntavam nada ✅

**Vermelho visto antes**, e nos dois:

- `loja.spec.ts:476` quebrou no instante em que a confirmação entrou — o teste
  antigo clicava em "Excluir" e esperava a linha sumir. É a prova de que o clique
  apagava direto.
- `cashback.spec.ts:99` idem.

**Nasceu `ui/ConfirmDialog`**, e os dois diálogos do pedido **não** o usam de
propósito: eles não perguntam, eles **colhem** — o motivo é o dado que faltaria
depois, e um campo com validação própria não cabe num "tem certeza?". Aqui não há
dado a colher; falta só o segundo de pausa entre o dedo e a consequência.

Três regras que ele carrega:

1. **`children` é obrigatório.** Um diálogo que só diz "Tem certeza?" vira o
   gesto de dois cliques que a pessoa aprende a fazer sem ler — custa um clique e
   não previne nada. O que faz a confirmação valer é a frase que diz **o que vai
   acontecer** e **o que fazer em vez disso**.
2. **O botão diz o VERBO, nunca "Confirmar".** "Confirmar" ao lado de "Cancelar"
   é a pior dupla possível em português, porque "Cancelar" tanto pode ser fechar
   o diálogo quanto cancelar a coisa. A saída se chama pelo que **preserva**:
   "Manter a forma", "Manter a regra própria".
3. **O erro fica dentro e o diálogo não fecha com ele** — mesma regra do
   cancelamento do pedido.

**Loja › Pagamento.** O corpo **aponta a chave** em vez de só avisar, e é o ponto:
a dois controles de distância, na mesma linha, existe um interruptor que faz a
versão REVERSÍVEL da mesma coisa. Na maior parte das vezes em que alguém aperta
"Excluir", o que queria era parar de oferecer aquela forma hoje.

**Cashback.** O rótulo sempre foi honesto ("Voltar a herdar a regra da rede") — e
era isso que escondia o problema: **frase gentil não é aviso de que não há
volta.** O corpo diz o que some (percentual, teto, dias, formas que geram) e o
que passa a valer.

**Uma casa trocada, e ela não é arrumação:** as classes `.saida*` moravam em
`OrderDetailPanel.css`, e o comentário de lá dizia o certo para a época — a folha
da coluna é a que sempre está carregada quando os diálogos do pedido podem
existir. Deixou de ser verdade: `ConfirmDialog` as usa em Loja e em Cashback,
telas que não carregam aquela coluna. **Estilo que só funciona porque OUTRA tela
por acaso está no mesmo pacote é o defeito esperando o dia em que alguém dividir
o bundle.** Foram para `Modal.css`, carregada sempre que qualquer um dos três
pode existir.

Portão: `format:check 0` · `lint 0` · `typecheck 0` · `test 0` (67 arquivos, 978
testes) · `playwright` **264 passaram**, 4 pulados, 0 falharam.

---

### 2.6 — Os complementos deixaram de ser leitura ✅

Item 3 da auditoria (§f.3, §A.1, §C.2) — o maior dela, e o único que ela mediu
em **dias** e não em horas.

**O que existia:** o `ProductDialog` LISTAVA os grupos e deixava ligar/desligar
uma opção que já existia. Não criava grupo, não criava opção, não mudava
`is_required`, `min_select`, `max_select` nem o preço de um adicional. A seção
terminava com a frase "nome, preço e ordem dos complementos têm rotas próprias e
não são editados aqui". **As quatro rotas estavam prontas no backend desde
antes.**

Montar uma pizza com "Escolha o tamanho" (obrigatório, 1 de 1) e "Adicionais"
(opcional, até 3) era um chamado para o suporte — e é o cardápio de qualquer
pizzaria, hamburgueria ou açaí. O cardápio muda toda semana; a filial abre uma
vez por ano.

#### O buraco que a auditoria não tinha visto

**O falso não servia NENHUMA das quatro — nem a de ligar/desligar opção, que o
painel já chamava.** `GET /admin/products/{id}` devolvia `option_groups: []`
sempre. Ou seja: o interruptor de opção, o aviso de "item fora de venda" e o
diálogo de confirmação **existiam no código e nunca tinham sido exercitados por
teste de ponta a ponta** — o dublê nunca os alimentou. É a mesma família do 428
do §2.1: um falso que não tem o caso nunca acusa que a tela não o trata.

#### As decisões, e a razão de cada uma

**1. As regras cruzadas moram num módulo puro, e são escritas à mão.** Elas
**não existem no `/openapi.json`**: o contrato publica `min_select` e
`max_select` como inteiros soltos, e a validação está num `model_validator` do
Pydantic, que não vira schema. São duas:

- `max_select >= min_select`;
- `is_required` exige `min_select >= 1` — o backend explica por quê: obrigatório
  com mínimo zero faria o **pedido** ser recusado na criação, sem o cardápio
  conseguir dizer o que falta escolher.

**2. Ligar "obrigatório" SOBE o mínimo para 1 sozinho.** Não é a tela
adivinhando: é ela escrevendo a consequência que o backend impõe **no momento em
que a decisão é tomada**, em vez de recusar o formulário no clique de salvar com
o campo culpado três linhas acima. Quem preenche não pensa em `min_select` —
pensa em "o cliente TEM de escolher um tamanho". Desligar **não** desce de
volta: o lojista pode querer "opcional, mas se escolher, escolhe pelo menos 2", e
desfazer o número dele seria a tela apagando decisão que não é dela.

**3. O PATCH leva o formulário INTEIRO.** O backend valida o **resultado da
mescla** com o banco: um corpo que mandasse só `is_required: true` num grupo de
`min_select: 0` voltaria 422 por causa de um campo que a tela nem mostrou.
Mandando os sete, o que o painel validou é exatamente o que o backend vai
validar — e some a classe "campo que sumiu do corpo do PATCH". O falso guarda o
corpo porque **olhando só o grupo resultante, "mandou tudo" e "mandou só o que
mudou" são indistinguíveis.**

**4. A seção saiu do `ProductDialog`.** O diálogo tem UM "Salvar" e ele grava o
PRODUTO; os complementos gravam sozinhos, no clique de cada formulário. O
comentário original já dizia isso e estava certo — o que mudou é que a seção
ficou grande demais para morar num arquivo que já cuida de nome, preço,
categoria, setor e foto.

**5. Os formulários abrem EM LINHA, não em diálogo.** No celular o
`ProductDialog` é a tela inteira; um segundo modal por cima empilharia duas
armadilhas de foco e dois "fechar" com efeitos diferentes. Em linha é o padrão
que Loja › Pagamento já usa (`NewMethodForm`).

**6. A confirmação de "isto tira o item de venda" virou EM LINHA também.** Antes
ela **trocava o conteúdo do `ProductDialog` inteiro** — decisão boa, e pelo mesmo
motivo. Com a seção fora do diálogo aquele truque saiu do alcance, e um `<Modal>`
aninhado seria exatamente o que a versão anterior evitou. Em linha resolve melhor
que os dois: ela nasce **onde o dedo estava**, com o grupo e a opção à vista.

**7. O preço do adicional atravessa como NÚMERO.** O contrato aceita
`number | string` na entrada e devolve `number`; quem decide é o vizinho, e o
`price` do produto vai como número no mesmo módulo. Dois formatos de dinheiro no
mesmo cardápio é como um dos dois começa a chegar errado.

**8. A opção nova entra no FIM do grupo.** Sem passar a posição, toda opção
nasceria com `sort_order: 0` e "Pequena, Média, Grande" viraria a ordem em que
alguém as digitou em dias diferentes.

#### Uma honestidade sobre o papel

`GET` dos grupos é `PESSOAS` e as três escritas são `GERÊNCIA`, então a seção
esconde os controles quando `podeEditar` é falso — com teste de componente.
**Mas hoje o atendente não chega até lá:** abrir o diálogo do item exige
`cardapio.editarProduto`, que também é `GERÊNCIA`. Os dois conjuntos são o mesmo.

A guarda fica — ela está ligada ao mapa **gerado** (`papeis.ts`), então responde
certo no dia em que uma das rotas mudar de papel. O que **não** se fez foi
fingir e2e disso: um teste que loga como atendente e nunca acha o botão de
editar passaria por 30 segundos de timeout, provando o oposto do nome dele. Ele
foi escrito, viu-se que não podia rodar, e virou um comentário no arquivo
dizendo por quê.

#### O que ficou de fora, e é decisão

- **Apagar grupo ou opção:** não existe `DELETE` no backend (auditoria C.1).
  Desativar é o caminho, e o formulário o oferece com o nome certo.
- **Reordenar grupos/opções por arrasto:** `sort_order` é gravado, mas não há
  rota de `reorder` como a de categorias. Reordenar hoje seria um PATCH por
  linha, e o cardápio tem o padrão de arrasto em outro lugar — frente própria.
- **Editar uma opção existente** (nome, preço): `PATCH /admin/options/{id}`
  aceita, e o painel só liga/desliga. Ficou de fora por tamanho, não por
  impedimento — **é a próxima coisa natural deste arquivo**, e está anotada no
  §5.

Portão: `format:check 0` · `lint 0` · `typecheck 0` · `test 0` (**69 arquivos,
1007 testes**, eram 67/978) · `playwright` **270 passaram**, 4 pulados, 0
falharam (eram 264).

---

---

### 2.7 — A passagem da `revisao` sobre a rodada inteira ✅

Os onze itens da skill, lidos contra os sete commits.

**Item 9 — a varredura de rota parada.** O número mudou:

| Quando           | Rotas `/admin` chamadas |
| ---------------- | ----------------------- |
| Auditoria (§a)   | **73 de 82**            |
| Fim desta rodada | **79 de 82**            |

As três que sobram são **exatamente os falsos positivos conhecidos**:
`GET /admin/orders/stream` (é `EventSource`, não passa pelo `openapi-fetch`) e
os dois `print-agent` (é a MÁQUINA falando, não o painel). **Zero lacunas, zero
rotas inventadas.** As seis que entraram: as quatro de complemento,
`POST /admin/error-reports` e `GET /admin/products/{id}/option-groups`.

**Item 6 — dinheiro, e uma observação que fica anotada em vez de virar mudança
silenciosa.** `additional_price` atravessa como **número**, e a skill manda
perguntar "como é que o campo ao lado está indo?". O vizinho é o `price` do
produto, que também vai como número, e o contrato tipa os dois como
`number | string`. **Estão consistentes, e é isso que a regra pede.**

O que fica escrito: se a forma de número for um dia errada para dinheiro aqui,
ela é errada para os DOIS — e trocar só o novo criaria a divergência que a regra
existe para impedir. É rodada própria, com o e2e do preço do produto junto.

**Item 5 — alvo de 44px.** Os controles novos usam `.btn`/`.btn--sm` e `.input`,
que o sistema já estica no toque (`--tap-mobile`, `--field-h-touch`). O único
que precisou de ajuste foi meu: `.field--curto` estava em `7ch`, e com os 24px
de `padding-inline` do `.input` sobravam ~25px de texto — "10" encostava nas
bordas. Passou a `9ch`.

**Itens 1, 2, 3, 4, 7, 8, 10:** conferidos, sem achado. O item 2 (campo que some
do PATCH) é o assunto do §2.6 e está resolvido pela raiz (o formulário inteiro);
o 8 é o §2.1; o 11 é o §2.3.

---

## 3. Bloqueado por backend

Herdado de `rodada-painel.md` §6 e de `auditoria.md` C.1 — **nada novo entrou
nesta rodada**, e nada saiu.

| Frente                             | O que falta do backend                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| **WhatsApp**                       | zero rotas. Sem `GET .../whatsapp` (o espelho de `print-agent`), nenhuma tela. Ver §6.1 anterior |
| **Integrações**                    | zero rotas administráveis. `GET /admin/integrations` e `GET/PATCH /admin/payment-gateway`        |
| **Criar filial**                   | não existe `POST /admin/branches`                                                                |
| **Apagar categoria/produto/setor** | não existe `DELETE` em nenhuma das três                                                          |
| **Logo do restaurante**            | `logo_path` existe no banco, mas só a vitrine pública o serve                                    |
| **Nota fiscal**                    | não existe nem tabela                                                                            |
| **Reordenar complemento**          | **NOVO NA LISTA:** `sort_order` é gravado, mas não há rota de `reorder` como a de categorias     |

O último é o único acréscimo, e ele é pequeno: hoje reordenar grupo ou opção
seria um PATCH por linha, contra o padrão de arrasto que o cardápio já tem.

---

## 4. Onde parei

**Tudo o que esta rodada se propôs está feito**, e os cinco portões estão verdes
lidos sem pipe. Sete commits, um por item, todos com push.

| #   | Item                                                       | Commit    |
| --- | ---------------------------------------------------------- | --------- |
| 0   | o falso dava o evento do SSE à conexão da tela anterior    | `e4b76c1` |
| 1   | o 428 do cancelamento, e o `detail` objeto                 | `39bbd19` |
| 2   | a borda de erro e o relato                                 | `defde3b` |
| 3   | o fuso do portão, e os dois defeitos de produto atrás dele | `8c85416` |
| 4/5 | a intermitente (não reproduziu) + as duas confirmações     | `50f7e27` |
| 6   | os complementos deixaram de ser leitura                    | `650ec31` |
| 7   | a revisão, e as skills com as armadilhas novas             | (este)    |

### Se esta sessão for retomada

Leia este arquivo, `auditoria.md` e `rodada-painel.md` antes de qualquer coisa.
O que continua de pé, em ordem de valor:

1. **Editar uma opção existente** (nome e preço). `PATCH /admin/options/{id}`
   aceita, e o painel só liga/desliga. É a continuação natural do §2.6 e a
   coisa mais barata que sobrou.
2. **`useOrderStream`: conexão aberta que parou de entregar** (auditoria D.5).
   Um relógio de "sem evento há N minutos" fecharia o único buraco de tempo real
   que sobrou.
3. **Teste de componente para as telas grandes** (auditoria "o que passaria
   despercebido" §2). Eram 91 `.tsx` para 8 testes de tela; hoje são 11, e as
   telas grandes (`OrdersPage`, `MenuPage`, `UsersPage`) continuam sem.
4. **O fake conferido contra o contrato** (auditoria §4). O falso agora é
   tipado nas rotas novas (`Schemas['AdminOptionGroupCreate']` etc.), o que é um
   começo — mas as antigas continuam com objeto literal.
5. **A intermitente do §9.4**, se ela voltar: suíte inteira em laço com
   `--trace=on`, não o arquivo isolado.
