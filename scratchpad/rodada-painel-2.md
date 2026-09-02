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

| #   | Item                                                      | Classe do enunciado | Estado |
| --- | --------------------------------------------------------- | ------------------- | ------ |
| 0   | `cozinha.spec.ts:195` — o SSE, vermelho no portão de base | portão              | ✅     |
| 1   | `detail` objeto + o diálogo do 428 do cancelamento        | (a) e (b)           | ✅     |
| 2   | `ErrorBoundary` + `POST /admin/error-reports`             | (b) e (c)           | ✅     |
| 3   | §3 do enunciado — a varredura de teste dependente de hora | portão              | ⬜     |
| 4   | §2 do enunciado — a intermitente de `loja.spec.ts:166`    | portão              | ⬜     |
| 5   | D.3 — as duas ações destrutivas sem confirmação           | (b)                 | ⬜     |
| 6   | Complementos deixarem de ser leitura (4 rotas paradas)    | (c)                 | ⬜     |

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
testes) · `playwright` 256/4/0. Commit `aad060a`.

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

## 3. Bloqueado por backend

Herdado de `rodada-painel.md` §6 e de `auditoria.md` C.1 — nada novo até aqui.

---

## 4. Onde parei

Início da rodada. Portão de base verde nas quatro primeiras linhas; a quinta
(e2e) estava rodando quando este arquivo foi criado.
