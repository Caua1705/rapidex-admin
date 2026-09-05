import { useState, type CSSProperties, type ReactNode } from 'react';

import { Card } from '../ds/Card';
import { TrendDownIcon, TrendUpIcon } from '../ds/icons';
import { PageBar } from '../ds/PageBar';
import {
  formatCurrency,
  labelFor,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orders/format';
import { stageOf, STATUS_LABELS } from '../orders/order-status';
import { readFilial, readVeredito, semMovimento, type Insight } from './insights';
import { variacaoDaFilial, type FilialComparada } from './branch-comparison';
import { Donut } from './Donut';
import { brutoDoPeriodo, partesDoBruto, saidasDoBruto } from './composition-model';
import { agrupamentoDoPeriodo, type Medida } from './line-chart-model';
import { HourChart } from './HourChart';
import { RevenueChart } from './RevenueChart';
import { Sparkline } from './Sparkline';
import { useBranchComparison, type BranchComparison } from './useBranchComparison';
import { useCancellationHours, type CancellationHours } from './useCancellationHours';
import {
  dayLabel,
  paymentMethodLabel,
  previousLabelFor,
  readChangeComBase,
  readRateChange,
  taxaTemBase,
  toNumber,
  toNumberOrZero,
  type ChangeReading,
} from './report-model';
import { usePerformance } from './usePerformance';
import { useSession } from '../auth/session-context';
import { usePermissoes } from '../auth/use-permissions';
import { branchName } from '../layout/branch-heading';
import type {
  Cancellations,
  CommissionReport,
  ProductSales,
  ReportPaymentMethods,
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
 * QUANTAS LINHAS CADA LISTA CURTA DESENHA.
 *
 * Cinco, e não dez: dentro de um cartão de meia largura, a partir da sexta
 * linha a lista deixa de ser "os que importam" e vira uma tabela cortada no
 * meio. O corte é escrito na tela — um "top 5" que não se anuncia é uma lista
 * que parece completa.
 */
const TOPO_DA_LISTA = 5;

/**
 * ============================================================================
 * DESEMPENHO — um painel, não um relatório
 * ============================================================================
 *
 * A TELA FOI REFEITA nesta rodada, e a mudança tem um nome: ela era quase toda
 * PROSA. Cada número vinha acompanhado de uma frase explicando o número, os
 * indicadores eram texto solto na página, as filiais eram uma lista de linhas
 * com uma barra preta, e havia um gráfico só. O diagnóstico do dono foi
 * literal: "parece um relatório de texto, não um dashboard".
 *
 * O QUE MUDOU, E POR QUÊ:
 *
 * 1. **Os indicadores viraram CARTÃO.** Quatro, na mesma altura, com rótulo,
 *    número grande, variação e uma minissérie do período no rodapé. A
 *    minissérie é a informação que nenhum dos dois outros dá: "R$ 3.169,50,
 *    -6,8%" é o mesmo texto para uma semana estável e para uma semana morta com
 *    um sábado enorme.
 * 2. **O gráfico virou o herói da tela**, com DUAS séries — este período e o
 *    anterior. A segunda já era carregada (`byDayPrevious`) e só alimentava uma
 *    frase: a comparação existia na memória do painel e não na tela.
 * 3. **A prosa saiu.** Sobraram DUAS frases na tela inteira, e cada uma diz o
 *    que a forma não diz: o veredito com a causa por dia (legenda do gráfico) e
 *    o contraste entre filiais ("não foi a rede, foi uma loja"). As outras dez
 *    regras continuam em `insights.ts`, testadas, sem consumidor — ver o
 *    registro da rodada em `scratchpad/rodada-desempenho.md`.
 * 4. **A comparação ganhou um FREIO.** `readChangeComBase` esconde a variação
 *    quando o período anterior teve menos de cinco pedidos e corta o percentual
 *    em ±999%. Era o defeito mais visível da tela antiga na loja que acabou de
 *    abrir: "-99,5%" em vermelho gigante sobre uma base de 1 pedido.
 *
 * ============================================================================
 * O CARTÃO AQUI, E A FOLHA NO RESTO DO PAINEL
 * ============================================================================
 *
 * A skill de design diz que a tela é uma FOLHA e que não existe cartão — e ela
 * continua valendo em Pedidos, Cardápio, Clientes e Minha loja, que são telas
 * de UMA natureza: uma lista, um formulário. Desempenho é a exceção, e é uma
 * exceção com motivo: são oito blocos de naturezas diferentes (quatro métricas,
 * um gráfico, duas comparações, dois rankings, um rodapé) na mesma página. Sem
 * um limite desenhado, eles leem como uma coluna contínua de texto — que é
 * exatamente o defeito que esta rodada veio consertar.
 *
 * O relevo é o menor possível e sai inteiro de tokens que já existiam
 * (`--surface-raised`, `--line`, `--shadow-lift`, `--r-card`): nenhuma paleta
 * nova, nenhuma sombra nova, nenhum raio novo. Ver `ds/Card.css`.
 *
 * ============================================================================
 * O QUE ESTA TELA CONTINUA NÃO TENDO, E POR QUÊ
 * ============================================================================
 *
 * - **Faturamento por HORA.** Nenhuma das seis rotas de relatório desce abaixo
 *   do dia. O agrupamento do gráfico é dia ou semana, e a hora não está na lista
 *   de opções porque ela não existe (ver `agrupamentoDoPeriodo`).
 * - **Pedidos por BAIRRO.** `AdminOrderListItem` não traz endereço nenhum; o
 *   bairro só existe em `OrderDetailResponse`, um pedido por vez. Ler o bairro
 *   de um mês seria uma requisição por pedido.
 * - **Cashback CONCEDIDO.** Não existe em resposta nenhuma de `/admin`. O que
 *   existe é o RESGATADO, somável do extrato de comissão, e é ele que a
 *   composição mostra — com esse nome, que é outro fato.
 *
 * Os três estão pedidos em `scratchpad/pedido-backend-desempenho.md`, e os
 * limites são escritos no pé da tela: espaço vazio ninguém interpreta.
 *
 * ----------------------------------------------------------------------------
 * QUEM LÊ DINHEIRO: o dono sempre; a gerência só com UMA filial escolhida
 * ----------------------------------------------------------------------------
 *
 * As rotas de relatório são da GERÊNCIA, mas o backend responde 403 ao gerente
 * que não manda recorte (`ensure_pode_ler_dinheiro`): sem `branch_id`, "ler o
 * faturamento" significa ler o do RESTAURANTE INTEIRO, e o resultado da Aldeota
 * não é do gerente do Centro. Por isso, para o gerente em "Todas as filiais",
 * esta tela não carrega nada e PEDE a filial em vez de disparar requisições que
 * voltam 403.
 *
 * A COMISSÃO É SÓ DO DONO, e não acompanhou as outras: é o percentual negociado
 * com a plataforma, não desempenho de loja.
 */
export function PerformancePage() {
  const { activeBranchId, branches } = useSession();
  const { podeLerDinheiro, pode } = usePermissoes();
  const podeLer = podeLerDinheiro(activeBranchId);
  const comComissao = pode('desempenho.verComissao');

  const { range, problem, reports, errors, isLoading, selectPreset, setCustomDate } =
    usePerformance(activeBranchId, { habilitado: podeLer, comComissao });

  /*
   * A MEDIDA DO GRÁFICO É ESTADO DE TELA, não do hook: trocar entre faturamento
   * e pedidos não pede nada ao backend — as duas vêm no mesmo `SalesByDayItem`.
   * Se ela morasse no hook, a troca dispararia o efeito de carga.
   */
  const [medida, setMedida] = useState<Medida>('faturamento');

  const filialAtiva = branches.find((filial) => filial.id === activeBranchId) ?? null;
  const nomeDaFilial = filialAtiva ? branchName(filialAtiva) : '';
  const {
    summary,
    byDay,
    byDayPrevious,
    payments,
    products,
    cancellations,
    cancellationsPrevious,
    commission,
  } = reports;
  const anterior = previousLabelFor(range.preset);
  const vazio = semMovimento(summary);

  /*
   * A BASE DA COMPARAÇÃO É A CONTAGEM DE PEDIDOS DO PERÍODO ANTERIOR, e ela
   * qualifica os TRÊS números do resumo — faturamento, pedidos e ticket saem
   * todos dela. Ver `readChangeComBase`.
   */
  const pedidosAnteriores = summary ? toNumber(summary.orders_count_comparison.previous) : null;

  /*
   * A TAXA DE CANCELAMENTO SÓ É TAXA COM BASE. O denominador é o do backend —
   * TODOS os pedidos do período, faturados mais excluídos —, e com menos de
   * cinco ela vira ruído: num período sem venda com dois cancelados, "100%"
   * em 28px diz que a operação parou. Ver `taxaTemBase`.
   */
  const pedidosDoPeriodo = cancellations
    ? cancellations.billable_orders_count + cancellations.orders_count
    : 0;
  const taxaLegivel = taxaTemBase(pedidosDoPeriodo);

  const comparaFiliais = podeLer && activeBranchId === '' && branches.length > 1;
  const filiais = useBranchComparison(branches, range, {
    habilitado: comparaFiliais && !problem,
  });

  const situacoes = [...new Set((cancellations?.breakdown ?? []).map((item) => item.status))];
  const horas = useCancellationHours(
    { startDate: range.startDate, endDate: range.endDate, branchId: activeBranchId },
    situacoes,
    { habilitado: podeLer && !!cancellations, esperados: cancellations?.orders_count ?? 0 },
  );

  return (
    <div className="perf">
      {/* A MESMA FAIXA DE 52px DE TODAS AS TELAS. O seletor de filial NÃO é
          duplicado aqui: ele mora na barra do shell, e dois lugares para
          escolher a mesma coisa é como os dois passam a discordar. */}
      <PageBar title="Desempenho">
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
      </PageBar>

      {problem ? (
        <p className="alert alert--error perf__alerta" role="alert">
          {problem}
        </p>
      ) : null}

      {/*
        A GERÊNCIA PRECISA ESCOLHER UMA LOJA, e a tela pede em vez de tentar.
        Sem esta frase, a abertura seriam oito requisições recusadas e oito
        tarjas vermelhas para dizer, em linguagem de erro, uma instrução.
      */}
      {!podeLer ? (
        <p className="perf__frase" data-testid="perf-escolha-filial">
          Escolha uma filial no seletor do topo para ver o desempenho dela. O resultado somado de
          todas as lojas é do dono do restaurante.
        </p>
      ) : null}

      {/*
        ESQUELETO, NÃO GIRADOR. A tela tem forma fixa — quatro cartões, um
        gráfico, quatro blocos —, e desenhar essa forma vazia diz o que está
        chegando e impede o salto de layout quando chega. Um girador no meio da
        página diria só "espere", e ainda jogaria o conteúdo inteiro para baixo
        no instante em que sumisse.
      */}
      {podeLer && !problem && isLoading ? <Esqueleto /> : null}

      {podeLer && !isLoading && !problem ? (
        <div className="perf__grade">
          {/* ================================================================
              0. PERÍODO SEM VENDA — um caso de primeira classe

              A TELA NÃO TROCA DE FORMA, ela troca de CONTEÚDO. Uma versão
              anterior desta rodada substituía a página inteira por uma frase
              solta num cartão, e o resultado era pior que o problema: mil
              pixels de nada, sem nenhuma pista do que aquela tela mostra
              quando há venda.

              O que fica: uma afirmação no topo (não um erro), os quatro
              cartões com TRAVESSÃO — que é "não sei" e não "R$ 0,00", que
              seria um faturamento de zero reais afirmado com todas as letras
              —, e cada bloco com uma linha dizendo o que apareceria ali.

              Os pedidos excluídos continuam ditos: zero faturado com dois
              cancelados é exatamente o caso em que os dois precisam ser vistos.
             ================================================================ */}
          {vazio && summary ? (
            <Card className="perf__vazio">
              <p className="perf__vazio-frase" data-testid="perf-vazio">
                Nenhum pedido foi faturado neste período.
              </p>

              {summary.excluded_orders_count > 0 ? (
                <p className="t-aux" data-testid="perf-excluidos">
                  {summary.excluded_orders_count === 1
                    ? '1 pedido não entra nestes números'
                    : `${summary.excluded_orders_count} pedidos não entram nestes números`}{' '}
                  — cancelados, recusados e estornados. O detalhe está em “O que não virou venda”.
                </p>
              ) : null}
            </Card>
          ) : null}

          {/* ================================================================
              1. OS QUATRO NÚMEROS

              O que a linha responde: A SEMANA FOI BOA?
             ================================================================ */}
          {errors.summary ? (
            <p className="alert alert--error" role="alert">
              {errors.summary}
            </p>
          ) : summary ? (
            <div className="kpis">
              <Kpi
                id="faturamento"
                rotulo="Faturamento"
                vazio={vazio}
                valor={formatCurrency(summary.revenue_total)}
                leitura={readChangeComBase(summary.revenue_comparison, anterior, pedidosAnteriores)}
                serie={byDay?.days.map((dia) => toNumberOrZero(dia.revenue_total))}
              />
              <Kpi
                id="pedidos"
                rotulo="Pedidos"
                vazio={vazio}
                valor={String(summary.orders_count)}
                leitura={readChangeComBase(
                  summary.orders_count_comparison,
                  anterior,
                  pedidosAnteriores,
                )}
                serie={byDay?.days.map((dia) => dia.orders_count)}
              />
              <Kpi
                id="ticket"
                rotulo="Ticket médio"
                vazio={vazio}
                valor={formatCurrency(summary.average_ticket)}
                leitura={readChangeComBase(
                  summary.average_ticket_comparison,
                  anterior,
                  pedidosAnteriores,
                )}
                /*
                  O TICKET POR DIA É DERIVADO, e é a única série da tela que o
                  é: `sales-by-day` não devolve ticket. A conta é a mesma do
                  backend (faturamento ÷ pedidos), e o dia sem pedido fica em
                  zero em vez de virar divisão por zero.
                */
                serie={byDay?.days.map((dia) =>
                  dia.orders_count > 0 ? toNumberOrZero(dia.revenue_total) / dia.orders_count : 0,
                )}
              />
              {/* ============================================================
                  O QUARTO NÃO É CASHBACK, E A TROCA ESTÁ REGISTRADA.

                  "Cashback concedido" não existe em resposta nenhuma de
                  `/admin` — nem no `SalesBreakdown`, nem no resumo. O que
                  existe é o RESGATADO, pedido a pedido no extrato de comissão,
                  e ele é SOMENTE_DONO: um quarto cartão que some para a
                  gerência quebraria a grade de quatro.

                  O cancelamento entra no lugar porque responde à mesma
                  natureza de pergunta (dinheiro que saiu), vale para os dois
                  papéis, e tem comparação — de uma segunda chamada da rota. O
                  cashback resgatado ficou na composição, com o nome certo.
                 ============================================================ */}
              <Kpi
                id="cancelamento"
                rotulo="Cancelamento"
                valor={taxaLegivel ? formatPercent(cancellations?.cancellation_rate_percent) : '—'}
                leitura={
                  taxaLegivel
                    ? readRateChange(
                        cancellations?.cancellation_rate_percent,
                        cancellationsPrevious === undefined
                          ? undefined
                          : cancellationsPrevious.cancellation_rate_percent,
                        anterior,
                      )
                    : {
                        text:
                          pedidosDoPeriodo === 1
                            ? 'sem taxa — 1 pedido no período'
                            : `sem taxa — ${pedidosDoPeriodo} pedidos no período`,
                        direction: 'none',
                        isMissing: true,
                      }
                }
                /*
                  A COR INVERTE AQUI, e é a única vez na tela. Taxa de
                  cancelamento subindo é notícia RUIM: verde para cima nesta
                  linha diria "boa" sobre mais pedidos perdidos.
                */
                inverso
                rodape={
                  cancellations && cancellations.orders_count > 0 ? (
                    <span className="kpi__meta">
                      {cancellations.orders_count === 1
                        ? '1 pedido'
                        : `${cancellations.orders_count} pedidos`}{' '}
                      · {formatCurrency(cancellations.amount_total)}
                    </span>
                  ) : null
                }
              />
            </div>
          ) : null}

          {/* ================================================================
              2. O GRÁFICO — o herói da tela
             ================================================================ */}
          <Card
            title="Faturamento ao longo do tempo"
            className="perf__heroi"
            actions={
              byDay ? (
                <span className="t-aux">
                  {dayLabel(byDay.period.start_date)} a {dayLabel(byDay.period.end_date)}
                </span>
              ) : null
            }
          >
            {errors.byDay ? (
              <p className="alert alert--error" role="alert">
                {errors.byDay}
              </p>
            ) : byDay ? (
              <>
                <RevenueChart
                  dias={byDay.days}
                  diasAnteriores={byDayPrevious?.days ?? null}
                  medida={medida}
                  onMedida={setMedida}
                  agrupamento={agrupamentoDoPeriodo(byDay.period.days)}
                  rotuloAnterior={anterior}
                />

                {/*
                  A ÚNICA FRASE DO TOPO DA TELA, e ela é a legenda do gráfico —
                  não um parágrafo de abertura. Ela diz a causa POR DIA
                  ("puxado para baixo por terça e sábado"), que é a única coisa
                  que a linha desenha e não escreve.
                */}
                {summary ? (
                  <p className="perf__veredito" data-testid="perf-veredito">
                    {readVeredito(summary, byDay, byDayPrevious, anterior).text}
                  </p>
                ) : null}
              </>
            ) : null}
          </Card>

          {/* ================================================================
              3. PARA ONDE O DINHEIRO FOI × DE ONDE ELE VEIO
             ================================================================ */}
          <div className="perf__par">
            <Card
              title="Composição do faturamento"
              actions={<span className="t-aux">do bruto</span>}
            >
              {errors.summary ? (
                <p className="alert alert--error" role="alert">
                  {errors.summary}
                </p>
              ) : summary ? (
                <Composicao summary={summary} commission={comComissao ? commission : null} />
              ) : null}
            </Card>

            {/*
              O SEGUNDO CARTÃO TROCA DE ASSUNTO CONFORME O RECORTE, e não fica
              vazio: em "todas as filiais" com mais de uma loja ele compara as
              lojas; com uma filial escolhida a comparação seria a tela se
              contradizendo (a linha de escopo acabou de dizer "estes números
              são da filial X"), então ele responde a outra pergunta que o mesmo
              `summary` já traz — entrega × retirada.
            */}
            {comparaFiliais ? (
              <Card
                title="As filiais"
                actions={
                  <span className="t-aux">
                    {branches.length === 2 ? 'as 2 lojas' : `as ${branches.length} lojas`}
                  </span>
                }
              >
                {filiais.erro ? (
                  <p className="alert alert--error" role="alert">
                    {filiais.erro}
                  </p>
                ) : (
                  <Filiais comparacao={filiais} anterior={anterior} />
                )}
              </Card>
            ) : (
              <Card title="Entrega e retirada">
                {errors.summary ? (
                  <p className="alert alert--error" role="alert">
                    {errors.summary}
                  </p>
                ) : summary ? (
                  <TiposDePedido summary={summary} />
                ) : null}
              </Card>
            )}
          </div>

          {/* ================================================================
              4. O QUE VENDE × COMO PAGAM
             ================================================================ */}
          <div className="perf__par">
            <Card
              title="Produtos mais vendidos"
              actions={<span className="t-aux">por unidades · top {TOPO_DA_LISTA}</span>}
            >
              {errors.products ? (
                <p className="alert alert--error" role="alert">
                  {errors.products}
                </p>
              ) : products ? (
                <Produtos products={products} />
              ) : null}
            </Card>

            {/* ==============================================================
                AQUI MORAVA "PEDIDOS POR BAIRRO" NO PEDIDO DA RODADA, e ele não
                tem como existir: `AdminOrderListItem` não traz endereço nenhum
                (o bairro só aparece em `OrderDetailResponse`, um pedido por
                vez), e nenhuma rota de relatório agrega por bairro. Ler o
                bairro de um mês seria uma requisição por pedido.

                No lugar entra a distribuição de formas de pagamento — que já
                era CARREGADA a cada abertura de tela e produzia, no máximo, uma
                frase condicional. A taxa de cada meio é diferente e o dinheiro
                em espécie é troco e risco: é resposta, não enfeite.
               ============================================================== */}
            <Card title="Como pagam" actions={<span className="t-aux">top {TOPO_DA_LISTA}</span>}>
              {errors.payments ? (
                <p className="alert alert--error" role="alert">
                  {errors.payments}
                </p>
              ) : payments ? (
                <Pagamentos payments={payments} />
              ) : null}
            </Card>
          </div>

          {/* ================================================================
              5. O RODAPÉ — o que não virou venda

              DISCRETO E SEM ALARME: ele é a largura inteira, com o mesmo
              cartão dos outros, e a única cor que aparece é a do ponto de
              status na tabela. Cancelamento faz parte da operação de qualquer
              restaurante; uma faixa vermelha aqui gritaria todo dia.
             ================================================================ */}
          <Card
            title="O que não virou venda"
            className="perf__rodape"
            actions={<span className="t-aux">cancelados, recusados e estornados</span>}
          >
            {errors.cancellations ? (
              <p className="alert alert--error" role="alert">
                {errors.cancellations}
              </p>
            ) : cancellations ? (
              <Cancelados cancellations={cancellations} horas={horas} />
            ) : null}
          </Card>

          {/* ================================================================
              6. O PÉ DA TELA — escopo e limites, uma linha cada
             ================================================================ */}
          <div className="perf__pe">
            <Escopo
              nomeDaFilial={nomeDaFilial}
              temEscolha={branches.length > 1}
              temComparacao={comparaFiliais}
            />

            {/*
              O QUE A TELA NÃO RESPONDE FICA ESCRITO, e em UMA linha — não numa
              seção vazia com título anunciando o nada. Uma tela de desempenho
              que finge cobrir tudo é pior que uma que diz onde não enxerga.
            */}
            <p className="t-aux perf__limites" data-testid="perf-limites">
              Esta tela ainda não responde <strong>quem compra</strong> (cliente novo × recorrente,
              e o cashback concedido), o <strong>tempo de preparo</strong>, o faturamento{' '}
              <strong>hora a hora</strong> nem a divisão por <strong>bairro</strong>: os quatro
              dependem de dados que o backend não devolve hoje.
            </p>
          </div>
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
 * componente que ninguém sabe manter. A exceção é o CARTÃO, que é do sistema
 * (`ds/Card`) — cartão é a peça que mais se duplica quando não se procura.
 * ======================================================================= */

/**
 * ============================================================================
 * O CARTÃO DE MÉTRICA
 * ============================================================================
 *
 * Quatro coisas, sempre na mesma ordem e sempre na mesma altura: rótulo (nível
 * 3), número (`--metric-*`), variação com seta, e o rodapé — a minissérie do
 * período, ou uma linha de meta quando não há série.
 *
 * A ALTURA IGUAL É REQUISITO, não acabamento. Quatro cartões de alturas
 * diferentes numa fileira desfazem a leitura de conjunto que a fileira existe
 * para dar, e o olho passa a comparar as MOLDURAS em vez dos números. Por isso
 * o rodapé nunca fica ausente: sem série e sem meta, ele é um vão da mesma
 * altura.
 *
 * O RÓTULO NÃO É CAIXA ALTA. O pedido desta rodada dizia "rótulo pequeno em
 * maiúscula discreta", e o sistema não tem esse nível: caixa alta com tracking
 * não existe no painel, e `check-design-tokens.mjs` barra
 * `text-transform: uppercase` fora de `tokens.css`. O que faz o trabalho é o
 * nível 3 (`.t-label`, 12/600/`--ink-3`), que é o rótulo de campo e de cabeçalho
 * de coluna do painel inteiro.
 */
function Kpi({
  id,
  rotulo,
  valor,
  leitura,
  serie,
  rodape,
  inverso = false,
  vazio = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  leitura: ChangeReading;
  /** A minissérie do período. Ausente = o rodapé fica com `rodape`, ou vazio. */
  serie?: readonly number[];
  rodape?: ReactNode;
  /** Subir é RUIM neste número (cancelamento). Ver o uso, no quarto cartão. */
  inverso?: boolean;
  /**
   * O PERÍODO NÃO TEVE VENDA — e aí o cartão mostra TRAVESSÃO, não "R$ 0,00".
   *
   * Os dois parecem a mesma coisa e não são: "R$ 0,00" é um faturamento de zero
   * reais afirmado com todas as letras, e é a leitura que faz o lojista achar
   * que a tela quebrou. O travessão é "não há número aqui", que é o que houve.
   *
   * Nem a variação, nem a minissérie: uma linha rente ao chão desenharia o
   * nada como forma, e "0% vs. a semana passada" compararia dois vazios.
   */
  vazio?: boolean;
}) {
  if (vazio) {
    return (
      <Card denso className="kpi" testId={`perf-kpi-${id}`}>
        <div className="kpi__cabeca">
          <p className="t-label kpi__rotulo">{rotulo}</p>
          <p className="kpi__valor kpi__valor--vazio">—</p>
          <p className="kpi__delta kpi__delta--vazio">sem venda no período</p>
        </div>
        <div className="kpi__rodape" />
      </Card>
    );
  }

  /*
   * A DIREÇÃO É DITA EM TRÊS CANAIS: o sinal no texto, a seta e a cor. A cor
   * sozinha reprovaria em WCAG 1.4.1 e a seta sozinha não é lida de relance,
   * que é justamente o trabalho do cartão.
   *
   * A SETA APONTA PARA ONDE O NÚMERO FOI, sempre — inclusive no cartão
   * invertido. Quem inverte é a COR: no cancelamento, a seta para cima vem em
   * `--danger`. Inverter a seta junto faria o desenho mentir sobre o número.
   */
  const Seta =
    leitura.direction === 'up' ? TrendUpIcon : leitura.direction === 'down' ? TrendDownIcon : null;

  const tom = leitura.isMissing
    ? 'vazio'
    : inverso && leitura.direction === 'up'
      ? 'down'
      : inverso && leitura.direction === 'down'
        ? 'up'
        : leitura.direction;

  return (
    <Card denso className={`kpi${inverso ? ' kpi--inverso' : ''}`} testId={`perf-kpi-${id}`}>
      <div className="kpi__cabeca">
        <p className="t-label kpi__rotulo">{rotulo}</p>
        <p className="kpi__valor">{valor}</p>
        <p className={`kpi__delta kpi__delta--${tom}`}>
          {Seta ? <Seta size={14} /> : null}
          <span>{leitura.text}</span>
        </p>
      </div>

      {/* O rodapé existe sempre, mesmo vazio — ver a nota de altura acima. */}
      <div className="kpi__rodape">
        {serie ? <Sparkline valores={serie} /> : null}
        {rodape}
      </div>
    </Card>
  );
}

/**
 * O ESQUELETO DA TELA.
 *
 * Ele desenha a FORMA que vai chegar — quatro cartões, o gráfico, dois pares —
 * e não uma barra de progresso genérica. Duas razões, e as duas são medidas em
 * salto de layout: o conteúdo entra no lugar onde o esqueleto já estava, e o
 * lojista sabe o que está sendo carregado antes de chegar.
 *
 * `aria-busy` no contêiner e `role="status"` numa frase invisível: o brilho é
 * decoração pura, e um leitor de tela não deve ouvir doze caixas cinzas.
 */
function Esqueleto() {
  return (
    <div className="perf__grade" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando o desempenho do período.
      </p>

      <div className="kpis" aria-hidden="true">
        {[0, 1, 2, 3].map((indice) => (
          <div className="esq esq--kpi" key={indice} />
        ))}
      </div>

      <div className="esq esq--heroi" aria-hidden="true" />

      <div className="perf__par" aria-hidden="true">
        <div className="esq esq--bloco" />
        <div className="esq esq--bloco" />
      </div>

      <div className="perf__par" aria-hidden="true">
        <div className="esq esq--bloco" />
        <div className="esq esq--bloco" />
      </div>
    </div>
  );
}

/**
 * O escopo dos números — dito UMA vez na tela, no pé.
 *
 * Ele diz QUAL recorte produziu estes números, porque "faturou R$ 12 mil"
 * significa coisas diferentes para uma loja e para a rede. Com uma filial só no
 * acesso não há o que distinguir, e a linha não aparece.
 */
function Escopo({
  nomeDaFilial,
  temEscolha,
  temComparacao,
}: {
  nomeDaFilial: string;
  temEscolha: boolean;
  /** O cartão "As filiais" está desenhado logo acima. */
  temComparacao: boolean;
}) {
  if (!temEscolha) return null;

  return (
    <p className="t-aux perf__escopo" data-testid="perf-escopo">
      {nomeDaFilial ? (
        <>
          Estes números são <strong>da filial {nomeDaFilial}</strong> — troque no seletor do topo
          para ver outra loja, ou a rede inteira.
        </>
      ) : temComparacao ? (
        <>
          Estes números somam <strong>todas as filiais</strong> — a divisão por loja está em “As
          filiais”, e o seletor do topo abre a tela inteira de uma delas.
        </>
      ) : (
        <>
          Estes números somam <strong>todas as filiais</strong> — escolha uma no seletor do topo
          para ver o resultado de uma loja só.
        </>
      )}
    </p>
  );
}

/**
 * ============================================================================
 * A COMPOSIÇÃO — a rosca e as saídas, com UM denominador só
 * ============================================================================
 *
 * A rosca divide o BRUTO (produtos + entrega + serviço); as saídas (desconto,
 * comissão, cashback resgatado) são medidas contra o MESMO bruto. A aritmética
 * inteira, e o porquê de não haver uma linha de "sobrou", estão em
 * `composition-model.ts`.
 *
 * A LISTA É A LEITURA, e a rosca é o apoio: cada fatia tem valor e percentual
 * escritos. Uma rosca sem os números seria um enfeite.
 */
function Composicao({
  summary,
  commission,
}: {
  summary: SalesSummary;
  /** Nulo para quem não é dono: a rota é SOMENTE_DONO e nem foi pedida. */
  commission: CommissionReport | null;
}) {
  const partes = partesDoBruto(summary);
  const saidas = saidasDoBruto(summary, commission);
  const bruto = brutoDoPeriodo(summary);

  if (partes.length === 0) {
    return (
      <p className="muted">
        Sem faturamento no período — aqui aparece para onde o dinheiro foi: produtos, taxas,
        descontos e comissão.
      </p>
    );
  }

  return (
    <div className="comp" data-testid="perf-composicao">
      {/*
        O MIOLO DA ROSCA LEVA O DENOMINADOR, e não é enfeite: sem ele, "89,5%"
        é uma fatia de um todo que a tela não escreve em lugar nenhum.
        `revenue_total` não serve para isso — ele já vem com o desconto abatido,
        e as três fatias somariam mais de 100% dele (ver `brutoDoPeriodo`).
      */}
      <div className="comp__anel">
        <Donut fatias={partes} />
        <span className="comp__centro">
          <span className="comp__centro-valor tnum">{formatCurrency(bruto)}</span>
          <span className="comp__centro-rotulo">bruto</span>
        </span>
      </div>

      <dl className="comp__lista">
        {partes.map((parte, index) => (
          <div className="comp__linha" key={parte.id}>
            <dt className="comp__rotulo">
              <span
                className={`comp__amostra comp__amostra--${Math.min(index, 2)}`}
                aria-hidden="true"
              />
              {parte.rotulo}
            </dt>
            <dd className="comp__valor tnum">{formatCurrency(parte.valor)}</dd>
            <dd className="comp__fatia tnum">{formatPercent(parte.fatiaPct)}</dd>
          </div>
        ))}

        {/*
          AS SAÍDAS FICAM DEPOIS DE UM FIO, e com o sinal de menos escrito.
          Sem ele, "Descontos R$ 100,00" numa lista logo abaixo de três parcelas
          que somam 100% seria lido como uma quarta parcela — e a soma daria
          130% do que existe.
        */}
        {saidas.map((saida, index) => (
          <div
            className={`comp__linha comp__linha--saida${index === 0 ? ' comp__linha--primeira-saida' : ''}`}
            key={saida.id}
          >
            <dt className="comp__rotulo">{saida.rotulo}</dt>
            <dd className="comp__valor tnum">− {formatCurrency(saida.valor)}</dd>
            <dd className="comp__fatia tnum">{formatPercent(saida.fatiaPct)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * AS FILIAIS LADO A LADO — a resposta para "qual das lojas vai melhor".
 *
 * A ORDEM É POR FATURAMENTO, maior primeiro (ver `compararFiliais`): em ordem
 * alfabética, "qual vai melhor" voltaria a exigir que o olho comparasse dois
 * números de quatro dígitos, que é o trabalho que este bloco existe para
 * poupar.
 *
 * A variação de cada loja vem de graça: cada resposta de `/reports/summary` já
 * traz o período anterior comparado pelo backend. É ela que separa "a Aldeota é
 * maior" de "a Aldeota está crescendo e a Zona Norte encolhendo".
 */
function Filiais({ comparacao, anterior }: { comparacao: BranchComparison; anterior: string }) {
  const { filiais, falharam, naoPedidas, isLoading } = comparacao;

  if (isLoading && filiais.length === 0) return <p className="muted">Carregando as filiais…</p>;

  /*
   * DUAS AUSÊNCIAS DIFERENTES, UMA MENSAGEM SÓ — e é de propósito que ela não
   * separe as duas: para o lojista, "nenhuma loja respondeu" e "nenhuma loja
   * vendeu" resultam na mesma tela, e a diferença entre elas está nomeada
   * logo abaixo (a linha de `falharam`, quando houve falha).
   *
   * O QUE NÃO PODE ACONTECER É A SEGUNDA VIRAR DUAS LINHAS DE "R$ 0,00" —
   * comparar duas lojas que não venderam é desenhar um empate que não houve, e
   * a barra de fatia nem existiria (não há denominador).
   */
  const nadaFaturado = filiais.every((filial) => toNumberOrZero(filial.summary.revenue_total) <= 0);
  if (filiais.length === 0 || nadaFaturado) {
    return (
      <p className="muted">
        Nenhuma loja faturou neste período — aqui aparece o faturamento de cada uma lado a lado.
      </p>
    );
  }

  return (
    <>
      <dl className="fatias" data-testid="perf-filiais">
        {filiais.map((filial) => (
          <LinhaDeFilial key={filial.branch.id} filial={filial} anterior={anterior} />
        ))}
      </dl>

      {/*
        A SEGUNDA (E ÚLTIMA) FRASE DA TELA. Ela desmonta o número do topo: a
        rede pode ter caído 6,8% sem que nenhuma loja tenha caído 6,8% — uma
        subiu e a outra despencou. Sem ela, o dono procuraria a causa na rede
        inteira. É a única coisa deste cartão que a forma não diz.
      */}
      <Frase insight={readFilial(filiais)} />

      {/*
        QUEM FALTOU É NOMEADO, e não somado silenciosamente ao resto: a fatia de
        cada loja é calculada sobre o faturamento das que RESPONDERAM, e sem
        esta linha uma loja que falhou deixaria a outra com "100% da rede".
      */}
      {falharam.length > 0 ? (
        <p className="t-aux perf__ressalva" data-testid="perf-filiais-falharam">
          {falharam.length === 1
            ? `Não deu para carregar ${falharam[0]} — as fatias acima dividem só o que respondeu.`
            : `Não deu para carregar ${falharam.length} filiais (${falharam.join(', ')}) — as fatias acima dividem só o que respondeu.`}
        </p>
      ) : null}

      {naoPedidas > 0 ? (
        <p className="t-aux perf__ressalva">
          {naoPedidas === 1
            ? 'Uma filial ficou de fora desta comparação.'
            : `${naoPedidas} filiais ficaram de fora desta comparação.`}{' '}
          Escolha-a no seletor do topo para ver a tela dela.
        </p>
      ) : null}
    </>
  );
}

function LinhaDeFilial({ filial, anterior }: { filial: FilialComparada; anterior: string }) {
  const fatia = filial.fatiaPct;
  /*
   * A MESMA GUARDA DOS CARTÕES DO TOPO, e pelo mesmo motivo: a filial que abriu
   * semana passada tem base de dois pedidos, e "+4.900%" ao lado do nome dela
   * mede o denominador, não a loja.
   */
  const leitura = readChangeComBase(
    filial.summary.revenue_comparison,
    anterior,
    toNumber(filial.summary.orders_count_comparison.previous),
  );
  const variacao = variacaoDaFilial(filial);

  const Seta =
    leitura.direction === 'up' ? TrendUpIcon : leitura.direction === 'down' ? TrendDownIcon : null;

  return (
    <div className="fatias__linha">
      <dt className="fatias__rotulo">{branchName(filial.branch)}</dt>
      <dd className="fatias__valor tnum">{formatCurrency(filial.summary.revenue_total)}</dd>
      {/*
        A META É UM TEXTO SÓ MAIS A VARIAÇÃO, e não seis pedaços soltos: a linha
        é `display: flex` por causa do delta, e cada nó de texto do JSX viraria
        um item de flex próprio — "31" e "pedidos" separados por um vão de 4px.
      */}
      <dd className="fatias__meta">
        <span>
          {[
            filial.summary.orders_count === 1
              ? '1 pedido'
              : `${filial.summary.orders_count} pedidos`,
            `ticket ${formatCurrency(filial.summary.average_ticket)}`,
            ...(fatia === null ? [] : [`${formatPercent(fatia)} do total`]),
          ].join(' · ')}
        </span>
        <span
          className={`fatias__delta fatias__delta--${
            leitura.isMissing || variacao === null ? 'vazio' : leitura.direction
          }`}
        >
          {Seta ? <Seta size={13} /> : null}
          {leitura.text}
        </span>
      </dd>

      {fatia === null ? null : (
        <div
          className="fatias__barra"
          aria-hidden="true"
          style={{ '--fatia': `${Math.min(100, Math.max(0, fatia))}%` } as CSSProperties}
        />
      )}
    </div>
  );
}

/**
 * ENTREGA × RETIRADA — o cartão que ocupa o lugar da comparação de filiais
 * quando não há o que comparar.
 *
 * Um tipo só vira frase, porque é o que ele é: uma "comparação" de um item, com
 * barra de 100%, seria uma moldura em volta de um fato.
 */
function TiposDePedido({ summary }: { summary: SalesSummary }) {
  const tipos = summary.order_types;
  if (tipos.length === 0) {
    return (
      <p className="muted">
        Nenhum pedido no período — aqui aparece quanto veio de entrega e quanto de retirada.
      </p>
    );
  }

  const unico = tipos.length === 1 ? tipos[0] : null;
  if (unico) {
    return (
      <p className="perf__frase">
        Todo o faturamento do período veio de{' '}
        {labelFor(ORDER_TYPE_LABELS, unico.order_type).toLowerCase()} —{' '}
        {unico.orders_count === 1 ? '1 pedido' : `${unico.orders_count} pedidos`},{' '}
        {formatCurrency(unico.revenue_total)}.
      </p>
    );
  }

  return (
    <dl className="fatias" data-testid="perf-tipos">
      {tipos.map((item) => {
        const fatia = toNumber(item.revenue_share_percent);
        return (
          <div className="fatias__linha" key={item.order_type}>
            <dt className="fatias__rotulo">{labelFor(ORDER_TYPE_LABELS, item.order_type)}</dt>
            <dd className="fatias__valor tnum">{formatCurrency(item.revenue_total)}</dd>
            <dd className="fatias__meta">
              {item.orders_count === 1 ? '1 pedido' : `${item.orders_count} pedidos`} ·{' '}
              {formatPercent(item.revenue_share_percent)}
            </dd>
            {fatia === null ? null : (
              <div
                className="fatias__barra"
                aria-hidden="true"
                style={{ '--fatia': `${Math.min(100, Math.max(0, fatia))}%` } as CSSProperties}
              />
            )}
          </div>
        );
      })}
    </dl>
  );
}

/**
 * ============================================================================
 * OS PRODUTOS — cinco linhas com barra proporcional
 * ============================================================================
 *
 * A TABELA DE QUATRO COLUNAS SAIU. Ela dava quatro números por linha (unidades,
 * pedidos, receita, e a posição implícita) e nenhuma forma: comparar o 1º com o
 * 4º exigia ler dois números de quatro dígitos. A barra responde "quanto maior"
 * antes da leitura.
 *
 * A BARRA MEDE UNIDADES, E A ORDEM TAMBÉM. `/reports/products` devolve o
 * ranking por unidades vendidas, e a barra tem de medir o que ordena a lista —
 * uma barra de receita numa lista ordenada por unidade desenha uma escada que
 * desce fora de ordem, e o lojista conclui que a tela está errada.
 *
 * A RESSALVA DO BACKEND CONTINUA COLADA no total: `listed_revenue_total` não
 * fecha com o faturamento do resumo (é receita bruta de item, sem cupom,
 * cashback nem taxas), e o texto vem pronto em `revenue_note`.
 */
function Produtos({ products }: { products: ProductSales }) {
  const listados = products.products.slice(0, TOPO_DA_LISTA);
  if (listados.length === 0) {
    return (
      <p className="muted">
        Nenhum item vendido no período — aqui aparecem os cinco que mais saíram, com quantidade e
        faturamento.
      </p>
    );
  }

  const maior = listados.reduce((topo, item) => Math.max(topo, item.quantity_total), 0);

  return (
    <>
      <ol className="ranking" data-testid="perf-produtos">
        {listados.map((item, index) => (
          <li
            className="ranking__linha"
            /* `product_id` é NULÁVEL (produto apagado depois da venda) e o nome
               pode repetir — o índice desempata sem virar a chave sozinho. */
            key={`${item.product_id ?? 'sem-id'}-${index}`}
          >
            <span className="ranking__nome">{item.product_name}</span>
            <span className="ranking__valor tnum">{formatCurrency(item.revenue_total)}</span>
            <span className="ranking__meta tnum">
              {item.quantity_total === 1 ? '1 unidade' : `${item.quantity_total} unidades`} ·{' '}
              {item.orders_count === 1 ? '1 pedido' : `${item.orders_count} pedidos`}
            </span>
            <span
              className="ranking__barra"
              aria-hidden="true"
              style={
                {
                  '--fatia': `${maior > 0 ? (item.quantity_total / maior) * 100 : 0}%`,
                } as CSSProperties
              }
            />
          </li>
        ))}
      </ol>

      <p className="t-aux perf__ressalva">
        Receita{' '}
        {products.products.length === 1
          ? 'deste item'
          : `dos ${products.products.length} itens analisados`}
        : {formatCurrency(products.listed_revenue_total)}. {products.revenue_note}
      </p>
    </>
  );
}

/**
 * COMO PAGAM — a distribuição que existia e nunca era desenhada.
 *
 * `payment_method` NULO É "SEM FORMA REGISTRADA", e não "Outro": o dicionário
 * tem uma entrada `other` que é uma forma de pagamento de verdade, e cair nela
 * inventaria um fato. O pedido existe, o dinheiro entrou, e ninguém registrou
 * como — é isso que a linha diz, porque é isso que o lojista vai investigar.
 */
function Pagamentos({ payments }: { payments: ReportPaymentMethods }) {
  const formas = [...payments.payment_methods]
    .sort((a, b) => toNumberOrZero(b.revenue_total) - toNumberOrZero(a.revenue_total))
    .slice(0, TOPO_DA_LISTA);

  if (formas.length === 0) {
    return (
      <p className="muted">
        Nenhum pagamento no período — aqui aparece a divisão entre Pix, cartão e dinheiro.
      </p>
    );
  }

  return (
    <dl className="fatias" data-testid="perf-pagamentos">
      {formas.map((forma) => {
        const fatia = toNumber(forma.revenue_share_percent);
        return (
          <div className="fatias__linha" key={forma.payment_method ?? 'sem-forma'}>
            <dt className="fatias__rotulo">
              {paymentMethodLabel(forma.payment_method, PAYMENT_METHOD_LABELS)}
            </dt>
            <dd className="fatias__valor tnum">{formatCurrency(forma.revenue_total)}</dd>
            <dd className="fatias__meta">
              {forma.orders_count === 1 ? '1 pedido' : `${forma.orders_count} pedidos`} ·{' '}
              {formatPercent(forma.revenue_share_percent)}
            </dd>
            {fatia === null ? null : (
              <div
                className="fatias__barra"
                aria-hidden="true"
                style={{ '--fatia': `${Math.min(100, Math.max(0, fatia))}%` } as CSSProperties}
              />
            )}
          </div>
        );
      })}
    </dl>
  );
}

/**
 * O QUE NÃO VIROU VENDA — contagem, valor, hora de entrada e a quebra.
 *
 * A TAXA NÃO SE REPETE AQUI: ela é o quarto cartão do topo. O que este bloco
 * acrescenta é o DETALHE — em que situação e em que forma de pagamento o
 * pedido se perdeu, e a que horas ele tinha entrado.
 */
function Cancelados({
  cancellations,
  horas,
}: {
  cancellations: Cancellations;
  horas: CancellationHours;
}) {
  if (cancellations.orders_count === 0) {
    return (
      <p className="muted">
        Nenhum pedido cancelado, recusado ou estornado no período — quando houver, aparecem aqui a
        situação, a contagem e o valor que não entrou.
      </p>
    );
  }

  return (
    <div className="naovenda">
      <div className="naovenda__quebra">
        {/*
          `is-<estágio>` E NÃO `is-<status do backend>`. A escala de cor tem SETE
          estágios visuais (`ds/status.ts`) e a máquina de estados do backend tem
          mais nomes — `rejected` e `cancelled` são coisas diferentes lá e o
          mesmo fim de linha aqui. Quem traduz é `stageOf`; escrever
          `is-${item.status}` direto daria uma classe que não existe e um ponto
          sem cor nenhuma, sem nada quebrar.
        */}
        <ul className="quebra" data-testid="perf-quebra">
          {cancellations.breakdown.map((item) => (
            <li
              className={`quebra__linha is-${stageOf(item.status)}`}
              key={`${item.status}-${item.payment_status}`}
            >
              {/* O ponto sai de `--st`, a mesma fonte do chip de status e do fio
                  da lista de Pedidos — quem pinta um estágio não escolhe matiz. */}
              <span className="quebra__ponto" aria-hidden="true" />
              <span className="quebra__nome">{labelFor(STATUS_LABELS, item.status)}</span>
              <span className="quebra__pagamento">
                {labelFor(PAYMENT_STATUS_LABELS, item.payment_status)}
              </span>
              <span className="quebra__pedidos tnum">
                {item.orders_count === 1 ? '1 pedido' : `${item.orders_count} pedidos`}
              </span>
              <span className="quebra__valor tnum num">{formatCurrency(item.amount_total)}</span>
            </li>
          ))}
        </ul>

        {/*
          O DENOMINADOR, ESCRITO. A taxa do cartão de cima é sobre TODOS os
          pedidos do período — faturados mais excluídos —, e quem tentar
          recalcular dividindo só pelos faturados vai achar outro número e
          concluir que a tela está errada.
        */}
        <p className="t-aux perf__ressalva">
          A taxa do topo é sobre todos os pedidos do período, faturados e excluídos — não só sobre
          os {cancellations.billable_orders_count} faturados.
        </p>
      </div>

      <Horas horas={horas} />
    </div>
  );
}

/**
 * A HORA DE ENTRADA dos pedidos que não viraram venda.
 *
 * O DADO NÃO VEM DO RELATÓRIO DE CANCELAMENTOS — ele não tem relógio nenhum.
 * Vem da listagem de pedidos, pelo `created_at`, com o mesmo período e o mesmo
 * recorte de filial. O porquê inteiro está em `cancellation-hours.ts`.
 *
 * TRÊS COISAS QUE ESTE BLOCO NÃO FAZ, e cada uma é uma escolha:
 *
 * 1. **Não desenha com amostra pequena** (`HORA_LIMIARES.amostraMinima`). Três
 *    cancelamentos não têm hora de concentração: têm três horas.
 * 2. **Não vira tarja quando falha.** A contagem, o valor e a quebra vieram do
 *    relatório e não passaram por aqui; uma faixa vermelha apagaria a resposta
 *    que carregou.
 * 3. **Não chama isso de "hora do cancelamento".** É a hora em que o pedido
 *    ENTROU; o instante do cancelamento não está no contrato.
 */
function Horas({ horas }: { horas: CancellationHours }) {
  if (horas.falhou) {
    return (
      <p className="t-aux perf__ressalva" data-testid="perf-horas-falhou">
        Não deu para ler a hora destes pedidos agora — o resto do bloco continua valendo.
      </p>
    );
  }

  if (horas.isLoading || !horas.leitura) return null;

  const { leitura } = horas;

  return (
    <div className="naovenda__horas" data-testid="perf-horas">
      <p className="t-label">A que horas eles entraram</p>

      <HourChart horas={leitura.horas} total={leitura.total} />

      <p className="t-aux perf__ressalva">
        A hora é a de ENTRADA do pedido — o painel não recebe o instante em que ele foi cancelado.
        {horas.truncado
          ? ` A leitura saiu de ${horas.lidos} dos ${horas.esperados} pedidos do período.`
          : ''}
      </p>
    </div>
  );
}

/**
 * Uma frase de leitura dos dados.
 *
 * `null` NÃO RENDERIZA NADA — e é este componente que faz a regra valer na
 * tela: sem ele, cada ponto de uso precisaria do seu próprio ternário, e o
 * primeiro que escrevesse `?? 'Período estável'` traria de volta a frase de
 * preenchimento que a tela recusa.
 */
function Frase({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <p className="t-aux perf__frase-curta" data-testid={`perf-frase-${insight.id}`}>
      {insight.text}
    </p>
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
function formatPercent(value: string | number | null | undefined): string {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  return `${(Math.round(numeric * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
