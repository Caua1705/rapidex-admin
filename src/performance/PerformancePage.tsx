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
  readFilial,
  readHoraCancelamento,
  readPagamento,
  readRetirada,
  readTicketOuVolume,
  readVeredito,
  readVolumeSemReceita,
  semMovimento,
  type Insight,
} from './insights';
import { HourChart } from './HourChart';
import { variacaoDaFilial, type FilialComparada } from './branch-comparison';
import {
  legendaDosQuadrantes,
  QUADRANTE_NOMES_MAX,
  quadrantesDeProduto,
  type Quadrante,
} from './product-quadrants';
import { useBranchComparison, type BranchComparison } from './useBranchComparison';
import { useCancellationHours, type CancellationHours } from './useCancellationHours';
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
 * - **Não tem FATURAMENTO por hora.** Não existe rota de relatório por hora no
 *   contrato: o mais fino que o backend entrega é o dia
 *   (`/reports/sales-by-day`). O que existe por hora é uma coisa só, e ela é
 *   contagem, não dinheiro — ver o item seguinte.
 * - **Não tem o grupo "sazonais" em O que vendeu.** É o quarto nome do padrão
 *   de mercado e ele não é detectável com um período agregado por vez. A tela
 *   escreve isso em vez de adivinhar — ver `product-quadrants.ts`.
 * - **FILTRA POR FILIAL, e passou a filtrar.** Este parágrafo dizia o
 *   contrário — "nenhuma das rotas aceita `branch_id`" — e era verdade até a
 *   revisão `20260820_0026` do backend. Hoje as seis aceitam, o seletor do topo
 *   funciona aqui como funciona em Pedidos, e é ele que decide se a tela mostra
 *   uma loja ou compara todas.
 *
 * O QUE ESTA RODADA ACRESCENTOU, E DE ONDE VEIO CADA COISA — nenhuma rota nova:
 *
 * - **AS FILIAIS LADO A LADO**, em "todas as filiais". Uma chamada de
 *   `/reports/summary` por loja, que passou a aceitar `branch_id`. A tela
 *   somava as duas e avisava que estava somando; o aviso era honesto e inútil.
 *   Ver `branch-comparison.ts`.
 * - **A HORA DOS CANCELAMENTOS.** O relatório de cancelamentos cruza situação
 *   com pagamento e não tem relógio; quem tem é `GET /admin/orders`, pelo
 *   `created_at`. É a hora de ENTRADA do pedido, e a tela diz isso. Ver
 *   `cancellation-hours.ts`.
 * - **OS GRUPOS DE PRODUTO.** O ranking diz o que vende; o grupo diz o que
 *   fazer. Os dois cortes têm nome em `QUADRANTE_LIMIARES`, e o denominador é o
 *   mesmo `listed_revenue_total` que a seção já usava.
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

  /*
   * A COMPARAÇÃO ENTRE FILIAIS EXISTE EM UM LUGAR SÓ: "todas as filiais", com
   * mais de uma loja no acesso. As três razões estão em `branch-comparison.ts`,
   * e a curta é esta — com uma filial escolhida, a tela já é sobre ela, e pôr o
   * faturamento da vizinha embaixo faria a página contradizer a própria legenda
   * de escopo três centímetros depois de escrevê-la.
   *
   * `podeLer` com `activeBranchId` vazio é, por construção, o DONO: o gerente é
   * recusado pelo backend sem recorte (`ensure_pode_ler_dinheiro`), então não há
   * conferência de papel a fazer aqui.
   */
  const comparaFiliais = podeLer && activeBranchId === '' && branches.length > 1;
  const filiais = useBranchComparison(branches, range, {
    habilitado: comparaFiliais && !problem,
  });

  /*
   * AS SITUAÇÕES DA HORA SAEM DO PRÓPRIO RELATÓRIO, não de uma lista escrita
   * aqui: são as que o backend contou como "não virou venda" neste período. O
   * porquê está em `useCancellationHours` — em resumo, uma segunda definição de
   * "não virou venda" morando na tela é como a contagem de cima e o gráfico de
   * baixo passam a discordar sem nada quebrar.
   */
  const situacoes = [...new Set((cancellations?.breakdown ?? []).map((item) => item.status))];
  const horas = useCancellationHours(
    { startDate: range.startDate, endDate: range.endDate, branchId: activeBranchId },
    situacoes,
    { habilitado: podeLer && !!cancellations, esperados: cancellations?.orders_count ?? 0 },
  );

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
          {/* Sem venda não há o que comparar entre lojas, então a linha de
              escopo volta a ser a de sempre — apontar para uma comparação que
              não vai ser desenhada seria mandar o lojista procurar um bloco
              inexistente. */}
          <Escopo
            nomeDaFilial={nomeDaFilial}
            temEscolha={branches.length > 1}
            temComparacao={false}
          />
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
                <Escopo
                  nomeDaFilial={nomeDaFilial}
                  temEscolha={branches.length > 1}
                  temComparacao={comparaFiliais}
                />
              </>
            ) : null}
          </section>

          {/* ================================================================
              A2. AS FILIAIS — só em "todas as filiais"

              Pergunta: QUAL DAS LOJAS VAI MELHOR?

              ELA VEM LOGO DEPOIS DA BANDA, e antes do gráfico, porque é a
              ressalva da banda virada do avesso: o bloco de cima acaba dizendo
              "estes números somam todas as filiais", e esta seção é a resposta
              a esse aviso. Entre os dois não pode entrar nada.

              É de largura inteira e não da grade de duas colunas: cada loja é
              uma linha com nome, valor, barra de fatia e uma linha de meta —
              espremida em metade, o nome da filial fica com 120px.
             ================================================================ */}
          {comparaFiliais ? (
            <Secao
              largo
              titulo="As filiais"
              nota={`no mesmo período · ${branches.length === 2 ? 'as 2 lojas' : `as ${branches.length} lojas`}`}
              erro={filiais.erro ?? undefined}
            >
              <Filiais comparacao={filiais} anterior={anterior} />
            </Secao>
          ) : null}

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
              /*
                A NOTA DIZ O ESCOPO DA ANÁLISE, e só isso. Ela dizia também "os
                mais vendidos, por unidades" — que é o critério da TABELA, e a
                tabela agora tem rótulo próprio. Com os dois, a mesma frase
                aparecia duas vezes na mesma seção (§8).
              */
              nota={
                products && products.products.length > 0
                  ? products.products.length === 1
                    ? '1 produto no período'
                    : `${products.products.length} produtos no período`
                  : undefined
              }
              erro={errors.products}
            >
              {products ? <Produtos products={products} /> : null}
            </Secao>

            {/* ==============================================================
                D. O QUE NÃO VIROU VENDA

                Pergunta: ESTOU PERDENDO PEDIDO EM QUÊ?

                ELA SUBIU PARA CÁ, e a troca com "Entrega e retirada" é de
                ALTURA, não de importância. As duas perguntas que a grade põe
                lado a lado precisam ter tamanhos parecidos: com o bloco de duas
                linhas de entrega/retirada ao lado da seção de produtos — que
                nesta rodada ganhou os grupos e passou de 800px —, a coluna da
                direita ficava com meia tela de nada e um fio de 700px correndo
                ao lado do vazio.

                A ordem nova também lê melhor: o que vendeu ao lado do que NÃO
                virou venda é a comparação que essas duas pedem juntas, e era o
                que o comentário da grade já dizia querer sem que o arranjo
                entregasse.
               ============================================================== */}
            <Secao titulo="O que não virou venda" erro={errors.cancellations}>
              {cancellations ? (
                <Cancelados cancellations={cancellations} horas={horas} />
              ) : null}
            </Secao>

            {/* ==============================================================
                E. ENTREGA E RETIRADA

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
function Escopo({
  nomeDaFilial,
  temEscolha,
  temComparacao,
}: {
  nomeDaFilial: string;
  temEscolha: boolean;
  /** A seção "As filiais" está desenhada logo abaixo. */
  temComparacao: boolean;
}) {
  if (!temEscolha) return null;

  return (
    <p className="perf__escopo" data-testid="perf-escopo">
      {nomeDaFilial ? (
        <>
          Estes números são <strong>da filial {nomeDaFilial}</strong> — troque no seletor do topo
          para ver outra loja, ou a rede inteira.
        </>
      ) : temComparacao ? (
        /*
          A MESMA RESSALVA, COM OUTRO FIM. Ela dizia "escolha uma no seletor do
          topo" — um pedido de trabalho ao lojista para responder a pergunta que
          a tela não respondia. Com a comparação desenhada logo abaixo, a
          instrução vira um apontamento: o número que ele quer já está na tela,
          três centímetros adiante. O seletor continua lá para quem quiser a
          tela INTEIRA de uma loja, e é isso que a segunda metade da frase diz.
        */
        <>
          Estes números somam <strong>todas as filiais</strong> — a divisão por loja está logo
          abaixo, e o seletor do topo abre a tela inteira de uma delas.
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
 * AS FILIAIS LADO A LADO — a resposta para "qual das duas vai melhor".
 *
 * A FORMA É A DE `.fatias` (entrega × retirada), e reusar era a decisão certa:
 * as duas seções fazem a MESMA pergunta visual — dois ou três valores
 * comparáveis, cada um com sua fatia do todo, onde a barra responde "qual é o
 * maior" antes de o olho ler os números. Uma classe `.filiais__*` paralela
 * seria a mesma lista escrita duas vezes, e a primeira mudança de respiro numa
 * delas separaria as duas para sempre.
 *
 * O QUE ESTA SEÇÃO ACRESCENTA À FORMA é a variação de cada loja, que vem de
 * graça: cada resposta de `/reports/summary` já traz o período anterior de
 * igual tamanho comparado pelo backend. É ela que separa "a Aldeota é maior" de
 * "a Aldeota está crescendo e a Zona Norte encolhendo" — duas leituras que
 * levam a decisões opostas.
 *
 * A ORDEM É POR FATURAMENTO, maior primeiro (ver `compararFiliais`): em ordem
 * alfabética, "qual vai melhor" voltaria a exigir que o olho comparasse dois
 * números de quatro dígitos, que é o trabalho que esta seção existe para
 * poupar.
 */
function Filiais({ comparacao, anterior }: { comparacao: BranchComparison; anterior: string }) {
  const { filiais, falharam, naoPedidas, isLoading } = comparacao;

  if (isLoading && filiais.length === 0) {
    return <p className="muted">Carregando as filiais…</p>;
  }

  if (filiais.length === 0) {
    return <p className="muted">Nenhuma filial respondeu neste período.</p>;
  }

  return (
    <>
      <Frase insight={readFilial(filiais)} />

      <dl className="fatias" data-testid="perf-filiais">
        {filiais.map((filial) => (
          <LinhaDeFilial key={filial.branch.id} filial={filial} anterior={anterior} />
        ))}
      </dl>

      {/*
        QUEM FALTOU É NOMEADO, e não somado silenciosamente ao resto.

        A fatia de cada loja é calculada sobre o faturamento das que
        RESPONDERAM — ver `compararFiliais`. Sem esta linha, uma loja que falhou
        deixaria a outra com "100% da rede" desenhado numa barra cheia, e o dono
        leria uma falha de carregamento como um fato de negócio.
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
  const leitura = readChange(filial.summary.revenue_comparison, anterior);
  const variacao = variacaoDaFilial(filial);

  /*
   * A DIREÇÃO EM TRÊS CANAIS, igual aos três números do topo: sinal no texto,
   * seta e cor. A cor sozinha reprovaria em WCAG 1.4.1, e a seta sozinha não é
   * lida de relance — que é justamente o trabalho desta linha.
   */
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
        Por isso a primeira metade é montada como uma string.
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

      {/*
        A BARRA É A FATIA DO FATURAMENTO DAS LOJAS QUE RESPONDERAM, e é ela que
        responde "qual é a maior" sem leitura de número. `aria-hidden` porque o
        percentual ao lado já diz o mesmo para quem escuta a tela, e ela some
        quando não há denominador — período sem faturamento nenhum não faz de
        ninguém "0% da rede".
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

/**
 * ============================================================================
 * O QUE VENDEU — o grupo primeiro, o ranking depois
 * ============================================================================
 *
 * A SEÇÃO PASSOU A RESPONDER DUAS PERGUNTAS, e a ordem entre elas é a decisão:
 *
 * 1. **O que FAZER** — os grupos (`Quadrantes`). Campeão, promissor e
 *    repensável são instruções: não deixe faltar, empurre, reveja.
 * 2. **O que VENDE** — o ranking por unidades, que é a leitura antiga e
 *    continua inteira. Ela responde "quem saiu mais", que é outra pergunta e
 *    também é legítima.
 *
 * O grupo vem primeiro porque a premissa da tela é essa: o dono não abre o
 * painel para estudar, abre para saber o que fazer amanhã. Um ranking em cima
 * dos grupos devolveria a seção ao formato de relatório com um apêndice.
 *
 * UM DENOMINADOR SÓ NA SEÇÃO INTEIRA. Os grupos, a frase de concentração, a
 * frase de volume sem receita e a linha de total dividem todos pelo MESMO
 * `listed_revenue_total` — a soma dos produtos que a rota devolveu. Duas fatias
 * na mesma seção com denominadores diferentes é como a tela passa a discordar
 * de si mesma sem que nada quebre.
 */
function Produtos({ products }: { products: ProductSales }) {
  const columns: readonly Column<LinhaProduto>[] = [
    { key: 'produto', header: 'Produto' },
    { key: 'unidades', header: 'Unidades', align: 'end' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'receita', header: 'Receita de item', align: 'end' },
  ];

  const grupos = quadrantesDeProduto(products);

  /*
   * A TABELA MOSTRA `RANKING_SIZE` LINHAS, E A REQUISIÇÃO PEDE
   * `PRODUTOS_ANALISADOS`. São números diferentes de propósito, e nenhum dos
   * dois fica implícito: a nota da seção diz quantos produtos entraram na
   * conta, e o rótulo da tabela diz quantos ela desenha. Uma tabela de 40
   * linhas numa coluna de metade de largura seria a seção inteira; um
   * denominador de 10 produtos faria "12% da receita de itens" significar 12%
   * de um total que exclui tudo o que ficou em 11º.
   */
  const listadosNaTabela = products.products.slice(0, RANKING_SIZE);

  const rows: LinhaProduto[] = listadosNaTabela.map((item, index) => ({
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
      {grupos ? <Quadrantes grupos={grupos} /> : null}

      <Frase insight={readConcentracao(products)} />
      <Frase insight={readVolumeSemReceita(products)} />

      {/*
        O RANKING CONTINUA, E AGORA DIZ POR QUE ESTÁ AQUI.

        Ele responde outra pergunta que os grupos: os grupos ordenam por
        DINHEIRO e os itens por UNIDADES, e é justamente na discordância entre
        as duas ordens que mora a informação ("o refrigerante é o terceiro mais
        pedido e um mero promissor em receita"). Sem o rótulo, a tabela leria
        como a mesma lista de cima escrita de novo.

        E quando a análise é maior que a tabela, ela diz quantas linhas mostra:
        um "top 10" que não se anuncia é uma lista que parece completa.
      */}
      <p className="t-label perf__sublabel">
        {products.products.length > RANKING_SIZE
          ? `Ranking por unidades — os ${RANKING_SIZE} primeiros`
          : 'Ranking por unidades'}
      </p>

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
            <span>
              Receita{' '}
              {products.products.length === 1
                ? 'deste item'
                : `destes ${products.products.length} itens`}
            </span>
            <span className="tnum">{formatCurrency(products.listed_revenue_total)}</span>
          </p>
          <p className="t-aux perf__ressalva">{products.revenue_note}</p>
        </div>
      ) : null}
    </>
  );
}

/**
 * ============================================================================
 * OS GRUPOS DE PRODUTO — e por que são TRÊS, não quatro
 * ============================================================================
 *
 * Cada grupo diz três coisas, nesta ordem: o NOME (campeões), o TAMANHO
 * (quantos itens e quanto da receita eles somam) e a AÇÃO.
 *
 * O CORTE FICA NA LEGENDA, uma vez para os três — e não dentro de cada bloco.
 * Dizê-lo é obrigatório, porque "campeão" sem o critério é uma opinião; dizê-lo
 * três vezes em três frases quase iguais gastava três linhas para explicar uma
 * régua só. Junto, o corte lê como o que ele é: uma escala.
 *
 * NÃO É UMA TABELA: são três blocos com nome, número e uma frase de ação. Uma
 * tabela de quatro colunas para três linhas gasta mais tinta em moldura que em
 * dado, e a coluna "ação" seria um parágrafo dentro de uma célula.
 *
 * OS NOMES SÃO CORTADOS EM `QUADRANTE_NOMES_MAX`. "Repensáveis" costuma ter
 * dezenas de itens num cardápio de restaurante, e trinta nomes numa coluna de
 * metade de largura é uma parede — mas nomear ZERO tiraria a ação do grupo, que
 * é justamente saber quais são. Quatro nomes e "e mais N" respondem "quais
 * são" para os piores casos e mandam o resto para o Cardápio.
 */
function Quadrantes({ grupos }: { grupos: readonly Quadrante[] }) {
  return (
    <>
      <dl className="quadrantes" data-testid="perf-quadrantes">
        {grupos.map((grupo) => {
          const nomeados = grupo.produtos.slice(0, QUADRANTE_NOMES_MAX);
          const restantes = grupo.produtos.length - nomeados.length;

          return (
            <div className="quadrantes__grupo" key={grupo.id} data-testid={`perf-grupo-${grupo.id}`}>
              <dt className="quadrantes__nome">
                {grupo.nome}
                <span className="quadrantes__contagem tnum">
                  {grupo.produtos.length === 1 ? '1 item' : `${grupo.produtos.length} itens`} ·{' '}
                  {formatPercent(grupo.fatiaPct)}
                </span>
              </dt>
              <dd className="quadrantes__corpo">
                <p className="quadrantes__itens">
                  {nomeados.map((produto) => produto.nome).join(', ')}
                  {restantes > 0 ? ` e mais ${restantes}` : ''}
                </p>
                <p className="quadrantes__acao">{grupo.acao}</p>
              </dd>
            </div>
          );
        })}
      </dl>

      {/*
        O QUARTO GRUPO NÃO EXISTE, E A TELA DIZ POR QUÊ.

        "Sazonais" é o quarto nome do padrão de mercado, e ele não tem como ser
        detectado com o que o contrato devolve: sazonalidade é um item que sobe
        e desce COM A ÉPOCA e volta a subir, e isso exige o mesmo produto medido
        em vários períodos comparáveis. `/reports/products` devolve um período
        por vez, agregado, sem recorte de tempo dentro dele.

        E o atalho — pedir o período anterior e chamar de sazonal quem variou
        muito — não serve: uma variação entre duas janelas não separa
        sazonalidade de crescimento, de promoção que rodou, de item que faltou
        na cozinha nem de produto que estreou. As quatro dão o mesmo par de
        números.

        Dizer isto em uma linha custa uma linha. Chutar custaria um item fora do
        cardápio porque a tela o chamou de "de época" — e o lojista não teria
        como saber que o painel adivinhou. Ver `product-quadrants.ts`.
      */}
      <p className="t-aux perf__ressalva" data-testid="perf-sem-sazonais">
        {legendaDosQuadrantes()} Não há um quarto grupo de sazonais: para dizer que um item é de
        época seria preciso vê-lo repetir em vários períodos, e o relatório de produtos devolve um
        período de cada vez. Sem isso, “sazonal” seria chute.
      </p>
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

function Cancelados({
  cancellations,
  horas,
}: {
  cancellations: Cancellations;
  horas: CancellationHours;
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

      <Horas horas={horas} />

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

/**
 * ============================================================================
 * A HORA — onde o padrão aparece
 * ============================================================================
 *
 * A seção já sabia dizer O QUÊ (situação e pagamento) e não sabia dizer QUANDO.
 * Cancelamento concentrado às 20h é operação no pico — entregador que não
 * apareceu, cozinha que estourou o tempo, pagamento que caiu no movimento.
 * Cancelamento espalhado pelo dia é cardápio, preço ou área de entrega. São dois
 * problemas diferentes, e a tabela de situações não separa um do outro.
 *
 * O DADO NÃO VEM DO RELATÓRIO DE CANCELAMENTOS — ele não tem hora nenhuma. Vem
 * da listagem de pedidos, pelo `created_at`, com o mesmo período e o mesmo
 * recorte de filial. O porquê inteiro está em `cancellation-hours.ts`.
 *
 * TRÊS COISAS QUE ESTE BLOCO NÃO FAZ, e cada uma é uma escolha:
 *
 * 1. **Não desenha com amostra pequena** (`HORA_LIMIARES.amostraMinima`). Três
 *    cancelamentos não têm hora de concentração: têm três horas. Um gráfico com
 *    três riscos convidaria o lojista a mudar a operação por causa de um acaso.
 * 2. **Não escreve frase quando está espalhado.** "Espalhado" é uma resposta, e
 *    ela é o próprio desenho plano do gráfico — uma frase que aparece sempre
 *    deixa de ser lida (regra 2 de `insights.ts`).
 * 3. **Não chama isso de "hora do cancelamento".** É a hora em que o pedido
 *    ENTROU; o instante do cancelamento não está no contrato. A diferença é
 *    dita na linha de apoio, não escondida.
 */
function Horas({ horas }: { horas: CancellationHours }) {
  /*
   * A FALHA É UMA LINHA DE APOIO, NÃO UMA TARJA. A taxa, o valor e a tabela de
   * situações vêm do relatório e não passaram por aqui: uma faixa vermelha por
   * um recorte ausente apagaria a resposta que carregou.
   */
  if (horas.falhou) {
    return (
      <p className="t-aux perf__ressalva" data-testid="perf-horas-falhou">
        Não deu para ler a hora destes pedidos agora — o resto da seção continua valendo.
      </p>
    );
  }

  if (horas.isLoading || !horas.leitura) return null;

  const { leitura } = horas;

  return (
    <div className="perf__horas" data-testid="perf-horas">
      <p className="t-label perf__sublabel">A que horas eles entraram</p>

      <HourChart horas={leitura.horas} total={leitura.total} />

      <Frase insight={readHoraCancelamento(leitura)} />

      {/*
        AS DUAS RESSALVAS, NUMA LINHA SÓ E SEMPRE — não só quando dá ruim.

        A primeira é do contrato e não some nunca: `created_at` é a entrada do
        pedido, não o instante do cancelamento. A segunda só aparece quando a
        paginação de fato cortou, e aí ela diz de quantos a leitura saiu — um
        recorte DECLARADO, não silencioso.
      */}
      <p className="t-aux perf__ressalva">
        A hora é a de ENTRADA do pedido — o painel não recebe o instante em que ele foi cancelado.
        {horas.truncado
          ? ` A leitura saiu de ${horas.lidos} dos ${horas.esperados} pedidos do período.`
          : ''}
      </p>
    </div>
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
function formatPercent(value: string | number | null | undefined): string {
  const numeric = toNumber(value);
  if (numeric === null) return '—';
  return `${(Math.round(numeric * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
