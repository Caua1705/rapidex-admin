import { useState } from 'react';

import { formatDelta, formatPrepRange, PREP_TIME_DELTAS } from './prep-time';
import type { usePrepTime } from './usePrepTime';

/**
 * Ajuste rápido do tempo de preparo, no topo da tela de pedidos.
 *
 * É a ação do turno cheio: a cozinha atrasou, o lojista empurra 10 minutos e a
 * previsão que o cliente vê acompanha. Por isso são botões de passo fixo e não
 * um campo — no meio do almoço ninguém digita número.
 *
 * O AJUSTE É POR FILIAL DENTRO DE UMA TELA QUE LÊ VÁRIAS, e é isso que o
 * separa das seções de Minha loja. Ele já respondeu "escolha uma filial" no
 * lugar do valor, com os botões travados: uma frase que nem fecha em português
 * ao lado do rótulo ("Preparo escolha uma filial") e um controle que o lojista
 * não tinha como usar sem antes ir mexer no cabeçalho — e mexer no cabeçalho
 * filtraria o quadro inteiro para uma loja, que é justamente o que ele não
 * pediu.
 *
 * Hoje ele RESOLVE a filial (a principal, na falta de escolha), opera sobre
 * ela e DIZ QUAL É, sem tocar no seletor do topo. Com uma filial só o nome não
 * aparece: não há o que desambiguar.
 *
 * A FILIAL E A FAIXA VÊM DE FORA, e é a única coisa que mudou nesta rodada: o
 * grupo da promessa (`Promessa`, em `OrdersToolbar`) precisa da MESMA faixa
 * para somá-la à entrega e dizer o que o cliente vê. Lida duas vezes, ela seria
 * uma segunda requisição para o mesmo número — e, no instante entre o PATCH e a
 * releitura, dois números diferentes na mesma barra. A resolução da filial
 * continua sendo a de `useResolvedBranch`: ela só passou a ser chamada um nível
 * acima, junto com a leitura que já dependia dela.
 */
export function PrepTimeControl({
  prep,
  branchId,
  nomeFilial,
}: {
  prep: ReturnType<typeof usePrepTime>;
  /** Vazio quando o lojista não enxerga filial nenhuma: os botões travam. */
  branchId: string;
  /** Vazio quando dizer o nome não acrescenta nada. Ver `Promessa`. */
  nomeFilial: string;
}) {
  const [baseMin, setBaseMin] = useState('');
  const [baseMax, setBaseMax] = useState('');

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

  /*
   * A faixa é a informação principal, e cada estado tem PALAVRA própria. Antes
   * havia só um travessão ao lado dos botões: um controle que se oferece para
   * somar cinco minutos sem dizer cinco minutos em cima de quê.
   */
  const temFaixa = prep.range !== null;

  return (
    <div className="prep prep--ajuste">
      <span className="prep__label">Preparo</span>

      {temFaixa ? (
        <span className="prep__range" data-testid="prep-time-range">
          {formatPrepRange(prep.range)}
        </span>
      ) : (
        <span className="prep__range prep__range--empty" data-testid="prep-time-range">
          {prep.isLoading ? 'carregando…' : 'não definido'}
        </span>
      )}

      {/*
        De qual loja é este número. Fica DEPOIS do valor porque é o
        qualificador dele, não o rótulo do controle — e some quando o
        cabeçalho já responde a mesma pergunta.
      */}
      {nomeFilial ? (
        <span className="prep__branch" data-testid="prep-time-branch">
          na {nomeFilial}
        </span>
      ) : null}

      <span className="prep__buttons">
        {PREP_TIME_DELTAS.map((delta) => (
          <button
            key={delta}
            type="button"
            className="btn btn--sm prep__step"
            disabled={branchId === '' || prep.isSaving}
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
                className="input tnum"
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
                className="input tnum"
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
