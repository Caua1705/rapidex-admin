import type { ReactNode } from 'react';

import { DataTable, type Column } from '../ds/DataTable';
import { DayChart } from './DayChart';
import {
  formatCurrency,
  labelFor,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orders/format';
import { STATUS_LABELS } from '../orders/order-status';
import {
  dayLabel,
  paymentMethodLabel,
  previousLabelFor,
  readChange,
  toNumber,
  type PerformancePreset,
} from './report-model';
import { RANKING_SIZE, usePerformance } from './usePerformance';
import type { MetricComparison } from '../api/types';
import './PerformancePage.css';

const PERIODOS: readonly { value: PerformancePreset; label: string }[] = [
  { value: 'last7', label: '7 dias' },
  { value: 'last30', label: '30 dias' },
  { value: 'custom', label: 'Escolher…' },
];

/**
 * ============================================================================
 * DESEMPENHO — as seis rotas de relatório, e nada além delas
 * ============================================================================
 *
 * O QUE ESTA TELA NÃO TEM, E POR QUÊ:
 *
 * - **Não tem gráfico por hora.** Não existe rota por hora no contrato: o mais
 *   fino que o backend entrega é o dia (`/reports/sales-by-day`). Não há lugar
 *   reservado nem "em breve" para ele — espaço guardado para uma tela que
 *   ninguém prometeu construir é ruído permanente.
 *
 * - **Não filtra por filial, E DIZ ISSO.** Nenhuma das seis rotas aceita
 *   `branch_id`. Como o seletor de filial do cabeçalho continua visível em
 *   toda tela do painel, ele ficaria aqui parecendo um filtro que pegou — e o
 *   lojista leria o faturamento de duas lojas como o de uma. A tela escreve o
 *   escopo uma vez, em cima, do lado do período: um seletor que não filtra é
 *   pior que um seletor ausente, mas um seletor que não filtra E AVISA deixa
 *   de mentir.
 *
 * O AVISO DE ESCOPO É DITO UMA VEZ, e não uma vez por seção (§8 da skill de
 * design): a mesma caixa repetida em seis blocos vira listra, não aviso.
 */
export function PerformancePage() {
  const { range, problem, reports, errors, isLoading, selectPreset, setCustomDate } =
    usePerformance();
  const { summary, byDay, payments, products, cancellations, commission } = reports;
  const anterior = previousLabelFor(range.preset);

  return (
    <div className="perf">
      <header className="perf__head">
        <h1 className="t-title">Desempenho</h1>
        <p className="t-aux perf__nota">
          Faturamento, pedidos, ticket médio, o dia a dia do período, formas de pagamento, produtos
          mais vendidos, cancelamentos e a comissão da plataforma.
        </p>
      </header>

      <div className="perf__barra">
        <div className="seg" role="group" aria-label="Período">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.value}
              type="button"
              className="seg__opt"
              aria-pressed={range.preset === periodo.value}
              onClick={() => selectPreset(periodo.value)}
              data-testid={`perf-period-${periodo.value}`}
            >
              {periodo.label}
            </button>
          ))}
        </div>

        {range.preset === 'custom' ? (
          <div className="perf__datas">
            <input
              className="input"
              type="date"
              value={range.startDate}
              onChange={(event) => setCustomDate({ startDate: event.target.value })}
              aria-label="Data inicial"
            />
            <span className="faint" aria-hidden="true">
              até
            </span>
            <input
              className="input"
              type="date"
              value={range.endDate}
              onChange={(event) => setCustomDate({ endDate: event.target.value })}
              aria-label="Data final"
            />
          </div>
        ) : null}

        {/*
          O ESCOPO, ESCRITO. Ele fica ao lado do período de propósito: os dois
          juntos são o recorte inteiro do que está na tela, e é aí que o olho
          vai antes de ler qualquer número.
        */}
        <p className="perf__escopo" data-testid="perf-escopo">
          Estes números somam <strong>todas as filiais</strong> — os relatórios não separam por
          loja, então o seletor de filial do topo não muda nada aqui.
        </p>
      </div>

      {problem ? (
        <p className="alert alert--error perf__alerta" role="alert">
          {problem}
        </p>
      ) : null}

      {isLoading ? <p className="muted perf__estado">Carregando…</p> : null}

      {!isLoading && !problem ? (
        <div className="perf__secoes">
          {/* --- resumo -------------------------------------------------- */}
          <Secao titulo="Resumo" erro={errors.summary}>
            {summary ? (
              <>
                <div className="tiles">
                  <Tile
                    rotulo="Faturamento"
                    valor={formatCurrency(summary.revenue_total)}
                    comparacao={summary.revenue_comparison}
                    anterior={anterior}
                  />
                  <Tile
                    rotulo="Pedidos"
                    valor={String(summary.orders_count)}
                    comparacao={summary.orders_count_comparison}
                    anterior={anterior}
                  />
                  <Tile
                    rotulo="Ticket médio"
                    valor={formatCurrency(summary.average_ticket)}
                    comparacao={summary.average_ticket_comparison}
                    anterior={anterior}
                  />
                </div>

                {/*
                  Os excluídos ficam aqui, colados no faturamento, porque é o
                  faturamento que eles qualificam: "este número não conta N
                  pedidos". Numa seção própria seria um número solto.
                */}
                {summary.excluded_orders_count > 0 ? (
                  <p className="t-aux perf__ressalva">
                    {summary.excluded_orders_count === 1
                      ? '1 pedido não entra nestes números'
                      : `${summary.excluded_orders_count} pedidos não entram nestes números`}{' '}
                    — cancelados, recusados e estornados. O detalhe está em Cancelamentos.
                  </p>
                ) : null}

                <Composicao summary={summary} />
              </>
            ) : null}
          </Secao>

          {/* --- dia a dia ----------------------------------------------- */}
          <Secao
            titulo="Dia a dia"
            nota={
              byDay
                ? `${dayLabel(byDay.period.start_date)} a ${dayLabel(byDay.period.end_date)} · ${
                    byDay.period.days === 1 ? '1 dia' : `${byDay.period.days} dias`
                  }`
                : undefined
            }
            erro={errors.byDay}
          >
            {byDay ? <DayChart days={byDay.days} /> : null}
          </Secao>

          {/* --- entrega × retirada -------------------------------------- */}
          <Secao titulo="Entrega e retirada" erro={errors.summary}>
            {summary ? <TiposDePedido summary={summary} /> : null}
          </Secao>

          {/* --- formas de pagamento ------------------------------------- */}
          <Secao titulo="Formas de pagamento" erro={errors.payments}>
            {payments ? <Pagamentos payments={payments} /> : null}
          </Secao>

          {/* --- produtos ------------------------------------------------ */}
          <Secao
            titulo="Mais vendidos"
            nota={`os ${RANKING_SIZE} primeiros, por unidades`}
            erro={errors.products}
          >
            {products ? <Produtos products={products} /> : null}
          </Secao>

          {/* --- cancelamentos ------------------------------------------- */}
          <Secao titulo="Cancelamentos" erro={errors.cancellations}>
            {cancellations ? <Cancelados cancellations={cancellations} /> : null}
          </Secao>

          {/* --- comissão ------------------------------------------------ */}
          <Secao titulo="Comissão da plataforma" erro={errors.commission}>
            {commission ? <Comissao commission={commission} /> : null}
          </Secao>
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * PEÇAS DA TELA
 *
 * Todas moram aqui, e não em `src/ds/`: nenhuma outra tela do painel tem
 * relatório, e um componente no design system que só um lugar usa é um
 * componente que ninguém sabe manter. Se Cupons ou Cashback chegarem com
 * números parecidos, aí o tile sobe para `ds/`.
 * ======================================================================= */

/** Um bloco da página: título, nota opcional, e o erro DAQUELA seção. */
function Secao({
  titulo,
  nota,
  erro,
  children,
}: {
  titulo: string;
  nota?: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <section className="perf__secao">
      <div className="perf__secao-head">
        <h2 className="t-section">{titulo}</h2>
        {nota ? <span className="t-aux">{nota}</span> : null}
      </div>

      {/*
        O ERRO É DA SEÇÃO, não da tela. As seis rotas vão em paralelo e falham
        separado (ver `usePerformance`): um 500 na comissão não pode apagar o
        faturamento, que é a parte que o lojista veio ver.
      */}
      {erro ? (
        <p className="alert alert--error" role="alert">
          {erro}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * O tile de um número de destaque.
 *
 * O VALOR NÃO LEVA `.tnum`, e isso não contradiz a regra do dinheiro tabular:
 * `.tnum` documenta "este número se compara com o de cima ou o de baixo, numa
 * coluna". Aqui não há coluna — são três valores lado a lado, de grandezas
 * diferentes. Com tabular, cada dígito ganha a largura de um "0" e o número
 * fica frouxo no corpo maior. Dinheiro EM COLUNA (as tabelas abaixo) continua
 * levando a classe.
 */
function Tile({
  rotulo,
  valor,
  comparacao,
  anterior,
}: {
  rotulo: string;
  valor: string;
  comparacao: MetricComparison;
  anterior: string;
}) {
  const leitura = readChange(comparacao, anterior);

  return (
    <div className="tile">
      <span className="tile__rotulo">{rotulo}</span>
      <span className="tile__valor">{valor}</span>
      {/*
        `change_percent` nulo vira "sem comparação", NUNCA 0% — ver
        `readChange`. A tinta é de apoio nos dois casos: uma queda de
        faturamento não é `--danger` (perigo é cancelar e excluir), e uma alta
        não é `--ok` (que é "no ar / à venda"). O sinal já diz a direção.
      */}
      <span className={`tile__delta${leitura.isMissing ? ' tile__delta--vazio' : ''}`}>
        {leitura.text}
      </span>
    </div>
  );
}

/** A composição do faturamento: de onde o número do resumo veio. */
function Composicao({ summary }: { summary: NonNullable<ReturnType<typeof usePerformance>['reports']['summary']> }) {
  const linhas: readonly { rotulo: string; valor: string }[] = [
    { rotulo: 'Itens', valor: summary.breakdown.subtotal_total },
    { rotulo: 'Taxa de entrega', valor: summary.breakdown.delivery_fee_total },
    { rotulo: 'Taxa de serviço', valor: summary.breakdown.service_fee_total },
    { rotulo: 'Descontos', valor: summary.breakdown.discount_total },
    { rotulo: 'Comissão da plataforma', valor: summary.breakdown.commission_total },
  ];

  return (
    <dl className="composicao">
      {/*
        O BLOCO PRECISAVA DE NOME, e isso só apareceu no print: cinco linhas de
        dinheiro logo abaixo dos tiles, sem rótulo nenhum, não dizem que são a
        decomposição do faturamento — parecem mais cinco números do resumo.
        Rótulo de contexto (13px, sem caixa alta), não um sexto nível.
      */}
      <div className="composicao__titulo">De onde vem o faturamento</div>

      {linhas.map((linha) => (
        <div className="composicao__linha" key={linha.rotulo}>
          <dt className="composicao__rotulo">{linha.rotulo}</dt>
          <dd className="composicao__valor tnum">{formatCurrency(linha.valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

type LinhaTipo = { id: string; tipo: string; pedidos: number; receita: ReactNode; fatia: string };

function TiposDePedido({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof usePerformance>['reports']['summary']>;
}) {
  const columns: readonly Column<LinhaTipo>[] = [
    { key: 'tipo', header: 'Tipo' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'receita', header: 'Faturamento', align: 'end' },
    { key: 'fatia', header: 'Fatia', align: 'end' },
  ];

  const rows: LinhaTipo[] = summary.order_types.map((item) => ({
    id: item.order_type,
    tipo: labelFor(ORDER_TYPE_LABELS, item.order_type),
    pedidos: item.orders_count,
    receita: <span className="tnum num">{formatCurrency(item.revenue_total)}</span>,
    fatia: formatPercent(item.revenue_share_percent),
  }));

  return (
    <DataTable
      caption="Faturamento por tipo de pedido"
      captionHidden
      columns={columns}
      rows={rows}
      empty={<p className="muted">Nenhum pedido no período.</p>}
    />
  );
}

type LinhaPagamento = { id: string; forma: ReactNode; pedidos: number; receita: ReactNode; fatia: string };

function Pagamentos({
  payments,
}: {
  payments: NonNullable<ReturnType<typeof usePerformance>['reports']['payments']>;
}) {
  const columns: readonly Column<LinhaPagamento>[] = [
    { key: 'forma', header: 'Forma' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'receita', header: 'Faturamento', align: 'end' },
    { key: 'fatia', header: 'Fatia', align: 'end' },
  ];

  const rows: LinhaPagamento[] = payments.payment_methods.map((item) => {
    /*
     * `payment_method` NULO NÃO VIRA "OUTRO" — ver `paymentMethodLabel`.
     * "Outro" é uma forma de pagamento de verdade, escolhível na configuração
     * da filial; nulo é pedido cuja forma ninguém registrou. A linha sai em
     * tinta de atenção porque é isso que o lojista vai querer investigar.
     */
    const semRegistro = item.payment_method === null || item.payment_method === undefined;
    const rotulo = paymentMethodLabel(item.payment_method, PAYMENT_METHOD_LABELS);

    return {
      id: item.payment_method ?? 'sem-registro',
      forma: semRegistro ? <span className="perf__sem-registro">{rotulo}</span> : rotulo,
      pedidos: item.orders_count,
      receita: <span className="tnum num">{formatCurrency(item.revenue_total)}</span>,
      fatia: formatPercent(item.revenue_share_percent),
    };
  });

  return (
    <DataTable
      caption="Faturamento por forma de pagamento"
      captionHidden
      columns={columns}
      rows={rows}
      empty={<p className="muted">Nenhum pedido no período.</p>}
    />
  );
}

type LinhaProduto = { id: string; produto: string; unidades: number; pedidos: number; receita: ReactNode };

function Produtos({
  products,
}: {
  products: NonNullable<ReturnType<typeof usePerformance>['reports']['products']>;
}) {
  const columns: readonly Column<LinhaProduto>[] = [
    { key: 'produto', header: 'Produto' },
    { key: 'unidades', header: 'Unidades', align: 'end' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'receita', header: 'Receita de item', align: 'end' },
  ];

  const rows: LinhaProduto[] = products.products.map((item, index) => ({
    // `product_id` é nulável (produto apagado depois da venda), e o nome pode
    // repetir entre linhas — o índice desempata sem virar a chave sozinho.
    id: `${item.product_id ?? 'sem-id'}-${index}`,
    produto: item.product_name,
    unidades: item.quantity_total,
    pedidos: item.orders_count,
    receita: <span className="tnum num">{formatCurrency(item.revenue_total)}</span>,
  }));

  return (
    <>
      <DataTable
        caption="Produtos mais vendidos"
        captionHidden
        columns={columns}
        rows={rows}
        empty={<p className="muted">Nenhum item vendido no período.</p>}
      />

      {/*
        A RESSALVA VEM DO BACKEND E FICA COLADA NO NÚMERO QUE ELA RESSALVA.
        `listed_revenue_total` não fecha com o faturamento do resumo — é receita
        bruta de item, sem cupom, cashback nem taxas. Mostrar o total sem a
        frase faria a tela parecer errada em duas somas que discordam; a
        resposta traz o texto pronto em `revenue_note`, então ele é dito com as
        palavras do backend e não com uma paráfrase nossa.
      */}
      {products.products.length > 0 ? (
        <div className="perf__total-ressalvado">
          <p className="perf__total-linha">
            <span>Receita destes itens</span>
            <span className="tnum">{formatCurrency(products.listed_revenue_total)}</span>
          </p>
          <p className="t-aux perf__ressalva">{products.revenue_note}</p>
        </div>
      ) : null}
    </>
  );
}

type LinhaCancelamento = { id: string; situacao: string; pagamento: string; pedidos: number; valor: ReactNode };

function Cancelados({
  cancellations,
}: {
  cancellations: NonNullable<ReturnType<typeof usePerformance>['reports']['cancellations']>;
}) {
  const columns: readonly Column<LinhaCancelamento>[] = [
    { key: 'situacao', header: 'Situação' },
    { key: 'pagamento', header: 'Pagamento' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'valor', header: 'Valor', align: 'end' },
  ];

  const rows: LinhaCancelamento[] = cancellations.breakdown.map((item) => ({
    id: `${item.status}-${item.payment_status}`,
    situacao: labelFor(STATUS_LABELS, item.status),
    /*
      TRADUZIDO. Sem `labelFor` a coluna saía com o valor cru do backend —
      "refunded", "pending" — no meio de uma tela em português. O dicionário
      já existe e é o mesmo do painel de detalhe do pedido; escrever o inglês
      aqui seria a tela falando duas línguas para o mesmo dado.
    */
    pagamento: labelFor(PAYMENT_STATUS_LABELS, item.payment_status),
    pedidos: item.orders_count,
    valor: <span className="tnum num">{formatCurrency(item.amount_total)}</span>,
  }));

  return (
    <>
      <div className="perf__resumo-linha">
        <span>
          {cancellations.orders_count === 1
            ? '1 pedido não virou venda'
            : `${cancellations.orders_count} pedidos não viraram venda`}
        </span>
        <span className="tnum">{formatCurrency(cancellations.amount_total)}</span>
      </div>

      {/*
        A TAXA É SOBRE TODOS OS PEDIDOS DO PERÍODO (faturados + excluídos), e a
        frase diz isso: quem tentar recalcular dividindo pelos faturados vai
        achar outro número e concluir que a tela está errada.
      */}
      <p className="t-aux perf__ressalva">
        {formatPercent(cancellations.cancellation_rate_percent)} de todos os pedidos do período —{' '}
        {cancellations.billable_orders_count} faturados mais {cancellations.orders_count} excluídos.
      </p>

      <DataTable
        caption="Cancelamentos por situação"
        captionHidden
        columns={columns}
        rows={rows}
        empty={<p className="muted">Nenhum pedido cancelado, recusado ou estornado no período.</p>}
      />
    </>
  );
}

function Comissao({
  commission,
}: {
  commission: NonNullable<ReturnType<typeof usePerformance>['reports']['commission']>;
}) {
  return (
    <>
      <div className="perf__resumo-linha">
        <span>Comissão sobre {formatCurrency(commission.commission_base_total)} de base</span>
        <span className="tnum">{formatCurrency(commission.commission_total)}</span>
      </div>

      {/*
        O EXTRATO PEDIDO A PEDIDO NÃO ENTRA NA TELA, e o motivo está escrito.
        `/reports/commission` devolve `orders[]` sem paginação: num período de
        30 dias são todos os pedidos faturados, e uma tabela de trezentas
        linhas no fim de uma página que já tem seis seções é rolagem que
        ninguém percorre. O que a tela mostra é o total — que é a pergunta
        ("quanto a plataforma levou") — e diz quantos pedidos ele soma, para
        que ninguém leia o número como se fosse de um pedido só.

        Isto é um recorte DECLARADO, não um corte silencioso.
      */}
      <p className="t-aux perf__ressalva">
        Soma de {commission.orders_count === 1 ? '1 pedido' : `${commission.orders_count} pedidos`}{' '}
        no período.
        {commission.excluded_orders_count > 0
          ? ` ${commission.excluded_orders_count === 1 ? '1 pedido ficou' : `${commission.excluded_orders_count} pedidos ficaram`} de fora (cancelado, recusado ou estornado).`
          : ''}{' '}
        O extrato pedido a pedido não cabe nesta tela.
      </p>
    </>
  );
}

/**
 * A porcentagem de uma fatia.
 *
 * Nula aqui NÃO é o mesmo caso de `change_percent`: `revenue_share_percent` e
 * `cancellation_rate_percent` vêm nulos quando não há denominador — nenhum
 * pedido no período. Não existe "0%" a escrever, porque não existe o todo do
 * qual seria fatia.
 */
function formatPercent(value: string | null | undefined): string {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  return `${(Math.round(numeric * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
