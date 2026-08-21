import type { CSSProperties, ReactNode } from 'react';

import { DataTable, type Column } from '../ds/DataTable';
import { TrendDownIcon, TrendUpIcon } from '../ds/icons';
import { PageBar } from '../ds/PageBar';
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
import { useSession } from '../auth/session-context';
import { usePermissoes } from '../auth/use-permissions';
import { branchName } from '../layout/branch-heading';
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
 * - **FILTRA POR FILIAL, e passou a filtrar.** Este parágrafo dizia o
 *   contrário — "nenhuma das rotas aceita `branch_id`" — e era verdade até a
 *   revisão `20260820_0026` do backend. Hoje as seis aceitam, e o seletor do
 *   topo funciona aqui como funciona em Pedidos.
 *
 * O AVISO DE ESCOPO É DITO UMA VEZ, e não uma vez por seção (§8 da skill de
 * design): a mesma caixa repetida em seis blocos vira listra, não aviso. O que
 * ele diz mudou junto: antes explicava que o seletor NÃO pegava; agora nomeia
 * o recorte que está no ar.
 *
 * ----------------------------------------------------------------------------
 * QUEM LÊ DINHEIRO: o dono sempre; a gerência só com UMA filial escolhida
 * ----------------------------------------------------------------------------
 *
 * As cinco rotas de relatório são da GERÊNCIA, mas o backend responde 403 ao
 * gerente que não manda recorte (`ensure_pode_ler_dinheiro`) — sem `branch_id`,
 * "ler o faturamento" significa ler o do RESTAURANTE INTEIRO, e o resultado da
 * Aldeota não é do gerente do Centro.
 *
 * Por isso, para o gerente em "Todas as filiais", esta tela não carrega nada e
 * PEDE a filial em vez de disparar seis requisições que voltam 403. É a única
 * tela do painel que pede uma escolha antes de mostrar — e é a exceção certa:
 * as outras resolvem a filial sozinhas porque o que elas gravam cabe em uma
 * loja qualquer; aqui a escolha MUDA O NÚMERO.
 *
 * A COMISSÃO É SÓ DO DONO, e não acompanhou as outras cinco: é o percentual
 * negociado com a plataforma, não desempenho de loja.
 */
