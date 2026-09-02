---
name: revisao
description: Checklist de revisão de código do Admin Rapidex — os dez defeitos que já chegaram à mão do lojista aqui e que nenhuma ferramenta acusa: estado que diverge entre telas, campo que some do corpo do PATCH, permissão que existe na tela e não na rota, controle preso ao `:hover` (invisível no toque), alvo menor que 44px, dinheiro que atravessa como número quando o vizinho vai como string, barra de salvar que não gruda, erro cujo `detail` é objeto (a tela mostra o número HTTP no lugar da frase), rota que o backend entregou e o painel nunca chamou, e achado que saiu de contagem de `grep` sem ser conferido. Leia ao revisar diff, PR ou rodada antes de dar por pronta, e ao terminar qualquer alteração em `src/`. Não substitui `npm run lint`/`typecheck`/`test` — é o que sobra depois deles.
---

# Revisão de código do Admin Rapidex

O `typecheck` diz que os tipos batem. O `lint` diz que a cor saiu de um token e
que o contraste passa. O `test` diz que a função devolve o que a asserção pede.

**Nenhum dos três pegou um só dos dez defeitos abaixo.** Todos compilaram,
passaram, subiram, e apareceram na tela de quem estava no balcão. Esta lista é
o que se lê com o olho depois que as ferramentas ficam verdes — e ela não é
genérica: cada item tem o caso real, com o commit, e o arquivo onde o conserto
mora hoje.

Ordem de leitura, em quatro grupos que custam igual:

- **1 a 3 — o painel mente sobre dado.** Estado que diverge, campo que some do
  corpo, permissão que a rota não tem.
- **4 a 7 — o painel fica inutilizável para quem está de pé, com o dedo, no
  meio do turno.**
- **8 e 9 — a funcionalidade não existe, e nada fica vermelho.** O erro que o
  painel não sabe ler e a rota que ele nunca chamou. Estes dois são os mais
  caros justamente porque não deixam rastro: o `typecheck` está feliz, os
  testes passam, e quem descobre é o lojista.
- **10 — o defeito é de quem revisa.** Achado que saiu de contagem e não foi
  conferido no arquivo.

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

# 8. Erro cujo `detail` é um OBJETO — a mensagem vira um número HTTP

**A pergunta:** esta rota responde algum erro com `detail` estruturado? Se
responde, o painel está mostrando a frase que o backend escreveu, ou o código
HTTP?

`readDetailMessage` (`api/errors.ts`) sabe ler três formas de erro: `detail`
como **string**, `detail` como **lista de validação do Pydantic**, e
`{ error: { message } }`. Uma quarta forma existe no contrato e ele não a
conhece: **`detail` como objeto**, com `code`, `message` e mais campos. Objeto
não é string e não é array, então as três leituras falham, e o painel cai em
`fallbackMessageFor(status)` — que escreve "A requisição falhou (428)".

**O caso real — o cancelamento que não acontece.**
`PATCH /admin/orders/{id}/cancel` a partir de `preparing` responde **428** com
`{ detail: { code, message, order_status } }`, e o contrato diz com todas as
letras que **isso não é erro**: "o painel abre o diálogo de confirmação e
reenvia". O `message` vem, nas palavras do backend, "pronta para ser mostrada no
diálogo de confirmação do painel".

O painel manda `confirm_prepared_order: false` fixo, não tem o segundo diálogo,
e mostra ao lojista **"A requisição falhou (428)."** Efeito prático: a partir do
momento em que alguém aperta "Iniciar preparo", o pedido não pode mais ser
cancelado pelo painel — nem por dono, nem por gerente.

**Por que nenhuma ferramenta pega:** o `typecheck` confere o corpo da resposta
de SUCESSO. O corpo de erro é `unknown` — é dado, não tipo. E o e2e fala com
`e2e/fake-api.ts`, escrito por nós: **um dublê que nunca devolve 428 nunca
acusa que o painel não sabe lê-lo.** É a forma mais barata de um portão de mil
casos ficar verde sobre um defeito.

**O padrão maior, e ele vale além do 428:** um status de erro que o contrato
descreve como "não é erro, o painel faz X" é uma **funcionalidade escrita como
resposta HTTP**. Ler isso como falha genérica não perde a mensagem: perde a
funcionalidade inteira.

**No diff, procure:** rota nova cujo contrato declare 4xx com schema próprio
(não `HTTPValidationError`); qualquer `409`, `422`, `428`, `402` com `detail`
que não seja `string`; um `catch` que joga tudo em `messageFromUnknownError`
sem olhar `error.status`.

---

# 9. Rota que o backend entregou e o painel nunca chamou

**A pergunta:** o que existe no contrato e não é chamado por ninguém?

Este não é defeito de código — é defeito de ATENÇÃO, e é o mais caro da lista
porque não deixa rastro nenhum. Nada fica vermelho. O `typecheck` está feliz, o
`lint` está feliz, os testes passam. A funcionalidade simplesmente não existe, e
o lojista liga para o suporte.

**Os casos reais:**

| Rota                                          | Ficou parada                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET/POST/PATCH` de `option-groups` (4 rotas) | semanas — complemento é só leitura no painel, e montar "Escolha o tamanho" virou SQL na mão    |
| `GET /admin/orders/{id}/print-jobs`           | ~20 dias — o lojista não via o que sai no papel                                                |
| `POST /admin/error-reports`                   | desde que entrou — e o painel não tem `ErrorBoundary`, então a tela branca não chega a ninguém |

**A varredura, e ela leva trinta segundos:**

```bash
grep -rn "apiClient\.\(GET\|POST\|PATCH\|PUT\|DELETE\)" src/api/*.ts \
  | sed "s/.*apiClient\.\([A-Z]*\)(\s*'\([^']*\)'.*/\1 \2/" | sort -u > /tmp/usadas.txt

