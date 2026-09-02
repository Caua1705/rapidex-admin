# Rodada do painel — estado

> **Leia isto antes de qualquer coisa ao retomar.** Este arquivo é a fonte da
> verdade da rodada, não a memória da sessão. Ele é atualizado NO MESMO COMMIT
> do item que descreve.

Branch: `rodada/painel`, saída de `dev`.
Início: 2026-09-02.

---

## 0. O que foi feito antes de começar

- `CLAUDE.md` lido. Cobre só a regra de git (branch, preview da Vercel).
- As cinco skills do repositório lidas: `git`, `proposta`, `rapidex-api`,
  `rapidex-design-system`, `revisao`.
- **A sidebar reorganizada JÁ ESTÁ na `dev`** — commit `6d58aa7`
  ("navegação: três grupos e um pé"). `dev` está 30 commits à frente da `main`
  e a `main` não tem nada que a `dev` não tenha. Não houve merge a fazer:
  `rodada/painel` saiu da `dev` e já nasceu com a lateral nova.
- `npm ci` foi preciso: o `node_modules` da máquina tinha
  `@fontsource-variable/inter` e o `package.json` pede `ibm-plex-sans`. O
  typecheck falhava por isso, e não por código.
- **Portão verde na base**, lido sem pipe:
  `typecheck 0` · `lint 0` · `test 0` — **61 arquivos, 925 testes**.

---

## 1. A DESCOBERTA QUE MUDA A RODADA

**Os itens 1, 2, 3 e 4 do enunciado JÁ ESTÃO NA `dev`.** A lista da rodada
descreve um painel anterior ao que está no repositório. Cada um foi conferido
no código, não presumido — a evidência está abaixo, item a item.

Isso não é motivo para não trabalhar: sobrou o item 5 (bloqueado, ver §6), a
auditoria do item 6, e **uma rota de backend parada há semanas que a auditoria
achou e que é da mesma família do item 1** (`print-jobs`).

---

## 2. Item por item — o que foi conferido

### Item 1 — Tela de impressão ✅ JÁ EXISTE

Mora em **`/loja/impressao`** (`src/store/PrintingTab.tsx`, 822 linhas), não em
rota de primeiro nível. As três perguntas do enunciado estão respondidas:

| Pergunta do enunciado         | Onde está                                                  |
| ----------------------------- | ---------------------------------------------------------- |
| conectado agora, e desde quando | `agentState` / `agentLabel` / `formatAgo` em `print-sectors/print-agent.ts` |
| quais impressoras ele enxerga | `listPrintAgentPrinters` → `GET /admin/branches/{id}/printers` |
| comanda de teste              | `requestPrintTest` → `POST /admin/branches/{id}/print-test` |

Rotas confirmadas no `openapi.json` do backend (checkout irmão
`../pedeaqui_back`), não supostas.

`is_online` vem do backend (janela de 90s contra o heartbeat de 30s) e a tela
**não** recalcula a partir de `last_seen_at` — decisão certa e documentada no
próprio `src/api/print-agent.ts`.

### Item 2 — Ajustes de pedido ✅ JÁ EXISTE

- **2.1** confirmação ao recusar: `src/orders/RejectOrderDialog.tsx`, e
  `order-actions.ts` marca `confirm: 'recusar'`.
- **2.2** um botão por estado: `advanceActionFor` (o avanço) e `exitActionFor`
  (a saída) em `src/orders/order-actions.ts`. Nunca dois avanços, nunca dois
  destrutivos lado a lado. O mapa de estados está escrito lá e replicado em §3
  deste arquivo.
- **2.3** o "Aceito" desabilitado: resolvido pela raiz — **o rótulo deixou de
  ser o nome do estado e virou verbo** ("Aceitar pedido"). O botão travado que
  dizia "Aceito" lia como "já foi aceito".

### Item 3 — Os dois campos que eram SQL na mão ✅ JÁ EXISTEM

- **3.1** `restaurants.description`: `src/store/BrandTab.tsx` +
  `restaurant-profile.ts` (`DESCRICAO_MAX`, `profilePayload`), gravando por
  `PATCH /admin/restaurant`. Seção **Loja › Marca**.
