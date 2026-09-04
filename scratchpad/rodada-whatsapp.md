# Rodada do WhatsApp — a tela que destravou

**05/09/2026.** O backend entregou as três rotas de admin do canal, e a tela
saiu de "em breve" para tela de verdade.

---

## O que existia antes

`/whatsapp` era um item `soon` da lateral, apontando para `ComingSoonPage` com a
frase "Ligar o número da loja para avisar o cliente a cada mudança de status do
pedido". `scratchpad/pedidos-ao-backend.md` (item 3) registrava a lacuna:
"WhatsApp e Integrações — nenhuma rota `/admin`". Aquele item está fechado.

## As três rotas, e os papéis

| Rota                                           | Papel          |
| ---------------------------------------------- | -------------- |
| `GET /admin/whatsapp/channels`                 | `GERENCIA`     |
| `POST /admin/whatsapp/channels`                | `SOMENTE_DONO` |
| `DELETE /admin/whatsapp/channels/{channel_id}` | `SOMENTE_DONO` |

Ler é da gerência porque é o gerente quem responde ao cliente que ligou dizendo
não ter recebido o aviso. Escrever é só do dono pelos dois lados: conectar cola
no banco uma credencial da Business Manager, e desconectar não quebra nada —
nenhum erro, nenhuma tela vermelha, só pedido seguindo em silêncio. Estrago
silencioso pede a senha que menos circula.

O `DELETE` responde **200 com o canal**, e não 204: a linha não é apagada.
`whatsapp_messages.channel_id` é FK sem `ON DELETE`, de propósito — apagar o
canal apagaria o registro de que o cliente foi avisado.

---

## As duas coisas que a tela existe para não deixar passar

### 1. Filial sem número HERDA o do restaurante

A resposta tem **duas listas**, e a segunda não é resumo da primeira.
`channels` são as linhas que existem; `branches` responde "por qual número ESTA
loja fala", com a herança já resolvida pelo backend. Uma filial sem linha
própria aparece em `channels` como ausência — e pode estar avisando o cliente
neste minuto pelo número do restaurante.

A tela põe as LOJAS primeiro e os NÚMEROS depois: a consequência antes do
cadastro. E `can_send` é **copiado** do backend, nunca deduzido — ele sai da
mesma consulta que o envio usa (`resolve_for_branch`), e uma segunda forma da
mesma pergunta do lado de cá diria "tudo certo" no dia em que a regra do envio
mudasse.

### 2. "Nunca conectou" e "conectou e caiu" são a mesma ausência na tela

E são consertos opostos. `situacaoDaLoja` (`src/whatsapp/whatsapp-model.ts`)
separa cinco casos, e três deles saem todos de `source: 'none'` ou de
`can_send: false`:

| Estado          | Como se lê                                                     |
| --------------- | -------------------------------------------------------------- |
| `propria`       | número próprio, no ar                                          |
| `propria-caida` | número próprio caído — **e ela NÃO cai no do restaurante**     |
| `herdada`       | sem número próprio, falando pelo do restaurante                |
| `herdada-caida` | sem número próprio, e o do restaurante — que ela usaria — caiu |
| `nunca`         | nunca teve número, e não há do que herdar                      |

**A armadilha do meio é do backend e é a que mais engana:** `resolve_for_branch`
só faz a queda acontecer quando a filial não tem linha NENHUMA. Filial com
número próprio desligado simplesmente para de mandar — o que se espera de um
número desligado, e o contrário do que "herança" quer dizer no resto do painel.

---

## O que a tela NÃO faz, e por quê

- **Não recorta pela filial do topo.** A rota aceita `branch_id`; o painel não o
  manda. O contrato diz que a forma sem recorte "é a principal, porque o dono
  precisa do mapa, não de uma loja por vez" — e esta tela é sobre herança, que
  uma loja por vez não mostra. Mesma decisão de Usuários, e a ressalva está
  escrita ao lado do título. `/whatsapp` entrou em `e2e/escopo.spec.ts` por
  isso: se um dia ela passar a recortar, o id vai ter de sair de algum lugar, e
  é esse "algum lugar" que a isca mede.

  **Esta é a exceção que mais se parece com esquecimento**, porque o parâmetro
  existe e está a uma linha de distância — e por isso ela está escrita também em
  `scratchpad/escopo-de-tenant.md` §4, ao lado da de Usuários, que é onde alguém
  vai olhar antes de "consertar".

- **Não monta a frase do estado a partir do enum.** `status_label` e
  `status_action` chegam prontos. O código serve para o painel DECIDIR (qual
  botão, qual etiqueta); a frase serve para a pessoa LER.
