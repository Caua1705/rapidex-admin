import { useEffect, useState } from 'react';

import type { Branch } from '../api/types';
import { datesForPeriod, type OrdersFilterState, type PeriodPreset } from './order-filters';
import type { StreamStatus } from './useOrderStream';

const STREAM_LABELS: Record<StreamStatus, string> = {
  live: 'Tempo real ligado',
  connecting: 'Reconectando…',
  offline: 'Sem conexão',
};

/** Filtros + situação do tempo real. Uma linha só, para não roubar altura. */
export function OrdersToolbar({
  filters,
  branches,
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
  branches: Branch[];
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
        <span className="field__label">Filial</span>
        <select
          className="select"
          value={filters.branchId}
          onChange={(event) => onChange({ branchId: event.target.value })}
        >
          {/*
            Quem está preso a uma filial recebe só ela de GET /admin/branches,
            então "todas" nunca mostra pedido fora do escopo do token.
          */}
          <option value="">Todas as filiais</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.display_name?.trim() || branch.name}
            </option>
          ))}
        </select>
      </label>

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

        <button
          type="button"
          className="btn btn--sm"
          onClick={onToggleMute}
          title={isMuted ? 'Alerta sonoro desligado' : 'Alerta sonoro ligado'}
        >
          {isMuted ? '🔇' : '🔔'}
        </button>

        <button type="button" className="btn btn--sm" onClick={onReload} disabled={isLoading}>
          {isLoading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
    </div>
  );
}
