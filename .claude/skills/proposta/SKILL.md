---
name: proposta
description: Como uma rodada de trabalho começa no Rapidex — levantar o que JÁ existe, propor por escrito, dizer o que fica de fora e por quê, e PARAR antes de escrever código. Leia ANTES da primeira linha de qualquer tela, seção, campo, relatório ou refatoração pedida em prosa ("faz uma tela de…", "adiciona…", "resolve o problema de…"). Não se aplica a conserto pontual já diagnosticado, nem a pedido que já vem com a decisão tomada.
---

# A proposta antes do código

Este painel é escrito em rodadas. Uma rodada não começa no editor: começa num
texto curto que diz **o que já existe**, **o que eu faria** e **o que eu não
faria** — e para ali, esperando resposta.

Isto não é cerimônia. É consequência de uma coisa que já aconteceu aqui várias
vezes: metade do trabalho de uma tela é decidir o que ela NÃO é, e essa decisão
é do lojista, não de quem digita. Escrever primeiro e perguntar depois
transforma uma pergunta de trinta segundos numa varredura de trezentas linhas.

## Quando este documento vale

| Pedido                                                | Propõe antes? |
| ----------------------------------------------------- | ------------- |
| "faz a tela de X"                                     | **sim**       |
| "adiciona o campo Y em Z"                             | **sim**       |
| "resolve o problema de W" (sem dizer como)            | **sim**       |
| "esse botão está com 28px, sobe para 44"              | não           |
| "o `weekday` está errado, passa por `backendWeekday`" | não           |

A pergunta que separa as duas colunas: **existe mais de uma forma defensável de
atender o pedido?** Se existe, o pedido é uma pergunta e a resposta é a
proposta. Se não existe, é uma tarefa e se faz.

Na dúvida, propor custa um parágrafo. Não propor custa a rodada.

---

# As quatro partes

## 1. O QUE EXISTE — e isto vem antes de qualquer ideia

Levantar não é "dar uma olhada". É responder, com arquivo e linha na mão:

- **A rota existe?** `npm run api:generate`, depois procurar no `openapi.d.ts`.
  Ver a skill `rapidex-api` §1 e §3 — e se a rota **não** existir, a proposta
  acaba aqui: ela vira um pedido para o backend, e o resto da rodada é o que dá
  para entregar sem ela.
- **A tela já faz isso em outro lugar?** Antes de desenhar componente, procurar
  em `src/ds/`, `src/ui/` e `src/styles/`. A skill `rapidex-design-system` tem a
  lista do que não se duplica.
