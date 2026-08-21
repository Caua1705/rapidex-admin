/**
 * Chamadas da tela de Avaliações.
 *
 * Uma rota só: `GET /admin/reviews`. Ela devolve as avaliações do período E o
 * agregado delas no mesmo corpo — não há rota separada de resumo, e isso é
 * decisão do backend: total e média saem do mesmo histograma que desenha as
 * barras, então as duas leituras da tela não têm como discordar.
 *
 * O PERÍODO É OBRIGATÓRIO (`start_date` e `end_date` não são opcionais no
 * contrato) e recorta a data da AVALIAÇÃO, não a do pedido. A descrição da
 * rota é literal: "a pergunta é 'o que os clientes disseram esta semana', e
 * uma nota escrita hoje sobre um pedido de terça pertence a hoje". Quem monta
 * o par de datas é `reviews/review-model.ts`, e elas são AAAA-MM-DD no dia da
 * OPERAÇÃO (America/Fortaleza), não no do navegador.
 *
 * O PAPEL É `GERENCIA`, e não `SOMENTE_DONO` como os relatórios. A divisão lá
 * é "dinheiro do restaurante inteiro é do dono"; avaliação não diz quanto
 * entrou. Por consequência não há aqui nada parecido com
 * `ensure_pode_ler_dinheiro`: o gerente lê sem precisar escolher uma filial
 * antes, e a tela não tem o portão que Desempenho tem.
 */
import { apiClient, unwrap } from './client';
import type { ReviewsResponse } from './types';

export type ReviewFilters = {
  /** AAAA-MM-DD no dia da operação. Obrigatório. */
  startDate: string;
  /** AAAA-MM-DD no dia da operação. Obrigatório, e INCLUSIVO. */
  endDate: string;
  /**
   * Vazio = todas as filiais que o token alcança (§4.3 da skill de API), nunca
   * todas as da plataforma. O filtro só RESTRINGE.
   */
  branchId: string;
  /**
   * "Só notas ATÉ este valor" — de 1 a 5, e o uso real é 3.
   *
   * `null` é "sem recorte de nota", e ele SOME da query em vez de ir nulo: o
   * contrato escreve ausência, não `max_rating=null`.
   *
   * ELE NÃO MEXE NO `summary` — o backend não o aplica ao agregado, de
   * propósito. Ver `ReviewSummary` em `types.ts`: a tela pode filtrar a lista
   * à vontade sem que a média do período se mova.
   */
  maxRating: number | null;
};

/**
 * As avaliações do período, com o agregado junto.
 *
 * SEM ENVELOPE DE PAGINAÇÃO: ao contrário de `/admin/customers` e
 * `/admin/orders`, a resposta não traz `total`, `limit` nem `offset` da LISTA
 * — só `items` e `summary`. E `summary.total` não serve de denominador: ele
 * conta o período inteiro, sem o `max_rating` que recortou a lista.
 *
 * É por isso que quem pagina (`useReviews`) descobre que há mais página pelo
 * tamanho da última resposta, e não por uma subtração. Usar `summary.total`
 * ali faria "Carregar mais" continuar aparecendo depois da última avaliação
 * baixa, pedindo uma página que volta vazia.
 */
export async function listReviews(
  filters: ReviewFilters,
  limit: number,
  offset: number,
): Promise<ReviewsResponse> {
  return unwrap(
    await apiClient.GET('/admin/reviews', {
      params: {
        query: {
          start_date: filters.startDate,
          end_date: filters.endDate,
          ...(filters.branchId ? { branch_id: filters.branchId } : {}),
          ...(filters.maxRating === null ? {} : { max_rating: filters.maxRating }),
          limit,
          offset,
        },
      },
    }),
  );
}
