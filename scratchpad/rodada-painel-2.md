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

| Portão                | Resultado                          |
| --------------------- | ---------------------------------- |
| `npm run format:check` | `exit 0`                          |
| `npm run lint`         | `exit 0` (190 pares de contraste)  |
| `npm run typecheck`    | `exit 0`                           |
| `npm test`             | `exit 0` — 63 arquivos, 948 testes |
| `npx playwright test`  | (rodando; anotado abaixo)          |

---

## 1. A ORDEM DESTA RODADA, e o porquê dela

A auditoria (§f) escolheu três, e ela **discorda** da lista da rodada anterior.
Esta rodada faz as três na ordem dela, e enfia duas coisas no meio pelo motivo
que está escrito em cada uma.

| #   | Item                                                     | Classe do enunciado | Estado |
| --- | -------------------------------------------------------- | ------------------- | ------ |
| 1   | `detail` objeto + o diálogo do 428 do cancelamento       | (a) e (b)           | ⬜     |
| 2   | `ErrorBoundary` + `POST /admin/error-reports`            | (b) e (c)           | ⬜     |
| 3   | §3 do enunciado — a varredura de teste dependente de hora | portão             | ⬜     |
| 4   | §2 do enunciado — a intermitente de `loja.spec.ts:166`   | portão              | ⬜     |
| 5   | D.3 — as duas ações destrutivas sem confirmação          | (b)                 | ⬜     |
| 6   | Complementos deixarem de ser leitura (4 rotas paradas)   | (c)                 | ⬜     |

**Por que 3 e 4 entram antes de 5 e 6, e não no fim:** eles são o portão. Um
portão que muda de resposta conforme a hora não protege os itens 5 e 6 — ele os
acompanha mentindo. Fazer a varredura depois de escrever o código novo é
descobrir na hora do merge se o vermelho é do código ou do relógio.

**Por que 6 é o último:** a auditoria já disse (§f.3) que ele é o único de dias,
e não de horas. Ele é o mais valioso por funcionalidade e o mais caro; com o
portão confiável antes dele, o que ele quebrar é dele.

---

## 2. Andamento — atualizado a cada item

(vazio: nada feito ainda além da leitura e do portão de base)

---

## 3. Bloqueado por backend

Herdado de `rodada-painel.md` §6 e de `auditoria.md` C.1 — nada novo até aqui.

---

## 4. Onde parei

Início da rodada. Portão de base verde nas quatro primeiras linhas; a quinta
(e2e) estava rodando quando este arquivo foi criado.
