# A integração da linha `dev` com a `main` — 2026-09-03

## Por que existiam duas linhas

A política do repositório mudou em **28/ago (`b703e7a`)**: o trabalho passou a
ser direto na `main`, sem branch nem PR, e o link fixo do preview da `dev` saiu
da documentação junto.

A linha da `dev` saiu de `be4c670`, **um commit antes dessa mudança**. Ela
nunca recebeu `b703e7a` — então o `CLAUDE.md` e a skill `git` que existiam
naquela árvore eram a cópia ANTERIOR, mandando trabalhar em `dev`. As rodadas
de 2 e 3 de setembro (45 commits: painel-2, entregador, relatório) leram essas
instruções e seguiram a política aposentada.

**A lição, e ela não é sobre git:** instrução de repositório é lida da árvore em
que se trabalha. Uma branch antiga carrega as REGRAS antigas junto com o
código, e nada avisa — a regra nova estava escrita, mas no lugar que aquela
sessão não abria. Quem detectou foi o dono, comparando a data do último deploy
de produção com o que a sessão dizia estar fazendo.

## O que a integração decidiu

O merge `origin/main` → `dev` deu **9 conflitos**, e a causa é uma só: os dois
lados consertaram O MESMO BUG em paralelo, sem saber um do outro.

|              | `main`                                                                                                                          | `dev`                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| commit       | `3d893f1` (28/ago)                                                                                                              | `39bbd19` (2/set)                   |
| o bug        | 428 `confirmation_required` com `detail` OBJETO: o painel mostrava "A requisição falhou (428)" e o pedido ficava preso na chapa | o mesmo                             |
| arquivo novo | `src/orders/cancel-confirmation.ts`                                                                                             | `src/orders/cancel-confirmation.ts` |

Por isso dois dos conflitos eram `add/add`: não houve edição concorrente, houve
**criação concorrente do mesmo arquivo**.

Os dois consertos concordavam no essencial (nunca mandar `confirm_prepared_order`
verdadeiro por conta própria; ler o 428 pelo `code` e não pelo texto; o desfecho
deixar de ser booleano; o 428 não acender a barra vermelha). As duas escolhas
que divergiam foram decididas **pelo dono**, as duas pela `dev`:

**A — quem escreve a frase.** O backend. A da `main` era escrita no painel, por
estágio. O que decidiu não foi o estilo: com a leitura da `main`, um 428 **sem
`message` ou `order_status`** cai fora e vira erro comum — e o pedido volta a
não poder ser cancelado, que é o defeito de origem. A frase da `main` não se
perdeu: virou pedido ao backend (`rodada-painel-2.md` §3.1).

**B — um diálogo em dois passos**, não dois diálogos. O motivo continua na tela
e **editável** no segundo passo (o lojista escreve "cliente desistiu", lê que a
comida já saiu, e quer acrescentar "já estava na rua"), e o aviso novo tem
`role="alert"` — sem ele, no leitor de tela, a única pista de que a pergunta
mudou seria o título, que não é relido.

### O que veio da `main` mesmo perdendo

Ficar com um lado não é jogar o outro fora. Do conserto da `main` foram
trazidos:

- **`confirmPrepared` gravado no falso.** A contagem de 428 da `dev` provava que
  o PRIMEIRO envio foi sem confirmação; nada provava que o SEGUNDO carregou
  `true`. Um painel que reenviasse `false` entraria em laço de 428 na cara do
  lojista e a suíte não veria.
- **O caso "Manter o pedido no segundo passo"**, portado para a UI da `dev`. Ele
  afirma que a segunda pergunta TEM SAÍDA — um diálogo cujo "Manter o pedido"
  cancelasse mesmo assim passaria por todos os outros testes.

### O que foi descartado, e por quê

- `src/orders/ConfirmPreparedCancelDialog.tsx` (o segundo diálogo da `main`) —
  apagado: nada o importa depois da decisão B.
- `CancelConfirmation` em `src/api/types.ts` — apagado: o apelido do contrato
  ficou sem uso, porque o modelo da `dev` tem tipo próprio de VISTA
  (`{message, orderStatus}`), tolerante a campo ausente de propósito.
- O parâmetro `confirmPreparedOrder` de `updateOrderStatus` na `main` — some com
  a versão da `dev`. **Ninguém o chamava com `true`** nem lá: era capacidade sem
  uso, e o comportamento é idêntico.

## Uma contradição que ficou de pé, e é de DOCUMENTAÇÃO

Os dois falsos afirmam coisas opostas sobre o backend, cada um por escrito:

- o da `main`: o 428 vem **ANTES** do 409 de estado final, "como no backend,
  onde `_ensure_cancellation_confirmed` roda antes de `status_change_service.apply`";
- o da `dev`: a checagem vem **DEPOIS** do 409, "pela mesma ordem de lá".

**Nenhum teste pode distinguir os dois**, e é por isso que ninguém percebeu: os
estados de produção (`preparing`, `ready`, `out_for_delivery`) e os finais
(`cancelled`, `completed`) são conjuntos DISJUNTOS — nenhum pedido cai nas duas
checagens, então a ordem entre elas não muda resposta nenhuma.

Ficou a da `dev`, por ser a que sobreviveu à resolução. **Um dos dois comentários
está errado sobre o backend**, e o custo de descobrir qual é abrir
`admin_order_service.py` uma vez. Vale fazer antes que alguém tome uma decisão
apoiada na frase errada — comentário que afirma o que o teste não cobre é
exatamente o tipo de coisa que envelhece sem avisar.