export function PerformancePage() {
  const { activeBranchId, branches } = useSession();
  const { podeLerDinheiro, pode } = usePermissoes();
  const podeLer = podeLerDinheiro(activeBranchId);

  /*
   * SEM PODER LER, NÃO SE PEDE. `usePerformance` dispara sete requisições no
   * efeito de montagem; passar-lhe um recorte que o backend vai recusar seria
   * sete 403 e uma tela de erro em vermelho para dizer "escolha uma filial".
   * O período em branco desliga a carga (ver `rangeProblem` no hook).
   */
  const { range, problem, reports, errors, isLoading, selectPreset, setCustomDate } =
    usePerformance(activeBranchId, {
      habilitado: podeLer,
      comComissao: pode('desempenho.verComissao'),
    });

  const filialAtiva = branches.find((filial) => filial.id === activeBranchId) ?? null;
  const nomeDaFilial = filialAtiva ? branchName(filialAtiva) : '';
  const { summary, byDay, byDayPrevious, payments, products, cancellations, commission } = reports;
  const anterior = previousLabelFor(range.preset);
  const vazio = semMovimento(summary);

  return (
    <div className="perf">
      {/*
        A MESMA FAIXA DE 52px DE TODAS AS TELAS. O período era um cartão branco
        contornado logo abaixo do título — um objeto de 50px de altura para
        três palavras e, às vezes, dois campos de data. Ele é ferramenta de
        tela, e ferramenta de tela mora na faixa da tela.
      */}
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

        {/*
          As datas só aparecem em "Escolher". Mantê-las sempre na faixa custaria
          dois campos de 148px para o caso raro de alguém querer uma janela
          específica.
        */}
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

        `ensure_pode_ler_dinheiro` recusa o gerente sem recorte: sem `branch_id`
        estes números somam o restaurante inteiro, e o resultado da Aldeota não
        é do gerente do Centro. Sem esta frase, a abertura da tela seriam cinco
        requisições recusadas e cinco tarjas vermelhas dizendo, em linguagem de
        erro, uma coisa que é uma instrução.

        NÃO É "ACESSO NEGADO": é uma escolha que falta, e ela se faz no seletor
        do topo, que já está na tela. Por isso a frase aponta para lá em vez de
        oferecer um botão próprio — dois lugares para escolher filial é como os
        dois passam a discordar.
      */}
      {!podeLer ? (
        <p className="perf__frase perf__frase--topo" data-testid="perf-escolha-filial">
          Escolha uma filial no seletor do topo para ver o desempenho dela. O resultado somado de
          todas as lojas é do dono do restaurante.
        </p>
      ) : null}

      {podeLer && isLoading ? <p className="muted perf__estado">Carregando…</p> : null}

      {/*
        SEM VENDA NO PERÍODO É UMA TELA, NÃO SEIS SEÇÕES ZERADAS.

        Um faturamento de R$ 0,00, um ticket de R$ 0,00, um gráfico de barras
        rentes ao chão e quatro tabelas vazias não dizem "não vendeu": dizem "a
        tela quebrou", e o lojista sai procurando o erro no painel em vez de
        olhar para o período. A frase afirma o que aconteceu, e os pedidos
        excluídos continuam ali — porque zero faturado com três cancelados é
        exatamente o caso em que os três precisam ser vistos.
      */}
      {podeLer && !isLoading && !problem && vazio && summary ? (
        <section className="perf__vazio" data-testid="perf-vazio">
          <p className="perf__frase perf__frase--topo">Nenhum pedido foi faturado neste período.</p>
          <Excluidos summary={summary} />
          <Escopo nomeDaFilial={nomeDaFilial} temEscolha={branches.length > 1} />
        </section>
      ) : null}

      {podeLer && !isLoading && !problem && !vazio ? (
        <div className="perf__secoes">
          {/* ================================================================
              A. A FRASE — a banda de topo

              Pergunta que a seção responde: A SEMANA FOI BOA?

              Ela não tem título de seção: um rótulo "Resumo" em cima da
              resposta a rebaixaria a mais um bloco de relatório. É a única
              coisa da tela que fala em frase inteira, é a primeira que o olho
              encontra, e é ela que separa esta tela de um relatório impresso.

              A BANDA NÃO É UM CARTÃO. Ela ocupa a largura da tela e é separada
              do resto por um fio mais forte — a mesma marcação que o total do
              pedido usa no detalhe e que o cabeçalho de coluna usa nas tabelas.
              Um cartão branco sobre chão cinza aqui devolveria a tela ao
              formato "painel administrativo de biblioteca pronta".
             ================================================================ */}
          <section className="perf__topo">
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

                {/*
                  O ESCOPO DESCE PARA CÁ, e a ordem é a decisão.

                  Ele já morou ao lado do período, acima da frase — e ali ele
                  era a primeira coisa que o olho encontrava, três linhas de
                  tinta de apoio na frente da única sentença que a tela existe
                  para dizer. Ele qualifica os números, então vive com eles: a
                  frase primeiro, a ressalva do escopo no pé do mesmo bloco.

                  Descer NÃO é encolher: mesma tinta, mesmo corpo, e ele
                  continua aparecendo inclusive no período sem venda nenhuma.
                */}
                <Escopo nomeDaFilial={nomeDaFilial} temEscolha={branches.length > 1} />
              </>
            ) : null}
          </section>

          {/* ================================================================
              B. OS DIAS — a largura inteira

              Pergunta: QUE DIAS SUSTENTARAM O PERÍODO E QUAIS NÃO APARECERAM?

              O gráfico é a peça que mais faz esta tela ler como painel em vez
              de documento, e por isso ele fica sozinho numa faixa da largura
              inteira, logo abaixo da resposta. Espremido numa coluna de
              metade, trinta dias viravam trinta riscos.
             ================================================================ */}
          <Secao
            largo
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
              AS QUATRO PERGUNTAS QUE SOBRAM — duas colunas separadas por fio

              Elas eram quatro cartões empilhados, um por vez, numa página que
              já rolava. Em duas colunas a tela deixa de ser uma fila e passa a
              ser uma grade: o olho compara "o que vendeu" com "o que não virou
              venda" sem rolar, que é a leitura que essas duas pedem juntas.
             ================================================================ */}
          <div className="perf__grade">
            {/* ==============================================================
                C. O QUE VENDEU

                Pergunta: O FATURAMENTO VEIO DE ONDE?
               ============================================================== */}
            <Secao
              titulo="O que vendeu"
              nota={`os ${RANKING_SIZE} primeiros, por unidades`}
              erro={errors.products}
            >
              {products ? <Produtos products={products} /> : null}
            </Secao>

            {/* ==============================================================
                D. ENTREGA E RETIRADA

                Pergunta: ESTOU GANHANDO MAIS ENTREGANDO OU O CLIENTE VINDO
                BUSCAR?
               ============================================================== */}
            <Secao titulo="Entrega e retirada" erro={errors.summary}>
              {summary ? (
                <>
                  <TiposDePedido summary={summary} />
                  <Frase insight={readRetirada(summary)} />
                </>
              ) : null}
            </Secao>

            {/* ==============================================================
                E. O QUE NÃO VIROU VENDA

                Pergunta: ESTOU PERDENDO PEDIDO EM QUÊ?
               ============================================================== */}
            <Secao titulo="O que não virou venda" erro={errors.cancellations}>
              {cancellations ? <Cancelados cancellations={cancellations} /> : null}
            </Secao>

            {/* ==============================================================
                F. O QUE SAI DO FATURAMENTO

                Pergunta: QUANTO SOBROU, DE VERDADE?

                É aqui que a forma de pagamento aparece — em uma linha de texto,
                e só quando ela concentra risco. Ver `readPagamento`.
               ============================================================== */}
            <Secao titulo="O que sai do faturamento" erro={errors.summary}>
              {summary ? (
                <>
                  <Composicao summary={summary} />
                  <Frase insight={readDesconto(summary)} />
                  {/*
                    A COMISSÃO É SÓ DO DONO. Para a gerência, o bloco não é
                    desenhado nem em erro: ela não foi pedida (ver
                    `usePerformance`), e uma tarja vermelha aqui diria que
                    faltou carregar algo que nunca ia carregar.
                  */}
                  {pode('desempenho.verComissao') ? (
                    errors.commission ? (
                      <p className="alert alert--error" role="alert">
                        {errors.commission}
                      </p>
                    ) : commission ? (
                      <Comissao commission={commission} />
                    ) : null
                  ) : null}
                  <Frase insight={readPagamento(payments)} />
                </>
              ) : null}
            </Secao>
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
 * O escopo dos números — dito uma vez na tela, no pé do bloco da frase.
 *
 * ELE MUDOU DE ASSUNTO. Dizia que os relatórios não separavam por loja e que o
 * seletor do topo não pegava aqui — verdade até as seis rotas ganharem
 * `branch_id`. Hoje o seletor pega, e a linha existe pelo motivo oposto: dizer
 * QUAL recorte produziu estes números, porque "faturou R$ 12 mil" significa
 * coisas diferentes para uma loja e para a rede.
 *
 * Com uma filial só no acesso não há o que distinguir, e a linha não aparece —
 * a mesma regra do `hasChoice` de `use-branch-scope.ts`.
 */
