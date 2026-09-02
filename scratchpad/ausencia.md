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
| 1   | o "ao vivo" que nunca é reavaliado             | aberto              |
| 2   | o agente de impressão fora de Loja › Impressão | **feito** `589cd94` |
| 3   | o primeiro pedido do turno não apita           | aberto              |
| 4-8 | os cinco menores                               | anotados            |

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

## 1. O painel afirma "ao vivo" sem ter como saber

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

O conserto tem forma conhecida: guardar o instante do último evento (ou de um
`ping`, se existir no stream) e virar o rótulo depois de N minutos de silêncio.
Precisa conferir antes se a rota manda comentário de _keep-alive_ — sem isso,
"N minutos sem evento" numa madrugada de domingo é silêncio legítimo, e o
rótulo mentiria para o outro lado.

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

## 3. O primeiro pedido do turno não apita

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

O cabeçalho do arquivo prevê exatamente o cenário — "um painel restaurado do
localStorage e deixado numa TV pode nunca receber um clique" — e o alerta que
falha nesse cenário é justamente o do **primeiro** pedido, que é o que ninguém
está esperando. O aviso precisa nascer com a tela, não com a primeira perda.

## 4. Duas leituras de apoio que somem sem deixar rastro

- `src/orders/useDeliveryEstimate.ts:40` — falha de rede → `setEstimate(null)` →
  a faixa de entrega some do cabeçalho.
- `src/orders/usePrepRange.ts:39` — falha → `setRange(null)` → some a faixa de
  preparo do dia.

Nos dois, **"a loja não configurou" e "não deu para ler" desenham a mesma
tela.** O primeiro é informação; o segundo é defeito — e eles são
indistinguíveis para quem olha. O `useCustomerHistory` faz a mesma coisa e está
_fora_ desta lista porque lá a ausência é do dado de apoio de uma linha; aqui é
o prazo que o lojista promete ao cliente no telefone.

## 5. O contador das faixas congela sem avisar

`src/orders/useOrdersBoard.ts:58`

O comentário diz: _"Badge desatualizado não impede trabalhar, e o erro da lista
já aparece"_. Isso vale quando as duas falham juntas — e elas são **rotas
diferentes**: `fetchStatusCounts` pode falhar sozinha, com a listagem verde.

O resultado é dois números discordando na mesma tela: a faixa mostra 4 pedidos
e o contador diz 7. Nada aceso. É a mesma família do `sort_order` divergente —
duas expressões do mesmo fato, e a tela não diz qual acreditar.

## 6. Grupos de opção somem por falha de rede

`src/menu/OptionGroupsSection.tsx:105` → `setGrupos([])`

A escolha de não derrubar a edição de nome e preço está certa e escrita. O
problema é o **valor** escolhido para a falha: lista vazia lê como _"este
produto não tem complemento"_, e essa é exatamente a tela em que o lojista
decide se precisa criar um. Ele cria o segundo "Escolha o tamanho".

Uma falha de leitura precisa de um terceiro estado (`null` = não sei), não do
mesmo valor que significa "não há".

## 7. Escrita que gravou e se reporta como falha

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

## 8. Contagem por categoria que fica velha em silêncio

`src/menu/useMenu.ts:189` devolve `null` na falha, e o `setProductCounts` mantém
a chave anterior. A fita de categorias fica com um número que não confere com a
lista aberta ao lado.

Menor que os outros — o número é de apoio e a lista é a verdade —, mas é a mesma
mecânica do item 5.

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
