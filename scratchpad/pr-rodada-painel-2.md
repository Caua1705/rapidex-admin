# PR: `rodada/painel-2` → `dev`

> Este arquivo é o corpo do PR, pronto para colar. Ele existe porque o `gh` não
> está instalado nesta máquina e não há token no ambiente — a abertura do PR é
> um clique manual, e o corpo não precisa ser reescrito por causa disso.
>
> **Link:** https://github.com/Caua1705/rapidex-admin/compare/dev...rodada/painel-2?expand=1
>
> **Base: `dev`. NÃO `main`.** O seletor de base do GitHub vem em `main` por
> padrão — é preciso trocar antes de criar.

---

## O que esta rodada faz

Dez commits, um por item, cada um verde nos cinco portões antes de entrar.

### O portão estava vermelho, e a rodada não sabia

O primeiro item não estava no enunciado: **`cozinha.spec.ts:195` falhava 1 em
10** antes de qualquer mudança. A causa foi provada com o falso instrumentado —
ao trocar de tela, a conexão SSE anterior fica pendurada por até 15s e a espera
do teste se satisfazia com esse cadáver. A espera saiu do teste e virou estrutura
no `pushNewOrder`.

### Três defeitos que chegavam à mão do lojista

1. **Cancelar pedido em produção não funcionava.** A partir de "Iniciar preparo",
   o 428 do backend caía como "A requisição falhou (428)" — `readDetailMessage`
   não sabia ler `detail` como objeto, e o segundo diálogo não existia. Nem dono
   nem gerente conseguiam cancelar.
2. **Tela branca sem rede de segurança.** Não havia `ErrorBoundary` em lugar
   nenhum. Agora há duas (raiz e conteúdo da rota), e o relato vai para
   `POST /admin/error-reports` — rota pronta que o painel nunca tinha chamado.
3. **Dois `DELETE` que aconteciam no clique**, sem perguntar nada: excluir forma
   de pagamento e apagar a regra de cashback da filial.

### Dois defeitos de fuso, achados pela varredura do portão

- `notaDaPausa` formatava a hora **sem `timeZone`**: "Pausada até 23:30" quando
  eram 20:30, num aparelho mal configurado.
- `usePrepRange` lia o dia da semana **do aparelho**, mostrando o prazo de preparo
  do dia errado.

Os dois passavam na máquina do desenvolvedor (UTC-3) e falhavam em UTC — **que é
o fuso deste runner**. Daí o pino de fuso nos dois configs, as duas guardas que
o prendem, e `scripts/check-fuso.mjs` no `lint`.

### Os complementos deixaram de ser leitura

Quatro rotas prontas e paradas. Montar "Escolha o tamanho" e "Adicionais" era um
chamado para o suporte — o cardápio de qualquer pizzaria.

---

## O que conferir na revisão

- **`e2e/fake-api.ts` cresceu bastante**, e de propósito: ele não tinha o 428 do
  cancelamento nem os grupos de complemento, e por isso o e2e ficava verde sobre
  telas que não funcionavam.
- **Rotas `/admin` chamadas: 79 de 82** (eram 73). As três que sobram são os
  falsos positivos conhecidos (o `EventSource` do stream e os dois do agente de
  impressão).
- **`npm run lint` ganhou um quarto script** (`check-fuso.mjs`).
- **O fuso do processo passou a ser fixado** em `vite.config.ts`. Se algum teste
  quebrar só aqui, é sinal de que ele dependia do fuso da máquina.

## Portão, lido sem pipe

| Passo                  | Resultado                               |
| ---------------------- | --------------------------------------- |
| `npm run format:check` | 0                                       |
| `npm run lint`         | 0                                       |
| `npm run typecheck`    | 0                                       |
| `npm test`             | 0 — **69 arquivos, 1009 testes**        |
| `npx playwright test`  | **271 passaram**, 4 pulados, 0 falharam |

Base de comparação: a rodada começou em 63 arquivos / 948 testes, com o e2e em
255 passando e **1 falhando**.

O detalhamento item a item está em `scratchpad/rodada-painel-2.md`.
