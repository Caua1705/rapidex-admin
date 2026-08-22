import type { CSSProperties, ReactNode } from 'react';

import { DataTable, type Column } from '../ds/DataTable';
import { PageBar } from '../ds/PageBar';
import { Select, type SelectOption } from '../ds/Select';
import { useSession } from '../auth/session-context';
import { branchName } from '../layout/branch-heading';
import { dayLabel } from '../performance/report-model';
import {
  contagem,
  contagemComUnidade,
  degrauQueVaza,
  estadoDaMedicao,
  FUNNEL_PERIODOS,
  lerDegraus,
  lerOrigens,
  origemLabel,
  percentInteiro,
  primeiroDiaComEvento,
  readOrigem,
  readVazamento,
  RETENCAO_DIAS,
  type DegrauLido,
  type EstadoDaMedicao,
  type FunilVeredito,
  type OrigemLida,
} from './funnel-model';
import { useFunnel } from './useFunnel';
import type { FunnelReport } from '../api/types';
import './FunnelPage.css';

/**
 * Quantas origens a tabela desenha.
 *
 * Um restaurante com QR por mesa tem quarenta rótulos, e quarenta linhas no fim
 * de uma tela é rolagem que ninguém percorre. A lista já vem ordenada por
 * sessões (decrescente) do backend, então o corte tira as caudas — e a tela diz
 * quantas ficaram de fora, porque recorte declarado não é recorte silencioso.
 */
const ORIGENS_LISTADAS = 12;

/**
 * ============================================================================
 * FUNIL — a tela que diz ONDE ESTÁ O VAZAMENTO
 * ============================================================================
 *
 * A PERGUNTA QUE ELA RESPONDE, e que nenhuma outra tela do painel alcança:
 * poucos pedidos porque ninguém entrou no cardápio, ou porque quem entrou não
 * comprou? São diagnósticos opostos com soluções opostas, e até esta rota
 * existir a plataforma só enxergava PEDIDO — o resultado, nunca o caminho.
 *
 * NÃO É UM GRÁFICO DE FUNIL. Cada degrau existe porque separa dois
 * diagnósticos, e é isso que a tela precisa deixar legível:
 *
 *   entrou e não abriu nada          → cardápio (foto, preço de vitrine)
 *   abriu e não pôs no carrinho      → produto (preço, adicional caro)
 *   montou carrinho e não foi fechar → regra comercial (frete, mínimo)
 *   chegou no fechamento e desistiu  → operação (pagamento, loja fechada)
 *   ninguém entrou                   → divulgação
 *
 * Os textos moram em `QUEDA_DIAGNOSTICO`, e a queda só ganha diagnóstico quando
 * ela É o vazamento: pendurar "problema de cardápio" num degrau que segura 80%
 * das pessoas seria a frase de preenchimento que a tela recusa.
 *
 * ----------------------------------------------------------------------------
 * POR QUE É TELA PRÓPRIA, E NÃO UMA SEÇÃO DENTRO DE DESEMPENHO
 * ----------------------------------------------------------------------------
 *
 * 1. **A permissão é outra.** Desempenho inteira está atrás de
 *    `podeLerDinheiro`: o gerente em "todas as filiais" vê um pedido de escolha
 *    e mais nada, porque `ensure_pode_ler_dinheiro` recusaria as seis rotas.
 *    Esta rota não passa por essa regra — não há um número de dinheiro na
 *    resposta —, e o backend diz o porquê com todas as letras: quem toca o
 *    balcão de uma loja é quem consegue agir sobre "o carrinho enche e o
 *    checkout esvazia". Como seção lá dentro, o funil ficaria invisível para
 *    exatamente quem deveria lê-lo.
 *
 * 2. **O período é outro.** Pedido fica para sempre; evento de funil é apagado
 *    aos 90 dias. Um seletor de período compartilhado ofereceria a esta leitura
 *    uma janela que o banco já apagou — e ela responderia 200, com os quatro
 *    primeiros degraus mordidos.
 *
 * 3. **Os dois `orders_count` não fecham, de propósito.** O resumo de
 *    Desempenho exclui cancelado e recusado; o funil os conta, porque mede se a
 *    PESSOA terminou de pedir. Na mesma tela, no mesmo período, seriam dois
 *    números de "pedidos" a três centímetros um do outro — e nenhuma ressalva
 *    conserta uma tela que se contradiz enquanto o olho passa.
 *
 * 4. **Hoje ela nasce sem dado.** Uma banda dizendo "a medição não está ligada"
 *    no meio de seis seções com número real lê como seção quebrada, não como
 *    aviso.
 *
 * ----------------------------------------------------------------------------
 * O ESTADO VAZIO É A PARTE MAIS IMPORTANTE DESTA TELA HOJE
 * ----------------------------------------------------------------------------
 *
 * O app do cliente ainda não dispara evento nenhum: os quatro primeiros degraus
 * nascem em zero e o quinto — que é o pedido, contado em `orders` — nasce
 * cheio. **Desenhar esse zero como zero afirmaria que ninguém entrou no
 * cardápio**, e o lojista concluiria que não tem movimento quando o que não tem
 * é medição. São as duas leituras opostas que esta tela existe para separar, e
 * confundi-las aqui seria a tela cometendo o erro que ela veio consertar.
 *
 * Por isso, com a medição desligada, os quatro degraus mostram **“—”, não
 * “0”** — e o quinto mostra o número de verdade, que é a prova: ninguém pede
 * sem abrir o cardápio. Ver `estadoDaMedicao`.
 */
