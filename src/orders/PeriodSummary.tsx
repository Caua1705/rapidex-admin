import { BOARD_COLUMNS, columnCount } from './board-columns';

/**
 * O resumo do período, acima do quadro.
 *
 * O QUE ELE RESPONDE: "como está o dia?" — a pergunta que hoje só era
 * respondida contando cards com o olho, coluna por coluna, e que erra assim que
 * uma coluna passa da altura da tela.
 *
 * DE ONDE VÊM OS NÚMEROS: do mesmo `GET /admin/orders/status-counts` que já
 * alimenta os badges das colunas — nenhuma requisição nova. É melhor que contar
 * os pedidos carregados: a lista é paginada em 50, então somar o que está em
 * memória diria "12 concluídos" num dia de 300. O contador do backend conta o
 * PERÍODO inteiro do filtro, que é exatamente o que a barra promete.
 *
 * O QUE ELE NÃO MOSTRA: faturamento. Não existe rota que o devolva — o que há é
 * `/admin/reports/commission`, que é a base de comissão da plataforma, por
 * intervalo de datas e sem recorte por filial. Não é a mesma grandeza, e
 * apresentá-la como "faturamento do dia" seria inventar um número. O lugar dele
 * na grade está preparado; o número entra quando a rota existir.
 */
export function PeriodSummary({
  counts,
  total,
  isLoading,
}: {
  /** Contagem por status do backend, para o período filtrado. */
  counts: Record<string, number>;
  /** Total de pedidos do filtro, que é o que o backend também devolve. */
  total: number;
  isLoading: boolean;
}) {
  return (
    <div className="summary" data-testid="period-summary">
      <div className="summary__stat summary__stat--total">
        <span className="summary__label">Pedidos no período</span>
        <span className="summary__value mono" data-testid="summary-total">
          {isLoading && total === 0 ? '—' : total}
        </span>
      </div>

      {/*
        Uma célula por coluna do quadro, na mesma ordem e com a mesma matiz:
        quem lê o resumo e desce o olho para o quadro encontra as caixas na
        mesma sequência. Ordem diferente aqui obrigaria a reler os rótulos.
      */}
      {BOARD_COLUMNS.map((column) => (
        <div
          key={column.key}
          className={`summary__stat status-${column.statuses[0]}`}
          data-testid={`summary-${column.key}`}
        >
          <span className="summary__label">
            <span className="summary__dot" aria-hidden="true" />
            {column.title}
          </span>
          <span className="summary__value mono">{columnCount(column, counts)}</span>
        </div>
      ))}
    </div>
  );
}
