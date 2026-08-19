import { useEffect, useState } from 'react';

import type { RestaurantSettingsUpdate } from '../api/types';
import { Checkbox } from '../ds/Checkbox';
import { SaveBar } from './SaveBar';
import {
  checkEstimatedRange,
  formatDecimalInput,
  formatIntegerInput,
  parseDecimal,
  parseInteger,
} from './settings-model';
import type { useStoreSettings } from './useStoreSettings';

type Draft = {
  minOrderValue: string;
  estimatedMin: string;
  estimatedMax: string;
  serviceFeeEnabled: boolean;
  serviceFeeAmount: string;
};

const EMPTY: Draft = {
  minOrderValue: '',
  estimatedMin: '',
  estimatedMax: '',
  serviceFeeEnabled: true,
  serviceFeeAmount: '',
};

/**
 * Configurações do RESTAURANTE inteiro — as mesmas para todas as filiais. É a
 * única aba desta tela que funciona com "Todas as filiais" no cabeçalho.
 *
 * "ACEITA ENTREGA" E "ACEITA RETIRADA" SAÍRAM DAQUI. Eles passaram a ser de
 * cada filial (`PATCH /admin/branches/{id}/order-types`) e não existem mais em
 * `AdminRestaurantSettingsUpdate` — mandá-los neste PATCH responde 422, e
 * levava junto o resto do formulário. O quiosque que só faz retirada desligava
 * a entrega da rede inteira, que é o defeito que a mudança fecha.
 *
 * `default_delivery_fee` NÃO ESTÁ AQUI, de propósito. A API aceita editá-lo,
 * mas ele não entra em cobrança nenhuma: o frete cobrado sai das regras por km
 * da filial (aba Entrega). Um campo de "taxa de entrega padrão" que não altera
 * o que o cliente paga é pior que campo faltando — o lojista mexe nele achando
 * que baixou o frete e o app continua cobrando o mesmo.
 */
export function GeneralTab({ settings }: { settings: ReturnType<typeof useStoreSettings> }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  const loaded = settings.settings;

  useEffect(() => {
    if (!loaded) return;
    const next: Draft = {
      minOrderValue: formatDecimalInput(loaded.min_order_value),
      estimatedMin: formatIntegerInput(loaded.estimated_delivery_time_min),
      estimatedMax: formatIntegerInput(loaded.estimated_delivery_time_max),
      // O backend manda `boolean | null` com padrão true: só o `false`
      // explícito desliga.
      serviceFeeEnabled: loaded.service_fee_enabled !== false,
      serviceFeeAmount: formatDecimalInput(loaded.service_fee_amount),
    };
    setDraft(next);
    setBaseline(next);
  }, [loaded]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  async function handleSave() {
    const minOrder = parseDecimal(draft.minOrderValue, { allowEmpty: false });
    if (!minOrder.ok) return setProblem(`Valor mínimo do pedido: ${minOrder.message}`);

    const estimatedMin = parseInteger(draft.estimatedMin);
    if (!estimatedMin.ok) return setProblem(`Tempo estimado mínimo: ${estimatedMin.message}`);

    const estimatedMax = parseInteger(draft.estimatedMax);
    if (!estimatedMax.ok) return setProblem(`Tempo estimado máximo: ${estimatedMax.message}`);

    const rangeProblem = checkEstimatedRange(estimatedMin.value, estimatedMax.value);
    if (rangeProblem) return setProblem(rangeProblem);

    const serviceFee = parseDecimal(draft.serviceFeeAmount, {
      // Com a taxa ligada o valor é obrigatório: taxa ligada e vazia cobraria
      // um número que ninguém escolheu.
      allowEmpty: !draft.serviceFeeEnabled,
    });
    if (!serviceFee.ok) return setProblem(`Taxa de serviço: ${serviceFee.message}`);

    const body: RestaurantSettingsUpdate = {
      min_order_value: minOrder.value,
      estimated_delivery_time_min: estimatedMin.value,
      estimated_delivery_time_max: estimatedMax.value,
      service_fee_enabled: draft.serviceFeeEnabled,
      service_fee_amount: serviceFee.value ?? 0,
    };

    if (await settings.save(body)) setBaseline(draft);
  }

  if (settings.isLoading)
    return <p className="muted store__loading">Carregando as configurações…</p>;

  return (
    <form
      className="store-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <section className="store-form__section">
        <h2 className="store-form__heading">Pedido</h2>

        <div className="store-form__grid">
          <label className="field">
            <span className="field__label">Valor mínimo do pedido</span>
            <input
              className="input tnum"
              inputMode="decimal"
              value={draft.minOrderValue}
              onChange={(event) => patch({ minOrderValue: event.target.value })}
              data-testid="settings-min-order"
            />
            <span className="field__hint">
              Abaixo disso o cliente não fecha o pedido. Em reais.
            </span>
          </label>

          {/*
            Mínimo e máximo são UM campo: eles formam uma faixa, sempre são
            editados juntos e o backend os valida em par. Em duas caixas
            rotuladas separadamente, cada uma pedia o próprio rótulo de três
            palavras e a própria linha de ajuda — três campos onde há dois
            números.
          */}
          <div className="field">
            <span className="field__label">Tempo estimado (min)</span>
            <div className="field__pair">
              <input
                className="input tnum"
                inputMode="numeric"
                aria-label="Tempo estimado mínimo, em minutos"
                value={draft.estimatedMin}
                onChange={(event) => patch({ estimatedMin: event.target.value })}
                data-testid="settings-eta-min"
              />
              <span className="field__pair-sep" aria-hidden="true">
                a
              </span>
              <input
                className="input tnum"
                inputMode="numeric"
                aria-label="Tempo estimado máximo, em minutos"
                value={draft.estimatedMax}
                onChange={(event) => patch({ estimatedMax: event.target.value })}
                data-testid="settings-eta-max"
              />
            </div>
            <span className="field__hint">É a faixa que o cliente vê ao escolher a loja.</span>
          </div>
        </div>
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Taxa de serviço</h2>

        {/* A caixa de marcar liga o campo ao lado: na mesma linha, a relação
            entre os dois é o próprio desenho. */}
        <div className="store-form__row">
          <Checkbox
            checked={draft.serviceFeeEnabled}
            onChange={(serviceFeeEnabled) => patch({ serviceFeeEnabled })}
            label="Cobrar taxa de serviço"
            data-testid="settings-service-fee-enabled"
          />

          <label className="field store-form__narrow">
            <span className="field__label">Valor da taxa</span>
            <input
              className="input tnum"
              inputMode="decimal"
              value={draft.serviceFeeAmount}
              disabled={!draft.serviceFeeEnabled}
              onChange={(event) => patch({ serviceFeeAmount: event.target.value })}
              data-testid="settings-service-fee-amount"
            />
          </label>
        </div>
      </section>

      <SaveBar
        isSaving={settings.isSaving}
        isDirty={isDirty}
        savedAt={settings.savedAt}
        errorMessage={problem ?? settings.errorMessage}
        onSave={() => void handleSave()}
        onReset={() => {
          setDraft(baseline);
          setProblem(null);
        }}
      />
    </form>
  );
}