export function FunnelPage() {
  const { activeBranchId, branches } = useSession();
  const { range, problem, funnel, erro, isLoading, selectPreset, setCustomDate, setSource } =
    useFunnel(activeBranchId);

  const filialAtiva = branches.find((filial) => filial.id === activeBranchId) ?? null;
  const nomeDaFilial = filialAtiva ? branchName(filialAtiva) : '';

  const degraus = funnel ? lerDegraus(funnel.steps) : [];
  const medicao: EstadoDaMedicao | null = funnel ? estadoDaMedicao(funnel) : null;
  const origens = funnel ? lerOrigens(funnel.sources) : [];

  /*
   * AS OPÇÕES DO SELETOR DE ORIGEM SAEM DA PRÓPRIA RESPOSTA, e isso só é
   * possível por uma decisão do backend: `sources` vem com TODAS as origens do
   * período mesmo quando o relatório já está filtrado por uma. Filtrada, a
   * lista teria uma linha só — e o seletor perderia todas as outras opções
   * assim que alguém escolhesse a primeira, que é o defeito clássico de filtro
   * que se alimenta do resultado filtrado.
   */
  const opcoesDeOrigem: SelectOption[] = [
    { value: '', label: 'Todas as origens' },
    ...origens.map((origem) => ({
      value: origem.source,
      label: origem.nome,
      hint: contagemComUnidade(origem.pedidos, 'pedido'),
    })),
  ];

  return (
    <div className="funil">
      <PageBar title="Funil">
        <div className="seg" role="group" aria-label="Período">
          {FUNNEL_PERIODOS.map((periodo) => (
            <button
              key={periodo.value}
              type="button"
              className="seg__opt"
              aria-pressed={range.preset === periodo.value}
              onClick={() => selectPreset(periodo.value)}
              data-testid={`funil-periodo-${periodo.value}`}
            >
              {periodo.label}
            </button>
          ))}
        </div>

        {/*
          OS CAMPOS DE DATA LEVAM `min` E `max`, e não é enfeite de formulário:
          `min` é o primeiro dia que ainda tem evento gravado. O calendário do
          navegador desabilita o resto, então a data que o banco já apagou não
          chega a ser escolhível — e quem digitar à mão cai na frase de
          `funnelRangeProblem`, que diz o motivo em vez de mostrar um funil
          mordido pelo expurgo.
        */}
        {range.preset === 'custom' ? (
          <div className="funil__datas">
            <input
              className="input"
              type="date"
              value={range.startDate}
              min={primeiroDiaComEvento()}
              max={range.endDate || undefined}
              onChange={(event) => setCustomDate({ startDate: event.target.value })}
              aria-label="Data inicial"
              data-testid="funil-data-de"
            />
            <span className="faint" aria-hidden="true">
              até
            </span>
            <input
              className="input"
              type="date"
              value={range.endDate}
              min={range.startDate || primeiroDiaComEvento()}
              onChange={(event) => setCustomDate({ endDate: event.target.value })}
              aria-label="Data final"
              data-testid="funil-data-ate"
            />
          </div>
        ) : null}

        {/*
          O FILTRO DE ORIGEM SÓ APARECE COM ORIGEM PARA ESCOLHER. Num
          restaurante em que tudo caiu em "direto" — que é o caso de hoje, e vai
          ser até o app devolver a origem no pedido — um seletor de uma opção só
          é um controle que promete um recorte inexistente.
        */}
        {origens.length > 1 ? (
          <Select
            bare
            value={range.source}
            onChange={setSource}
            options={opcoesDeOrigem}
            aria-label="Filtrar os degraus por origem"
            display={
              <span className="funil__filtro-origem">
                <span className="t-aux">Origem:</span>{' '}
                {range.source ? origemLabel(range.source) : 'Todas'}
              </span>
            }
            data-testid="funil-filtro-origem"
          />
        ) : null}
      </PageBar>

      {problem ? (
        <p className="alert alert--error funil__alerta" role="alert">
          {problem}
        </p>
      ) : null}

      {/*
        O ERRO NÃO APAGA O QUE JÁ ESTAVA LIDO (ver `useFunnel`): a tarja diz o
        que falhou e o funil desenhado continua sendo a última resposta boa.
      */}
      {erro ? (
        <p className="alert alert--error funil__alerta" role="alert">
          {erro}
        </p>
      ) : null}

      {isLoading && !funnel ? <p className="muted funil__estado">Carregando…</p> : null}

      {funnel && medicao ? (
        <div className="funil__secoes">
          {/* ================================================================
              A. A RESPOSTA — a banda de topo

              Mesma gramática de Desempenho: uma frase em corpo 22, os números
              crus depois dela, as ressalvas no pé, e um fio forte fechando a
              banda. Não é um cartão — o que a distingue do resto da página é o
              espaço e o corpo, não uma moldura.
             ================================================================ */}
          <section className="funil__topo">
            <p className="funil__frase funil__frase--topo" data-testid="funil-veredito">
              {readVazamento(funnel, degraus, medicao).text}
            </p>

            {medicao === 'desligada' ? <MedicaoDesligada /> : null}

            <Ressalvas
              funnel={funnel}
              medicao={medicao}
              nomeDaFilial={nomeDaFilial}
              temEscolha={branches.length > 1}
            />
          </section>

          {/* ================================================================
              B. OS DEGRAUS

              Pergunta: ONDE EU PERCO GENTE?

              Largura inteira, como o gráfico de dias em Desempenho: é a peça
              principal da tela, e espremida em metade a linha de diagnóstico
              (que é uma frase inteira) quebraria em quatro fileiras.
             ================================================================ */}
          <Secao
            titulo="Os degraus"
            nota={`${dayLabel(funnel.period.start_date)} a ${dayLabel(funnel.period.end_date)} · ${
              funnel.period.days === 1 ? '1 dia' : `${funnel.period.days} dias`
            }`}
          >
            <Degraus degraus={degraus} medicao={medicao} />

            {/*
              A RESSALVA DO QUINTO DEGRAU, COLADA NO NÚMERO QUE ELA RESSALVA.

              Ela vem PRONTA na resposta (`orders_note`), e é escrita com as
              palavras do backend em vez de uma paráfrase nossa — a mesma
              decisão do `revenue_note` em "O que vendeu". Duas redações da
              mesma ressalva é como as duas começam a discordar: a do painel
              seria ajustada numa rodada de texto, a do backend numa mudança de
              regra, e ninguém reconciliaria as duas.
            */}
            <p className="t-aux funil__ressalva" data-testid="funil-orders-note">
              {funnel.orders_note}
            </p>
          </Secao>

          {/* ================================================================
              C. DE ONDE ELES VIERAM

              Pergunta: O QR DA MESA ESTÁ FUNCIONANDO?

              É a outra metade da tela, e não um apêndice: os degraus dizem ONDE
              se perde, a origem diz DE ONDE vieram os que ficaram e os que
              foram embora. Uma sem a outra responde meia pergunta.
             ================================================================ */}
          <Secao
            titulo="De onde eles vieram"
            nota={
              origens.length === 0
                ? undefined
                : origens.length === 1
                  ? '1 origem no período'
                  : `${origens.length} origens no período`
            }
          >
            <Origens origens={origens} medicao={medicao} />
          </Secao>
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * PEÇAS DA TELA
 *
 * Moram aqui e não em `src/ds/`, pela mesma razão das peças de Desempenho:
 * nenhuma outra tela do painel tem funil, e um componente no design system que
 * só um lugar usa é um componente que ninguém sabe manter.
 * ======================================================================= */

/** Um bloco da página: título, nota opcional, conteúdo. Separado por fio. */
function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <section className="funil__secao">
      <div className="funil__secao-head">
        <h2 className="t-section">{titulo}</h2>
        {nota ? <span className="t-aux">{nota}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * O AVISO DE QUE A MEDIÇÃO NÃO ESTÁ LIGADA.
 *
 * ELE NÃO É UM `.alert--error`, e a escolha é deliberada: nada quebrou e não há
 * nada que o lojista possa consertar apertando alguma coisa. Uma tarja vermelha
 * numa tela recém-aberta lê como defeito do painel, e a resposta natural a isso
 * é abrir um chamado — quando o que existe é uma frente de trabalho em
 * andamento do outro lado.
 *
 * É `.alert--info` — "isto é uma nota, não um problema" —, e ele diz três
 * coisas, nesta ordem: o que falta, o que isso faz com os números da tela, e o
 * que JÁ é verdade mesmo assim. A terceira é a que impede a tela de parecer
 * inútil: o quinto degrau e a divisão de pedidos por origem são reais hoje.
 *
 * SEM BOTÃO, sem "ativar medição", sem barra de progresso. Quem liga isso é o
 * app do cliente, não este painel — um botão aqui seria um controle morto, que
 * é exatamente o que a página "Em breve" do sistema existe para não ter.
 */
function MedicaoDesligada() {
  return (
    <div className="alert alert--info funil__medicao" role="note" data-testid="funil-sem-medicao">
      <p>
        <strong>A medição do cardápio ainda não está ligada no app do cliente.</strong> Enquanto o
        cardápio digital não registrar as etapas de quem navega, os quatro primeiros degraus não têm
        de onde vir — e é por isso que eles aparecem como “—” e não como zero.
      </p>
      <p>
        O que já é verdade nesta tela: o último degrau, que é o pedido, e a divisão dos pedidos por
        origem. O resto passa a valer no dia em que o app começar a registrar.
      </p>
    </div>
  );
}

/**
 * As ressalvas do recorte, no pé da banda — todas juntas, uma vez cada.
 *
 * A REGRA É A DE DESEMPENHO (§8 da skill de design): a mesma caixa repetida em
 * cada seção vira listra, não aviso. As três aqui qualificam os mesmos números,
 * então vivem com eles.
 */
function Ressalvas({
  funnel,
  medicao,
  nomeDaFilial,
  temEscolha,
}: {
  funnel: FunnelReport;
  medicao: EstadoDaMedicao;
  nomeDaFilial: string;
  temEscolha: boolean;
}) {
  return (
    <div className="funil__escopo" data-testid="funil-escopo">
      {temEscolha ? (
        <p>
          {nomeDaFilial ? (
            <>
              Estes números são <strong>da filial {nomeDaFilial}</strong> — troque no seletor do
              topo para ver outra loja, ou a rede inteira.
            </>
          ) : (
            <>
              Estes números somam <strong>todas as filiais</strong> — escolha uma no seletor do topo
              para ver o funil de uma loja só.
            </>
          )}
        </p>
      ) : null}

      {funnel.source ? (
        <p>
          Os degraus estão recortados pela origem <strong>{origemLabel(funnel.source)}</strong>. A
          divisão por origem, logo abaixo, continua mostrando todas.
        </p>
      ) : null}

      {/*
        O PRAZO É DITO SEMPRE, e não só quando alguém esbarra nele.
        O relatório de Desempenho alcança 92 dias; este alcança 90, e a
        diferença não é arredondamento: o evento de funil é apagado, o pedido
        não. Quem não souber disso vai achar que o painel encurtou o período por
        capricho — e, pior, vai comparar um período de 30 dias com um de 120 e
        concluir que o movimento desabou.
      */}
      <p>
        O funil só existe nos <strong>últimos {RETENCAO_DIAS} dias</strong>: os eventos mais antigos
        são apagados, e por isso esta tela não oferece um período que o banco já não tem.
        {medicao === 'medindo'
          ? ' Os quatro primeiros degraus contam sessões e o último conta pedidos — as colunas não se somam entre si.'
          : ''}
      </p>
    </div>
  );
}

/**
 * ============================================================================
 * OS DEGRAUS — a escada, e a queda entre um e outro
 * ============================================================================
 *
 * A FORMA REUSA `.fatias`, a mesma peça de "entrega × retirada" e de "As
 * filiais" em Desempenho, e o reuso é de mérito: as três fazem a MESMA pergunta
 * visual — poucos valores comparáveis, cada um com sua barra, onde o
 * comprimento responde "qual é o maior" antes de o olho ler o número. Uma
 * família `.degrau__*` paralela seria a mesma lista escrita duas vezes, e a
 * primeira mudança de respiro numa delas separaria as duas para sempre.
 *
 * O QUE ESTA SEÇÃO ACRESCENTA À FORMA é a linha ENTRE as linhas: a queda. Ela é
 * a informação da tela — o degrau sozinho diz quanta gente chegou, a queda diz
 * quanta gente sumiu e o que fazer a respeito — e não tem equivalente em
 * `.fatias`, por isso ganha classe própria.
 *
 * É UM `<ol>` E NÃO UM `<dl>`. `.fatias` é uma lista de definição, e uma linha
 * de queda entre dois `<div>` de `dt`/`dd` seria HTML inválido; aqui a ordem é
 * a informação (degrau 1, queda, degrau 2), que é exatamente o que uma lista
 * ordenada declara.
 */
function Degraus({
  degraus,
  medicao,
}: {
  degraus: readonly DegrauLido[];
  medicao: EstadoDaMedicao;
}) {
  /*
   * O DEGRAU QUE A FRASE DO TOPO APONTOU. Marcá-lo aqui é a mesma afirmação no
   * canal visual, e nunca uma segunda opinião: sai da MESMA `degrauQueVaza` que
   * `readVazamento` consulta para escrever a frase. Uma condição parecida
   * reescrita aqui é como a marca e a frase passariam a apontar para degraus
   * diferentes sem que nada quebrasse.
   *
   * Com a medição desligada não há degrau a marcar: as conversões saem de um
   * denominador que ninguém contou.
   */
  const idQueVaza = medicao === 'medindo' ? (degrauQueVaza(degraus)?.id ?? null) : null;

  return (
    <ol
      className={`degraus${medicao === 'desligada' ? ' degraus--sem-medicao' : ''}`}
      data-testid="funil-degraus"
    >
      {degraus.map((degrau, indice) => (
        <li className="degraus__item" key={degrau.id}>
          {/*
            A QUEDA VEM ANTES DO DEGRAU QUE ELA EXPLICA, porque é assim que ela
            se lê: a pessoa desce do degrau de cima para este, e a porcentagem é
            de quem CHEGOU aqui (`conversion_from_previous_percent` é do degrau
            que recebe).
          */}
          {indice > 0 ? (
            <Queda
              degrau={degrau}
              medicao={medicao}
              ehOVazamento={idQueVaza !== null && idQueVaza === degrau.id}
            />
          ) : null}

          <div className="fatias__linha degraus__degrau">
            <span className="fatias__rotulo">{degrau.nome}</span>
            <span className="fatias__valor tnum">
              {/*
                “—” E NÃO “0” COM A MEDIÇÃO DESLIGADA. É a linha inteira desta
                tela: zero afirma que ninguém passou por aqui, o travessão diz
                que ninguém contou. O último degrau é a exceção porque ele não
                vem de evento nenhum — ele é o pedido, e o pedido é real.
              */}
              {medicao === 'desligada' && degrau.unidade === 'sessao'
                ? '—'
                : contagem(degrau.count)}
            </span>
            <span className="fatias__meta">
              {medicao === 'desligada' && degrau.unidade === 'sessao'
                ? 'sem medição'
                : degrau.unidade === 'pedido'
                  ? degrau.count === 1
                    ? 'pedido'
                    : 'pedidos'
                  : degrau.count === 1
                    ? 'sessão'
                    : 'sessões'}
            </span>

            {/*
              A BARRA SÓ EXISTE COM BASE PARA MEDIR. Com a medição desligada, o
              primeiro degrau é zero e a única barra desenhável seria a do
              quinto — uma barra cheia sozinha embaixo de quatro linhas vazias,
              dizendo que o pedido é 100% de coisa nenhuma.
            */}
            {medicao === 'desligada' || degrau.fatiaPct === null ? null : (
              <div
                className="fatias__barra"
                aria-hidden="true"
                style={{ '--fatia': `${degrau.fatiaPct}%` } as CSSProperties}
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * A LINHA DE QUEDA — a informação da escada.
 *
 * Ela tem duas formas, e a diferença é o que a tela pode afirmar:
 *
 * - **comum**: só a porcentagem de quem chegou. Um degrau que segura 80% das
 *   pessoas não tem diagnóstico a receber, e pendurar "problema de cardápio"
 *   nele seria a frase de preenchimento que a tela recusa;
 * - **o vazamento**: a porcentagem MAIS o diagnóstico — o que a gente que sumiu
 *   fez, de quem é o problema e o que olhar. É a única linha da escada que
 *   manda fazer alguma coisa, e por isso é a única que levanta a voz.
 *
 * A MARCA DO VAZAMENTO É EM TRÊS CANAIS, nunca só cor (WCAG 1.4.1): o fio de
 * 2px na margem — a mesma gramática do estágio na lista de pedidos e do grupo
 * aberto na navegação —, a palavra "Maior perda" escrita, e a tinta cheia. Nada
 * de vermelho: `--danger` responde "perigo", e um degrau que converte pouco não
 * é um erro, é o lugar onde há trabalho a fazer.
 */
function Queda({
  degrau,
  medicao,
  ehOVazamento,
}: {
  degrau: DegrauLido;
  medicao: EstadoDaMedicao;
  ehOVazamento: boolean;
}) {
  /*
   * COM A MEDIÇÃO DESLIGADA NÃO HÁ QUEDA A ESCREVER. A conversão do último
   * degrau seria "pedidos ÷ zero sessões", que o backend já devolve como nulo —
   * e mesmo que não devolvesse, uma taxa de conversão calculada sobre um
   * denominador que ninguém mediu é o número mais enganoso que esta tela
   * poderia mostrar.
   */
  if (medicao === 'desligada') {
    return (
      <p className="degraus__queda degraus__queda--vazia" aria-hidden="true">
        ↓
      </p>
    );
  }

  return (
    <p
      className={`degraus__queda${ehOVazamento ? ' degraus__queda--vazamento' : ''}`}
      data-testid={ehOVazamento ? 'funil-vazamento' : undefined}
    >
      <span className="degraus__queda-taxa tnum">
        <span aria-hidden="true">↓ </span>
        {percentInteiro(degrau.retencaoPct)}
      </span>{' '}
      <span className="degraus__queda-texto">
        {degrau.retencaoPct === null
          ? 'não há degrau anterior com movimento para comparar'
          : 'chegaram até aqui'}
        {ehOVazamento && degrau.diagnostico ? (
          <>
            {' · '}
            <strong>Maior perda:</strong> {degrau.diagnostico.perda} — problema de{' '}
            {degrau.diagnostico.area} ({degrau.diagnostico.oQueOlhar}).
          </>
        ) : null}
      </span>
    </p>
  );
}

type LinhaOrigem = {
  id: string;
  origem: string;
  sessoes: string;
  pedidos: string;
  conversao: string;
};

/**
 * ============================================================================
 * AS ORIGENS — quem trouxe quem, e quem trouxe quem não compra
 * ============================================================================
 *
 * AQUI É TABELA DE VERDADE, ao contrário dos degraus: quatro colunas
 * comparáveis, N linhas, e a leitura é descer a coluna procurando a origem que
 * destoa. É o caso em que `DataTable` ganha do resto — inclusive no celular,
 * onde ela deixa de ser tabela e cada linha vira bloco com o nome da coluna ao
 * lado do valor.
 *
 * A FRASE VEM ANTES DA TABELA, como em toda seção do painel: a linha que
 * importa é a origem que traz gente e não vende, e ela pode estar em qualquer
 * posição da lista. Deixá-la para o olho achar seria a tela guardando a
 * resposta que ela tem.
 */
function Origens({
  origens,
  medicao,
}: {
  origens: readonly OrigemLida[];
  medicao: EstadoDaMedicao;
}) {
  if (origens.length === 0) {
    return (
      <p className="muted">
        Nenhum pedido e nenhuma sessão no período — não há origem a dividir.
      </p>
    );
  }

  const columns: readonly Column<LinhaOrigem>[] = [
    { key: 'origem', header: 'Origem' },
    { key: 'sessoes', header: 'Sessões', align: 'end' },
    { key: 'pedidos', header: 'Pedidos', align: 'end' },
    { key: 'conversao', header: 'Viraram pedido', align: 'end' },
  ];

  const listadas = origens.slice(0, ORIGENS_LISTADAS);

  const rows: LinhaOrigem[] = listadas.map((origem) => ({
    id: origem.source,
    origem: origem.nome,
    /*
     * “—” OUTRA VEZ, E PELO MESMO MOTIVO DA ESCADA: com a medição desligada,
     * "0 sessões" ao lado de "12 pedidos" afirmaria que doze pessoas pediram
     * sem nunca abrir o cardápio. O travessão diz que a sessão não foi contada.
     */
    sessoes: medicao === 'desligada' ? '—' : contagem(origem.sessoes),
    pedidos: contagem(origem.pedidos),
    conversao: medicao === 'desligada' ? '—' : percentInteiro(origem.conversaoPct),
  }));

  const leitura: FunilVeredito | null = readOrigem(origens, medicao);
  const semSessao = medicao === 'medindo' && origens.some((origem) => origem.pedidoSemSessao);
  const cortadas = origens.length - listadas.length;

  return (
    <div className="funil__origens">
      {leitura ? (
        <p className="funil__frase" data-testid={`funil-frase-${leitura.id}`}>
          {leitura.text}
        </p>
      ) : null}

      <DataTable
        caption="Sessões e pedidos por origem"
        captionHidden
        columns={columns}
        rows={rows}
        empty={<p className="muted">Nenhuma origem no período.</p>}
      />

      {cortadas > 0 ? (
        <p className="t-aux funil__ressalva">
          {cortadas === 1
            ? 'Uma origem com menos movimento ficou fora desta lista.'
            : `${cortadas} origens com menos movimento ficaram fora desta lista.`}{' '}
          A tabela mostra as {ORIGENS_LISTADAS} que mais trouxeram gente.
        </p>
      ) : null}

      {/*
        PEDIDO SEM SESSÃO TEM DUAS CAUSAS E A TELA NOMEIA AS DUAS, porque a ação
        é diferente em cada uma: origem que só passou a existir no meio do
        período (o pedido fica, o evento tem prazo) não pede nada; link
        publicado sem o parâmetro de origem pede conserto no link.
      */}
      {semSessao ? (
        <p className="t-aux funil__ressalva" data-testid="funil-pedido-sem-sessao">
          Alguma origem tem pedido e nenhuma sessão registrada. Ou o pedido chegou por um link cuja
          visita não foi contada, ou o evento daquela visita já passou dos {RETENCAO_DIAS} dias — o
          pedido fica para sempre, o evento não.
        </p>
      ) : null}
    </div>
  );
}
