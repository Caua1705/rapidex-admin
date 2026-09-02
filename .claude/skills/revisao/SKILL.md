---
name: revisao
description: Checklist de revisão de código do Admin Rapidex — os sete defeitos que já chegaram à mão do lojista aqui e que nenhuma ferramenta acusa: estado que diverge entre telas, campo que some do corpo do PATCH, permissão que existe na tela e não na rota, controle preso ao `:hover` (invisível no toque), alvo menor que 44px, dinheiro que atravessa como número quando o vizinho vai como string, e barra de salvar que não gruda. Leia ao revisar diff, PR ou rodada antes de dar por pronta, e ao terminar qualquer alteração em `src/`. Não substitui `npm run lint`/`typecheck`/`test` — é o que sobra depois deles.
---

# Revisão de código do Admin Rapidex

O `typecheck` diz que os tipos batem. O `lint` diz que a cor saiu de um token e
que o contraste passa. O `test` diz que a função devolve o que a asserção pede.

**Nenhum dos três pegou um só dos sete defeitos abaixo.** Todos compilaram,
passaram, subiram, e apareceram na tela de quem estava no balcão. Esta lista é
o que se lê com o olho depois que as ferramentas ficam verdes — e ela não é
genérica: cada item tem o caso real, com o commit, e o arquivo onde o conserto
mora hoje.

Ordem de leitura: **1 a 3 fazem o painel mentir sobre dado; 4 a 7 fazem o
painel ficar inutilizável para quem está de pé, com o dedo, no meio do turno.**
Os dois grupos custam igual.

---

# 1. Estado que diverge entre telas

**A pergunta:** essa regra já está escrita em outro lugar? Se está, esta cópia
vai divergir da outra — a questão é só quando.

Duas expressões da mesma verdade não se reconciliam sozinhas. Quem erra é a
tela do lojista, em silêncio, e o sintoma aparece longe do dia da mudança.

