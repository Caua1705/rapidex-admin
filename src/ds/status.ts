/**
 * Os SETE estágios do pedido, do ponto de vista visual.
 *
 * Eles são a escala de cor de `tokens.css` (`--st-*`) e nada mais: a classe
 * `is-<estágio>` no elemento expõe `--st` e `--st-wash`, e o componente lê as
 * duas sem nunca escolher uma matiz.
 *
 * POR QUE ESTA LISTA NÃO É A DO BACKEND: a máquina de estados do backend tem
 * `rejected` e `cancelled` como coisas diferentes, e visualmente as duas são o
 * mesmo fim de linha. Quem traduz é a tela de pedidos (`src/orders`), no ponto
 * em que ela já conhece o contrato — o design system não sabe o que é um
 * `out_for_delivery`.
 */
export type Stage =
  'pendente' | 'aceito' | 'preparando' | 'pronto' | 'entrega' | 'concluido' | 'cancelado';

/** O rótulo curto de cada estágio. Substantivo ou particípio, nunca frase. */
export const STAGE_LABEL: Record<Stage, string> = {
  pendente: 'Pendente',
  aceito: 'Aceito',
  preparando: 'Preparando',
  pronto: 'Pronto',
  entrega: 'Saiu para entrega',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};
