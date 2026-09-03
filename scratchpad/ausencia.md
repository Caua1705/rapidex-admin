# Falha cujo sintoma é AUSÊNCIA

A camada 2 — "o que decide se a loja vende" — é a mais cara desta rodada por um
motivo só: **quando ela falha, a tela não muda.** O lojista não vê tarja
vermelha, não vê erro no console, não tem o que contar para o suporte. Ele
percebe porque _nada aconteceu_: o pedido não entrou, o papel não saiu, o som
não tocou.

Este arquivo é a varredura atrás das **irmãs** dessa falha. Nasceu como lista;
o que já foi fechado está marcado no título de cada item, com o commit.

| #   | Item                                           | Estado              |
| --- | ---------------------------------------------- | ------------------- |
| 1   | o "ao vivo" que nunca é reavaliado             | **feito**           |
| 2   | o agente de impressão fora de Loja › Impressão | **feito** `589cd94` |
| 3   | o primeiro pedido do turno não apita           | **feito**           |
| 4   | as duas leituras de apoio que somem            | **feito**           |
| 5   | o contador das faixas que congela              | **feito**           |
| 6   | grupos de opção sumindo por falha de rede      | **feito**           |
| 7   | escrita que gravou e se reportava como falha   | **feito**           |
| 8   | contagem por categoria que fica velha          | **feito**           |

**Os oito estão fechados.** Nada do que este arquivo levantou sobrou.

## Como foi medido

Primeiro a máquina, depois o olho (`revisao` §10: contagem de `grep` não é
achado, é onde olhar).

- `catch` que não escreve o erro em lugar nenhum: **29 candidatos** em `src/`.
  Abrindo os 29, **a grande maioria é escolha declarada** — devolvem o erro a
  quem chamou, ou têm o comentário dizendo por que engolir é o certo ali
  (`useCustomerHistory`, `useKitchenOrders`, `SessionProvider`,
  `setAvailabilityForMany`). Não estão nesta lista.
- Limites fixos de página, para achar lista que corta em silêncio.
- Quem consome o estado do agente de impressão, e onde.
- Estado do stream: o que exatamente faz o painel dizer "ao vivo".

Sobraram **oito**. Estão em ordem de estrago.

---

## 1. ~~O painel afirma "ao vivo" sem ter como saber~~ — FEITO

`src/orders/useOrderStream.ts:129`

`setStatus('live')` acontece no `onopen` e **nunca mais é reavaliado**. O único
caminho de volta para `connecting`/`offline` é o `onerror`. Não existe relógio
de "último evento recebido".

Uma conexão TCP aberta que parou de entregar — proxy com buffer, worker travado
do outro lado, a conexão que o backend mata aos 15 min sem o socket cair —
mantém a etiqueta **ao vivo** na tela enquanto nenhum pedido aparece.

**O sintoma é a tela calma.** Pior que ausência simples: o painel está
_ativamente tranquilizando_ o lojista enquanto o telefone toca. É a irmã mais
próxima da camada 2, e é a auditoria **D.5**, ainda aberta.

**A conferência que a suspeita pedia mudou o desenho inteiro.** O backend
MANDA `keep-alive` — `: ping` a cada 20s, `HEARTBEAT_INTERVAL_SECONDS` — e ele
não serve: comentário SSE **não vira evento no `EventSource`**, não há callback
para ele, e contar batidas (o desenho óbvio) é impossível do navegador.

O sinal observável é outro, e é uma GARANTIA: `MAX_STREAM_SECONDS = 900` — toda
conexão morre aos 15 minutos de propósito, para não acumular zumbi no worker.
Logo **uma conexão saudável produz um `onopen` a cada quinze minutos**, tenha
entrado pedido ou não. O relógio não mede "há quanto tempo não entra pedido"
(numa madrugada de domingo isso mentiria); mede há quanto tempo o painel não
recebe NADA — evento **ou reabertura**.

**Limite: 20 minutos** = o teto do backend mais cinco de folga, e a folga
precisa caber uma reabertura inteira que deu trabalho (ticket, conexão, espera
crescente). Generosa de propósito, para o erro cair do lado barato: acusar tarde
custa minutos de lista velha com a recarga logo atrás; acusar cedo ensina o
lojista a ignorar a etiqueta.

Os dois números são **espelho declarado** de `admin_order_stream_service.py` —
nenhum está no `/openapi.json` —, e o estrago da divergência está escrito em
`stream-health.ts`.

