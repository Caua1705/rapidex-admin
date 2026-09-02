import { useEffect, useState, type ReactNode } from 'react';

import { useResolvedBranch } from '../auth/use-branch-scope';
import { BellIcon, RefreshIcon } from '../ds/icons';
import { SearchField } from '../ds/SearchField';
import { datesForPeriod, type OrdersFilterState, type PeriodPreset } from './order-filters';
import { formatPrepRange, promessaAoCliente } from './prep-time';
import { PrepTimeControl } from './PrepTimeControl';
import { useDeliveryEstimate, type DeliveryEstimate as Estimativa } from './useDeliveryEstimate';
import { STREAM_LABELS, type StreamStatus } from './useOrderStream';
import { usePrepTime } from './usePrepTime';

const PERIODOS: readonly { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7', label: '7 dias' },
  { value: 'custom', label: 'Escolher' },
];

/**
 * ============================================================================
 * AS FERRAMENTAS DE PEDIDOS — quatro naturezas, e agora quatro lugares
 * ============================================================================
 *
 * O DIAGNÓSTICO: todos os controles moravam numa faixa só, na ordem em que
 * foram escritos, e quatro coisas de naturezas diferentes se embaralhavam —
 * abas de navegação, filtro de período, ajuste do tempo de preparo e botão de
 * atualizar dividiam a mesma régua sem nada dizendo qual era qual. O sintoma
 * mais visível era o contador de estágio ficar numa fileira e o filtro de
 * período em outra, sendo que os dois falam da MESMA coisa: o recorte da lista.
 *
 * O AGRUPAMENTO ESCOLHIDO, e a pergunta que cada grupo responde:
 *
 *   FAIXA 1 — A TELA
 *     "onde estou e o que posso apertar"
 *     · título e ABAS (navegação): que lista estou vendo
 *     · AÇÕES, encostadas na margem direita: atualizar, alerta sonoro
 *
 *   FAIXA 2 — A LISTA E A LOJA
 *     esquerda, O RECORTE: "o que esta lista está mostrando"
 *       · busca · período · contadores por estágio
 *     direita, A PROMESSA: "o que a loja está prometendo agora"
 *       · preparo (com o ajuste) · entrega · tempo real
 *
 * POR QUE OS CONTADORES DESCERAM PARA JUNTO DO PERÍODO. Eles são o RESULTADO do
 * recorte: "Novos 2" é quantos pedidos novos existem NO PERÍODO E NA BUSCA que
 * estão logo ao lado. Separados, o lojista lia dois números sem saber que um
 * governa o outro — e eles são, como você disse, filtro em potencial: no dia em
 * que clicar num estágio recortar a lista, o controle já vai estar no grupo
 * certo, ao lado dos outros dois recortes. Hoje eles CONTAM e mais nada, e
 * nenhum controle desta barra mudou o que faz.
 *
 * POR QUE A PROMESSA NÃO É FILTRO E FICA DO OUTRO LADO. Preparo, entrega e
 * tempo real não recortam nada: eles descrevem o estado da LOJA. Misturados com
 * o período, davam a impressão de que ajustar o preparo mudaria a lista. Do
 * outro lado da faixa, com um fio no meio, eles voltam a ser o que são — e o
 * ajuste de +5/+10/−5 continua ali, a um clique, no meio do turno.
 *
 * POR QUE A AÇÃO SOBE PARA A FAIXA 1. Atualizar e o sino não se LEEM, se
 * APERTAM. Encostados na margem direita da faixa do título — o canto em que
 * toda tela do painel põe a ação — eles saem de dentro do grupo que se lê.
 */

/**
 * O grupo de AÇÃO, na faixa do título.
 *
 * "Ativar som" só existe quando o navegador bloqueou o áudio: um botão para
 * ligar o que já está ligado é ruído permanente no canto mais valioso da tela.
 */