**O caso real — o item que saiu de venda sozinho (`c0116c2`).** A regra
"produto com grupo obrigatório sem opção disponível está fora de venda" morava
no backend, em SQL, e **também** em `menu/required-groups.ts`, em TypeScript,
sobre grupos que a listagem do cardápio nem carrega. Hoje o estado ATUAL sai de
`unavailable_by_required_group`, lido em `menu-model.ts`; o arquivo em
TypeScript ficou existindo só para a pergunta que nenhuma rota responde ("e se
eu desativar esta opção agora?").

**O segundo caso, mais barato de cometer:** a navegação é desenhada em dois
lugares — a lateral (`AppShell`) e a barra de baixo (`BottomBar`). Um `filter`
de permissão copiado nos dois é a forma conhecida de o item sumir de um e ficar
no outro. Por isso existe **um** `useNavGroups` (`layout/use-nav.ts`), e não um
filtro em cada componente.

Onde isto reaparece:

| Regra                            | A fonte única                                           | Quem consome                  |
| -------------------------------- | ------------------------------------------------------- | ----------------------------- |
| Qual é o próximo passo do pedido | `orders/order-actions.ts`                               | a linha e o rodapé do detalhe |
| A máquina de estados             | o backend; `orders/order-status.ts` é ESPELHO declarado | os botões oferecidos          |
| O que este papel enxerga         | `layout/use-nav.ts`                                     | lateral e barra de baixo      |
| Rótulo de dia da semana          | `WEEKDAYS` em `store/business-hours.ts`                 | toda tela de horário          |

Um espelho declarado (como `order-status.ts`) é aceitável quando está escrito
QUEM ganha na divergência e qual é o estrago máximo. Um espelho por acidente,
não.

**No diff, procure:** a mesma condição escrita em dois arquivos; um `filter` de
permissão dentro de um componente; um cálculo que reproduz o que um campo da
resposta já traz.

---

# 2. Campo que some no corpo do PATCH

**A pergunta:** o corpo que sobe tem todos os campos que a rota interpreta — e
a ausência de um deles significa o que você acha que significa?

No contrato do Rapidex, **ausente, `null` e valor são três coisas diferentes**,
e a diferença é a razão de várias rotas existirem separadas:

- **campo ausente** — não mexe;
- **`null` explícito** — apaga, ou volta a herdar;
- **valor** — passa a usar este.

Sem o terceiro estado não haveria como desfazer uma sobrescrita de filial: a
loja ficaria com a cópia congelada para sempre (`AdminBranchSettingsUpdate`, e
a rodada `36ec41f` — "vazio é herdando, e ele não vira null sozinho").

**O caso real que custa mais caro:** o rascunho de edição de produto sai de
`productDraftFrom` (`menu/menu-model.ts`), e o corpo do PATCH manda
`catalog_key` **sempre**. Um rascunho montado à mão que esqueça a chave
**desfaz o pareamento de um item porque alguém corrigiu o preço dele** — e o
relatório que soma as duas lojas numa linha passa a somar menos, sem erro em
tela nenhuma.

Os casos em que a lista curta apaga o que ficou de fora:

- `PUT /admin/branches/{id}/business-hours` **troca a semana inteira**. Dia
  ausente = dia fechado. Monte com `weekPayload()`.
- `PATCH /admin/categories/reorder` recebe a **lista completa** de ids.
  Use `categoryIdsForReorder`, nunca uma lista filtrada pela busca.

E o inverso: `printing_sector_id: null` significa **"não imprimir comanda deste
item"**. Omitir o campo não é a mesma coisa que mandar nulo.

**No diff, procure:** um `if (x !== undefined)` montando corpo; um spread de
rascunho que perdeu uma chave; uma lista que veio de um `.filter()` indo para
uma rota que substitui. A skill `rapidex-api` §5 tem a tabela completa.

---

# 3. Permissão que aparece na tela mas não na rota

**A pergunta:** este botão chama uma rota que este papel pode chamar? E o corpo
que ele monta não carrega um campo que o papel não pode escrever?

A regra do painel é **SOME, NÃO DESABILITA** (`3cc2b11`): desabilitado sem
explicação é pior que ausente — a pessoa fica tentando, e um `title` não
sobrevive ao toque. Nada disso é segurança: quem recusa é o backend, sempre.
Isto é sobre não prometer o que não se cumpre.

**O caso real — o campo de preço que dava 403 ao reenviar o mesmo valor.**
`PATCH /admin/products/{id}` é da gerência e edita nome, descrição, categoria e
preço pela MESMA rota. Só que **o preço é do dono**. Esconder o campo da tela
não bastou: o rascunho vinha preenchido com o preço atual e o backend confere
`if payload.price is not None` — reenviar o valor **igual** é 403 do mesmo
jeito. O conserto foi tirar o campo do **corpo**, e o e2e confere isso no
corpo, não na tela.

**O segundo caso, que ninguém previu:** os relatórios ganharam `branch_id` na
revisão `20260820_0026` do backend e o painel não soube. Sem o parâmetro, o
gerente levava 403 na tela inteira. Faturamento **exige** recorte para a
gerência — sem `branch_id` a consulta soma as lojas todas, e o resultado da
Aldeota não é do gerente do Centro. A tela PEDE a filial em vez de disparar
cinco requisições que voltam 403.

**Falha fechado:** `role` é `str` no contrato; papel desconhecido vira `null` e
`pode(null, …)` é falso em tudo. Um quinto papel no backend esconde botões em
vez de mostrar os que vão dar 403.

**No diff, procure:** botão novo sem `pode('...')`; ação nova que não entrou em
`auth/permissions.ts`; corpo de PATCH montado a partir de um rascunho completo
quando um dos campos é de outro papel; rota nova consumida sem conferir se ela
aceita `branch_id`.

---

# 4. Controle que depende de `:hover`

**A pergunta:** este controle existe para quem está com o dedo?

Num aparelho de toque `:hover` **nunca é verdade**. Um controle que só aparece
no hover não está discreto — ele **não existe** para quem usa o painel no
balcão.

**O caso real — o lápis invisível no balcão (`c0116c2`).** `.item__edit`,
`.item__reorder` e `.rail__reorder` nasciam com `opacity: 0` e apareciam no
`:hover`. Editar um item do cardápio era impossível no tablet do balcão, e as
setas de reordenar — que são a alternativa que a **WCAG 2.5.7** exige para o
arrastar — estavam invisíveis. _Uma alternativa invisível não é alternativa._

O conserto está em `menu/MenuPage.css` e vale pela **CAPACIDADE do aparelho, não
pela largura da janela**:

```css
@media (hover: none) {
  .item__edit,
  .item__reorder,
  .rail__reorder {
    opacity: 1;
  }
}
```

Um tablet de 1024px com tela sensível ao toque tem o mesmo problema de um
telefone de 390. `@media (max-width: …)` sozinho não o alcança.

**E a verificação tem uma armadilha própria:** redimensionar a janela do
navegador **não** ativa `@media (hover: none)`. Sem emular a capacidade de toque
por _device descriptor_, a varredura confere o desktop duas vezes e conclui que
está tudo certo — foi por isso que a auditoria de `3e7ad94` teve de dizer isso
por escrito. O `e2e/capturas.spec.ts` fotografa em 390px, mas em `Desktop
Chrome`: **ele não cobre este item.**

**No diff, procure:** `opacity: 0` / `visibility: hidden` / `display: none`
revertido por `:hover` ou `:focus-within`; `.grupo:hover .filho`; qualquer
controle cuja única entrada seja o ponteiro.

---

# 5. Alvo menor que 44px

**A regra:** 24px mínimo (WCAG 2.5.8), **44px no celular**. No toque nada
encolhe.

**O caso real — doze achados, um motivo só (`3e7ad94`).** `.btn--sm` optava por
sair da regra de 44px no toque e `.btn--sm.icon-btn` fixava a largura em 28:
**todo botão de ícone do painel media 28×34 no celular** — o sino que avisa que
entrou pedido, o "Atualizar agora", o "Fechar detalhe", o lápis do cardápio.

O conserto **não engorda o desenho**: cresce a área que responde ao dedo, num
pseudo-elemento invisível (`styles/primitives.css`, bloco `@media (hover:
none)`), com duas regras que valem a pena entender antes de copiar:

- **a altura sempre estica; a largura só tem PISO** (`width: 100%` +
  `min-width: var(--tap-mobile)`). Um botão de texto de 107px continua com
  107px de alvo e não ganha 44px de sobra invisível de cada lado, que roubaria
  o clique do vizinho;
- **botão desabilitado não ganha o pseudo-elemento** — alvo estendido em
  controle inerte só serve para cobrir o vizinho que ainda funciona.

**A exceção declarada:** botões que se ENCOSTAM. Os passos de preparo
(+5/+10/−5) se tocam de propósito e a sobra caía sobre o vizinho — medido, "−5"
roubava 6,5px de "+10". Lá o alvo cresce de verdade, em `orders/OrdersPage.css`.

**Altura que vem do conteúdo é a origem mais comum do defeito**, e ela não
aparece em nenhuma folha de estilo: a fita de categorias media 42px porque a
altura saía de "nome + contagem", e o filtro de período media 21px — reprovava
até na régua de ponteiro. Onde a altura importa, ela é **dita**
(`min-height: var(--tap-mobile)`).

**No diff, procure:** `--tap-mobile` / `--control-h-touch` ausentes num controle
novo; `height` ou `width` literal em botão de ícone; controle cuja altura vem só
do texto; e a soma **alvo + vão** entre dois controles vizinhos.

---

# 6. Dinheiro que atravessa como número quando o vizinho atravessa como string

**A pergunta:** este valor é dinheiro? Então como é que o campo ao lado dele
está indo?

Vários corpos do contrato aceitam `number | string | null` no mesmo campo — e o
TypeScript aceita os dois sem piscar. Do outro lado é `Decimal` do Python.
Mandar `50.1` como número deixa a conversão para o `float` do JSON, e um valor
de 50,10 pode chegar **50,099999**.

**O caso real:** `min_ticket` / `max_ticket` do filtro de Clientes. Um recorte
de "ticket mínimo 50,10" que chega 50,099999 **recorta uma linha de menos, sem
nada acender** — a tela mostra uma lista plausível que está errada. Por isso
`customers/customer-filters.ts` manda os dois como STRING de duas casas:

```ts
const min = parseDecimal(state.minTicket);
if (min.ok && min.value !== null) query.minTicket = min.value.toFixed(2);
```

`toFixed(2)` é a mesma escolha que o resto do painel faz para dinheiro.

**O contraponto, para não virar regra cega:** a média de nota (`average` em
`AdminReviewSummary`) é `float` de propósito e **não** segue esta regra — média
de nota não é dinheiro, não tem centavo e não precisa de casa fixa. A pergunta é
"isto é dinheiro?", não "isto é decimal?".

**E os que nem são dinheiro nem decimal:** as datas vão **cruas**. Elas já são o
dia da OPERAÇÃO (`America/Fortaleza`), saem de um `input type="date"` que
devolve AAAA-MM-DD sem fuso, e passar por `Date` no meio do caminho
reintroduziria o fuso do navegador.

**No diff, procure:** um valor monetário indo direto como `number`; um campo de
dinheiro novo ao lado de outro que já usa `.toFixed(2)`; `parseFloat` sem
`parseDecimal`/`formatDecimalInput` (`store/settings-model.ts`) na entrada e na
saída do campo.

---

# 7. Barra de salvar que não gruda

**A pergunta:** o ancestral que rola é mesmo o que você acha que é?

Este é o item mais específico da lista e ele está aqui porque o defeito era
**perda de dado**, não acabamento.

**O caso real (`3e7ad94`).** Com o formulário de Geral sujo numa tela de 844px,
a `store-save-bar` estava em **y=1204** — fora da tela, no fim do documento,
exatamente onde o botão morava ANTES de existir uma barra grudenta, e
exatamente o que `store/SaveBar.tsx` foi escrito para impedir: _"quem editava um
campo do meio e trocava de aba perdia a alteração sem nunca ter visto que havia
algo para salvar"_.

**A causa não era o `bottom`, era o CONTÊINER.** `position: sticky` gruda dentro
do ancestral que ROLA. `.store__col` declara `overflow-y: auto` e por isso era o
ancestral eleito — mas no telefone a moldura não tem altura fixa (`.shell` é
`min-height`, não `height`): a coluna cresce com o conteúdo,
`scrollHeight === clientHeight`, e quem rola é a **página**. _Sticky num
contêiner que não rola não tem contra o que grudar._

O conserto foi devolver a rolagem para quem já estava rolando (`overflow:
visible` na coluna, em `store/StorePage.css`), com dois cuidados que andam
juntos:

- a barra para **acima** da barra de baixo do shell, não na borda do viewport —
  ali mora a navegação do celular;
- a coluna ganha `padding-bottom` do tamanho das duas barras, senão o último
  campo fica permanentemente coberto quando há algo para salvar.

**No diff, procure:** `position: sticky` novo — e suba a árvore atrás de cada
`overflow` no caminho; `overflow-y: auto` acrescentado num ancestral de algo que
gruda; barra fixa sem `padding-bottom` correspondente no conteúdo. E confira em
**altura de telefone**, não só em largura: o defeito só aparece quando o
documento é mais alto que a tela.

---

# Como se roda a revisão

As ferramentas primeiro — elas eliminam o que não vale o olho:

```bash
npm run typecheck   # o contrato bate
npm test            # a lógica
npm run lint        # ESLint + tokens + contraste + hash da CSP
npx playwright test # o caminho de ponta a ponta
```

Depois a leitura, na ordem dos sete itens. E, para uma rodada visual, as fotos:

```bash
CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --workers=1
```

As imagens saem em `capturas/` (ignorada pelo git) e são para **olhar**. Duas
coisas que elas **não** cobrem, e que precisam de navegador na mão: `@media
(hover: none)` (item 4 — o arnês roda em `Desktop Chrome`) e a rolagem de um
documento mais alto que a tela (item 7).

## O que uma revisão não faz

**Nunca "corrigir" teste removendo cobertura.** Quando o comportamento muda de
propósito, a asserção muda de **forma** e continua cobrindo o mesmo requisito —
foi o que aconteceu com o agrupamento vazio: "a coluna não escreve 'Nenhum
pedido'" virou "a coluna não é desenhada".

E um achado de revisão que vira uma rodada de trabalho não se conserta de
carona: ele volta como proposta (skill `proposta`).

---

# O checklist

Estado e dado:

- [ ] Alguma regra deste diff já está escrita no backend ou em outra tela?
- [ ] Todo corpo de PATCH leva os campos que a rota interpreta, e a ausência de
      cada um significa o que se quis dizer?
- [ ] Toda rota que substitui recebeu a lista **completa**?
- [ ] Todo botão novo tem papel, e nenhum corpo carrega campo de outro papel?
- [ ] Todo valor de dinheiro atravessa do mesmo jeito que o vizinho?

Toque e tela:

- [ ] Nenhum controle depende de `:hover` para existir?
- [ ] Todo alvo novo tem 44px no celular — inclusive os que tiram a altura do
      conteúdo?
- [ ] Todo `sticky` novo tem um ancestral que de fato rola, conferido em altura
      de telefone?

E, por último, a pergunta que fecha: **o que nesta rodada só apareceria depois
de uma semana em produção?** Os sete itens acima são as respostas que já foram
dadas. A oitava ainda não tem nome.
