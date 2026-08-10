# Três direções para o painel do lojista

Abra cada `index.html` direto no navegador — são páginas estáticas, sem build.
Cada uma mostra **Pedidos, Cardápio e Minha loja**, nos **dois temas**, com a
**lateral completa** (os onze itens do produto, inclusive os que ainda não têm
tela).

```
design/direcoes/
  brasa/   tokens.css · direcao.css · index.html
  papel/   tokens.css · direcao.css · index.html
  sinal/   tokens.css · direcao.css · index.html
  comparar.css   o andaime da folha — não é de nenhuma direção
  estampar.js    estampa as 3 telas × 2 temas — não vai para o app
```

## O que é igual nas três

A **estrutura** não está em disputa: ela mudou nas três do mesmo jeito, porque
as três mudanças são de organização, não de estilo.

- **O quadro tem três faixas, não sete colunas.** Novos / Em preparo / Prontos
  e na rua. O pedido caminha da esquerda para a direita dentro da faixa e de
  cima para baixo entre elas.
- **Concluído e cancelado saíram do quadro** e viraram a aba **Histórico**. São
  consulta, não trabalho: ocupavam duas das sete colunas com o que ninguém toca
  durante o turno.
- **A barra de filtros não abre e não fecha.** Período, busca e prazo de preparo
  ficam escritos na tela o turno inteiro.
- **Minha loja perdeu as seis abas** e virou coluna única com âncoras.
- **Um só componente de pedido** e **um só interruptor** no sistema.

## O que está em disputa

| | **Brasa** | **Papel** | **Sinal** |
| --- | --- | --- | --- |
| Referência | cozinha às 22h, equipamento | cardápio impresso, comanda | painel de partidas, sala de controle |
| Tema principal | escuro | claro | escuro |
| Neutro | fuligem **quente** | papel pardo **quente** | grafite **frio** |
| Marca | laranja (perto do selo) | **bordô** | **azul-sinal** |
| Interface | Space Grotesk | IBM Plex Sans | Barlow |
| Título | Space Grotesk | **Fraunces** (serifa) | Barlow |
| Número | **JetBrains Mono** | tabular da própria sans | **Barlow Condensed**, 26px |
| Raio | 2 / 3 / 4 | **0** | **cápsula / 8 / 12** |
| Lateral | console **escuro nos dois temas** | papel, sem plano próprio, só um fio | painel sólido, item ativo em cápsula cheia |
| Pedido | cartão com fio de status e **barra de brasa** | **cupom**: fio em cima, corte fino embaixo | módulo com **testeira** e número de quadro |
| Linha de lista | grade com filete | **pontilhado** ligando nome e preço | grade com bloco de status |
| Textura | hachura a 45° na lateral | trama de papel no chão | hachura refletiva só na faixa vazia |
| Degradê | sim — **só** na barra de maturação | não | não |
| Ícones | traço 1,75 · ponta reta · canto vivo | traço 1,25 · ponta redonda · desenho solto | traço 2,5 · ponta reta · geométrico |

## O que já está garantido nas três

Cada `tokens.css` passa nos **106 pares de contraste** de
`scripts/check-contrast.mjs`, nos dois temas — a mesma régua que o `npm run
lint` aplica. Nenhuma das três precisa de concessão de acessibilidade para ser
escolhida.

Cada `direcao.css` também já obedece à regra de aderência: nenhuma cor, corpo
de fonte ou raio escrito à mão fora do `tokens.css` da direção. A vencedora
pode ser levantada inteira.

## O que estas páginas NÃO são

Mockup para escolher direção, não a tela final. Em particular:

- Minha loja mostra **3 das 6 seções** — o suficiente para julgar o ritmo da
  coluna única e das âncoras.
- Não há celular, não há estado vazio, não há diálogo, não há a Cozinha.
- Os dados são fixos e iguais nas três, de propósito: o que muda de uma folha
  para a outra é só o desenho.
