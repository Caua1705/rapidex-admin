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
| 2   | cadastro `/admin/couriers`           | a fazer                   |
| 3   | o acesso (link + código + QR)        | a fazer                   |
| 4   | atribuição, e quem está com o pedido | a fazer                   |

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

## Portão

Lido sem pipe, com o item 1 fechado:

```
format:check  ok
lint          ok · 1381 casos afirmam alguma coisa
typecheck     ok
test          74 arquivos · 1088 casos
playwright    305 passed · 4 skipped · 0 failed
```
