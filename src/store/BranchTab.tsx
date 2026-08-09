import { useEffect, useState } from 'react';

import type { BranchUpdate } from '../api/types';
import { SaveBar } from './SaveBar';
import { formatCoordinateInput, parseCoordinate } from './settings-model';
import type { useBranchDetail } from './useBranchDetail';

type Draft = {
  name: string;
  displayName: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: string;
  longitude: string;
};

const EMPTY: Draft = {
  name: '',
  displayName: '',
  email: '',
  phone: '',
  whatsapp: '',
  address: '',
  neighborhood: '',
  city: '',
  state: '',
  zipcode: '',
  latitude: '',
  longitude: '',
};

/**
 * Cadastro da filial: nome, endereço, contato e coordenada.
 *
 * A COORDENADA NÃO É DETALHE. Ela é a origem do cálculo de rota: sem latitude e
 * longitude, o Google mede a distância a partir do lugar errado e o frete sai
 * errado para todo mundo — ou o endereço volta como fora de área. Por isso ela
 * tem seção própria e um aviso quando está vazia, em vez de ficar como mais
 * dois campos no fim do formulário.
 *
 * `slug` e `is_active` não estão aqui porque o contrato não os aceita: o slug é
 * URL pública e desativar filial é operação de plataforma, não de lojista.
 */
export function BranchTab({ branchDetail }: { branchDetail: ReturnType<typeof useBranchDetail> }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  const { branch } = branchDetail;

  useEffect(() => {
    if (!branch) return;
    const next: Draft = {
      name: branch.name ?? '',
      displayName: branch.display_name ?? '',
      email: branch.email ?? '',
      phone: branch.phone ?? '',
      whatsapp: branch.whatsapp ?? '',
      address: branch.address ?? '',
      neighborhood: branch.neighborhood ?? '',
      city: branch.city ?? '',
      state: branch.state ?? '',
      zipcode: branch.zipcode ?? '',
      latitude: formatCoordinateInput(branch.latitude),
      longitude: formatCoordinateInput(branch.longitude),
    };
    setDraft(next);
    setBaseline(next);
  }, [branch]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const missingCoordinates = draft.latitude.trim() === '' || draft.longitude.trim() === '';

  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  async function handleSave() {
    if (draft.name.trim() === '') return setProblem('A filial precisa de um nome.');

    const latitude = parseCoordinate(draft.latitude, 'latitude');
    if (!latitude.ok) return setProblem(`Latitude: ${latitude.message}`);

    const longitude = parseCoordinate(draft.longitude, 'longitude');
    if (!longitude.ok) return setProblem(`Longitude: ${longitude.message}`);

    /*
     * Campo de texto vazio vai como null, e não como "": null é "não tenho
     * este dado", enquanto "" grava uma string vazia que depois aparece como
     * um WhatsApp em branco no app do cliente.
     */
    const text = (value: string) => (value.trim() === '' ? null : value.trim());

    const body: BranchUpdate = {
      name: draft.name.trim(),
      display_name: text(draft.displayName),
      email: text(draft.email),
      phone: text(draft.phone),
      whatsapp: text(draft.whatsapp),
      address: text(draft.address),
      neighborhood: text(draft.neighborhood),
      city: text(draft.city),
      state: text(draft.state),
      zipcode: text(draft.zipcode),
      latitude: latitude.value,
      longitude: longitude.value,
    };

    if (await branchDetail.save(body)) setBaseline(draft);
  }

  if (branchDetail.isLoading) return <p className="muted store__loading">Carregando a filial…</p>;
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
        <h2 className="store-form__heading">Identificação</h2>

        <div className="store-form__grid">
          <label className="field">
            <span className="field__label">Nome da filial</span>
            <input
              className="input"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              data-testid="branch-name"
            />
          </label>

          <label className="field">
            <span className="field__label">Nome de exibição</span>
            <input
              className="input"
              value={draft.displayName}
              onChange={(event) => patch({ displayName: event.target.value })}
              data-testid="branch-display-name"
            />
            <span className="faint store-form__hint">
              O que o cliente vê. Vazio usa o nome acima.
            </span>
          </label>
        </div>
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Contato</h2>

        <div className="store-form__grid">
          <label className="field">
            <span className="field__label">Telefone</span>
            <input
              className="input mono"
              inputMode="tel"
              value={draft.phone}
              onChange={(event) => patch({ phone: event.target.value })}
              data-testid="branch-phone"
            />
          </label>

          <label className="field">
            <span className="field__label">WhatsApp</span>
            <input
              className="input mono"
              inputMode="tel"
              value={draft.whatsapp}
              onChange={(event) => patch({ whatsapp: event.target.value })}
              data-testid="branch-whatsapp"
            />
          </label>

          <label className="field">
            <span className="field__label">E-mail</span>
            <input
              className="input"
              type="email"
              value={draft.email}
              onChange={(event) => patch({ email: event.target.value })}
              data-testid="branch-email"
            />
          </label>
        </div>
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Endereço</h2>

        <div className="store-form__grid">
          <label className="field store-form__wide">
            <span className="field__label">Logradouro e número</span>
            <input
              className="input"
              value={draft.address}
              onChange={(event) => patch({ address: event.target.value })}
              data-testid="branch-address"
            />
          </label>

          <label className="field">
            <span className="field__label">Bairro</span>
            <input
              className="input"
              value={draft.neighborhood}
              onChange={(event) => patch({ neighborhood: event.target.value })}
              data-testid="branch-neighborhood"
            />
          </label>

          <label className="field">
            <span className="field__label">Cidade</span>
            <input
              className="input"
              value={draft.city}
              onChange={(event) => patch({ city: event.target.value })}
              data-testid="branch-city"
            />
          </label>

          <label className="field">
            <span className="field__label">Estado</span>
            <input
              className="input"
              maxLength={2}
              value={draft.state}
              onChange={(event) => patch({ state: event.target.value.toUpperCase() })}
              data-testid="branch-state"
            />
          </label>

          <label className="field">
            <span className="field__label">CEP</span>
            <input
              className="input mono"
              inputMode="numeric"
              value={draft.zipcode}
              onChange={(event) => patch({ zipcode: event.target.value })}
              data-testid="branch-zipcode"
            />
          </label>
        </div>
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Localização no mapa</h2>

        {/* Coordenada errada ou faltando é frete errado para todo mundo — o
            cálculo de rota parte daqui. */}
        {missingCoordinates ? (
          <p className="alert alert--warn store-form__warn" data-testid="branch-missing-coords">
            Sem latitude e longitude, a distância até o cliente é medida a partir do lugar errado e
            o frete sai errado em todos os pedidos desta filial.
          </p>
        ) : null}

        <div className="store-form__grid">
          <label className="field">
            <span className="field__label">Latitude</span>
            <input
              className="input mono"
              inputMode="decimal"
              placeholder="-3.731862"
              value={draft.latitude}
              onChange={(event) => patch({ latitude: event.target.value })}
              data-testid="branch-latitude"
            />
          </label>

          <label className="field">
            <span className="field__label">Longitude</span>
            <input
              className="input mono"
              inputMode="decimal"
              placeholder="-38.526669"
              value={draft.longitude}
              onChange={(event) => patch({ longitude: event.target.value })}
              data-testid="branch-longitude"
            />
          </label>
        </div>
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
