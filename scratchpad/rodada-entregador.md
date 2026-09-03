# Rodada: as telas de entregador (fase 1)

Fonte da verdade desta frente. Atualizado no MESMO commit de cada item.

**Branch:** `rodada/entregador`, saída de `rodada/painel-2` (não de `dev`) — a
regeneração do contrato quebrou o cupom em 11 pontos e metade deles é a
correção de `valid_until` nullable que a painel-2 já tem. O PR desta frente
depende da painel-2 entrar primeiro; decisão confirmada pelo dono.

## O que existe, e onde

| #   | Item                                 | Estado                    |
| --- | ------------------------------------ | ------------------------- |
| 0   | contrato + `sort_order` do cupom     | feito `b50d2b6` `4f0a437` |
| 1   | taxa por corrida (Loja › Entrega)    | **feito**                 |
| 2   | cadastro `/admin/couriers`           | **feito**                 |
| 3   | o acesso (link + código + QR)        | **feito**                 |
| 4   | atribuição, e quem está com o pedido | **feito**                 |

## As decisões que já estão tomadas

Vieram da leitura do contrato e da resposta do dono, e não se reabrem sem
motivo novo.

1. **As quatro frases de `AssignmentErrorCode` são NOSSAS.** O contrato traz o
   enum de propósito ("o painel escreve a mensagem por codigo, nao pelo
   texto"); a glosa da descrição da rota não é texto de tela.

   | código         | frase                                                        |
   | -------------- | ------------------------------------------------------------ |
   | `not_found`    | "Este pedido não está na sua lista."                         |
   | `not_delivery` | "Retirada não tem entregador."                               |
   | `order_closed` | "Este pedido já terminou."                                   |
   | `other_branch` | "{Entregador} é da {filial dele}, e este pedido é de outra." |

   `not_found` não distingue inexistente / de outro restaurante / de filial
   invisível: o backend uniu os três "para nao virar oraculo de UUID", e a tela
   não pode desfazer isso.

2. **`VITE_COURIER_APP_URL`** é o host do app do CLIENTE. A tela do entregador
   ainda não existe; ela vai morar naquele repositório, em
   `/entregador/{link_token}`, ao lado de `/acompanhar/{tracking_token}`.

3. **QR: `qrcode-generator`**, local. Serviço externo de imagem de QR está
   PROIBIDO aqui — mandaria o token de acesso do motoboy para um terceiro, num
   par que sai uma vez só. Vazamento disfarçado de conveniência.

4. **Papéis saem do `papeis.ts`**, não do enunciado. Atribuir e desatribuir são
   **PESSOAS**: o atendente entrega o pedido ao motoboy sem chamar o gerente.

5. **"Entregadores" entra no grupo "Hoje"**, depois de Cardápio.

6. **Toda escrita de atribuição passa pela rota de LOTE**, mesmo com um pedido
   só — é o que mantém o caminho por-item exercitado desde o primeiro dia. UI
   em dois lugares: um por vez no detalhe do pedido, lote na tela do
   entregador. Seleção múltipla no quadro é frente própria.

## O que o contrato desmentiu

- **O `: ping` do stream não serve para nada do lado do painel** (era da rodada
  anterior, mas vale repetir aqui): comentário SSE não vira evento.
- **A ATRIBUIÇÃO NÃO EMITE EVENTO NO STREAM.** `AdminOrderStreamService` varre
  pedidos criados e histórico de STATUS; atribuir grava em
  `courier_assignments` e não toca em nenhum dos dois. `AdminOrderListItem` já
  traz `courier_id`/`courier_name` (backend `d84fc5d`), e o evento os carrega —
  mas só quando o evento existe, isto é, na próxima mudança de status.

  **Consequência para o item 4:** a linha do quadro tem de ser atualizada pela
  RESPOSTA do POST, localmente. Confiar no stream deixaria o quadro mostrando
  o motoboy antigo até o pedido andar de status.

## Pedidos ao backend

### 1. O stream devia emitir na atribuição

**Prioridade: alta, e o motivo é o segundo atendente.**

Hoje a atribuição não gera evento (ver acima). A solução local — aplicar a
resposta do POST no estado da tela — conserta o quadro de QUEM CLICOU, e só
dele. Numa loja com duas pessoas no balcão, a outra continua vendo o pedido
como "sem entregador" até ele mudar de status: ela atribui de novo, para outro
motoboy, e os dois saem para o mesmo endereço. Reatribuir é barato para o
backend (fecha a linha anterior e abre outra) e caro para a loja.

Isso não é conserto de painel: nenhum polling nosso resolve sem trocar o
tempo real por uma varredura, que é exatamente o que o SSE veio evitar. O que
resolve é um tipo de evento novo — `order.courier_changed`, ou o
`order.status_changed` passando a disparar também na atribuição — carregando o
mesmo `AdminOrderListItem` que os outros já carregam. O painel já sabe aplicar
esse item: `applyStreamEvent` não precisaria de uma linha.

Enquanto não vier, fica anotado como limitação conhecida da fase 1.

## Item 1 — a taxa por corrida

`GET/PATCH /admin/branches/{branch_id}/courier-fee`, em Loja › Entrega.

**Seção própria, rota própria, botão próprio**, como as faixas de prazo ao
lado: o PATCH é SOMENTE_DONO enquanto o resto da aba é da gerência, e um botão
só faria o 403 de uma metade parecer falha da outra.

### A regra dura, nas duas direções

`null` é "sem taxa", **nunca** zero — zero é um número que SOMA no histórico
que o dono usa para pagar, e a filial sem taxa apareceria como "grátis".

E a leitura ao contrário, que é a que se erra por descuido: **um zero DIGITADO
é um zero de verdade**, o acordo em que a loja não paga por corrida. Mostrá-lo
como "sem taxa" apagaria uma escolha do lojista. Os dois sentidos têm teste.

### O que mais ficou decidido aqui

- **Cada campo tem o próprio nulo.** Base nula com por-km preenchido é
  configuração válida (paga pela distância, nada pela corrida) e o backend
  calcula. "Sem taxa" é os DOIS nulos.
- **Só o campo mexido entra no corpo.** "Campo ausente não mexe" só vale como
  garantia se a tela realmente omitir o que não tocou — e o dia em que esta
  seção mostrar um campo a menos para algum papel, mandar o par inteiro
  reescreveria por cima do que a tela nem exibiu. É o defeito do preço do
  produto (403 ao reenviar o mesmo valor), evitado antes de acontecer.
- **Campo esvaziado manda `null` explícito**, não a ausência. Mesma regra de
  `printing_sector_id`.
- **Dinheiro sobe como string de duas casas.** `Decimal` do outro lado; 8,10
  como número pode chegar 8,099999.
- **Leitura que falha NÃO vira "sem taxa".** Sem resposta, a tela mostra o erro
  e não afirma nada sobre quanto a loja paga — é a pior frase que esta seção
  pode dizer errado. `semTaxa(null)` é falso de propósito.
- **A gerência lê e não grava:** somem os CAMPOS, não a seção. Esconder tudo
  faria o gerente concluir que a loja não paga o motoboy pelo painel e voltar a
  perguntar ao dono no WhatsApp.
- **O aviso que evita o chamado:** mudar a taxa vale para as próximas corridas;
  a atribuída congela `courier_fee_snapshot`, como `unit_price_snapshot` faz
  com o preço.

### Vermelho visto

20 casos do modelo puro antes da implementação. Os 10 e2e nasceram verdes (a
implementação veio antes), então foram provados por **três mutações**:

| mutação                                   | o que caiu |
| ----------------------------------------- | ---------- |
| ausência renderizada como `R$ 0,00`       | 2          |
| corpo do PATCH sempre com o par inteiro   | 3          |
| campos visíveis para quem não pode gravar | 1          |

**Armadilha nova, e ela quase passou:** desfazer uma mutação por "primeira
ocorrência" só é seguro enquanto a mutação não torna a string ambígua. A
mutação 3 tirou `podeEditar` do bloco dos campos; ao desfazer, o replace
acertou o bloco do VALOR, que vinha antes — e os dois trocaram de papel, com o
`typecheck` verde. Quem pegou foi a suíte rodada logo depois.

## Item 2 — o cadastro

`/entregadores`, no grupo "Hoje" da lateral, depois de Cardápio.

### As decisões

- **A tela ADOTA uma filial** (`useAdoptedBranch`), como Cardápio e as seções
  de Loja. O telefone é único DENTRO da filial e `branch_id` é obrigatório no
  cadastro — "escolha uma filial" antes da tela lê como bug para quem pediu a
  tela.
- **A filial só existe no POST.** `AdminCourierUpdate` é `extra="forbid"`:
  mandá-la num PATCH é 422, não campo ignorado. Por isso criar e editar são
  DOIS caminhos de verdade no `salvar` — um ternário uniria os tipos e
  desligaria o compilador exatamente onde ele protege.
- **Os limites do Pydantic estão escritos à mão**, num lugar só e com a origem
  nomeada (`NOME_MAX = 120`, `TELEFONE_MIN_DIGITOS = 8`). O `/openapi.json` não
  publica `Field(min_length=…)` nem `field_validator`.
- **O telefone conta DÍGITOS, não caracteres.** O backend cobra as duas coisas,
  e é o vão entre elas que pega o caso real: "(85) 9999" tem nove caracteres e
  seis dígitos.
- **O 409 vai para o CAMPO do telefone, e a decisão sai do STATUS.** Casar a
  frase do backend seria um acordo que se desfaz em silêncio no dia em que
  alguém corrigir uma vírgula lá.
- **Desativar não pergunta; excluir pergunta.** Desativar é reversível num
  clique e a consequência está ao lado do interruptor; perguntar em toda troca
  é o que ensina o lojista a confirmar sem ler — e aí o diálogo que importa
  passa batido também. O diálogo de excluir oferece a alternativa reversível,
  porque ela existe.
- **A lista não é reordenada.** `ORDER BY name ASC` é do banco; refazer com
  `localeCompare` daria uma segunda resposta para a mesma pergunta.
- **Lista vazia só é afirmação quando a leitura voltou.** Com erro em tela, o
  estado vazio não aparece — "nenhum entregador" numa queda de rede faz o
  lojista cadastrar de novo quem já existe, e tomar 409.

### O defeito que eu mesmo cometi, e o que o pegou

`errosDoEntregador` mapeia todo 409 para o campo do telefone, porque no
FORMULÁRIO 409 é sempre telefone repetido. Eu usei a mesma função no erro de
**desativar** e de **excluir** — e ali o 409 fala de outra coisa. Resultado:
`geral` vinha nulo e a recusa do backend virava **erro nenhum na tela**.

É a falha cujo sintoma é ausência, cometida por quem passou a rodada anterior
inteira varrendo atrás dela. Quem pegou foi o e2e da recusa do DELETE, que só
existe porque nenhuma escrita nasce só no caminho feliz.

### A lateral subiu de oito para nove itens

`nav.test.ts` trava esse número de propósito ("que suba com alguém tendo lido
esta linha"). Subiu, com o motivo escrito no teste e em `nav.ts`: quem atribui
é o atendente, no meio do turno, com o pedido na mão — uma tela de turno no pé
das configurações é uma tela que essa pessoa não encontra.

## Item 3 — o acesso

`POST /admin/couriers/{id}/access`, no botão da linha.

### A tela do entregador existe — desde 2026-09-03

Ela ficou pronta no repositório do app do cliente, no mesmo dia: **página
própria** (`entregador.html`, 8 kB contra os 380 kB do app do cliente), com as
três telas — entrada por código, lista de pedidos e histórico.

Então o link que este painel gera **leva a lugar de verdade** assim que os dois
lados estiverem no ar. Até o deploy dos dois, abrir o link dá 404 do APP, e não
do painel — é a única leitura que ainda pode assustar quem testar.

> A versão anterior desta seção dizia que a tela não existia. Ficou registrado
> porque é o tipo de aviso que envelhece em um dia e continua sendo lido por
> semanas.

### O domínio não tem padrão, e essa é a proteção

`VITE_COURIER_APP_URL` está no `.env.example` **comentada, sem valor**.
Faltando ela, o painel **não oferece o botão**. A alternativa seria gerar um
link para um domínio errado — e o par sai uma vez só: o motoboy receberia algo
que não abre, e a segunda via mata a primeira.

Um padrão embutido no código seria exatamente o defeito que a ausência da
variável existe para impedir, e ele apareceria em produção, uma vez, no dia do
primeiro entregador.

O `playwright.config.ts` fixa a variável para o e2e exercitar o caminho que
existe; o caso da variável AUSENTE é coberto no teste de unidade
(`podeGerarAcesso('')`), porque dublá-lo no e2e exigiria um segundo servidor
com outro ambiente só para provar que um botão não aparece.

### O QR é desenhado aqui, e a recusa importa mais que a implementação

Um serviço de imagem por URL (`api.qrserver.com/...?data=<link>`) mandaria o
token de acesso do motoboy **para um terceiro**, num par que sai uma vez só e
abre a operação da loja. Vazamento de segredo disfarçado de conveniência.

`qrcode-generator` (zero dependências) desenha localmente, e o componente
emite **SVG de verdade** — sem `dangerouslySetInnerHTML` e sem `data:` URI.
Há um e2e que conta as requisições externas durante a geração e exige zero.

**As duas cores do QR viraram tokens** (`--qr-tinta`, `--qr-fundo`), fixas nos
dois temas: quem lê um QR é uma CÂMERA, e traços escuros sobre a parede escura
do tema noturno não têm contraste nenhum para o leitor. A régua de aderência
estava certa em barrar o literal — cor do sistema se declara num lugar só,
inclusive a que é fixa de propósito. Assim a exceção fica visível para quem
revisa, em vez de escondida num `eslint-disable`.

### O diálogo é irmão do da senha temporária

As quatro decisões de lá valem aqui, e pelo mesmo motivo: o aviso vem ANTES do
par; `dismissible={false}`; fechar exige a confirmação de que entregou; e o par
aparece INTEIRO, porque um sem o outro não abre nada.

**Três caminhos, nenhum redundante:** o QR é para o motoboy que está na loja; o
WhatsApp para o que não está (o caso comum, porque o cadastro costuma vir
antes); copiar é a saída de quem usa outro canal, e a que sobra quando o
WhatsApp do balcão está na conta errada.

**O WhatsApp é só um link `wa.me`** — sem API, sem Business Manager, sem token.
É por isso que este botão existe hoje, enquanto a integração de WhatsApp do
painel inteiro ainda é "em breve". Ele leva o par inteiro numa mensagem só:
mandar link e código em duas é o que produz a ligação de volta ("chegou só o
endereço"), e a essa altura o par já não existe para reenviar a metade que
faltou.

**Regerar pergunta antes**, e a frase diz o que quebra do lado de lá: o par de
agora para de funcionar na hora, e quem estiver entregando com o app aberto
perde o acesso no meio da corrida. O 409 do inativo sobe com a frase do
backend, que já diz o que fazer.

### Vermelho visto

12 casos do modelo puro com o módulo ainda inexistente. Os 9 e2e sob duas
mutações: regerar sem perguntar (derruba 2) e o diálogo fechando sem a
confirmação (1).

### Uma armadilha de execução, anotada duas vezes hoje

**Duas suítes e2e ao mesmo tempo brigam pelo mesmo servidor** e reportam
contagem falsa — uma execução acusou 9 falhas em `caminho-critico.spec.ts` que
passam todas isoladas. O número do portão sai de uma execução SOZINHA.

## Item 4 — a atribuição

`POST /admin/couriers/{id}/assignments`, `GET/DELETE /admin/orders/{id}/courier`.

### A regra que manda no desenho inteiro

**A rota responde 200 MESMO COM ITENS RECUSADOS**, e quem decide é o `ok` de
cada um. Ler o 200 como sucesso é a forma mais silenciosa de um pedido nunca
chegar a ninguém: a tela diria "entregue ao Jorge" e o motoboy não teria
recebido nada. `resumoDoLote` existe só para isso, e `tudoCerto` é falso com
UMA recusa no lote.

### O botão não é oferecido onde a resposta seria "não"

Das quatro recusas do contrato, **três a tela sabe prever** olhando o próprio
pedido e a própria lista:

| código         | como a tela evita                                      |
| -------------- | ------------------------------------------------------ |
| `not_delivery` | o bloco não existe em pedido de retirada               |
| `order_closed` | nem em pedido encerrado                                |
| (409 inativo)  | entregador desativado não entra no seletor             |
| `other_branch` | os entregadores oferecidos são os da filial DO PEDIDO  |
| `not_found`    | não dá para prever — é a que a frase existe para dizer |

Oferecer o botão para depois explicar por que ele não funcionou é pior que não
oferecê-lo: o lojista clica, lê, e aprende que o painel promete o que não
cumpre.

**Efeito colateral disso:** `other_branch` é inalcançável a partir do detalhe.
O contexto da frase vai assim mesmo porque quem a escreve é uma função só,
compartilhada com o lote — onde o caso é real, com o entregador fixo e os
pedidos variando.

### Os três estados de "quem está com ele"

`undefined` (não li), `null` (ninguém — 200 com os dois campos nulos, estado
NORMAL) e o entregador. O 404 é o pedido fora do escopo e vira mensagem de
erro, nunca "ninguém ainda": dizer que um pedido está parado esperando alguém,
sobre um que JÁ saiu, manda o lojista atribuir de novo — e dois motoboys para o
mesmo endereço.

### O 409 do DELETE releitura junto

"Ninguém está com o pedido" é clique repetido ou tela velha. A tela mostra a
frase do backend **e relê**, porque a segunda leitura é o que desfaz a tela
velha. E "Tirar" só existe quando alguém está com ele — oferecê-lo sem ninguém
seria fabricar esse 409.

### O que o teste de XSS ganhou junto

O painel do pedido passou a ler a sessão (papel e filiais), e
`OrderDetailPanel.xss.test.tsx` o monta sem provedor. A sessão foi **dublada
ali**, como as duas rotas que ele já dublava. A alternativa — um prop de
desligar o bloco, como o `catalogPairing={false}` de `ProductDialog` — não
cabia: lá o prop existe porque o pareamento é opcional na própria tela, e aqui
o bloco não é opcional em pedido de entrega nenhum.

### Vermelho visto

15 casos do modelo puro com o módulo ainda inexistente. Os 12 e2e sob três
mutações:

| mutação                                              | o que caiu |
| ---------------------------------------------------- | ---------- |
| 200 lido como sucesso, sem olhar o `ok` de cada item | 2          |
| retirada também ganhando o bloco                     | 1          |
| leitura que falhou virando "ninguém ainda"           | 1          |

## Portão

Lido sem pipe, com os quatro itens fechados:

```
format:check  ok
lint          ok · 1460 casos afirmam alguma coisa
typecheck     ok
test          77 arquivos · 1133 casos
playwright    339 passed · 4 skipped · 0 failed
```