export function OrdersActions({
  isLoading,
  soundBlocked,
  isMuted,
  onEnableSound,
  onToggleMute,
  onReload,
}: {
  isLoading: boolean;
  soundBlocked: boolean;
  isMuted: boolean;
  onEnableSound: () => void;
  onToggleMute: () => void;
  onReload: () => void;
}) {
  return (
    <div className="orders__acoes">
      {soundBlocked ? (
        <button type="button" className="btn btn--sm" onClick={onEnableSound}>
          Ativar som
        </button>
      ) : null}

      <button
        type="button"
        className="btn btn--sm btn--ghost icon-btn"
        onClick={onToggleMute}
        title={isMuted ? 'Alerta sonoro desligado' : 'Alerta sonoro ligado'}
        aria-label={isMuted ? 'Ligar alerta sonoro' : 'Desligar alerta sonoro'}
        aria-pressed={isMuted}
      >
        <BellIcon muted={isMuted} />
      </button>

      <button
        type="button"
        className="btn btn--sm btn--ghost icon-btn"
        onClick={onReload}
        disabled={isLoading}
        title="Atualizar agora"
        aria-label={isLoading ? 'Atualizando' : 'Atualizar agora'}
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

/**
 * A SEGUNDA FAIXA: o recorte à esquerda, a promessa da loja à direita.
 *
 * Ela é mais baixa que a faixa do título (34px contra 52) e fica logo abaixo
 * dela, grudenta também: a hierarquia entre as duas é dita pela altura e pela
 * ordem, não por uma cor de fundo — duas faixas preenchidas empilhadas seriam
 * duas barras cinzas antes do primeiro pedido.
 *
 * ELA NÃO ABRE E NÃO FECHA, e este é o ponto que não muda: numa tela que fica
 * aberta o turno inteiro, um filtro atrás de um botão "Filtros" é um filtro que
 * ninguém lembra que ligou. O lojista jura que sumiu pedido, liga para o
 * suporte, e o que sumiu foi a memória de que ontem ele deixou o período em
 * "últimos 7 dias". Escrito na tela, o estado se conserta sozinho.
 *
 * A FILIAL NÃO ESTÁ AQUI: ela é escopo de sessão e mora no seletor do
 * cabeçalho. Dois controles para a mesma coisa é como eles passam a discordar.
 */
export function OrdersToolbar({
  filters,
  streamStatus,
  onChange,
  contagens,
}: {
  filters: OrdersFilterState;
  streamStatus: StreamStatus;
  onChange: (patch: Partial<OrdersFilterState>) => void;
  /**
   * Os contadores por estágio. Vêm de fora porque quem os conta é o quadro, e
   * eles só existem na aba "Em andamento" — no histórico não há estágio aberto.
   */
  contagens: ReactNode;
}) {
  // A busca tem estado próprio para não disparar uma requisição por tecla.
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = window.setTimeout(() => onChange({ search: searchDraft }), 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search, onChange]);

  return (
    <div className="orders__barra">
      {/* --- o recorte: o que esta lista está mostrando --------------------- */}
      <div className="filtros" aria-label="O que a lista mostra">
        {/*
          A BUSCA É A DO DESIGN SYSTEM, na variante de barra — um campo com
          borda de quatro lados no meio de uma linha de texto é o objeto que faz
          a faixa ler como bloco.

          Ela vem PRIMEIRO no grupo porque é a ferramenta mais usada dos três: o
          período se ajusta uma vez por turno, a busca é a cada vez que alguém
          liga perguntando do pedido.
        */}
        <div className="filtros__busca">
          <SearchField
            label="Buscar pedido por número ou nome do cliente"
            placeholder="Nº do pedido ou cliente"
            variant="barra"
            value={searchDraft}
            onValueChange={setSearchDraft}
          />
        </div>

        {/*
          O PERÍODO É TEXTO. Sem trilho, sem cápsula e sem fundo: o ativo é peso
          cheio mais uma sublinha de 1px. É o mesmo estado, visível o tempo todo,
          por zero pixel de altura própria.
        */}
        <div className="filtros__periodo" role="group" aria-label="Período">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.value}
              type="button"
              className="filtros__periodo-opt"
              aria-pressed={filters.period === periodo.value}
              onClick={() =>
                onChange({ period: periodo.value, ...datesForPeriod(periodo.value, filters) })
              }
              data-testid={`orders-period-${periodo.value}`}
            >
              {/*
                O RÓTULO NUM FILHO PRÓPRIO, e é ele que leva a sublinha do
                ativo. No toque o botão cresce para 44px de alvo (ver
                `OrdersPage.css`), e uma sublinha desenhada na borda do BOTÃO
                desceria junto — 11px abaixo da letra, solta. No `<span>` ela
                continua colada no texto, que é onde a marcação significa.
              */}
              <span className="filtros__periodo-rotulo">{periodo.label}</span>
            </button>
          ))}
        </div>

        {/*
          As datas só aparecem em "Escolher". Mantê-las sempre na tela custaria
          dois campos de 120px a cada minuto do turno para o caso raro de alguém
          querer uma janela específica.
        */}
        {filters.period === 'custom' ? (
          <div className="filtros__datas">
            <label className="filtros__data">
              <span className="sr-only">De</span>
              <input
                className="input input--bare"
                type="date"
                value={filters.startDate}
                onChange={(event) => onChange({ startDate: event.target.value })}
                aria-label="Data inicial"
              />
            </label>
            <span className="faint" aria-hidden="true">
              até
            </span>
            <label className="filtros__data">
              <span className="sr-only">Até</span>
              <input
                className="input input--bare"
                type="date"
                value={filters.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
                aria-label="Data final"
              />
            </label>
          </div>
        ) : null}

        {contagens}
      </div>

      <Promessa streamStatus={streamStatus} />
    </div>
  );
}

