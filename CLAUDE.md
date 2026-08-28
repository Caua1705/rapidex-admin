## Git

- Commitar e empurrar direto na `main`. É a branch de trabalho do painel — não
  abrir branch nem PR para mudança normal.
- Ao terminar, me devolver o link do deploy da Vercel.

O CI (`.github/workflows/ci.yml`) roda a cada push na `main`: typecheck, lint,
testes e e2e. Push com o verde quebrado é o que esta regra tem de mais caro —
não há branch intermediária para segurar nada.
