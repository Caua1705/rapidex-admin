/**
 * A linha da paginação do quadro. Ela só existe quando há o que paginar.
 *
 * O QUE SAIU DAQUI, EM DUAS RODADAS:
 *
 *   1. Sete cartões de resumo que repetiam, número por número, os contadores
 *      do cabeçalho de cada coluna — logo abaixo, na mesma ordem e na mesma
 *      cor. Custavam 90px de altura do quadro.
 *   2. O total do período ("3 pedidos no período"). Ele parecia uma informação
 *      nova, e não era: é a SOMA dos sete contadores de coluna, que estão
 *      visíveis na mesma tela, na mesma dobra. Contador que o olho consegue
 *      somar do que já está na tela não é um dado — é uma linha a menos de
 *      pedido. O contador ficou onde o olho já está: na coluna.
 *
 * O QUE SOBROU é a única coisa que a tela não diz sozinha: que existem pedidos
 * do período FORA da página carregada. Isso não sai de nenhum contador — a
 * lista é paginada, e as colunas mostram o que veio.
 *
 * FATURAMENTO NÃO ENTRA: não existe rota que o devolva. O que há é
 * `/admin/reports/commission`, que é base de comissão da plataforma, por
 * intervalo de datas e sem recorte por filial — outra grandeza. Mostrá-la como
 * "faturamento do dia" seria inventar um número que vira decisão.
 */
export function PeriodLine({
  total,
  loaded,
  isLoading,
  onLoadMore,
}: {
  /** Total de pedidos do filtro, direto do backend. */
  total: number;
  /** Quantos desses já estão na tela — a lista é paginada. */
  loaded: number;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  if (loaded >= total) return null;

  return (
    <div className="period" data-testid="period-summary">
      <span>
        <span className="tnum" data-testid="summary-loaded">
          {loaded}
        </span>{' '}
        de{' '}
        <span className="tnum period__total" data-testid="summary-total">
          {total}
        </span>{' '}
        {total === 1 ? 'pedido do período na tela' : 'pedidos do período na tela'}
      </span>

      <button
        type="button"
        className="btn btn--sm btn--ghost"
        onClick={onLoadMore}
        disabled={isLoading}
      >
        {isLoading ? 'Carregando…' : 'Carregar mais'}
      </button>
    </div>
  );
}
