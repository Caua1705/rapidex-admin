import { useState } from 'react';

import { formatDelta, formatPrepRange, PREP_TIME_DELTAS } from './prep-time';
import { usePrepTime } from './usePrepTime';

/**
 * Ajuste rápido do tempo de preparo, no topo da tela de pedidos.
 *
 * É a ação do turno cheio: a cozinha atrasou, o lojista empurra 10 minutos e a
 * previsão que o cliente vê acompanha. Por isso são botões de passo fixo e não
 * um campo — no meio do almoço ninguém digita número.
 *
 * O ajuste é POR FILIAL, então com "todas as filiais" escolhidas no cabeçalho
 * não há o que ajustar: os botões ficam travados com o motivo no `title`, em
 * vez de sumirem (um controle que some é um controle que o lojista procura).
 */
export function PrepTimeControl({ branchId }: { branchId: string }) {
  const prep = usePrepTime(branchId);
  const [baseMin, setBaseMin] = useState('');
  const [baseMax, setBaseMax] = useState('');

  const semFilial = branchId === '';
  const motivoTravado = semFilial
    ? 'Escolha uma filial no topo para ajustar o tempo de preparo.'
    : undefined;

  const min = Number(baseMin);
  const max = Number(baseMax);
  const baseValida =
    baseMin.trim() !== '' &&
    baseMax.trim() !== '' &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min > 0 &&
    max >= min;

  async function salvarBase() {
    const salvou = await prep.saveBase(min, max);
    if (salvou) {
      setBaseMin('');
      setBaseMax('');
    }
  }

  return (
    <div className="prep">
      <span className="prep__label">Preparo</span>
      <span className="prep__range mono" data-testid="prep-time-range">
        {formatPrepRange(prep.range)}
      </span>

      <span className="prep__buttons">
        {PREP_TIME_DELTAS.map((delta) => (
          <button
            key={delta}
            type="button"
            className="btn btn--sm prep__step"
            disabled={semFilial || prep.isSaving}
            title={motivoTravado}
            onClick={() => void prep.adjust(delta)}
            data-testid={`prep-time-${delta > 0 ? 'mais' : 'menos'}-${Math.abs(delta)}`}
          >
            {formatDelta(delta)}
          </button>
        ))}
      </span>

      {/*
        Erro e campo de base saem do fluxo da barra: crescendo dentro dela,
        empurrariam os filtros de lugar a cada 409.
      */}
      {prep.errorMessage ? (
        <div className="prep__popover" role="alert" data-testid="prep-time-error">
          <p className="prep__message">{prep.errorMessage}</p>
          <button type="button" className="btn btn--sm" onClick={prep.dismiss}>
            Entendi
          </button>
        </div>
      ) : null}

      {prep.needsBase ? (
        <div className="prep__popover" data-testid="prep-time-base">
          <p className="prep__message">
            Esta filial ainda não tem tempo de preparo gravado. Informe a faixa uma vez e depois os
            botões passam a somar em cima dela.
          </p>
          <div className="prep__base-fields">
            <label className="field">
              <span className="field__label">Mínimo (min)</span>
              <input
                className="input mono"
                type="number"
                min="1"
                inputMode="numeric"
                value={baseMin}
                autoFocus
                onChange={(event) => setBaseMin(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Máximo (min)</span>
              <input
                className="input mono"
                type="number"
                min="1"
                inputMode="numeric"
                value={baseMax}
                onChange={(event) => setBaseMax(event.target.value)}
              />
            </label>
          </div>
          <div className="prep__base-actions">
            <button type="button" className="btn btn--sm" onClick={prep.dismiss}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              disabled={!baseValida || prep.isSaving}
              onClick={() => void salvarBase()}
            >
              {prep.isSaving ? 'Salvando…' : 'Salvar faixa'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
