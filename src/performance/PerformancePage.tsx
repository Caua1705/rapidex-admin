import type { ReactNode } from 'react';

import { DataTable, type Column } from '../ds/DataTable';
import { DayChart } from './DayChart';
import {
  formatCurrency,
  labelFor,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orders/format';
import { STATUS_LABELS } from '../orders/order-status';
import {
  readCancelamento,
  readConcentracao,
  readDesconto,
  readDiaFraco,
  readPagamento,
  readRetirada,
  readTicketOuVolume,
  readVeredito,
  semMovimento,
  type Insight,
} from './insights';
import { dayLabel, previousLabelFor, readChange, toNumber } from './report-model';
import { RANKING_SIZE, usePerformance } from './usePerformance';
import type {
  Cancellations,
  CommissionReport,
  MetricComparison,
  ProductSales,
  SalesSummary,
} from '../api/types';
import type { PerformancePreset } from './report-model';
import './PerformancePage.css';

const PERIODOS: readonly { value: PerformancePreset; label: string }[] = [
  { value: 'last7', label: '7 dias' },
  { value: 'last30', label: '30 dias' },
  { value: 'custom', label: 'Escolher…' },
];

/**
 * ============================================================================
 * DESEMPENHO — uma tela que RESPONDE, não que exibe
 * ============================================================================
 *
 * A PREMISSA: o dono de restaurante não lê relatório. Ele não abre o painel
 * para estudar — abre para saber se a semana foi boa e o que fazer amanhã. Um
 * painel que exige interpretação já falhou.
 *
 * O QUE ISSO MUDA, CONCRETAMENTE:
 *
 * - **A primeira coisa da tela é uma FRASE, não um número.** Ela sai de regras
 *   determinísticas sobre o que as rotas devolvem (`insights.ts`), sem IA e sem
 *   estimativa. Os três números crus vêm depois dela, em peso reduzido, para
 *   quem quiser conferir a conta.
 * - **Toda frase tem limiar nomeado**, e frase cuja condição não bate não
 *   aparece. Não há frase neutra de preenchimento.
 * - **O que não tem resposta boa nos dados ficou de fora.** Formas de pagamento
 *   eram uma tabela de quatro colunas; hoje são uma linha de texto na última
 *   seção, e só quando uma forma concentra o risco (ver `readPagamento`).
 *
 * O QUE ESTA TELA CONTINUA NÃO TENDO, E POR QUÊ:
 *
 * - **Não tem gráfico por hora.** Não existe rota por hora no contrato: o mais
 *   fino que o backend entrega é o dia (`/reports/sales-by-day`).
 * - **Não filtra por filial, E DIZ ISSO.** Nenhuma das rotas aceita
 *   `branch_id`. Como o seletor de filial do cabeçalho continua visível em toda
 *   tela do painel, ele ficaria aqui parecendo um filtro que pegou.
 *
 * O AVISO DE ESCOPO É DITO UMA VEZ, e não uma vez por seção (§8 da skill de
 * design): a mesma caixa repetida em seis blocos vira listra, não aviso.
 */
export function PerformancePage() {
  const { range, problem, reports, errors, isLoading, selectPreset, setCustomDate } =
    usePerformance();
  const { summary, byDay, byDayPrevious, payments, products, cancellations, commission } = reports;
  const anterior = previousLabelFor(range.preset);
  const vazio = semMovimento(summary);

  return (
    <div className="perf">
      <header className="perf__head">
        <h1 className="t-title">Desempenho</h1>
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
          O ESCOPO, ESCRITO — e ele não encolhe nem sai quando não há venda. Ele
          fica ao lado do período de propósito: os dois juntos são o recorte
          inteiro do que está na tela, e é aí que o olho vai antes de ler
          qualquer número (ou qualquer frase).
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

      {/*
        SEM VENDA NO PERÍODO É UMA TELA, NÃO SEIS SEÇÕES ZERADAS.

        Um faturamento de R$ 0,00, um ticket de R$ 0,00, um gráfico de barras
        rentes ao chão e quatro tabelas vazias não dizem "não vendeu": dizem "a
        tela quebrou", e o lojista sai procurando o erro no painel em vez de
        olhar para o período. A frase afirma o que aconteceu, e os pedidos
        excluídos continuam ali — porque zero faturado com três cancelados é
        exatamente o caso em que os três precisam ser vistos.
      */}
      {!isLoading && !problem && vazio && summary ? (
        <section className="perf__vazio" data-testid="perf-vazio">
          <p className="perf__frase perf__frase--topo">
            Nenhum pedido foi faturado neste período.
          </p>
          <Excluidos summary={summary} />
        </section>
      ) : null}

      {!isLoading && !problem && !vazio ? (
        <div className="perf__secoes">
          {/* ================================================================
              A. A FRASE

              Pergunta que a seção responde: A SEMANA FOI BOA?

              Ela não é um cartão e não tem título de seção: um rótulo
              "Resumo" em cima da resposta a rebaixaria a mais um bloco de
              relatório. É a única coisa da tela que fala em frase inteira, e é
              a primeira que o olho encontra.
             ================================================================ */}
          <section className="perf__resposta">
            {errors.summary ? (
              <p className="alert alert--error" role="alert">
                {errors.summary}
              </p>
            ) : summary ? (
              <>
                <p className="perf__frase perf__frase--topo" data-testid="perf-veredito">
                  {readVeredito(summary, byDay, byDayPrevious, anterior).text}
                </p>

                <Frase insight={readTicketOuVolume(summary)} />

                {/*
                  OS NÚMEROS CRUS VÊM DEPOIS DA FRASE E EM PESO REDUZIDO — eles
                  não são a resposta, são a conferência dela. Sem cartão: três
                  caixas com sombra aqui competiriam com a frase e devolveriam a
                  tela ao formato de painel de indicadores que a premissa
                  recusa.
                */}
                <dl className="numeros">
                  <Numero
                    rotulo="Faturamento"
                    valor={formatCurrency(summary.revenue_total)}
                    comparacao={summary.revenue_comparison}
                    anterior={anterior}
                  />
                  <Numero
                    rotulo="Pedidos"
                    valor={String(summary.orders_count)}
                    comparacao={summary.orders_count_comparison}
                    anterior={anterior}
                  />
                  <Numero
                    rotulo="Ticket médio"
                    valor={formatCurrency(summary.average_ticket)}
                    comparacao={summary.average_ticket_comparison}
                    anterior={anterior}
                  />
                </dl>

                <Excluidos summary={summary} />
              </>
            ) : null}
          </section>

          {/* ================================================================
              B. OS DIAS

              Pergunta: QUE DIAS SUSTENTARAM O PERÍODO E QUAIS NÃO APARECERAM?
             ================================================================ */}
          <Secao
            titulo="Os dias"
            nota={
              byDay
                ? `${dayLabel(byDay.period.start_date)} a ${dayLabel(byDay.period.end_date)} · ${
                    byDay.period.days === 1 ? '1 dia' : `${byDay.period.days} dias`
                  }`
                : undefined
            }
            erro={errors.byDay}
          >
            {byDay ? (
              <>
                <DayChart days={byDay.days} />
                <Frase insight={readDiaFraco(byDay)} />
              </>
            ) : null}
          </Secao>

          {/* ================================================================
              C. O QUE VENDEU

              Pergunta: O FATURAMENTO VEIO DE ONDE?
             ================================================================ */}
          <Secao
            titulo="O que vendeu"
            nota={`os ${RANKING_SIZE} primeiros, por unidades`}
            erro={errors.products}
          >
            {products ? <Produtos products={products} /> : null}
          </Secao>

          {/* ================================================================
              D. ENTREGA E RETIRADA

              Pergunta: ESTOU GANHANDO MAIS ENTREGANDO OU O CLIENTE VINDO
              BUSCAR?
             ================================================================ */}
          <Secao titulo="Entrega e retirada" erro={errors.summary}>
            {summary ? (
              <>
                <TiposDePedido summary={summary} />
                <Frase insight={readRetirada(summary)} />
              </>
            ) : null}
          </Secao>

          {/* ================================================================
              E. O QUE NÃO VIROU VENDA

              Pergunta: ESTOU PERDENDO PEDIDO EM QUÊ?
             ================================================================ */}
          <Secao titulo="O que não virou venda" erro={errors.cancellations}>
            {cancellations ? <Cancelados cancellations={cancellations} /> : null}
          </Secao>

          {/* ================================================================
              F. O QUE SAI DO FATURAMENTO

              Pergunta: QUANTO SOBROU, DE VERDADE?

              É aqui que a forma de pagamento aparece — em uma linha de texto, e
              só quando ela concentra risco. Ver `readPagamento`.
             ================================================================ */}
          <Secao titulo="O que sai do faturamento" erro={errors.summary}>
            {summary ? (
              <>
                <Composicao summary={summary} />
                <Frase insight={readDesconto(summary)} />
                {errors.commission ? (
                  <p className="alert alert--error" role="alert">
                    {errors.commission}
                  </p>
                ) : commission ? (
                  <Comissao commission={commission} />
                ) : null}
                <Frase insight={readPagamento(payments)} />
              </>
            ) : null}
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
 * componente que ninguém sabe manter.
 * ======================================================================= */

/**
 * Uma frase de leitura dos dados.
 *
 * `null` NÃO RENDERIZA NADA — e é este componente que faz a regra valer na
 * tela: sem ele, cada ponto de uso precisaria do seu próprio ternário, e o
 * primeiro que escrevesse `?? 'Período estável'` traria de volta a frase de
 * preenchimento que a premissa recusa.
 */
function Frase({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <p className="perf__frase" data-testid={`perf-frase-${insight.id}`}>
      {insight.text}
    </p>
  );
}

/**
 * A linha dos pedidos excluídos — permanente, e colada no faturamento porque é
 * o faturamento que ela qualifica: "este número não conta N pedidos".
 */
function Excluidos({ summary }: { summary: SalesSummary }) {
  if (summary.excluded_orders_count <= 0) return null;
  return (
    <p className="t-aux perf__ressalva" data-testid="perf-excluidos">
      {summary.excluded_orders_count === 1
        ? '1 pedido não entra nestes números'
        : `${summary.excluded_orders_count} pedidos não entram nestes números`}{' '}
      — cancelados, recusados e estornados. O detalhe está em “O que não virou venda”.
    </p>
  );
}

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
        O ERRO É DA SEÇÃO, não da tela. As rotas vão em paralelo e falham
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
 * Um dos três números crus, abaixo da frase.
 *
 * SEM `.tnum`: a classe documenta "isto se compara descendo uma coluna", e três
 * valores lado a lado, de grandezas diferentes, não são coluna. Dinheiro EM
 * COLUNA (as tabelas abaixo) continua levando a classe.
 */
function Numero({
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
    <div className="numeros__item">
      <dt className="numeros__rotulo">{rotulo}</dt>
      <dd className="numeros__valor">{valor}</dd>
      {/*
        `change_percent` nulo vira "sem comparação", NUNCA 0% — ver
        `readChange`. A tinta é de apoio nos dois casos: uma queda de
        faturamento não é `--danger` (perigo é cancelar e excluir), e uma alta
        não é `--ok` (que é "no ar / à venda"). O sinal já diz a direção.
      */}
      <dd className={`numeros__delta${leitura.isMissing ? ' numeros__delta--vazio' : ''}`}>
        {leitura.text}
      </dd>
    </div>
  );
}

/** A composição do faturamento: de onde o número da frase veio. */
function Composicao({ summary }: { summary: SalesSummary }) {
  /*
   * A COMISSÃO NÃO ENTRA AQUI, e ela está no `breakdown` do contrato.
   *
   * Ela tem linha própria logo abaixo — com a base sobre a qual foi
   * calculada, que é a informação que o valor sozinho não dá. Nas duas, o
   * mesmo R$ 316,95 apareceria duas vezes na mesma seção (§8).
   */
  const linhas: readonly { rotulo: string; valor: string }[] = [
    { rotulo: 'Itens', valor: summary.breakdown.subtotal_total },
    { rotulo: 'Taxa de entrega', valor: summary.breakdown.delivery_fee_total },
    { rotulo: 'Taxa de serviço', valor: summary.breakdown.service_fee_total },
    { rotulo: 'Descontos', valor: summary.breakdown.discount_total },
  ];

  return (
    <dl className="composicao">
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

function TiposDePedido({ summary }: { summary: SalesSummary }) {
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

type LinhaProduto = {
  id: string;
  produto: string;
  unidades: number;
  pedidos: number;
  receita: ReactNode;
};

function Produtos({ products }: { products: ProductSales }) {
  const columns: readonly Column<LinhaProduto>[] = [
    { key: 'produto', header: 'Produto' },
    { key: 'unidades', header: 'Unidades', align: 'end' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'receita', header: 'Receita de item', align: 'end' },
  ];

  const rows: LinhaProduto[] = products.products.map((item, index) => ({
    /*
     * `product_id` É NULÁVEL (produto apagado depois da venda), e o nome pode
     * repetir entre linhas — o índice desempata sem virar a chave sozinho.
     *
     * E o nome NÃO VIRA LINK PARA O CARDÁPIO: sem id não há para onde ir, e um
     * link que existe em oito linhas e falta em duas é pior que nenhum. A tela
     * não linka nenhuma.
     */
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

      <Frase insight={readConcentracao(products)} />
    </>
  );
}

type LinhaCancelamento = {
  id: string;
  situacao: string;
  pagamento: string;
  pedidos: number;
  valor: ReactNode;
};

function Cancelados({ cancellations }: { cancellations: Cancellations }) {
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
      já existe e é o mesmo do painel de detalhe do pedido.
    */
    pagamento: labelFor(PAYMENT_STATUS_LABELS, item.payment_status),
    pedidos: item.orders_count,
    valor: <span className="tnum num">{formatCurrency(item.amount_total)}</span>,
  }));

  /*
   * A FRASE SUBSTITUI A LINHA DE TOTAL QUANDO EXISTE, em vez de somar-se a
   * ela. As duas dizem a mesma taxa e o mesmo valor perdido — uma como
   * afirmação ("5,3% dos pedidos não fecharam, a maior parte em Cancelado"), a
   * outra como placar. Com as duas na tela, o mesmo R$ 186,00 aparecia duas
   * vezes em quatro linhas (§8). Quando o cancelamento está na faixa de rotina
   * e não há frase, a linha de total volta: aí ela é a única coisa que diz
   * quanto não entrou.
   */
  const frase = readCancelamento(cancellations);

  return (
    <>
      {frase ? (
        <Frase insight={frase} />
      ) : (
        <div className="perf__resumo-linha">
          <span>
            {cancellations.orders_count === 1
              ? '1 pedido não virou venda'
              : `${cancellations.orders_count} pedidos não viraram venda`}
          </span>
          <span className="tnum">{formatCurrency(cancellations.amount_total)}</span>
        </div>
      )}

      {/*
        O DENOMINADOR, ESCRITO. A taxa é sobre TODOS os pedidos do período —
        faturados mais excluídos —, e quem tentar recalcular dividindo só pelos
        faturados vai achar outro número e concluir que a tela está errada.

        Ele não repete a contagem de excluídos, que já está lá em cima colada
        no faturamento: aqui o que importa é que eles ENTRAM na conta.
      */}
      <p className="t-aux perf__ressalva">
        A taxa é sobre todos os pedidos do período, faturados e excluídos — não só sobre os{' '}
        {cancellations.billable_orders_count} faturados.
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

function Comissao({ commission }: { commission: CommissionReport }) {
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
        ("quanto a plataforma levou") — e diz quantos pedidos ele soma.

        Isto é um recorte DECLARADO, não um corte silencioso.
      */}
      <p className="t-aux perf__ressalva">
        Soma de {commission.orders_count === 1 ? '1 pedido' : `${commission.orders_count} pedidos`}{' '}
        no período. O extrato pedido a pedido não cabe nesta tela.
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
