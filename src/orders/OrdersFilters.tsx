import { useEffect, useState } from 'react';

import { BellIcon, RefreshIcon } from '../ds/icons';
import { SearchField } from '../ds/SearchField';
import { datesForPeriod, type OrdersFilterState, type PeriodPreset } from './order-filters';
import { PrepTimeControl } from './PrepTimeControl';
import { useDeliveryEstimate } from './useDeliveryEstimate';
import type { StreamStatus } from './useOrderStream';

const PERIODOS: readonly { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7', label: '7 dias' },
  { value: 'custom', label: 'Escolher' },
];

const STREAM_LABELS: Record<StreamStatus, string> = {
  live: 'Tempo real',
  connecting: 'Reconectando…',
  offline: 'Sem conexão',
};

/**
 * AS FERRAMENTAS DA TELA DE PEDIDOS — e elas NÃO ESTÃO MAIS DENTRO DE UM CARTÃO.
 *
 * O QUE MUDOU: isto era um cartão branco com moldura e raio, ocupando ~130px
 * de altura para cinco controles, empilhado entre as abas e o primeiro pedido.
 * Filtro é FERRAMENTA, não conteúdo: ele não é uma coisa que se lê, é uma coisa
 * que se opera de vez em quando e que precisa estar visível para não mentir.
 *
 * Agora ele é um grupo na MESMA linha do título (ver `OrdersPage`), sem fundo,
 * sem borda e sem altura própria:
 *
 *   - o PERÍODO deixou de ser cápsula segmentada e virou texto com sublinha no
 *     ativo. Quatro palavras numa linha custam o que quatro palavras custam;
 *     o trilho cinza em volta era o objeto que fazia a barra virar um bloco.
 *   - a BUSCA perdeu a caixa e ficou com um fio embaixo — e isso virou uma
 *     VARIANTE do componente do sistema (`ds/SearchField`), não uma segunda
 *     busca escrita aqui.
 *   - as duas PROMESSAS (preparo e entrega) continuam aqui, porque é aqui que
 *     alguém as confere no meio do turno, mas em tinta de apoio.
 *
 * ELA CONTINUA NÃO ABRINDO E NÃO FECHANDO, e este é o ponto que não muda: numa
 * tela que fica aberta o turno inteiro, um filtro atrás de um botão "Filtros" é
 * um filtro que ninguém lembra que ligou. O lojista jura que sumiu pedido, liga
 * para o suporte, e o que sumiu foi a memória de que ontem ele deixou o período
 * em "últimos 7 dias". Escrito na tela, o estado se conserta sozinho.
 *
 * A FILIAL NÃO ESTÁ AQUI: ela é escopo de sessão e mora no seletor do
 * cabeçalho. Dois controles para a mesma coisa é como eles passam a discordar.
 */
export function OrdersFilters({
  filters,
  streamStatus,
  isLoading,
  soundBlocked,
  isMuted,
  onEnableSound,
  onToggleMute,
  onChange,
  onReload,
}: {
  filters: OrdersFilterState;
  streamStatus: StreamStatus;
  isLoading: boolean;
  soundBlocked: boolean;
  isMuted: boolean;
  onEnableSound: () => void;
  onToggleMute: () => void;
  onChange: (patch: Partial<OrdersFilterState>) => void;
  onReload: () => void;
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
    <div className="filtros">
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
            {periodo.label}
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

      {/*
        A BUSCA É A DO DESIGN SYSTEM, na variante de barra.

        Esta tela tinha a PRÓPRIA busca escrita à mão — um `<label>` com uma
        lupa e um `<input>` sem classe de controle — só porque a do sistema
        vinha com caixa e a barra não pode ter caixa. A cópia custou o que toda
        cópia custa: ela não tinha botão de limpar, não tinha estado
        desabilitado e o rótulo acessível era um `sr-only` solto em vez de um
        `<label for>`. Hoje a caixa é uma variante do componente, e existe uma
        busca só no painel.

        O placeholder é curto de propósito: com o painel de detalhe aberto, a
        coluna da lista fica com ~200px para ela. O rótulo acessível continua
        sendo "Buscar pedido", e a busca continua procurando as duas coisas.
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
        AS DUAS PROMESSAS — preparo e entrega. Elas são a única coisa desta
        barra que ALTERA a loja, e continuam aqui porque é no meio do turno que
        alguém as confere; separadas em outra tela, ninguém confere a soma.

        `PrepTimeControl` sem `branchId`: o controle resolve a própria filial. O
        filtro da barra é de LEITURA e aceita vazio ("todas as que eu enxergo");
        o ajuste de preparo é ESCRITA e precisa de uma. Ver `auth/branch-scope`.
      */}
      <PrepTimeControl />
      <DeliveryEstimate />

      <span className="filtros__vao" aria-hidden="true" />

      <span className={`conn conn--${streamStatus}`} data-testid="stream-status">
        <span className="conn__dot" />
        <span className="conn__texto">{STREAM_LABELS[streamStatus]}</span>
      </span>

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
function DeliveryEstimate() {
  const estimate = useDeliveryEstimate();

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
