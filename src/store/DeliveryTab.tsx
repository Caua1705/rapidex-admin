import { useEffect, useState } from 'react';

import type { BranchUpdate } from '../api/types';
import { formatCurrency } from '../orders/format';
import { checkDeliveryConfig, estimateDeliveryFee, type DeliveryConfig } from './delivery-config';
import { SaveBar } from './SaveBar';
import { formatDecimalInput, parseDecimal } from './settings-model';
import type { useBranchDetail } from './useBranchDetail';

type Draft = {
  baseFee: string;
  perKm: string;
  minFee: string;
  maxFee: string;
  maxDistanceKm: string;
};

const EMPTY: Draft = { baseFee: '', perKm: '', minFee: '', maxFee: '', maxDistanceKm: '' };

/** Distâncias da prévia: perto, médio e no limite do que a loja costuma cobrir. */
const PREVIEW_DISTANCES = [1, 3, 5];

/**
 * As regras de entrega da filial.
 *
 * É POR RAIO, NÃO POR BAIRRO: o preço sai de `base + por_km × km` sobre a
 * distância do endereço até a filial, preso entre a mínima e a máxima. Não há
 * tabela de bairro nem zona no mapa — e a tela diz isso, porque quem vem do
 * concorrente procura por bairro e conclui que a função sumiu.
 *
 * A prévia ao lado dos campos existe para o erro de digitação aparecer na hora:
 * "2,00 por km" e "20,00 por km" são um dígito de diferença e R$ 90 de frete
 * num pedido de 5 km.
 */