- **3.2** `unavailable_by_required_group`: `productSaleState` em
  `src/menu/menu-model.ts` devolve `'sem-opcao'`, e `MenuPage.tsx` conta os
  itens nesse estado. O **porquê** nomeado (qual grupo esvaziou) está em
  `src/menu/required-groups.ts`, usado pelo diálogo do produto ANTES de a
  mudança ser aplicada — que é quando o aviso serve.

### Item 4 — Papéis ✅ JÁ EXISTE, e melhor do que o enunciado pedia

Não há divergência viva: o painel **não** trata o 403 depois de tentar. Ele
sabe o mapa antes.

- `scripts/papeis-generate.mjs` **gera** `src/api/generated/papeis.ts` a partir
  de `tests/test_papeis_das_rotas.py` e `src/api/dependencies/admin_scope.py`
  do backend. Rodado nesta sessão: **78 rotas em 60 caminhos**, sem diff.
- **4.2** esconder, não desabilitar: `nav.ts` (campo `acao`), `use-nav.ts` (não
  desenha grupo vazio), `store-sections.ts` (campo `acao` por seção),
  `RequireAuth acao=…` nas rotas.
- **4.3** `print_agent` recusado no painel: `podeEntrarNoPainel()` em
  `src/auth/permissions.ts:465` e a guarda em `SessionProvider.tsx`, que também
  derruba quem já estava dentro de antes da frente. Coberto por
  `permissions.test.ts`.

A matriz está em §4 deste arquivo.

### Item 5 — WhatsApp e Integrações ⛔ BLOQUEADO PELO BACKEND

Ver §6. Não há uma única rota. Nenhuma tela foi escrita.

### Item 6 — Auditoria

Ver §7. Feita, sem commit de código.

---

## 3. O mapa de estados do pedido (pedido pelo item 2.2)

Fonte: `src/orders/order-actions.ts` + `order-status.ts`.

| Estado             | Avanço (primário, laranja, 1 só) | Saída (destrutiva, 1 só, sempre confirma) |
| ------------------ | -------------------------------- | ----------------------------------------- |
| `pending`          | Aceitar pedido → `accepted`      | **Recusar pedido** → `rejected` (`PATCH /status`) |
| `accepted`         | Iniciar preparo → `preparing`    | Cancelar pedido (`PATCH /cancel`, GERENCIA) |
| `preparing`        | Marcar como pronto → `ready`     | Cancelar pedido                            |
| `ready` (delivery) | Enviar para entrega → `out_for_delivery` | Cancelar pedido                    |
| `ready` (retirada) | Concluir pedido → `completed`    | Cancelar pedido                            |
| `out_for_delivery` | Concluir pedido → `completed`    | Cancelar pedido                            |
| terminais          | — (nenhum)                       | — (nenhum)                                 |

Três regras que o mapa carrega e que não são óbvias:

1. **De `ready` quem escolhe é a MODALIDADE, não o lojista.** Oferecer os dois
   deixaria um botão permanentemente travado ao lado do bom.
2. **"Cancelar" não aparece em `pending`.** As duas rotas existem, mas na tela
   seriam duas maneiras de dizer "não vai sair" no mesmo pedido. Recusar é a
   palavra do estágio, e ela também grava o motivo.
3. **A saída não foi para a linha da lista no celular**, só o avanço. Dois
   alvos vizinhos com consequências opostas num alvo de polegar.

---

## 4. A matriz de papéis (pedida pelo item 4.1)

Papéis de `admin_users.role`: `owner`, `manager`, `attendant`, `print_agent`.

Conjuntos, lidos de `admin_scope.py` do backend (não transcritos à mão):

| Conjunto             | Papéis                                        |
| -------------------- | --------------------------------------------- |
| `SOMENTE_DONO`       | owner                                         |
| `GERENCIA`           | owner, manager                                |
| `PESSOAS`            | owner, manager, attendant                     |
| `AGENTE_DE_IMPRESSAO`| print_agent                                   |
| `PESSOAS_E_AGENTE`   | owner, manager, attendant, print_agent        |

