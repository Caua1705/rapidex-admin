import type { CSSProperties, ReactNode } from 'react';

import { useSession } from '../auth/session-context';
import { HelpPopover } from '../ds/HelpPopover';
import { PageBar } from '../ds/PageBar';
import { Select } from '../ds/Select';
import { branchName } from '../layout/branch-heading';
import { formatDateTime } from '../orders/format';
import { dayLabel } from '../performance/report-model';
import { RatingLabel, Stars } from './Stars';
import {
  readSemEtiqueta,
  readVeredito,
  readVolumeBaixo,
  semAvaliacao,
  type Insight,
} from './review-insights';
import {
  contar,
  formatAverage,
  LOW_RATING_MAX,
  lowRatingCount,
  maxRatingFrom,
  problemTagLabel,
  ratingRows,
  RATING_OPTIONS,
  tagRows,
  type ReviewPreset,
} from './review-model';
import { useReviews } from './useReviews';
import type { Branch, ReviewItem, ReviewSummary } from '../api/types';
import './ReviewsPage.css';

const PERIODOS: readonly { value: ReviewPreset; label: string }[] = [
  { value: 'last7', label: '7 dias' },
  { value: 'last30', label: '30 dias' },
  { value: 'custom', label: 'Escolher…' },
];

/**
 * ============================================================================
 * AVALIAÇÕES — a tela responde "o que deu errado", não "o que disseram"
 * ============================================================================
 *
 * Atraso e pedido errado são a reclamação nº 1 do consumidor de delivery, e até
 * esta frente existir o restaurante só descobria quando o cliente reclamava em
 * outro lugar. A avaliação é o único canal de retorno direto — e o que se faz
 * com ela é CONSERTAR alguma coisa.
 *
 * Por isso esta tela não é uma lista cronológica com um filtro escondido. A
 * ordem das peças é a ordem em que a pergunta se responde:
 *
 *   1. **A FRASE.** "3 das 5 notas baixas apontaram 'Atrasou'." É a única coisa
 *      da tela que fala em frase inteira, e sai de regra determinística sobre o
 *      agregado (`review-insights.ts`) — sem IA, sem estimativa.
 *   2. **OS TRÊS NÚMEROS** que a conferem: média, avaliações, notas baixas.
 *   3. **AS ETIQUETAS**, da mais frequente para a menos. É a informação mais
 *      acionável do painel inteiro, e é a razão de a etiqueta ser lista fechada
 *      em vez de texto livre: texto livre não soma.
 *   4. **O HISTOGRAMA**, que mostra a distribuição de onde a média saiu.
 *   5. **A LISTA**, aberta em "até 3 estrelas".
 *
 * ----------------------------------------------------------------------------
 * AS DUAS PROPRIEDADES DO AGREGADO QUE ESTA TELA NÃO PODE CONTRARIAR
 * ----------------------------------------------------------------------------
 *
 * **A média sai do histograma.** Os dois vêm do mesmo `summary`, e nada aqui
 * recalcula nenhum dos dois a partir de `items` — que é uma página, e já pode
 * estar recortada por nota. Barras e média não têm como se contradizer porque
 * são o mesmo número lido duas vezes.
 *
 * **`max_rating` não entra no agregado.** O filtro de nota recorta a LISTA e
 * mais nada: a média, o total e as barras falam sempre do período inteiro. É o
 * que permite a tela abrir em "só as notas baixas" sem que o dono veja a média
 * desabar e conclua que a semana piorou.
 *
 * A tela DIZ isso, uma vez, na linha que separa a lista do agregado — e não uma
 * vez por seção, que viraria listra em vez de aviso.
 *
 * ----------------------------------------------------------------------------
 * O QUE ESTA TELA NÃO TEM, E POR QUÊ
 * ----------------------------------------------------------------------------
 *
 * - **Não mostra nome nem telefone de quem avaliou**, e não é omissão: o
 *   contrato não manda os dois de propósito. Eles já estão em
 *   `GET /admin/orders/{id}`, e repetir dado pessoal numa segunda tela é
 *   superfície a mais sem leitor novo. O que a linha carrega é o `order_number`,
 *   que é como o lojista acha o pedido em Pedidos.
 *
 * - **Não linka para o pedido.** `GET /admin/orders` busca por número, mas o
 *   painel não tem endereço que abra um pedido a partir de fora da tela de
 *   Pedidos — e um link que às vezes acerta é pior que nenhum (a mesma decisão
 *   de Clientes). O número está escrito e se copia.
 *
 * - **Não responde à avaliação, não modera e não publica nota no cardápio.**
 *   Nenhuma das três tem rota, e as três estão registradas como fora do escopo
 *   no documento do backend.
 *
 * - **Não compara com o período anterior.** Não existe `previous_period` neste
 *   agregado como existe no de vendas. Uma variação calculada com duas
 *   chamadas seria um número nosso com cara de número do backend.
 */
