# Painel × vitrine: quem ordena o mesmo dado de jeitos diferentes

> Varredura da classe que o `sort_order` das categorias revelou: **o painel
> ordena de um jeito e o cardápio público de outro.** Cada tela parece certa
> sozinha, e é isso que torna o defeito caro.
>
> Método: todo `order_by` dos repositórios do backend (52 ocorrências) cruzado
> com todo `.sort(` do `src/` (18). Data: 2026-09-02, `rodada/painel-2`.

## O quadro

| Dado                     | Vitrine (o cliente)                                     | Painel                                       | Veredito                         |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------- | -------------------------------- |
| **Categoria**            | `sort_order ASC, name ASC` (NULLS LAST)                 | `sort_order` (nulo no fim) + nome            | ✅ igual — consertado hoje       |
| **Produto**              | `Category.sort_order, Product.sort_order, Product.name` | idem, dentro da categoria                    | ✅ igual — consertado hoje       |
| **Forma de pagamento**   | `payment_flow, sort_order, id`                          | era `sort_order, label`                      | 🔴 **painel errado** — corrigido |
| **Grupo de complemento** | **sem `ORDER BY`**                                      | a ordem do admin (`sort_order, name`)        | 🔴 **vitrine errada** — backend  |
| **Opção do grupo**       | **sem `ORDER BY`**                                      | a ordem do admin                             | 🔴 **vitrine errada** — backend  |
| **Filial**               | `is_main DESC` (NULLS **FIRST**)                        | `is_main DESC NULLS LAST` (do backend admin) | 🟠 **vitrine errada** — backend  |
| **Faixa de entrega**     | `max_distance_km ASC`                                   | `max_distance_km` crescente                  | ✅ igual                         |
| **Arte de cupom**        | `sort_order ASC, name ASC`                              | `sort_order` + nome                          | ✅ igual                         |
| **Horário**              | `weekday, sort_order, id`                               | grade fixa de 7 dias, 1ª faixa de cada       | ⚠️ colapsa, **mas avisa**        |
| **Setor de impressão**   | — (o cliente não vê)                                    | `sort_order` + nome                          | ✅ não se aplica                 |
| **Cupom (lista)**        | `sort_order ASC, created_at DESC`                       | `created_at DESC` (a do admin)               | ⚠️ lacuna, ver abaixo            |

---

## 1. 🔴 Forma de pagamento — o painel estava errado. CORRIGIDO

`branch_repository.list_enabled_payment_methods` (o checkout) e
`admin_settings_repository.list_payment_methods` (o painel) usam **o mesmo
`ORDER BY`**, de propósito: `payment_flow, sort_order, id`. A única diferença
entre as duas consultas é o filtro `enabled`.

O painel reordenava com `sort_order, label` — e o comentário dele dizia, com
todas as letras, ser _"a ordem em que o cliente as vê"_.

**Por que ele errava quase sempre:** toda forma nasce com `sort_order: 0`
(`PaymentMethodsTab` as cria assim, e não há como reordená-las na tela). Todas
empatam, então o **desempate decidia a lista inteira** — o lojista via
"Dinheiro, Pix" e o cliente via a ordem de cadastro.

Corrigido em `store/payment-order.ts`, que reproduz as três chaves e nomeia a
consulta de lá. O `id ASC` é arbitrário e é de propósito: **o que importa não é
o critério ser bonito, é ser o mesmo dos dois lados.**

---

## 2. 🔴 Complemento na vitrine sai em ordem ARBITRÁRIA — bloqueado por backend

O mais grave da lista, e ele **não é do painel**.

```python
# src/models/product_model.py:74
option_groups = relationship("ProductOptionGroup", back_populates="product")
# src/models/product_option_model.py:26
options = relationship("ProductOption", back_populates="option_group")
```

**Nenhum dos dois declara `order_by`**, e `menu_repository.get_active_products`
os carrega com `selectinload(...)` sem ordenar. O admin ordena
(`admin_menu_repository:275` → `sort_order ASC, name ASC`); a vitrine não ordena
nada — o Postgres devolve na ordem que quiser.

**O que isso custa:** o lojista arruma "Escolha o tamanho" antes de
"Adicionais", confere no painel, e o cliente pode ver ao contrário. Pior: o
`sort_order` que o painel passou a gravar corretamente nesta rodada (grupo novo
no fim, posição preservada na edição) **não tem efeito nenhum na vitrine**
enquanto isto não mudar.

**O que o backend precisa:** `order_by` na relação, ou o `ORDER BY` explícito no
`selectinload` —

```python
option_groups = relationship(
    "ProductOptionGroup",
    back_populates="product",
    order_by="ProductOptionGroup.sort_order, ProductOptionGroup.name",
)
```

**Quem está certo:** o painel. A ordem que o lojista monta é a intenção; a
vitrine é que não a respeita.

---

## 3. 🟠 `is_main` nulo ordena ao contrário nos dois lados — bloqueado por backend

```python
# público  — menu_repository.py:29
.order_by(Branch.is_main.desc(), Branch.name.asc())
# admin    — branch_repository.py:49
.order_by(Branch.is_main.desc().nulls_last(), Branch.name.asc())
```

`is_main` é `Mapped[bool | None]` — **anulável**. Em `DESC`, o padrão do
Postgres é **NULLS FIRST**; o admin desfaz isso com `.nulls_last()` explícito, e
o público não.

Resultado: a filial com `is_main = NULL` aparece **em primeiro para o cliente** e
**em último no painel**.

**Quem está certo:** o admin. O `.nulls_last()` é deliberado e está comentado no
arquivo (_"a listagem ja e `is_main DESC NULLS LAST, name ASC`"_) — filial sem
marcação não é a principal, e não deve encabeçar a lista de ninguém.

**O que o backend precisa:** o mesmo `.nulls_last()` em `menu_repository:29`.

---

## 4. ⚠️ Cupom: a vitrine ordena por um campo que o painel não edita

Não é divergência — é lacuna. A vitrine usa `RestaurantCoupon.sort_order ASC,
created_at DESC`; a listagem do painel usa só `created_at DESC`, o que é
defensável (lista de administração, não de exibição).

Só que **o painel não tem como definir o `sort_order` de um cupom**. A ordem em
que as campanhas aparecem para o cliente é decidida por um campo que só existe
em SQL na mão — mesma família das linhas de `auditoria.md` §C.1.

---

## 5. O que NÃO é divergência, conferido

- **Horário.** O painel desenha uma faixa por dia e o backend aceita várias
  (almoço e jantar). Isso é **limitação declarada**, não descuido:
  `hasMultiplePeriods` avisa antes que salvar apague a segunda, e o comentário
  de `weekFromResponse` explica.
- **Faixa de entrega, arte de cupom, setor de impressão.** Iguais, ou só
  existem no painel.

---

## 6. Um limite honesto desta varredura

O desempate por NOME não é comparável daqui. A vitrine usa `name ASC` com a
**collation do Postgres**; o painel usa `localeCompare(nome, 'pt-BR')`. Para
nomes que começam com acento — "Água" contra "Zebra" — uma collation `C`
ordenaria por byte e poria "Zebra" primeiro, enquanto o `pt-BR` põe "Água".

Ele só decide alguma coisa quando `sort_order` empata, e nas duas listas em que
isso aparece (categoria e produto) o painel sabe reordenar, então o empate é
raro. **Não afirmo que divergem: afirmo que não dá para saber daqui** — depende
da collation do banco, que não está no repositório do backend.
