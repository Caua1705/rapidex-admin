import { useEffect, useState } from 'react';

import { BellIcon, RefreshIcon, SearchIcon } from '../ds/icons';
import { datesForPeriod, type OrdersFilterState, type PeriodPreset } from './order-filters';
import { PrepTimeControl } from './PrepTimeControl';
import { useDeliveryEstimate } from './useDeliveryEstimate';
import type { StreamStatus } from './useOrderStream';

const PERIODOS: readonly { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7', label: '7 dias' },
  { value: 'custom', label: 'Escolher…' },
];

const STREAM_LABELS: Record<StreamStatus, string> = {
  live: 'Tempo real',
  connecting: 'Reconectando…',
  offline: 'Sem conexão',
};

/**
 * A BARRA DE FILTROS — e ela NÃO ABRE E NÃO FECHA.
 *
 * Este é o ponto: numa tela que fica aberta o turno inteiro, um filtro atrás
 * de um botão "Filtros" é um filtro que ninguém lembra que ligou. O lojista
 * jura que sumiu pedido, liga para o suporte, e o que sumiu foi a memória de
 * que ontem ele deixou o período em "últimos 7 dias". Escrito na tela, o
 * estado se conserta sozinho — dá para ver o filtro errado sem procurá-lo.
 *
 * O PERÍODO É UM SEGMENTADO, não um seletor. São quatro opções fixas: com o
 * segmentado o estado fica visível sem abrir nada, e trocar de "Hoje" para
 * "Ontem" é um clique em vez de três. `ds/Select` continua sendo o caminho
 * para lista longa ou lista que vem do backend — quatro teclas cabem, doze
 * seriam uma parede.
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
      <div className="seg" role="group" aria-label="Período">
        {PERIODOS.map((periodo) => (
          <button
            key={periodo.value}
            type="button"
            className="seg__opt"
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
        As datas só aparecem em "Escolher…". Mantê-las sempre na tela custaria
        dois campos de 120px a cada minuto do turno para o caso raro de alguém
        querer uma janela específica.
      */}
      {filters.period === 'custom' ? (
        <div className="filtros__datas">
          <label className="filtros__data">
            <span className="sr-only">De</span>
            <input
              className="input"
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
              className="input"
              type="date"
              value={filters.endDate}
              onChange={(event) => onChange({ endDate: event.target.value })}
              aria-label="Data final"
            />
          </label>
        </div>
      ) : null}

      <label className="filtros__busca">
        <span className="sr-only">Buscar pedido</span>
        <span className="filtros__lupa" aria-hidden="true">
          <SearchIcon size={14} />
        </span>
        <input
          className="input filtros__busca-campo"
          type="search"
          placeholder="Nº do pedido ou nome do cliente"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </label>

      <div className="filtros__dir">
        {/*
          Sem `branchId`: o controle resolve a própria filial. O filtro da
          barra é de LEITURA e aceita vazio ("todas as que eu enxergo"); o
          ajuste de preparo é ESCRITA e precisa de uma. Passar o filtro para
          dentro dele era o que fazia o controle travar com "escolha uma
          filial" no lugar do valor. Ver `auth/branch-scope.ts`.
        */}
        <PrepTimeControl />

        {/*
          O TEMPO DE ENTREGA AO LADO DO DE PREPARO. Os dois juntos são a
          promessa que o cliente vê — preparo é o que a cozinha controla,
          entrega é o que a rua acrescenta —, e separados em telas diferentes
          ninguém confere a soma.

          Ele é SÓ LEITURA aqui, e não por economia: `estimated_delivery_time`
          é do RESTAURANTE (ver `useDeliveryEstimate`), então um botão de +5
          nesta barra mudaria a previsão de todas as filiais de uma vez.
          Empurrar o prazo no meio do turno é o que o preparo faz, e ele é por
          filial. Quem edita este é Minha loja › Geral.
        */}
        <DeliveryEstimate />

        <span className={`conn conn--${streamStatus}`} data-testid="stream-status">
          <span className="conn__dot" />
          {STREAM_LABELS[streamStatus]}
        </span>

        {soundBlocked ? (
          <button type="button" className="btn btn--sm" onClick={onEnableSound}>
            Ativar som
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn--sm icon-btn"
          onClick={onToggleMute}
          title={isMuted ? 'Alerta sonoro desligado' : 'Alerta sonoro ligado'}
          aria-label={isMuted ? 'Ligar alerta sonoro' : 'Desligar alerta sonoro'}
          aria-pressed={isMuted}
        >
          <BellIcon muted={isMuted} />
        </button>

        <button
          type="button"
          className="btn btn--sm icon-btn"
          onClick={onReload}
          disabled={isLoading}
          title="Atualizar agora"
          aria-label={isLoading ? 'Atualizando' : 'Atualizar agora'}
        >
          <RefreshIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * O tempo estimado de entrega, no mesmo tratamento do prazo de preparo.
 *
 * SEM `.tnum`, e o de preparo ao lado também não tem mais: minuto de
 * configuração está na lista literal do que NÃO leva a classe (§1 da skill de
 * design). "25–35 min" não se compara com o número da linha de cima — não há
 * linha de cima; é um valor único numa barra. A classe documenta "isto se
 * compara descendo uma coluna", e aqui isso não é verdade.
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