O que cada um alcança, por tela:

| Tela / seção         | owner | manager | attendant | print_agent |
| -------------------- | ----- | ------- | --------- | ----------- |
| Entrar no painel     | ✅    | ✅      | ✅        | ⛔ recusado |
| Pedidos              | ✅    | ✅      | ✅        | —           |
| — cancelar pedido    | ✅    | ✅      | ⛔        | —           |
| Cozinha              | ✅    | ✅      | ✅        | —           |
| Cardápio (ver/esgotar)| ✅   | ✅      | ✅        | —           |
| — preço do produto   | ✅    | ⛔¹     | ⛔        | —           |
| Clientes             | ✅    | ✅      | ⛔        | —           |
| Desempenho           | ✅    | ✅²     | ⛔        | —           |
| Avaliações           | ✅    | ✅      | ⛔        | —           |
| Cupons (ver)         | ✅    | ✅      | ⛔        | —           |
| — criar/editar cupom | ✅    | ⛔      | ⛔        | —           |
| Cashback (ver)       | ✅    | ✅      | ⛔        | —           |
| — gravar regra       | ✅    | ⛔      | ⛔        | —           |
| Usuários             | ✅    | ⛔      | ⛔        | —           |
| Loja › Operação      | ✅    | ✅      | ✅        | —           |
| Loja › Impressão     | ✅    | ✅      | ✅³       | —           |
| Loja › Marca/Geral/Valores | ✅ | ⛔     | ⛔        | —           |
| Loja › Filial/Horários/Entrega/Pagamento | ✅ | ✅ | ⛔     | —           |

¹ **Não é regra de rota.** `PATCH /admin/products/{id}` é da GERÊNCIA, mas o
campo `price` é do dono — **quem decide é o CORPO**. Mora à mão em
`src/auth/permissions.ts` (`ensure_pode_definir_preco`), com teste próprio.

² Idem: os relatórios são da GERÊNCIA, mas **o gerente precisa mandar recorte
de UMA filial**; sem `branch_id` na query continua 403. **Quem decide é a
QUERY.** `podeLerDinheiro` em `permissions.ts`.

³ O atendente vê o programa e manda via de teste (é ele que está ao lado da
impressora). O inventário de impressoras e a edição de setores são da gerência,
escondidos controle a controle DENTRO da tela.

**As duas exceções ¹ e ² são a razão de `papeis.ts` sozinho não bastar:** um
mapa rota→papel não alcança regra que depende do corpo ou da query.

---

## 5. O QUE ESTA RODADA ENTREGOU DE CÓDIGO

Como 1–4 já existiam e o 5 está bloqueado, o trabalho foi para a rota que a
auditoria encontrou parada — **da mesma família do item 1, e pelo mesmo
motivo**: existe no backend, o painel nunca chamou, e o lojista fica sem saber
o que sai no papel.

- [x] **contrato regerado** — `amount_below_minimum` entrou no erro de
      pagamento do checkout público. Commit separado, como manda a skill.
- [x] **A comanda deste pedido** — `GET /admin/orders/{order_id}/print-jobs`
      no detalhe do pedido. Ver §5.1.

### 5.1 A comanda deste pedido

**O que a rota é, e o que ela NÃO é.** Ela devolve as vias **já formatadas em
texto de largura fixa**, prontas para a bobina. Ela **não** marca nada como
impresso e **não** é histórico de impressão — o próprio backend diz que
reimprimir é um GET repetido. Então a tela não pode dizer "a comanda saiu": ela
diz **o que sai**, que é a pergunta que o suporte responde por telefone hoje.

Três estados da lista `jobs` que a tela precisa separar, e nenhum é erro:

| `jobs`                    | O que significa                                              |
| ------------------------- | ------------------------------------------------------------ |
| vazia                     | a filial zerou as duas contagens de via desse tipo de pedido |
| só `type: 'customer'`     | pagamento online ainda não confirmado — via de produção não é gerada, é a mesma regra do "aguardando pagamento, não preparar" |
| cliente + produção        | o caso normal                                                 |