function Escopo({ nomeDaFilial, temEscolha }: { nomeDaFilial: string; temEscolha: boolean }) {
  if (!temEscolha) return null;

  return (
    <p className="perf__escopo" data-testid="perf-escopo">
      {nomeDaFilial ? (
        <>
          Estes números são <strong>da filial {nomeDaFilial}</strong> — troque no seletor do topo
          para ver outra loja, ou a rede inteira.
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
  largo = false,
  children,
}: {
  titulo: string;
  nota?: string;
  erro?: string;
  /** A seção ocupa a largura inteira, fora da grade de duas colunas. */
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`perf__secao${largo ? ' perf__secao--largo' : ''}`}>
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

  /*
   * A DIREÇÃO É DITA EM TRÊS CANAIS: o sinal no texto, a seta e a cor.
   *
   * A cor sozinha não bastaria (WCAG 1.4.1) e a seta sozinha não é lida de
   * relance, que é justamente o trabalho: com os três, "subiu" ou "caiu" chega
   * antes de o olho ler o número.
   */
  const Seta =
    leitura.direction === 'up' ? TrendUpIcon : leitura.direction === 'down' ? TrendDownIcon : null;

  return (
    <div className="numeros__item">
      <dt className="numeros__rotulo">{rotulo}</dt>
      <dd className="numeros__valor">{valor}</dd>
      {/*
        `change_percent` nulo vira "sem comparação", NUNCA 0% — ver `readChange`.
        Aí não há direção, e a linha fica na tinta de apoio: pintar de verde ou
        vermelho uma comparação que não existe seria afirmar o que a rota diz
        não saber.
      */}
      <dd
        className={`numeros__delta numeros__delta--${leitura.isMissing ? 'vazio' : leitura.direction}`}
      >
        {Seta ? <Seta size={14} /> : null}
        <span>{leitura.text}</span>
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

/**
 * TABELA SÓ QUANDO É TABELA.
 *
 * Entrega e retirada são DOIS valores — e, numa loja que só entrega, um. Uma
 * tabela de quatro colunas e cabeçalho para duas linhas gasta mais tinta em
 * moldura do que em dado, e uma tabela de UMA linha não é tabela: é uma frase
 * com bordas. Aqui os dois casos têm forma própria:
 *
 * - um tipo só: uma frase, porque é o que ela é;
 * - dois tipos: uma lista compacta, com a fatia como barra de proporção — a
 *   comparação entre eles é a pergunta da seção, e a barra a responde antes da
 *   leitura do número.
 */
function TiposDePedido({ summary }: { summary: SalesSummary }) {
  const tipos = summary.order_types;
  if (tipos.length === 0) return <p className="muted">Nenhum pedido no período.</p>;

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
    <dl className="fatias">
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
            {/*
              A BARRA É PROPORÇÃO, NÃO ENFEITE: ela responde "qual dos dois é
              maior" sem que o olho compare dois números de quatro dígitos.
              `aria-hidden` porque o percentual ao lado já diz o mesmo para quem
              escuta a tela — e ela some quando não há denominador.
            */}
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
