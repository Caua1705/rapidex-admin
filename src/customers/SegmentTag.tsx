import { SEGMENT_HINT, segmentLabel } from './customer-segment';
import type { CustomerSegment } from '../api/types';

/**
 * A CLASSIFICAÇÃO DE UM CLIENTE, NA LINHA DELE.
 *
 *   <SegmentTag segment="em_risco" />
 *
 * DUAS PISTAS, COMO TODO ESTADO DO SISTEMA (WCAG 1.4.1): a palavra, que é o
 * que o leitor de tela lê, e um ponto na matiz semântica ao lado dela. Nenhuma
 * informação depende só da cor.
 *
 * ----------------------------------------------------------------------------
 * POR QUE NÃO É UM `ds/StatusChip`, E POR QUE NÃO TEM FUNDO TINGIDO
 * ----------------------------------------------------------------------------
 *
 * O chip de status é do PEDIDO: ele carrega a escala `--st-*` (sete estágios) e
 * um wash atrás do texto. Duas coisas o desqualificam aqui.
 *
 * A primeira é de vocabulário. Um `SegmentChip` em `src/ds/` teria que declarar
 * as cinco classes à mão — o design system não pode importar o `openapi.d.ts`
 * gerado, e é essa fronteira que deixa `ds/` compilar sozinho (o mesmo motivo
 * de `orders/OrderLine` existir). Uma união copiada é exatamente a segunda
 * fonte de verdade que a skill de API proíbe: o dia em que o backend
 * acrescentar uma sexta classe, ela continua compilando e a linha sai sem
 * rótulo. Aqui, `Record<CustomerSegment, …>` acende no `npm run typecheck`.
 *
 * A segunda é de densidade. O estágio do pedido é escrito UMA vez por bloco na
 * lista de Pedidos — é coluna mesclada. A classificação é de cada linha, e
 * cinquenta retângulos tingidos descendo uma coluna transformam a tabela em
 * mancha: quem procura os dois "Em risco" no meio de cinquenta chips não os
 * acha mais depressa por eles terem fundo. Sem o wash, quem faz o trabalho de
 * relance é o PONTO — ocre e carmim saltam de uma coluna calma, que é
 * justamente a leitura que a tela precisa ("a quem vale a pena chamar de
 * volta"). É a gramática do chip sem o objeto do chip.
 *
 * A MATIZ SAI DA SEMÂNTICA DE ESTADO, não de uma escala nova: `--info` para o
 * relacionamento recente, tinta comum para o ocasional, `--ok` para o fiel,
 * `--alert` para quem passou do ponto e `--danger` para quem já foi. As cinco
 * classes `is-seg-*` moram em `tokens.css`, junto das `is-<estágio>`, e o
 * componente lê `--seg` sem nunca escolher uma cor.
 *
 * A CLASSE DE ESTILO É `.classe`, E NÃO `.seg`: `.seg` já é o SEGMENTADO do
 * sistema (`styles/primitives.css`), aquele trilho de alternativas com plano
 * `--surface-muted`. Com o nome repetido, a etiqueta nascia com o fundo e o
 * raio do segmentado — cinco pílulas cinzentas descendo a coluna, que é
 * exatamente o objeto que este componente existe para NÃO ser.
 */
export function SegmentTag({ segment }: { segment: CustomerSegment }) {
  const rotulo = segmentLabel(segment);

  /*
   * SEM CLASSE, TRAVESSÃO — e não a etiqueta vazia.
   *
   * É a mesma convenção do ticket médio (`formatAverageTicket`) e das datas
   * (`formatDate`, `formatSince`): quando não dá para saber, o painel escreve
   * um travessão. A célula em branco dizia a mesma coisa de um jeito que
   * ninguém lê como informação — ela lê como falha de carregamento, e foi
   * exatamente assim que a ausência do campo na resposta passou por bug de
   * tela.
   *
   * O PONTO NÃO VEM. Ele é a matiz da classe, e sem classe não há matiz para
   * mostrar: um ponto cinza ao lado de um travessão seria uma etiqueta
   * afirmando uma quinta coisa que não existe.
   *
   * `.muted` é a tinta de "isto não é um valor", a mesma da coluna "Cliente
   * desde" quando a data não veio.
   */
  if (rotulo === null) return <span className="muted">—</span>;

  return (
    <span className={`classe is-seg-${segment}`} title={SEGMENT_HINT[segment]}>
      <span className="classe__ponto" aria-hidden="true" />
      {rotulo}
    </span>
  );
}