**Cópia é ENTRADA REPETIDA, não campo `copies`.** Duas vias do cliente chegam
como dois itens idênticos em sequência. A tela agrupa para exibir ("2 vias"),
mas **nunca** deduplica a contagem.

---

## 6. BLOQUEADO — e o que o backend precisa entregar

### 6.1 WhatsApp (item 5.1) ⛔

**Zero rotas.** Varredura no `openapi.json` do backend (104 caminhos) por
`whats|integr|notif|webhook|message`: o único acerto é
`POST /payments/webhooks/{provider}`, que é o gateway falando com o backend —
nada a ver.

`whatsapp` existe como **campo de texto** em `customers` e no pedido (o número
que o lojista repete). Não há conexão, não há sessão, não há número da loja.

A tela continua sendo a `ComingSoonPage` de `/whatsapp`, que é o certo: item de
navegação que não navega é pior que item ausente.

**Para o painel fechar, o backend precisa de:**

- `GET /admin/branches/{branch_id}/whatsapp` → `is_connected`, `phone_number`,
  `connected_since`, `last_error` — o espelho exato de `print-agent`, que já
  provou ser a forma certa de contar "um programa externo está no ar?".
- `POST /admin/branches/{branch_id}/whatsapp/session` → o QR / pareamento.
- `DELETE …/whatsapp/session` → desconectar.
- `GET /admin/branches/{branch_id}/whatsapp/templates` → quais mudanças de
  status disparam mensagem, e o texto de cada uma.

Sem a primeira, **nenhuma tela**: as outras três são configuração de uma coisa
cujo estado o painel não sabe ler.

### 6.2 Integrações (item 5.2) ⛔

**Zero rotas de integração administrável.** O que existe e poderia ser
confundido com isso:

| Candidato                              | Por que não é a tela de Integrações                    |
| -------------------------------------- | ------------------------------------------------------ |
| `GET /restaurants/{slug}/payment-config`| É a **API pública da vitrine** (sem autenticação). O painel não usa `/restaurants/*` — skill `rapidex-api` §4.3. |
| `POST /payments/webhooks/{provider}`    | Gateway → backend. O painel não tem o que ler nem gravar aqui. |
| Impressora                              | Já tem tela: **Loja › Impressão**. Duplicá-la em Integrações é dois lugares para o mesmo estado. |
| Formas de pagamento                     | Já tem tela: **Loja › Pagamento**. É catálogo de meios, não credencial de gateway. |

**Para o painel fechar, o backend precisa de:**

- `GET /admin/integrations` → uma linha por integração com `provider`,
  `is_connected`, `connected_at`, `scope` (rede ou filial).
- `GET/PATCH /admin/payment-gateway` → credencial do gateway **sem devolver o
  segredo** (só os 4 últimos dígitos e `updated_at`, como todo painel sério
  faz). Hoje isso é linha de banco escrita à mão.
- Nota fiscal: não existe nada, nem tabela. É frente inteira, não rota.

### 6.3 Fora desta rodada por decisão do enunciado (§7 dele)

- Pedido Pix nunca pago entulhando "Novos" — decisão de produto não tomada.
  (Nota: `b90874c` e `3bf8de4` já mexeram nisso; o rodapé de Novos existe.)
- Deploy pelo portão · mudança no backend · merge na `main`.

---

## 7. AUDITORIA (item 6)

Escrita em `scratchpad/auditoria.md` para não afogar este arquivo, que é o de
retomada. **Nenhum conserto foi feito nela** — só lista.

---

## 8. Onde parei

- [x] §0 leitura, branch, portão verde na base
- [x] §2 conferência dos itens 1–4
- [x] contrato regerado, commit separado
- [x] §5.1 a comanda deste pedido
- [x] §6 bloqueios escritos com o que o backend precisa devolver
- [x] §7 auditoria
- [x] skill do repositório e `CLAUDE.md` atualizados