**E a etiqueta não basta:** o diagnóstico refaz a conexão, que é o remédio de
uma conexão morta, e a reabertura arrasta a recarga da lista. De brinde, o
`typecheck` denunciou dois `STREAM_LABELS` — um deles `Record<string, string>`,
onde um estado novo não daria erro e a etiqueta ficaria vazia na tela que fica
pendurada na parede da cozinha.

## 2. ~~O agente de impressão cair é invisível fora de Loja › Impressão~~ — FEITO (`589cd94`)

`src/store/PrintingTab.tsx:90` é o **único** consumidor de `usePrintAgent` no
painel inteiro.

O dado existe e é bom: `is_online` já vem calculado pelo backend contra a janela
de 90s, `seconds_since_last_seen` vem junto, e o 202 do teste de impressão ainda
devolve `agent_is_online` de propósito (`src/api/types.ts:342`). Nada disso
aparece em **Pedidos** nem em **Cozinha** — as duas telas onde o lojista está
quando a comanda deveria estar saindo.

`src/orders/ComandaDoPedido.tsx:88` chegava a escrever _"Se o papel não saiu,
confira o programa em Loja › Impressão"_. Estava certo, e era tarde: essa frase
só é lida por quem **já foi procurar**. O programa caiu às 19h, e ninguém soube
até o primeiro cliente reclamar.

**Como ficou:** `print-sectors/AvisoDoAgente.tsx`, um componente para as duas
telas. Três decisões que valem para a próxima faixa que alguém for escrever:

- **só `offline` acende.** "Nunca instalado" é configuração, não incidente — a
  loja sem impressora veria a faixa todo dia e ela viraria papel de parede;
- **leitura que não voltou não afirma nada.** Filial sem resposta sai da conta,
  em vez de virar "nenhuma comanda está saindo" numa piscada de wi-fi. É o item
  6 desta lista aplicado antes de cometê-lo;
- **as filiais são as que a tela MOSTRA**, não a resolvida: com "todas", são
  todas, e a faixa nomeia qual parou.

A linha da comanda passou a trazer o estado do programa no MESMO clique que já
carregava as vias — em paralelo e com `catch` próprio, para a leitura de apoio
não levar junto o que o lojista veio ver.

## 3. ~~O primeiro pedido do turno não apita~~ — FEITO

`src/orders/useNewOrderSound.ts:44-48`

```ts
if (context.state === 'suspended') {
  setIsBlocked(true);
  void context.resume();
  return; // <- este pedido não tocou
}
```

Com o áudio bloqueado, `play()` marca o estado, pede o `resume()` e **volta sem
tocar**. O botão "Ativar som" aparece só _depois_ que um pedido já passou em
silêncio.

O cabeçalho do arquivo previa exatamente o cenário — "um painel restaurado do
localStorage e deixado numa TV pode nunca receber um clique" — e o alerta que
falhava nesse cenário era justamente o do **primeiro** pedido, que é o que
ninguém está esperando.

**Como ficou:** o hook lê `context.state` na montagem e escuta `statechange`. A
mudança de fundo é a mesma dos outros dois itens desta lista — **o estado passou
a ser observado, e não deduzido de uma tentativa que falhou**. De quebra, isso
cobre o caso que ninguém tinha visto: alguns navegadores suspendem o áudio de
uma aba escondida há horas, que é o dia a dia de um balcão, e a tela só
descobriria no pedido seguinte.

E **mudo vence bloqueado**: quem desligou o sino não é convidado a "ativar o
som" — o sino cortado já explica o silêncio, e as duas mensagens juntas fariam o
lojista apertar uma para descobrir que faltava a outra. A decisão sai pronta do
hook, e não como dois fatos para cada tela combinar por conta.

## 4. ~~Duas leituras de apoio que somem sem deixar rastro~~ — FEITO

- `src/orders/useDeliveryEstimate.ts:40` — falha de rede → `setEstimate(null)` →
  a faixa de entrega some do cabeçalho.
- `src/orders/usePrepRange.ts:39` — falha → `setRange(null)` → some a faixa de
  preparo do dia.

Nos dois, **"a loja não configurou" e "não deu para ler" desenham a mesma
tela.** O primeiro é informação; o segundo é defeito — e eles são
indistinguíveis para quem olha. O `useCustomerHistory` faz a mesma coisa e está
_fora_ desta lista porque lá a ausência é do dado de apoio de uma linha; aqui é
o prazo que o lojista promete ao cliente no telefone.