/**
 * ============================================================================
 * A PROMESSA — preparo MAIS entrega, e o que disso chega ao cliente
 * ============================================================================
 *
 * Nenhum controle daqui recorta a lista: os três dizem em que pé a loja está.
 * O ajuste de preparo é ESCRITA e precisa de uma filial resolvida; o filtro do
 * outro lado da barra é de LEITURA e aceita vazio ("todas as que eu enxergo").
 * Ver `auth/branch-scope`.
 *
 * A LINHA QUE FALTAVA: "Cliente vê 55–80 min · preparo + entrega".
 *
 * Os botões de +5/+10/−5 estão aqui desde sempre e NADA dizia o que aquele
 * tempo significa. Os dois números viviam lado a lado como se fossem promessas
 * independentes, e o lojista empurrava dez minutos no preparo achando que mexia
 * num número só — quando o que ele move é o prazo que o cliente lê no
 * aplicativo.
 *
 * ELA É UM TERCEIRO LEITOR, e não uma frase de ajuda, por três razões:
 *
 *   - a gramática do grupo já é essa (rótulo nível 3, valor, qualificador em
 *     tinta de apoio) — é o mesmo desenho de "Preparo" e "Entrega", e não uma
 *     peça nova no meio de uma faixa de 40px;
 *   - a conta fica À VISTA: apertando +10, o número do cliente anda dez minutos
 *     junto. A regra se ensina sozinha, no clique, uma vez;
 *   - ela sobrevive ao celular. `title` não existe no toque, e um balão
 *     esconderia justamente do turno a informação de que o turno precisa.
 *
 * "preparo + entrega" fica escrito porque a soma sozinha ainda deixaria o
 * lojista adivinhando de onde saíram os 55 — e é o "+" que responde à pergunta
 * que abriu esta rodada.
 *
 * A FILIAL E A FAIXA SÃO LIDAS AQUI, uma vez, e descem para o controle: ele
 * ajusta a faixa e este grupo a soma. Duas leituras seriam duas requisições
 * para o mesmo número e, no instante entre o PATCH e a releitura, dois números
 * diferentes na mesma barra.
 */
function Promessa({ streamStatus }: { streamStatus: StreamStatus }) {
  const { branchId, branch, isAutoResolved, hasChoice } = useResolvedBranch();
  const prep = usePrepTime(branchId);
  const entrega = useDeliveryEstimate();

  /*
   * O nome da filial só entra quando ele ACRESCENTA: com "todas" no cabeçalho
   * e mais de uma loja, o valor na barra é de uma delas e não dizer qual seria
   * mentir por omissão. Com a filial já escolhida no topo, o cabeçalho já a
   * nomeia — repetir aqui é a mesma informação duas vezes na mesma tela (§8).
   */
  const nomeFilial =
    isAutoResolved && hasChoice && branch ? branch.display_name?.trim() || branch.name : '';

  const cliente = promessaAoCliente(prep.range, entrega);

  return (
    <div className="promessa" aria-label="O que a loja promete agora">
      <PrepTimeControl prep={prep} branchId={branchId} nomeFilial={nomeFilial} />
      <DeliveryEstimate estimate={entrega} />

      {/*
        SEM AS DUAS PONTAS, NÃO HÁ LINHA. Uma promessa calculada só com o
        preparo prometeria o tempo da cozinha como se fosse o da porta — que é
        justamente o erro de leitura que ela existe para desfazer.
      */}
      {cliente ? (
        <span className="prep" data-testid="promessa-cliente">
          <span className="prep__label">Cliente vê</span>
          <span className="prep__range">{formatPrepRange(cliente)}</span>
          <span className="prep__conta">preparo + entrega</span>
        </span>
      ) : null}

      <span className={`conn conn--${streamStatus}`} data-testid="stream-status">
        <span className="conn__dot" />
        <span className="conn__texto">{STREAM_LABELS[streamStatus]}</span>
      </span>
    </div>
  );
}

/**
 * O tempo estimado de entrega, no mesmo tratamento do prazo de preparo.
 *
 * Ele é SÓ LEITURA aqui, e não por economia: `estimated_delivery_time` é do
 * RESTAURANTE (ver `useDeliveryEstimate`), então um botão de +5 nesta barra
 * mudaria a previsão de todas as filiais de uma vez. Empurrar o prazo no meio
 * do turno é o que o preparo faz, e ele é por filial. Quem edita este é Minha
 * loja › Geral.
 *
 * SEM `.tnum`: minuto de configuração não se compara descendo uma coluna — não
 * há coluna. A classe documenta "isto se alinha com o de cima", e aqui isso não
 * é verdade.
 */
function DeliveryEstimate({ estimate }: { estimate: Estimativa | null }) {
  return (
    <span className="prep" data-testid="delivery-estimate">
      <span className="prep__label">Entrega</span>
      {estimate ? (
        <span className="prep__range">
          {estimate.min}–{estimate.max} min
        </span>
      ) : (
        <span className="prep__range prep__range--empty">sem faixa</span>
      )}
    </span>
  );
}
