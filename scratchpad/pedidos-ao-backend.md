# Pedidos ao backend, prontos para colar

Cada item aqui é uma coisa que o painel não consegue fazer e que **não se
resolve do lado de cá**. O formato é o de sempre: o que falta, por que o painel
precisa, e o que já existe no backend que torna o pedido barato.

---

## 1. `DELETE /admin/products/{id}` e `DELETE /admin/categories/{id}`

> **Cole daqui para baixo.**

Falta apagar item e categoria do cardápio. Hoje o painel só sabe **desativar**
(`is_active: false`), e desativar resolve o cliente — o item some da vitrine —
mas não resolve o lojista: a linha errada continua na lista dele, todo dia, para
sempre. Uma categoria criada com o nome errado fica na barra do cardápio até
alguém entrar no banco.

**Isso não é hipótese de tela.** É o item C.1 da auditoria do painel, e a única
saída hoje é `DELETE` na mão, no banco de produção.

**O modelo de dados já está pronto para isso**, e é o que torna o pedido barato:

- `order_items.product_id` é **nullable**, e tudo que o histórico precisa já
  está congelado na própria linha do item vendido —
  `product_name_snapshot`, `product_description_snapshot`,
  `unit_price_snapshot`, `catalog_key_snapshot`, `product_code_snapshot`;
- `admin_report_repository.py:205` já diz, por escrito, que
  _"`product_id` e nullable na tabela (produto pode ter sido apagado)"_ — o
  relatório de mais vendidos agrupa por `catalog_key_snapshot`, e não pelo id;
- `SET NULL` já é o arranjo usado em `customer_address_id`,
  `admin_error_reports.branch_id` e `admin_error_reports.admin_user_id`.

**O que falta de fato são duas linhas e uma rota.** A FK
`order_items.product_id → products.id` está declarada **sem `ondelete`**
(`order_item_model.py:18`), então um `DELETE` hoje estoura `IntegrityError` —
vira 500 — em qualquer produto que já tenha sido vendido uma vez. O pedido é:

1. migração pondo `ondelete="SET NULL"` nessa FK (e na equivalente da
   categoria, se houver);
2. `DELETE /admin/products/{id}` e `DELETE /admin/categories/{id}`, com o mesmo
   escopo de papel do `PATCH` correspondente.

Se apagar categoria com item dentro for para ser recusado, um **409 com frase**
("Esvazie a categoria antes de apagá-la") resolve — o painel já sabe mostrar a
frase de um 409, e é assim que ele trata o nome repetido de setor e a forma de
pagamento repetida.

**O que NÃO estou pedindo, e vale dizer para ninguém gastar sprint nisso:**
idempotência no `POST`. Ver o item 2 abaixo.

---

## 2. Idempotência no `POST /admin/products` — **NÃO precisa**

Isto entrou na lista por engano meu, e fica registrado para não voltar.

A suspeita era: o painel diz "não gravou" sobre um item que gravou, o lojista
aperta de novo, e nasce a segunda linha no cardápio do cliente. **O backend já
barra isso**, e barra bem:

- `uq_products_branch_slug` (revisão `20260820_0026`) é único em
  `(branch_id, slug)`, e `slug` deriva do nome;
- `AdminMenuService._ensure_product_slug_is_free` confere antes e responde
  **409 "Já existe um produto com esse nome nesta filial"** — com frase, em vez
  de deixar o `IntegrityError` virar 500;
- categoria tem o par exato: `uq_categories_branch_slug` e o 409
  "Já existe uma categoria com esse nome nesta filial".

Ou seja, o clique repetido já é uma recusa legível, não uma linha nova. O que
sobrava era **do lado do painel** — ele dizia "não gravou" sobre um item criado,
e o lojista batia no 409 logo em seguida, lendo duas frases que se contradizem.
Isso foi consertado em `8d96520`, na tela.

**Uma consequência a registrar:** o painel nunca exercitou esses dois 409, e o
falso do e2e **não os dubla** — ele monta o slug e insere, sem conferir nada. É
um caso do §4.10 da skill `rapidex-api` (o falso mais frouxo que o backend), e
está sendo fechado na rodada do Cardápio.

---

## 3. Outras lacunas de rota já levantadas (auditoria C.1)

Sem detalhamento aqui — estão na auditoria com o motivo de cada uma. Em ordem
do que mais dói:

| O que                         | Falta                                            |
| ----------------------------- | ------------------------------------------------ |
| **Criar filial**              | não existe `POST /admin/branches`                |
| **Apagar setor de impressão** | não existe `DELETE /admin/printing-sectors/{id}` |
| **Logo do restaurante**       | `logo_path` só é servido na API da vitrine       |
| **Credencial do gateway**     | nenhuma rota `/admin`; hoje é linha de banco     |
| **Nota fiscal**               | não existe nem tabela                            |

**O WhatsApp saiu desta lista em 05/09/2026.** O backend entregou
`GET`/`POST /admin/whatsapp/channels` e
`DELETE /admin/whatsapp/channels/{channel_id}`, e a tela foi construída — ver
`scratchpad/rodada-whatsapp.md`. Fica registrado o que a linha dizia antes,
porque o engano é fácil de repetir: o contrato de 2026-09-03 já trazia
`/webhooks/whatsapp`, e ele é a **entrada da Meta no backend**, não a
configuração do lojista. Uma rota com o nome certo no caminho errado não é a
rota que a tela precisa.

**Integrações também saiu**, e por outro motivo: o item foi removido do menu em
vez de virar tela. As três coisas que o `soon` dela prometia ou não estão sendo
construídas ou já moram em outro lugar do painel — o porquê está em
`src/layout/nav.ts`.
