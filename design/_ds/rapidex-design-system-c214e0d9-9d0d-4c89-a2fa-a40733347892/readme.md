# Export legado arquivado

Este diretório é um export estático produzido antes da implementação atual do
Admin Rapidex. Ele permanece no repositório apenas como histórico de exploração
e **não é fonte de verdade, pacote de componentes nem dependência da aplicação**.

O manifesto, os tokens, os cards HTML e o UI kit deste bundle descrevem uma
direção descartada (Manrope, IBM Plex Mono, board em kanban e valores antigos).
Não importe arquivos desta pasta e não use `_ds_manifest.json` para orientar
mudanças no produto.

A fonte de verdade vigente é:

- `.claude/skills/rapidex-design-system/SKILL.md` para decisões e regras;
- `src/styles/tokens.css` para valores visuais;
- `src/styles/primitives.css` e `src/ds/` para componentes;
- `src/layout/` e os estilos das páginas para comportamento responsivo real.

O sistema implementado usa Inter Variable, sidebar 232px/rail 72px/barra móvel,
quadro de Pedidos por faixas sem scroll horizontal global e temas claro/escuro
por tokens semânticos. Consulte a skill vigente para a especificação completa.