- **A regra já está escrita?** Duas expressões da mesma regra divergem no dia em
  que uma delas mudar. Foi o caso de `required-groups.ts`: a tela deduzia em
  TypeScript um estado que o backend já respondia em
  `unavailable_by_required_group`, e a rodada `c0116c2` fechou isso — o arquivo
  ficou existindo só para a pergunta que nenhuma rota responde ("e se eu
  desativar esta opção?").
- **Quem pode apertar?** `auth/permissions.ts`. Um botão proposto sem papel é um
  botão que alguém vai ver e tomar 403.

O levantamento é o que faz a proposta valer alguma coisa. Uma proposta que
começa em "eu faria assim" é um palpite; uma que começa em "hoje isto está
assim, e a rota que falta é essa" é uma decisão informada.

## 2. O QUE EU FARIA — e por quê, não só o quê

A proposta descreve a forma E o motivo. O motivo é a parte que se discute; a
forma sozinha só dá para aceitar ou recusar.

Quando há mais de um caminho defensável, **nomeie os dois e escolha um**. Uma
lista de opções sem recomendação devolve o trabalho para quem pediu.

Duas rodadas que mostram o formato:

- **`68e3a8b` (o funil)** — a proposta era "tela própria, não seção dentro de
  Desempenho", e veio com quatro razões, cada uma bastando sozinha: a permissão
  é outra, o período é outro (evento de funil vence em 90 dias, pedido não), os
  dois `orders_count` não fecham de propósito, e hoje ela nasce sem dado. A
  quarta razão é a que virou a parte mais importante da tela — o estado vazio.
- **`b65748f` (entrega)** — três coisas do backend, e a proposta foi sobre ONDE
  cada uma mora: frete grátis em Valores e Geral, pausa em Operação, faixas de
  prazo em Entrega, cada uma no regime que já era o dela. "Misturar dois regimes
  na mesma tela é o jeito mais barato de fazer alguém preencher o campo errado."

Quando a escolha é visual e não cabe em texto, a proposta pode ser código
**descartável**: `8fdc83f` construiu três direções para Pedidos em
`/prototipo/pedidos/{a,b,c}`, com dados de exemplo, sem tocar na tela real, nos
tokens nem em nada compartilhado — e a exceção de lint saiu junto com a pasta
quando a direção foi escolhida. Isso continua sendo proposta, não
implementação: o que a distingue é que nada dela sobrevive à decisão.

## 3. O QUE FICA DE FORA — e esta é a parte que costuma faltar

Uma proposta sem essa lista promete a rodada inteira, e a rodada inteira nunca
cabe. Cada item de fora vem com o motivo, e os motivos legítimos são poucos:

| Motivo                 | Exemplo                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **A rota não existe**  | não se inventa caminho — `rapidex-api` §3                                                                                              |
| **É decisão sua**      | não se decide por você o que você deixou pendente de propósito                                                                         |
| **É outro regime**     | as faixas de prazo saíram da barra de salvar da aba: `PUT` que substitui tudo, com outra permissão (`b65748f`)                          |
| **É outra rodada**     | `3e7ad94` fechou o celular e deixou escrito: "fora do escopo, como combinado: o balão do gráfico de Desempenho e a Cozinha no telefone" |
| **Não tem como saber** | dado que ninguém mede ainda — desenhar o zero afirmaria uma coisa que não se sabe (`68e3a8b`)                                           |

O que NÃO é motivo: "dá trabalho", "fica para depois" sem dizer depois de quê,
e "achei que não era importante". Se algo do pedido sai da rodada, quem decide
é você — o meu trabalho é dizer que está saindo.

## 4. PARAR

A proposta termina e o editor não abre. Nada de "já fui adiantando o arquivo
X". Um arquivo adiantado é uma decisão tomada por antecipação, e ela vira
argumento para manter o caminho que a resposta talvez fosse mudar.

**Duas exceções, e só duas:**

- **Leitura.** Ler o repositório, o contrato e o backend é o item 1; isso não é
  escrever.
- **Protótipo descartável**, quando a escolha é visual e a proposta pede olho em
  vez de texto (`8fdc83f`). Ele nasce isolado, com dados de exemplo, e some com
  a decisão.

---

# O formato

Curto. A proposta é para ser lida no meio do dia, não estudada.

```
O QUE EXISTE
  <o que já está no repositório, no contrato, na tela — com nome de arquivo>
  <a rota existe? qual? o que ela aceita no corpo?>

O QUE EU FARIA
  1. <a coisa> — <por quê, e o que isso descarta>
  2. <a coisa> — <por quê>

O QUE FICA DE FORA
  · <item> — <motivo, da tabela acima>
  · <item> — <motivo>

PERGUNTA
  <a decisão que é sua, quando houver — uma, não cinco>
```

Quando o pedido tem itens independentes, a proposta se organiza por item, e
cada um pode ser aceito sozinho. Rodada de quatro itens em que o terceiro é
recusado não deve perder os outros três.

## A pergunta é uma, e é a que só você responde

Devolver cinco perguntas é devolver o trabalho. Decisão de forma, de nome, de
ordem e de detalhe são minhas — eu escolho e digo o que escolhi. O que sobe
para você é o que depende de saber como a loja funciona, do que você já decidiu
em outro lugar, ou do que custa dinheiro.

---

# O que a proposta vira

A rodada aceita termina num commit cujo corpo é a proposta CUMPRIDA: o que
existia, o que foi feito, por quê, e o que ficou de fora. Os corpos de
`c0116c2`, `b65748f`, `68e3a8b` e `3e7ad94` são todos assim, e é por isso que
eles servem de fonte meses depois — um `git log` que só diz "feat: tela de X"
obriga a reler o diff para saber o que foi decidido.

Se ao escrever o commit você não consegue dizer por que uma coisa está assim, a
proposta pulou uma parte.

---

# Antes de mandar a proposta

- [ ] Rodei `npm run api:generate` e confirmei cada rota que a proposta usa?
- [ ] Procurei em `src/ds/`, `src/ui/` e `src/styles/` antes de propor
      componente novo?
- [ ] Conferi se a regra que vou escrever já está escrita — no backend ou em
      outra tela?
- [ ] Conferi o papel de cada botão que a proposta cria (`auth/permissions.ts`)?
- [ ] A lista do que fica de fora existe, e cada item tem motivo?
- [ ] Escolhi um caminho, em vez de devolver um cardápio de opções?
- [ ] O editor continua fechado?