**Conserto (2026-09-03):** `falhou` é estado próprio nos dois hooks, e o valor
que a falha escrevia (`null`) parou de ser escrito — porque `null` JÁ queria
dizer "a loja não configurou". A tela ganhou a terceira frase: "não deu para
ler", ao lado de "sem faixa" e "não definido".

Três decisões que a implementação tomou e o achado não previa:

- **a frase da falha não vira alerta.** Continua sendo uma palavra no lugar do
  valor, na mesma tinta discreta — quem abriu esta tela veio ver pedido, e um
  alerta vermelho numa tela que fica aberta o turno inteiro é o que se aprende a
  ignorar. O que se conserta é a tela AFIRMAR o que ela não sabe;
- **um ajuste desta sessão desmente a leitura que caiu** (`usePrepTime`):
  `falhou` só vale com `adjusted === null`. Se o PATCH voltou com uma faixa, ela
  é a verdade mais fresca que a tela tem, e dizer "não deu para ler" em cima do
  número que o próprio lojista acabou de gravar seria pior que o defeito;
- **`isLoading` vem antes de `falhou`** no controle de preparo: durante a
  primeira leitura a frase certa é "carregando…", e só depois dela a tela tem
  direito de dizer que não conseguiu.

Provado por mutação: dois e2e em `caminho-critico.spec.ts` derrubam a rota de
apoio (`/admin/settings` e `/business-hours`) e exigem a frase nova E a ausência
da antiga — devolver o `setEstimate(null)`/`setRange(null)` derruba os dois. Os
dois ainda afirmam que a lista de pedidos ficou de pé: apoio que cai não leva
junto o que o lojista veio ver.

## 5. ~~O contador das faixas congela sem avisar~~ — FEITO

`src/orders/useOrdersBoard.ts:58`

O comentário diz: _"Badge desatualizado não impede trabalhar, e o erro da lista
já aparece"_. Isso vale quando as duas falham juntas — e elas são **rotas
diferentes**: `fetchStatusCounts` pode falhar sozinha, com a listagem verde.

O resultado é dois números discordando na mesma tela: a faixa mostra 4 pedidos
e o contador diz 7. Nada aceso. É a mesma família do `sort_order` divergente —
duas expressões do mesmo fato, e a tela não diz qual acreditar.

**Conserto (2026-09-03):** `countsStale` no `useOrdersBoard`, e uma ressalva ao
lado dos contadores: _"números podem estar velhos"_. Some sozinha na primeira
leitura que voltar.

**O número velho FICA na tela**, e isso é escolha: apagá-lo trocaria um número
possivelmente desatualizado por nenhum, e o contador de apoio serve para o
relance — o que faltava não era o dado, era a tela parar de afirmá-lo como
fresco. Pela mesma razão a ressalva não é `.alert`: nada quebrou para o lojista,
e a listagem — a verdade — continua verde ao lado.

Provado por mutação: o e2e derruba `status-counts` sozinha, exige a ressalva e
exige o cartão de pedido de pé (as duas rotas são independentes — era esse o
achado). O par dele afirma o outro lado: com o contador respondendo, a ressalva
não existe na tela.

## 6. ~~Grupos de opção somem por falha de rede~~ — FEITO

`src/menu/OptionGroupsSection.tsx:105` → `setGrupos([])`

A escolha de não derrubar a edição de nome e preço está certa e escrita. O
problema é o **valor** escolhido para a falha: lista vazia lê como _"este
produto não tem complemento"_, e essa é exatamente a tela em que o lojista
decide se precisa criar um. Ele cria o segundo "Escolha o tamanho".

Uma falha de leitura precisa de um terceiro estado (`null` = não sei), não do
mesmo valor que significa "não há".

**Conserto (2026-09-03):** `erroDeLeitura` é estado próprio. O `catch` deixa
`grupos` em `null` e a seção diz que não conseguiu ler — o nome e o preço
seguem editáveis, que era a razão de não derrubar tudo.

**E o botão de criar SOME enquanto a leitura falhou.** Essa parte não estava no
achado e é o que fecha o buraco: o estrago descrito aqui não é ler "nenhum
grupo", é CRIAR um em cima do que já existe. Deixar o botão de pé com o aviso ao
lado ainda deixaria o caminho aberto para quem lê o botão antes da frase.

Provado por mutação: devolver o `setGrupos([])` derruba o e2e novo
(`complementos.spec.ts`).

## 7. ~~Escrita que gravou e se reporta como falha~~ — FEITO