node -e "
const d=require('../pedeaqui_back/openapi.json'), fs=require('fs');
const back=new Set(Object.entries(d.paths).flatMap(([p,o])=>p.startsWith('/admin')
  ? Object.keys(o).filter(m=>'get post patch put delete'.includes(m)).map(m=>m.toUpperCase()+' '+p) : []));
const usadas=new Set(fs.readFileSync('/tmp/usadas.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean));
console.log('NAO USADAS:'); [...back].filter(r=>!usadas.has(r)).sort().forEach(r=>console.log(' ',r));
console.log('INVENTADAS:'); [...usadas].filter(r=>!back.has(r)).sort().forEach(r=>console.log(' ',r));
"
```

**Os cinco falsos positivos conhecidos**, que aparecem toda vez e não são
lacuna: `GET /admin/orders/stream` (é `EventSource`, não passa pelo
`openapi-fetch`), `POST /admin/print-agent/heartbeat` e
`POST /admin/print-agent/printers` (é a MÁQUINA falando, não o painel), e as
rotas do agente que o painel nunca deve chamar. O resto é para explicar.

**Rode isto ao começar uma rodada, não ao terminar.** Metade do que se pediria
como "tela nova" já tem rota pronta esperando, e a outra metade não tem rota
nenhuma — e as duas descobertas mudam o que vale a pena propor.

---

# 10. Contagem de `grep` não é achado — é onde olhar

**A pergunta:** este número saiu de uma contagem de ocorrência de palavra? Então
abra os arquivos antes de escrever a conclusão.

Não é defeito do painel: é defeito de quem revisa, e por isso está aqui.

**O caso real, cometido nesta auditoria.** Uma varredura por
`isLoading|Carregando|Spinner` acusou **cinco páginas sem estado de
carregamento**, incluindo o `LoginPage` — "o lojista aperta Entrar no 3G e nada
muda". Abrindo os arquivos: `LoginPage` tem `submitting`, escreve "Entrando…" e
desabilita o botão; `StoreIndexPage` e `StoreSectionPage` não carregam nada
(são o roteador das seções); `ComingSoonPage` não tem o que carregar. **As cinco
estavam certas.** O grep é que não conhecia o nome da variável.

Refeita com os nomes que o repositório de fato usa
(`isSending|isSaving|submitting|Salvando|Enviando|disabled=`), as onze abas de
Loja e os dez diálogos têm todos algum estado.

**O custo do erro é assimétrico, e é por isso que ele vale um item:** um falso
NEGATIVO deixa um defeito passar; um falso POSITIVO manda consertar uma tela que
não está quebrada, e isso custa uma rodada inteira. Achado que sai de contagem e
não é conferido no arquivo **não entra na lista**.

**E quando um achado seu não sobreviver à conferência, deixe-o escrito, riscado
e com o motivo.** Uma revisão que só mostra o que confirmou não deixa ninguém
calibrar quanto confiar no resto dela.

---

# Como se roda a revisão

As ferramentas primeiro — elas eliminam o que não vale o olho:

```bash
npm run typecheck   # o contrato bate
npm test            # a lógica
npm run lint        # ESLint + tokens + contraste + hash da CSP
npx playwright test # o caminho de ponta a ponta
```

Depois a leitura, na ordem dos dez itens. E, para uma rodada visual, as fotos:

```bash
CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --workers=1
```

As imagens saem em `capturas/` (ignorada pelo git) e são para **olhar**. Duas
coisas que elas **não** cobrem, e que precisam de navegador na mão: `@media
(hover: none)` (item 4 — o arnês roda em `Desktop Chrome`) e a rolagem de um
documento mais alto que a tela (item 7).

**E, ANTES de tudo isso, a varredura do item 9** — o que o backend entregou e
o painel nunca chamou. Ela é a única que muda o que vale a pena fazer na rodada,
então ela vem primeiro, não por último.

> **Leia o `format:check` também, e leia-o SEM pipe.** Ele é o PRIMEIRO passo
> do job `verificar` no CI, e passo que falha derruba o job: `lint`,
> `typecheck`, `test` e `build` não chegam a rodar. Em 2026-09-02 ele estava
> vermelho em 41 arquivos e ninguém tinha reparado — um portão de mil casos
> atrás de uma porta fechada protege exatamente nada. Um `| tail` engole o
> código de saída e reproduz o mesmo silêncio de propósito.

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
- [ ] Alguma rota deste diff responde 4xx com `detail` que não seja string? A
      tela mostra a frase do backend, ou o número HTTP?
- [ ] Rodei a varredura de rota parada, e sei explicar cada sobra?

Toque e tela:

- [ ] Nenhum controle depende de `:hover` para existir?
- [ ] Todo alvo novo tem 44px no celular — inclusive os que tiram a altura do
      conteúdo?
- [ ] Todo `sticky` novo tem um ancestral que de fato rola, conferido em altura
      de telefone?

Método:

- [ ] Todo achado meu que saiu de contagem de `grep` foi conferido no arquivo?
- [ ] O portão foi lido SEM pipe, `format:check` incluído?

E, por último, a pergunta que fecha: **o que nesta rodada só apareceria depois
de uma semana em produção?** Os dez itens acima são as respostas que já foram
dadas. A décima primeira ainda não tem nome.
