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
| 1   | `detail` objeto + o diálogo do 428 do cancelamento        | (a) e (b)           | ⬜     |
| 2   | `ErrorBoundary` + `POST /admin/error-reports`             | (b) e (c)           | ⬜     |
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

## 3. Bloqueado por backend

Herdado de `rodada-painel.md` §6 e de `auditoria.md` C.1 — nada novo até aqui.

---

## 4. Onde parei

Início da rodada. Portão de base verde nas quatro primeiras linhas; a quinta
(e2e) estava rodando quando este arquivo foi criado.