export function ReviewsPage() {
  const { branches, activeBranchId } = useSession();
  const reviews = useReviews(activeBranchId);

  /*
   * O RECORTE ATIVO, LIDO DA SESSÃO E NÃO RESOLVIDO — a mesma regra de
   * Clientes. Esta rota aceita `branch_id` em query e entende vazio como
   * "todas as que eu enxergo"; resolver a filial principal por baixo faria a
   * tela afirmar "filial Matriz" enquanto pede as avaliações do restaurante
   * inteiro.
   *
   * Com UMA filial no escopo não há aviso a dar: "todas" e "a única" são o
   * mesmo recorte.
   */
  const filialAtiva = branches.find((branch) => branch.id === activeBranchId) ?? null;
  const temEscolhaDeFilial = branches.length > 1;
  const recorte = !temEscolhaDeFilial
    ? null
    : filialAtiva
      ? `da filial ${branchName(filialAtiva)}`
      : 'do restaurante inteiro';

  const { summary, problem, errorMessage, isLoading } = reviews;
  const vazio = summary !== null && semAvaliacao(summary);
  const temBaixas = summary !== null && lowRatingCount(summary) > 0;

  return (
    <div className="reviews">
      <PageBar
        title="Avaliações"
        aside={
          /*
            O RECORTE E A AJUDA SÃO UM GRUPO, como em Clientes: o vão de 16px
            que a faixa põe entre os elementos do título separaria o ícone da
            frase que ele explica.
          */
          <span className="reviews__escopo-grupo">
            {recorte ? (
              <span className="t-aux reviews__escopo" data-testid="reviews-scope">
                {recorte}
              </span>
            ) : null}

            {/*
              A EXPLICAÇÃO ATRÁS DO ÍCONE, e ela responde às três perguntas que
              esta tela cria. Nenhuma cabe numa coluna, e as três se leem uma
              vez na vida — é exatamente o caso para o qual `ds/HelpPopover`
              existe (a ressalva que cresceu), e não para o subtítulo que o
              sistema não tem.
            */}
            <HelpPopover
              label="Como o cliente avalia"
              title="Como o cliente avalia"
              data-testid="reviews-ajuda"
            >
              <p className="t-aux" data-testid="reviews-nota-canal">
                O cliente avalia pela tela de acompanhamento do pedido, quando ele é entregue — o
                mesmo link que ele já usa para acompanhar. Só pedido concluído pode ser avaliado, e
                ele tem 14 dias a partir da entrega para dar ou trocar a nota.
              </p>

              {/*
                O PERÍODO É O DA AVALIAÇÃO, NÃO O DO PEDIDO, e a descrição da
                rota é literal sobre isso. Sem esta frase, o lojista conta as
                notas de "ontem" e não acha o pedido de ontem que gerou uma
                delas — a nota escrita hoje sobre a terça pertence a hoje.
              */}
              <p className="t-aux" data-testid="reviews-nota-periodo">
                O período recorta o dia em que a <strong>nota foi escrita</strong>, não o dia do
                pedido: uma nota dada hoje sobre um pedido de terça aparece em hoje.
              </p>

              <p className="t-aux" data-testid="reviews-nota-cliente">
                A etiqueta de problema só é perguntada com nota de até {LOW_RATING_MAX} estrelas, e
                escolhê-la é opcional. O nome e o telefone de quem avaliou não vêm nesta tela: use o
                número do pedido para achá-lo em Pedidos, onde a pessoa já está.
              </p>
            </HelpPopover>
          </span>
        }
      >
        <div className="seg" role="group" aria-label="Período">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.value}
              type="button"
              className="seg__opt"
              aria-pressed={reviews.range.preset === periodo.value}
              onClick={() => reviews.selectPreset(periodo.value)}
              data-testid={`reviews-period-${periodo.value}`}
            >
              {periodo.label}
            </button>
          ))}
        </div>

        {reviews.range.preset === 'custom' ? (
          <div className="reviews__datas">
            <input
              className="input"
              type="date"
              value={reviews.range.startDate}
              onChange={(event) => reviews.setCustomDate({ startDate: event.target.value })}
              aria-label="Data inicial"
              data-testid="reviews-data-de"
            />
            <span className="faint" aria-hidden="true">
              até
            </span>
            <input
              className="input"
              type="date"
              value={reviews.range.endDate}
              onChange={(event) => reviews.setCustomDate({ endDate: event.target.value })}
              aria-label="Data final"
              data-testid="reviews-data-ate"
            />
          </div>
        ) : null}

        {/*
          O FILTRO DE NOTA FICA SEMPRE VISÍVEL, e é o que paga a tela abrir
          recortada em "até 3 estrelas". Atrás de um botão "Filtros" ele seria o
          filtro que ninguém lembra que ligou — o defeito que a barra de Pedidos
          existe para não ter. Aqui o recorte está escrito na faixa que gruda no
          topo, e o agregado logo abaixo dele não se move com ele.
        */}
        <Select
          bare
          value={reviews.maxRating === null ? '' : String(reviews.maxRating)}
          onChange={(value) => reviews.setMaxRating(maxRatingFrom(value))}
          options={RATING_OPTIONS}
          aria-label="Filtrar a lista por nota"
          display={
            <span className="reviews__filtro-nota">
              <span className="t-aux">Lista:</span>{' '}
              {RATING_OPTIONS.find(
                (opcao) =>
                  opcao.value === (reviews.maxRating === null ? '' : String(reviews.maxRating)),
              )?.label ?? 'Todas as notas'}
            </span>
          }
          data-testid="reviews-filtro-nota"
        />
      </PageBar>

      {problem ? (
        <p className="alert alert--error reviews__alerta" role="alert">
          {problem}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="alert alert--error reviews__alerta" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isLoading && !problem ? <p className="muted reviews__estado">Carregando…</p> : null}

      {/*
        NINGUÉM AVALIOU: UMA TELA, NÃO QUATRO SEÇÕES ZERADAS.

        Média "—", cinco barras rentes ao chão, uma lista de etiquetas vazia e
        uma lista vazia não dizem "ninguém avaliou": dizem "a tela quebrou", e o
        dono sai procurando o defeito no painel. Ele também precisa saber POR
        QUE não chega nada — a avaliação não tem canal próprio, ela mora na tela
        de acompanhamento do pedido —, senão a conclusão é que o recurso não
        funciona.
      */}
      {!isLoading && !problem && !errorMessage && vazio ? (
        <section className="reviews__vazio" data-testid="reviews-vazio">
          <p className="reviews__frase reviews__frase--topo">Nenhuma avaliação neste período.</p>
          <p className="reviews__frase">
            O cliente avalia pela tela de acompanhamento do pedido, quando ele é entregue — não há
            nada a ligar aqui, e nada a fazer além de esperar a próxima entrega. Só pedido concluído
            pode ser avaliado, e ele tem 14 dias para isso.
          </p>
          <Periodo range={reviews.range} />
          <Escopo recorte={recorte} />
        </section>
      ) : null}

      {!isLoading && !problem && !errorMessage && summary && !vazio ? (
        <div className="reviews__secoes">
          {/* ================================================================
              A. A RESPOSTA — a banda de topo, largura inteira

              Pergunta: O QUE DEU ERRADO ESTA SEMANA?
             ================================================================ */}
          <section className="reviews__topo">
            <p className="reviews__frase reviews__frase--topo" data-testid="reviews-veredito">
              {readVeredito(summary).text}
            </p>

            <Frase insight={readVolumeBaixo(summary)} />

            {/*
              OS TRÊS NÚMEROS CRUS, na mesma peça que Desempenho usa (`.numeros`
              de `PerformancePage.css`) — não é um segundo desenho de métrica: é
              a mesma classe, e as duas telas precisam ler como a mesma família.
              Aqui eles não têm delta: este agregado não traz período anterior,
              e uma variação calculada por nós teria cara de número do backend.
            */}
            <dl className="numeros">
              <Numero
                rotulo="Média das notas"
                valor={formatAverage(summary.average)}
                testId="reviews-media"
              />
              <Numero rotulo="Avaliações" valor={String(summary.total)} testId="reviews-total" />
              <Numero
                rotulo={`Notas baixas (até ${LOW_RATING_MAX})`}
                valor={String(lowRatingCount(summary))}
                testId="reviews-baixas"
              />
            </dl>

            <Periodo range={reviews.range} />
            <Escopo recorte={recorte} />
          </section>

          <div className={`reviews__grade${temBaixas ? '' : ' reviews__grade--unica'}`}>
            {/* ==============================================================
                B. O QUE DEU ERRADO — as etiquetas somadas

                Pergunta: O QUE, EXATAMENTE, ESTÁ QUEBRADO?

                A seção NÃO É DESENHADA quando não houve nota baixa: um bloco
                anunciando zero custa uma dobra por turno para dizer o que a
                frase do topo já disse. É a mesma regra do agrupamento vazio na
                lista de pedidos.
               ============================================================== */}
            {temBaixas ? (
              <Secao
                titulo="O que deu errado"
                nota={`as etiquetas das ${contar(lowRatingCount(summary), 'nota baixa', 'notas baixas')}`}
              >
                <Etiquetas summary={summary} />
                <Frase insight={readSemEtiqueta(summary)} />
              </Secao>
            ) : null}

            {/* ==============================================================
                C. AS NOTAS — o histograma

                Pergunta: DE ONDE SAIU ESTA MÉDIA?

                As cinco barras e a média do bloco de cima são o MESMO número
                lido duas vezes (ver o cabeçalho do arquivo). E as cinco
                aparecem sempre, inclusive as zeradas: a nota que ninguém deu é
                informação, e o backend manda as cinco chaves justamente para
                que nenhum front invente o preenchimento.
               ============================================================== */}
            <Secao titulo="Como as notas se dividiram" nota="o período inteiro">
              <Histograma summary={summary} />
            </Secao>
          </div>

          {/* ================================================================
              D. A LISTA — o que cada pessoa escreveu
             ================================================================ */}
          <section className="reviews__lista-secao">
            <div className="reviews__secao-head">
              <h2 className="t-section">As avaliações</h2>
              <span className="t-aux">{recorteDaLista(reviews.maxRating)}</span>
            </div>

            {/*
              A RESSALVA DO RECORTE, DITA UMA VEZ E AQUI.

              É a linha que impede a contradição aparente entre as duas metades
              da tela: a lista mostra 5 linhas e o número acima dela diz 23. Sem
              ela, a leitura natural é "o painel está errado" — e a explicação
              (o agregado ignora o filtro de nota, de propósito) não cabe em
              lugar nenhum senão junto da fronteira entre os dois.

              Ela só existe com filtro ligado: sem recorte não há discrepância a
              explicar, e uma frase que aparece sempre deixa de ser lida.
            */}
            {reviews.maxRating !== null ? (
              <p className="t-aux reviews__ressalva" data-testid="reviews-ressalva-filtro">
                Os números acima são do período inteiro e não mudam com este filtro — é a lista que
                está recortada.
              </p>
            ) : null}

            {reviews.items.length === 0 ? (
              <ListaVazia
                summary={summary}
                maxRating={reviews.maxRating}
                onVerTudo={() => reviews.setMaxRating(null)}
              />
            ) : (
              <ul className="reviews__lista" data-testid="reviews-lista">
                {reviews.items.map((item) => (
                  <Avaliacao
                    key={`${item.order_number}-${item.created_at}`}
                    item={item}
                    branches={branches}
                    /* O nome da loja só é dito quando a lista soma mais de uma. */
                    comFilial={temEscolhaDeFilial && filialAtiva === null}
                  />
                ))}
              </ul>
            )}

            {reviews.hasMore ? (
              <div className="reviews__rodape">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void reviews.loadMore()}
                  disabled={reviews.isLoadingMore}
                  data-testid="reviews-carregar-mais"
                >
                  {reviews.isLoadingMore ? 'Carregando…' : 'Carregar mais'}
                </button>
                {/*
                  "N na tela", e NÃO "N de M": não existe total da lista no
                  contrato desta rota, e `summary.total` conta o período inteiro
                  sem o filtro de nota. "12 de 23" seria uma fração de duas
                  perguntas diferentes.
                */}
                <span className="t-aux">
                  <span className="tnum">{reviews.items.length}</span> na tela
                </span>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * PEÇAS DA TELA
 *
 * Todas moram aqui, e não em `src/ds/`: nenhuma outra tela do painel mostra
 * avaliação, e um componente no design system que só um lugar usa é um
 * componente que ninguém sabe manter. As duas exceções são `Stars`, que tem
 * arquivo próprio por ter estado acessível a testar, e `.numeros`, que já é do
 * sistema.
 * ======================================================================= */

/** Uma frase de leitura. `null` não renderiza nada — a regra é do componente. */
function Frase({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <p className="reviews__frase" data-testid={`reviews-frase-${insight.id}`}>
      {insight.text}
    </p>
  );
}

/** Um bloco da página: título, nota e conteúdo. Separado por fio, sem cartão. */
function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="reviews__secao">
      <div className="reviews__secao-head">
        <h2 className="t-section">{titulo}</h2>
        {nota ? <span className="t-aux">{nota}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Um dos três números crus. Reusa `.numeros` de Desempenho — mesma família, e
 * é isso que faz as duas telas de leitura lerem como um produto só.
 */
function Numero({ rotulo, valor, testId }: { rotulo: string; valor: string; testId: string }) {
  return (
    <div className="numeros__item">
      <dt className="numeros__rotulo">{rotulo}</dt>
      <dd className="numeros__valor tnum" data-testid={testId}>
        {valor}
      </dd>
    </div>
  );
}

/** O período que os números respondem, escrito por extenso. */
function Periodo({ range }: { range: { startDate: string; endDate: string } }) {
  if (!range.startDate || !range.endDate) return null;
  return (
    <p className="t-aux reviews__ressalva" data-testid="reviews-periodo">
      {range.startDate === range.endDate
        ? `Avaliações escritas em ${dayLabel(range.startDate)}.`
        : `Avaliações escritas de ${dayLabel(range.startDate)} a ${dayLabel(range.endDate)}.`}
    </p>
  );
}

/**
 * De qual loja são estes números — a mesma peça de Desempenho e de Clientes, e
 * pelo mesmo motivo: "média 3,4" significa coisas diferentes para uma loja e
 * para a rede. Com uma filial só no acesso não há o que distinguir.
 */
function Escopo({ recorte }: { recorte: string | null }) {
  if (!recorte) return null;
  return (
    <p className="reviews__escopo-linha" data-testid="reviews-escopo">
      Estes números são <strong>{recorte}</strong> — troque no seletor do topo para ver outra loja,
      ou a rede inteira.
    </p>
  );
}

/**
 * AS ETIQUETAS SOMADAS — a peça mais acionável da tela.
 *
 * A barra é proporção contra o total de notas baixas (ver `tagRows`), e é ela
 * que responde "isto é o problema ou é um caso?" antes de o olho ler o número.
 * Marca neutra: quem carrega a informação é o COMPRIMENTO, e a brasa tem um
 * emprego só no sistema.
 */
function Etiquetas({ summary }: { summary: ReviewSummary }) {
  const linhas = tagRows(summary);

  if (linhas.length === 0) {
    return (
      <p className="muted">
        Nenhuma das notas baixas apontou etiqueta — escolhê-la é opcional para quem avalia.
      </p>
    );
  }

  return (
    <dl className="fatias" data-testid="reviews-etiquetas">
      {linhas.map((linha) => (
        <div className="fatias__linha" key={linha.tag}>
          <dt className="fatias__rotulo">{linha.label}</dt>
          <dd className="fatias__valor tnum">{linha.count}</dd>
          {/*
            SEM O "de 6 notas baixas" EM CADA LINHA. Ele estava aqui — o slot
            `.fatias__meta` de Desempenho — e era o mesmo denominador escrito
            três vezes, uma por etiqueta, embaixo do que o cabeçalho da seção
            já diz ("as etiquetas das 6 notas baixas"). No celular isso dobrava
            a altura do bloco mais acionável da tela para repetir uma
            informação que não muda de linha para linha.
          */}
          <div
            className="fatias__barra"
            aria-hidden="true"
            style={{ '--fatia': `${Math.round(linha.ratio * 100)}%` } as CSSProperties}
          />
        </div>
      ))}
    </dl>
  );
}

/**
 * O HISTOGRAMA — cinco linhas, sempre.
 *
 * Linhas e não colunas: as categorias têm rótulo curto e são só cinco, e em
 * linha a barra cresce na direção em que se lê. Em coluna, o eixo precisaria de
 * régua e o bloco ocuparia o dobro da altura para a mesma informação.
 */
function Histograma({ summary }: { summary: ReviewSummary }) {
  return (
    <ul className="histograma" data-testid="reviews-histograma">
      {ratingRows(summary).map((linha) => (
        <li className="histograma__linha" key={linha.rating}>
          <RatingLabel rating={linha.rating} />
          <span className="histograma__barra" aria-hidden="true">
            <span
              className="histograma__preenchimento"
              style={{ '--fatia': `${Math.round(linha.ratio * 100)}%` } as CSSProperties}
            />
          </span>
          <span className="histograma__contagem tnum num">{linha.count}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * UMA AVALIAÇÃO.
 *
 * Não é linha de tabela e não é cartão. O comentário é texto livre de até 500
 * caracteres escrito pelo cliente: numa célula de tabela ele quebraria a grade
 * de todas as outras linhas, e num cartão cada avaliação viraria uma moldura
 * disputando atenção com as vizinhas. Aqui é um bloco de leitura separado por
 * fio — a mesma gramática do resto do painel.
 *
 * A ORDEM DENTRO DELA é a da pergunta: a nota (o quanto), a etiqueta (o quê), e
 * só então de qual pedido e quando. O comentário fecha, porque é o único que se
 * lê inteiro.
 *
 * O texto do cliente entra como FILHO de JSX, nunca por `innerHTML` — o ESLint
 * barra os cinco sumidouros de XSS em todo o `src/`, e esta é uma das quatro
 * telas que mostram texto escrito por quem está do outro lado.
 */
function Avaliacao({
  item,
  branches,
  comFilial,
}: {
  item: ReviewItem;
  branches: readonly Branch[];
  comFilial: boolean;
}) {
  const filial = branches.find((branch) => branch.id === item.branch_id) ?? null;

  return (
    <li className="avaliacao">
      <div className="avaliacao__cabeca">
        <Stars value={item.rating} />

        {/*
          A ETIQUETA É UMA `.tag` — a palavra sobre um plano de agrupamento que
          o sistema já tem. NÃO é um `StatusChip`: chip de status é o estágio de
          um pedido, com matiz própria, e uma etiqueta de problema pintada de
          carmim diria que a avaliação é um estado da operação. Ela é um
          assunto.
        */}
        {item.problem_tag ? <span className="tag">{problemTagLabel(item.problem_tag)}</span> : null}

        <span className="t-aux avaliacao__meta">
          {/*
            O NÚMERO DO PEDIDO É O QUE LIGA A NOTA AO QUE ACONTECEU, e é o único
            identificador que esta resposta traz. `.tnum` porque ele desce numa
            coluna, e é um dos quatro casos em que a classe vale.
          */}
          Pedido <span className="tnum">#{item.order_number}</span>
          {' · '}
          {formatDateTime(item.created_at)}
          {comFilial && filial ? ` · ${branchName(filial)}` : ''}
        </span>
      </div>

      {item.comment ? <p className="avaliacao__comentario">{item.comment}</p> : null}
    </li>
  );
}

/**
 * A LISTA VAZIA, e são DOIS estados diferentes com a mesma aparência de
 * "nada aqui" — separá-los é o ponto deste componente.
 *
 * 1. **Filtro ligado e nenhuma nota baixa.** É NOTÍCIA BOA, e precisa ler como
 *    notícia boa: a semana em que ninguém reclamou não pode aparecer como uma
 *    tela vazia com cara de defeito. E há por onde sair — o botão desliga o
 *    recorte, porque a alternativa seria adivinhar que o filtro está no alto.
 * 2. **Sem filtro e sem linhas**, com o período tendo avaliações. Isto só
 *    acontece se a página pedida vier vazia; a frase é neutra e não promete
 *    ação nenhuma.
 */
function ListaVazia({
  summary,
  maxRating,
  onVerTudo,
}: {
  summary: ReviewSummary;
  maxRating: number | null;
  onVerTudo: () => void;
}) {
  if (maxRating === null) {
    return (
      <p className="muted reviews__estado" data-testid="reviews-lista-vazia">
        Nenhuma avaliação para mostrar neste recorte.
      </p>
    );
  }

  return (
    <div className="reviews__estado-vazio" data-testid="reviews-lista-vazia">
      <p className="reviews__frase">
        {`Nenhuma nota de até ${maxRating} ${maxRating === 1 ? 'estrela' : 'estrelas'} neste período — ${contar(summary.total, 'avaliação', 'avaliações')} ${summary.total === 1 ? 'ficou' : 'ficaram'} acima disso.`}
      </p>
      <button
        type="button"
        className="btn btn--sm"
        onClick={onVerTudo}
        data-testid="reviews-ver-tudo"
      >
        Ver todas as avaliações
      </button>
    </div>
  );
}

/** O que a seção da lista escreve ao lado do título. */
function recorteDaLista(maxRating: number | null): string {
  if (maxRating === null) return 'todas as notas do período';
  if (maxRating === 1) return 'só as de 1 estrela';
  return `só as de até ${maxRating} estrelas`;
}
