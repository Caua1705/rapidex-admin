# Admin Rapidex

O painel do lojista de `admin.pederapidex.com`. React 19 + Vite + TypeScript,
falando com uma API só (`api.pederapidex.com`) por um caminho só
(`src/api/client.ts`).

## As skills, e qual ler quando

Este arquivo é o mapa. **O conteúdo mora em `.claude/skills/`**, e cada skill
existe porque um defeito específico chegou à mão de um lojista.

| Skill                   | Leia ANTES de                                                     |
| ----------------------- | ----------------------------------------------------------------- |
| `proposta`              | a primeira linha de qualquer tela/seção/campo pedido em prosa     |
| `rapidex-api`           | escrever qualquer consumo de rota, e antes de mexer em `src/api/` |
| `rapidex-design-system` | criar ou alterar UI em `src/`                                     |
| `revisao`               | dar uma rodada por pronta                                         |
| `git`                   | qualquer `commit`, `push`, `checkout` ou criação de branch        |

**Se a rodada é "faça uma tela de X", comece pela `proposta`, não pelo editor.**

## Git

- NUNCA commitar ou dar push na `main` sem eu pedir explicitamente.
- Se a branch atual for `main`, PARE e me avise antes de qualquer alteração.
- Trabalhar sempre em `dev`, criando-a a partir da `main` se não existir.
- Ao terminar, me devolver o link do preview da Vercel da branch.

Preview fixo da `dev` (link permanente, não muda a cada push):

https://rapidex-admin-git-dev-cauas-projects-3c9f6aea.vercel.app

Ao terminar qualquer alteração na `dev`, devolver esse link.

## O portão

```bash
npm run format:check   # PRIMEIRO passo do CI — ver o aviso abaixo
npm run lint           # ESLint + tokens + contraste + hash da CSP
npm run typecheck
npm test
npx playwright test    # e2e, com a API inteira dublada em e2e/fake-api.ts
```

**Leia o código de saída, e leia-o SEM pipe.** `| tail` engole o `exit code` e
transforma vermelho em silêncio.

> **`format:check` é o PRIMEIRO `run` do job `verificar`**, e passo que falha
> derruba o job: `lint`, `typecheck`, `test` e `build` não chegam a rodar. Em
> 2026-09-02 ele estava vermelho em 41 arquivos e ninguém tinha reparado — um
> portão de mil casos atrás de uma porta fechada protege exatamente nada. Se
> você mexeu em algo, rode `npm run format` antes de commitar.

O CI (`.github/workflows/ci.yml`) dispara em **push para `main`** e em
**pull request**. Trabalho que vai direto para a `dev` sem PR **não é
verificado por ninguém até a hora do merge** — que é o pior momento para
descobrir.

## As duas gerações, e por que nada de contrato se escreve à mão

```bash
npm run api:generate     # src/api/generated/openapi.d.ts
npm run papeis:generate  # src/api/generated/papeis.ts
```

As duas leem o repositório do backend, nesta ordem: `RAPIDEX_OPENAPI` /
`RAPIDEX_BACKEND` → o checkout irmão `../pedeaqui_back` → o raw do GitHub.

- **`openapi.d.ts`** é o contrato. Nenhum tipo de request ou response é escrito
  à mão; `src/api/types.ts` só dá apelido. A skill `rapidex-api` conta os dois
  bugs que um arquivo de tipos "provisório" já custou.
- **`papeis.ts`** é o mapa de papel por rota, lido da auditoria do backend.
  Ele existe porque 200 virando 403 **não muda o `openapi.json`** — o painel
  desenharia botões que a pessoa não pode apertar.

Rode as duas **antes** de escrever a chamada, não depois. E **commite o diff de
contrato separado** da tela que o motivou.

## Três coisas que já custaram caro

1. **O cardápio é da FILIAL.** `listCategories`/`listProducts` exigem `branchId`
   na assinatura porque a leitura sem recorte devolve o cardápio de cada loja
   somado num só — 200, JSON válido, e a tela dobrada.
2. **`weekday` do backend é 0 = segunda**, `Date#getDay()` é 0 = domingo. A
   conversão tem um lugar só: `backendWeekday()`.
3. **`unit_price_snapshot` JÁ inclui os adicionais.** Somar
   `additional_price_snapshot` faz o painel discordar do que o cliente pagou.

## Onde ficam os documentos de rodada

`scratchpad/` é versionado e é a fonte da verdade de uma rodada longa: o que foi
feito, o que ficou bloqueado e por quê, e o que a próxima sessão precisa saber
para retomar sem depender de memória nenhuma. Ele passa pelo Prettier como o
resto do repositório.
