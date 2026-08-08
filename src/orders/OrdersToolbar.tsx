import { useEffect, useState } from 'react';

import { datesForPeriod, type OrdersFilterState, type PeriodPreset } from './order-filters';
import type { StreamStatus } from './useOrderStream';

const STREAM_LABELS: Record<StreamStatus, string> = {
  live: 'Tempo real ligado',
  connecting: 'Reconectando…',
  offline: 'Sem conexão',
};

/**
 * Filtros + situação do tempo real. Uma linha só, para não roubar altura.
 *
 * A filial NÃO está aqui: ela é escopo de sessão e mora no seletor do
 * cabeçalho. Dois controles para a mesma coisa é como eles passam a discordar.
 */
export function OrdersToolbar({
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

  function handlePeriodChange(period: PeriodPreset) {
    onChange({ period, ...datesForPeriod(period, filters) });
  }

  return (
    <div className="toolbar">
      <label className="field">
        <span className="field__label">Período</span>
        <select
          className="select"
          value={filters.period}
          onChange={(event) => handlePeriodChange(event.target.value as PeriodPreset)}
        >
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="last7">Últimos 7 dias</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>

      {filters.period === 'custom' ? (
        <>
          <label className="field">
            <span className="field__label">De</span>
            <input
              className="input"
              type="date"
              value={filters.startDate}
              onChange={(event) => onChange({ startDate: event.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Até</span>
            <input
              className="input"
              type="date"
              value={filters.endDate}
              onChange={(event) => onChange({ endDate: event.target.value })}
            />
          </label>
        </>
      ) : null}

      <label className="field toolbar__search">
        <span className="field__label">Busca</span>
        <input
          className="input"
          type="search"
          placeholder="Número do pedido ou nome do cliente"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </label>

      <div className="toolbar__right">
        <span className={`conn conn--${streamStatus}`} data-testid="stream-status">
          <span className="conn__dot" />
          {STREAM_LABELS[streamStatus]}
        </span>

        {soundBlocked ? (
          <button type="button" className="btn btn--sm" onClick={onEnableSound}>
            Ativar som
          </button>
        ) : null}

        {/* Ícone e não emoji: o painel não usa emoji em lugar nenhum. */}
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

        <button type="button" className="btn btn--sm" onClick={onReload} disabled={isLoading}>
          {isLoading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
    </div>
  );
}

function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
      {muted ? <path d="M3 3l18 18" /> : null}
    </svg>
  );
}