export function DeliveryTab({
  branchDetail,
}: {
  branchDetail: ReturnType<typeof useBranchDetail>;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  const { branch } = branchDetail;

  useEffect(() => {
    if (!branch) return;
    const next: Draft = {
      baseFee: formatDecimalInput(branch.delivery_base_fee),
      perKm: formatDecimalInput(branch.delivery_fee_per_km),
      minFee: formatDecimalInput(branch.delivery_min_fee),
      maxFee: formatDecimalInput(branch.delivery_max_fee),
      maxDistanceKm: formatDecimalInput(branch.delivery_max_distance_km),
    };
    setDraft(next);
    setBaseline(next);
  }, [branch]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  /** O que os campos valem AGORA, para o aviso e a prévia acompanharem a digitação. */
  const draftConfig: DeliveryConfig = {
    delivery_base_fee: numberOrNull(draft.baseFee),
    delivery_fee_per_km: numberOrNull(draft.perKm),
    delivery_min_fee: numberOrNull(draft.minFee),
    delivery_max_fee: numberOrNull(draft.maxFee),
    delivery_max_distance_km: numberOrNull(draft.maxDistanceKm),
  };
  const configProblems = checkDeliveryConfig(draftConfig);

  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  async function handleSave() {
    const base = parseDecimal(draft.baseFee);
    if (!base.ok) return setProblem(`Taxa base: ${base.message}`);

    const perKm = parseDecimal(draft.perKm);
    if (!perKm.ok) return setProblem(`Valor por km: ${perKm.message}`);

    const minFee = parseDecimal(draft.minFee);
    if (!minFee.ok) return setProblem(`Taxa mínima: ${minFee.message}`);

    const maxFee = parseDecimal(draft.maxFee);
    if (!maxFee.ok) return setProblem(`Taxa máxima: ${maxFee.message}`);

    const maxDistance = parseDecimal(draft.maxDistanceKm);
    if (!maxDistance.ok) return setProblem(`Distância máxima: ${maxDistance.message}`);

    const body: BranchUpdate = {
      delivery_base_fee: base.value,
      delivery_fee_per_km: perKm.value,
      delivery_min_fee: minFee.value,
      delivery_max_fee: maxFee.value,
      delivery_max_distance_km: maxDistance.value,
    };

    if (await branchDetail.save(body)) setBaseline(draft);
  }

  if (branchDetail.isLoading) return <p className="muted store__loading">Carregando a entrega…</p>;
  if (!branch) {
    return (
      <p className="alert alert--error" role="alert">
        {branchDetail.errorMessage ?? 'Não foi possível carregar esta filial.'}
      </p>
    );
  }

  return (
    <form
      className="store-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <section className="store-form__section">
        <h2 className="store-form__heading">Cobrança da entrega</h2>
        <p className="faint store-form__hint">
          O frete é por raio: taxa base mais o valor por quilômetro, medido em linha reta da filial
          até o endereço. Não existe preço por bairro.
        </p>

        {/*
          Base ou por-km em branco não é campo opcional vazio: sem eles a
          estimativa não roda, TODO endereço volta como não atendível e a loja
          fica aberta sem receber um pedido de entrega sequer. Por isso o
          vermelho de erro, e não o âmbar de aviso.
        */}
        {configProblems.length > 0 ? (
          <div
            className="alert alert--error store-form__warn"
            role="alert"
            data-testid="delivery-config-error"
          >
            <strong>Entrega mal configurada</strong>
            <ul className="store-form__problems">
              {configProblems.map((entry) => (
                <li key={entry.field}>{entry.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="store-form__grid">
          <label className="field">
            <span className="field__label">Taxa base</span>
            <input
              className="input mono"
              inputMode="decimal"
              value={draft.baseFee}
              onChange={(event) => patch({ baseFee: event.target.value })}
              data-testid="delivery-base-fee"
            />
          </label>

          <label className="field">
            <span className="field__label">Valor por km</span>
            <input
              className="input mono"
              inputMode="decimal"
              value={draft.perKm}
              onChange={(event) => patch({ perKm: event.target.value })}
              data-testid="delivery-per-km"
            />
          </label>

          {/* Piso e teto são uma FAIXA, como o tempo estimado em Geral: um
              rótulo, uma ajuda, dois números. */}
          <div className="field">
            <span className="field__label">Faixa da taxa</span>
            <div className="field__pair">
              <input
                className="input mono"
                inputMode="decimal"
                aria-label="Taxa mínima da entrega"
                value={draft.minFee}
                onChange={(event) => patch({ minFee: event.target.value })}
                data-testid="delivery-min-fee"
              />
              <span className="field__pair-sep" aria-hidden="true">
                a
              </span>
              <input
                className="input mono"
                inputMode="decimal"
                aria-label="Taxa máxima da entrega"
                value={draft.maxFee}
                onChange={(event) => patch({ maxFee: event.target.value })}
                data-testid="delivery-max-fee"
              />
            </div>
            <span className="faint store-form__hint">Vazio dos dois lados: sem piso e sem teto.</span>
          </div>

          <label className="field">
            <span className="field__label">Distância máxima (km)</span>
            <input
              className="input mono"
              inputMode="decimal"
              value={draft.maxDistanceKm}
              onChange={(event) => patch({ maxDistanceKm: event.target.value })}
              data-testid="delivery-max-distance"
            />
            <span className="faint store-form__hint">Além disso o endereço não é atendido.</span>
          </label>
        </div>
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Como fica o frete</h2>

        <ul className="delivery-preview" data-testid="delivery-preview">
          {PREVIEW_DISTANCES.map((km) => {
            const fee = estimateDeliveryFee(draftConfig, km);
            return (
              <li className="delivery-preview__row" key={km}>
                <span className="mono">{km} km</span>
                {/* Coluna de dinheiro: tabular e à direita, como em toda a tela. */}
                <span className={fee === null ? 'faint num' : 'num delivery-preview__fee'}>
                  {fee === null ? 'Não atendido' : formatCurrency(fee)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <SaveBar
        isSaving={branchDetail.isSaving}
        isDirty={isDirty}
        savedAt={branchDetail.savedAt}
        errorMessage={problem ?? branchDetail.errorMessage}
        onSave={() => void handleSave()}
        onReset={() => {
          setDraft(baseline);
          setProblem(null);
        }}
      />
    </form>
  );
}

/**
 * Texto do campo → número para a prévia, sem julgar o que está sendo digitado.
 *
 * Diferente do `parseDecimal` do salvamento: aqui, "12," no meio da digitação
 * vira null e a prévia mostra "Não atendido" por um instante, o que é honesto —
 * não dá para estimar com um número incompleto.
 */
function numberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}
