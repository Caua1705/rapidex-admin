/**
 * Uma linha, com o total do período. Nada mais.
 *
 * O QUE ELA SUBSTITUIU: sete cartões de resumo que repetiam, número por
 * número, os contadores que já estão no cabeçalho de cada coluna do quadro —
 * logo abaixo, na mesma ordem e na mesma cor. Era a mesma informação duas
 * vezes na mesma tela, e a de cima custava 90px de altura do quadro.
 *
 * O contador por status ficou onde o olho já está: na coluna. O que a coluna
 * NÃO responde é "quantos pedidos no dia inteiro", porque isso é a soma de
 * sete lugares — e é só isso que sobrou aqui.
 *
 * O número vem de `GET /admin/orders/status-counts`, que conta o PERÍODO
 * inteiro do filtro. Contar os pedidos carregados diria "12" num dia de 300,
 * porque a lista é paginada.
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
  const faltaCarregar = loaded < total;

  return (
    <div className="period" data-testid="period-summary">
      <span>
        <span className="mono period__total" data-testid="summary-total">
          {isLoading && total === 0 ? '—' : total}
        </span>{' '}
        {total === 1 ? 'pedido no período' : 'pedidos no período'}
      </span>

      {/*
        A paginação só se anuncia quando há o que paginar. Ela morava num
        rodapé próprio, que era uma faixa inteira da tela para dizer "3 de 3" —
        a frase que menos muda o que o lojista faz em seguida.
      */}
      {faltaCarregar ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            <span className="mono">{loaded}</span> na tela
          </span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onLoadMore}>
            Carregar mais
          </button>
        </>
      ) : null}
    </div>
  );
}
