---
name: git
description: Regras de branch e commit no Rapidex — commitar e empurrar direto na `main`, sem branch nem PR, e devolver o link do deploy da Vercel ao terminar. Leia ANTES de qualquer `git commit`, `git push`, `git checkout`, criação de branch ou abertura de PR.
---

## Git

- Commitar e empurrar direto na `main`. É a branch de trabalho do painel — não
  abrir branch nem PR para mudança normal.
- Ao terminar, me devolver o link do deploy da Vercel.

O CI (`.github/workflows/ci.yml`) roda a cada push na `main`: typecheck, lint,
testes e e2e. Push com o verde quebrado é o que esta regra tem de mais caro —
não há branch intermediária para segurar nada.

> Até 2026-08-28 a regra era o contrário: trabalhar sempre em `dev` e nunca
> empurrar na `main` sem pedido explícito. Se você encontrar `dev` em algum
> lugar (um checkout antigo, um comentário), é resíduo — a `main` é a branch.