- **Não mostra mensagens.** Não há rota de histórico de aviso nem de reenvio
  manual — o reenvio do que falhou é do servidor. A ajuda da tela diz isso.
- **Não mostra o token, nem parcial.** Ele entra por `POST` e não volta em rota
  nenhuma. Na reconexão o campo nasce vazio, e o `waba_id` também: a leitura o
  devolve MASCARADO (`••••7890`), e mandar a máscara de volta cadastraria uma
  conta que não existe.

---

## Detalhes que custariam caro e ficaram presos em teste

- **Os tetos do Pydantic** (`waba_id` 64, `phone_number_id` 64,
  `display_phone_number` 32) não saem no `/openapi.json`. Estão em `LIMITES`,
  num lugar só, com a classe de origem nomeada — skill `rapidex-api` §4.8.
- **As quatro recusas de cadastro** estão no falso do e2e com a frase do backend
  letra por letra (§4.10): filial inexistente (404), número de outro restaurante
  (409, e a frase **não** diz de quem ele é), número de outra filial sua (409,
  nomeando a filial) e lugar ocupado (409, dizendo por qual número aquele lugar
  fala hoje).
- **O falso guarda a LINHA e deriva a vista**, como o backend — e a ORDEM da
  derivação é regra: a desconexão da Meta vence a nossa. Guardar `status` pronto
  faria o e2e concordar com qualquer derivação, inclusive a que confunde os dois
  estados que a tela existe para separar.
- **A DATA SÓ APARECE ONDE ELA É VERDADE — e são dois casos de três.**
  `connected_at` não é coluna: o backend o monta de `updated_at`, que tem
  `onupdate`. Desconectar escreve na linha, então o próprio 200 do `DELETE` já
  volta com `connected_at` valendo o INSTANTE DA DESCONEXÃO.

  A primeira versão da célula escrevia "No ar desde 25/08" embaixo de "Desligado
  no painel" — duas frases que se contradizem. A segunda trocou por "Conectado
  em 25/08", que é PIOR: continua sendo uma data errada, agora com uma frase que
  soa exata. A terceira não diz data nenhuma no estado `disabled`.

  **O falso era mais frouxo que o backend exatamente aqui** (§4.10): ele não
  movia `connected_at` no `DELETE`, e por isso os 14 testes ficaram verdes sobre
  a data errada. Hoje ele move, e há teste de AUSÊNCIA — conferido por mutação:
  devolvendo a frase, ele fica vermelho.

  Falta coluna no backend, e o pedido está em `pedidos-ao-backend.md` §4.
  Achado na captura, não no teste.

---

## O que mudou fora da tela

- **`Integrações` saiu do menu** (decisão registrada em `src/layout/nav.ts`), e
  com ela a última entrada `soon`. Consequências reconciliadas nesta rodada:
  - a foto `em-breve` de `e2e/capturas.spec.ts` saiu — ficou sem assunto — e
    entrou uma foto `whatsapp`, que mostra as duas heranças lado a lado;
  - **o pé da lateral ficou com UM item para o atendente** ("Loja"), porque o
    WhatsApp ganhou `acao` de leitura (GERENCIA) e Integrações sumiu.
    `nav.test.ts` passou a cobrar a invariante só nos grupos **com rótulo
    pintado**: o que um grupo de um custa é a linha de texto acima dele, e o pé
    não pinta rótulo (`AppShell.tsx`). O teste novo ao lado cobra o que sobrou —
    o pé nunca pode SUMIR, porque é a única porta do balcão para Loja.
- **As quatro varreduras de `escopo.spec.ts` viraram `test.slow()`.** Com 22
  telas o orçamento de 30s ficava a segundos do teto e falhava na máquina
  carregada — §11 da skill `revisao`, portão que muda de resposta conforme quem
  o roda. Encurtar a lista de telas seria encurtar o que a varredura mede.

---

## O que a próxima sessão precisa saber

- **Não há tela de mensagens, e não é lacuna do painel**: não existe rota. Se um
  dia houver, o lugar dela é aqui e a pergunta é "este cliente foi avisado?".
- **`disconnected_by_meta` é o único estado cujo conserto não é nosso.** O botão
  "Conectar de novo" existe nele de propósito — quem já religou na Meta precisa
  de caminho de volta —, e é a frase do backend ao lado que impede o clique
  inútil. Se um dia isso se mostrar insuficiente na mão do lojista, o conserto é
  a frase, não o botão.
- **O restante da lista de `pedidos-ao-backend.md` continua de pé**: criar
  filial, apagar produto/categoria, apagar setor de impressão, logo do
  restaurante, credencial do gateway e nota fiscal.