`src/menu/OptionGroupsSection.tsx:160-171` (`gravar`)

```ts
await acao(); // gravou
await recarregar(); // esta falhou
setEditando(null); // nunca chega aqui
```

Se a gravação passa e a releitura cai, o `catch` escreve a mensagem de erro e o
formulário **fica aberto**. Do lado de cá do balcão isso é indistinguível de
"não salvou" — e a reação natural é apertar de novo, criando o grupo duas vezes.

Não é ausência: é o inverso dela (o painel nega o que aconteceu). Está aqui
porque a causa é a mesma — **o painel só sabe o que a segunda leitura contou.**

**Conserto (2026-09-03):** os dois `await` deixaram de dividir um `catch`. A
falha da ESCRITA continua igual (mensagem, formulário aberto, o texto do
lojista preservado). A falha da RELEITURA fecha o formulário — porque a escrita
aconteceu — e diz o que houve, nesta ordem: "Salvo. Não deu para reler a lista
agora — o que aparece abaixo pode estar desatualizado."

"Salvo" vem primeiro de propósito: é a palavra que muda o que a pessoa faz em
seguida. A lista velha é ressalva, não manchete.

Provado por mutação: devolver o `catch` único derruba o e2e novo.

## 8. ~~Contagem por categoria que fica velha em silêncio~~ — FEITO

`src/menu/useMenu.ts:189` devolve `null` na falha, e o `setProductCounts` mantém
a chave anterior. A fita de categorias fica com um número que não confere com a
lista aberta ao lado.

Menor que os outros — o número é de apoio e a lista é a verdade —, mas é a mesma
mecânica do item 5.

**Conserto (2026-09-03):** a sondagem que caiu devolve `[category.id, undefined]`
em vez de `null`, e a mesclagem passou a **apagar** a chave. `undefined` é o
"não sei" que a fita já sabia desenhar: ela simplesmente não escreve número
naquela categoria.

**Aqui o número velho SOME, e no item 5 ele FICA** — e a diferença não é
incoerência. Lá, a listagem ao lado é a verdade e o contador é relance; aqui a
contagem da fita é a única resposta para _"qual categoria está vazia?"_, que é a
pergunta que faz o lojista descobrir que o cardápio subiu pela metade. Número
errado nessa pergunta é pior que número nenhum. E a fita já tinha o desenho do
vazio pronto — não precisou de frase nova.

Provado por mutação: o e2e de `cardapio.spec.ts` derruba **só a sondagem** (o
`limit=1` é o que a distingue da listagem da categoria aberta) e cobra as duas
metades — o número da FECHADA some, e o da ABERTA fica, porque esse vem do
`total` da listagem, que é mais fresco. Duas fontes para a mesma pergunta podem
conviver; o que não pode é a mais velha se passar pela nova.

---

## O que foi conferido e NÃO é achado

Para a próxima sessão não refazer o caminho:

| Suspeita                                       | Veredito                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `catch` vazio em `SessionProvider.tsx:102`     | deliberado e escrito: erro de rede não desloga                                     |
| `catch` vazio em `ProductDialog.tsx:132`       | idem, leitura de apoio do diálogo                                                  |
| `setAvailabilityForMany` engolindo N mensagens | escolha declarada: o que importa é _qual item_ ficou para trás, e isso ela devolve |
| `useKitchenOrders.ts:86`                       | cartão aparece sem itens e a próxima montagem tenta de novo — declarado            |
| cardápio cortando em 50 produtos               | tem "Carregar mais", tem `total`, e o reordenar se recusa com a lista pela metade  |
| categorias cortando por página                 | `listCategories` não pagina                                                        |
| estado vazio confundido com filtro             | `CustomersPage.tsx:259` e `CouponsPage.tsx:460` separam os dois casos por escrito  |
| `avisoDeVias` lendo lista vazia como falha     | é a metade da tela que existe para responder "não saiu nada" — está certa          |
| reordenar otimista sem volta                   | volta ao lugar na recusa; está escrito no cabeçalho                                |

## Nota de método

O `catch` silencioso — a primeira suspeita, a que a ferramenta acha sozinha — é
o **caminho menos produtivo** desta varredura: 29 candidatos, 3 achados, e todos
os 3 por causa do _valor_ escolhido na falha, não por engolir o erro.

O que rendeu foi a outra pergunta: **"qual dado o painel tem na mão e não
mostra em nenhuma tela?"** — foi ela que achou o item 2, que é o mais barato de
consertar e provavelmente o mais sentido no balcão.
