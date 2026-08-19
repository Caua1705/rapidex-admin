import { useEffect, useState, type ReactNode } from 'react';

import { formatCurrency } from '../orders/format';
import {
  bodyFromDraft,
  draftFromOverrides,
  EMPTY_DRAFT,
  type OverridesDraft,
} from './branch-overrides';
import { SaveBar } from './SaveBar';
import type { useBranchOperation } from './useBranchOperation';
import type { useStoreSettings } from './useStoreSettings';

/**
 * OS NÚMEROS COMERCIAIS DESTA FILIAL — e o que ela herda do restaurante.
 *
 * Regime diferente do estado do dia: abrir/fechar é sempre da filial, sem
 * herança, enquanto mínimo, prazo, taxa de serviço e contingência têm padrão do
 * restaurante e a filial só o sobrescreve quando precisa divergir. Com nove
 * campos por loja e nenhuma herança, abrir a quinta loja custaria 45 valores
 * digitados; com o padrão, ela nasce com os seis preços certos.
 *
 * POR QUE ELA NÃO ESTÁ EM OPERAÇÃO. Operação é o estado do dia: lista densa,
 * escaneada no meio do turno, uma linha por filial. Estes valores se encostam
 * uma vez por mês, são um formulário, e cada campo carrega uma herança para
 * explicar. Numa linha expansível, a lista rápida vira acordeão e o formulário
 * fica espremido numa largura que não é dele.
 *
 * CAMPO VAZIO SIGNIFICA "HERDANDO", NUNCA ZERO. A ajuda de cada campo diz o
 * padrão do restaurante por extenso — mostrar zero afirmaria que a loja não
 * cobra taxa de serviço quando ela cobra a da rede. E o campo vazio só vira
 * `null` no corpo quando o lojista APAGOU um valor que existia; ver
 * `branch-overrides.ts`, que é onde essa regra mora.
 */
export function BranchValuesTab({
  branchId,
  operation,
  settings,
}: {
  branchId: string;
  operation: ReturnType<typeof useBranchOperation>;
  settings: ReturnType<typeof useStoreSettings>;
}) {
  const [draft, setDraft] = useState<OverridesDraft>(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState<OverridesDraft>(EMPTY_DRAFT);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const linha = operation.branchOf(branchId);
  const padrao = settings.settings;
  const gravado = linha?.overrides ?? null;

  useEffect(() => {
    if (!gravado) return;
    const next = draftFromOverrides(gravado);
    setDraft(next);
    setBaseline(next);
  }, [gravado]);

  if (operation.isLoading || settings.isLoading)
    return <p className="muted store__loading">Carregando os valores…</p>;

  if (!linha || !gravado || !padrao)
    return (
      <p className="alert alert--error" role="alert">
        {operation.loadError ?? settings.errorMessage ?? 'Não consegui ler os valores da filial.'}
      </p>
    );

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function patch(change: Partial<OverridesDraft>) {
    setDraft((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  async function handleSave() {
    if (!gravado || !padrao) return;

    const resultado = bodyFromDraft(draft, gravado, padrao);
    if (!resultado.ok) return setProblem(resultado.message);

    /*
     * NADA MUDOU, NADA SAI. Um corpo vazio não é um PATCH inofensivo: é uma
     * chamada que não pede nada, e o backend responderia a linha de volta como
     * se algo tivesse acontecido.
     */
    if (resultado.vazio) {
      setBaseline(draft);
      return;
    }

    if (await operation.saveSettings(branchId, resultado.body)) {
      setBaseline(draft);
      setSavedAt(Date.now());
    }
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
        <h2 className="store-form__heading">Pedido</h2>

        <div className="store-form__grid">
          <Campo
            rotulo="Valor mínimo do pedido"
            proprio={gravado.min_order_value != null}
            padrao={formatCurrency(padrao.min_order_value)}
          >
            <input
              className="input tnum"
              inputMode="decimal"
              value={draft.minOrderValue}
              onChange={(event) => patch({ minOrderValue: event.target.value })}
              data-testid="branch-min-order"
            />
          </Campo>

          {/*
            Mínimo e máximo são UM campo: eles formam uma faixa, sempre são
            editados juntos, e o backend os valida em par sobre a MESCLA com o
            que já está gravado — sobrescrever só um lado é legítimo.
          */}
          <Campo
            rotulo="Tempo estimado (min)"
            proprio={
              gravado.estimated_delivery_time_min != null ||
              gravado.estimated_delivery_time_max != null
            }
            padrao={`${padrao.estimated_delivery_time_min ?? '—'} a ${
              padrao.estimated_delivery_time_max ?? '—'
            } min`}
          >
            <div className="field__pair">
              <input
                className="input tnum"
                inputMode="numeric"
                aria-label="Tempo estimado mínimo desta filial, em minutos"
                value={draft.estimatedMin}
                onChange={(event) => patch({ estimatedMin: event.target.value })}
                data-testid="branch-eta-min"
              />
              <span className="field__pair-sep" aria-hidden="true">
                a
              </span>
              <input
                className="input tnum"
                inputMode="numeric"
                aria-label="Tempo estimado máximo desta filial, em minutos"
                value={draft.estimatedMax}
                onChange={(event) => patch({ estimatedMax: event.target.value })}
                data-testid="branch-eta-max"
              />
            </div>
          </Campo>
        </div>
      </section>

      <section className="store-form__section">
        <h2 className="store-form__heading">Taxa de serviço</h2>

        {/*
          TRÊS OPÇÕES, PORQUE O CAMPO TEM TRÊS ESTADOS. Uma caixa de marcar só
          sabe dizer sim e não, e aqui "não cobrar" é uma escolha desta loja —
          diferente de herdar, que segue o que a rede decidir depois. Com duas
          opções, desligar a taxa e herdá-la ficariam indistinguíveis, e o
          lojista não teria como voltar atrás.
        */}
        <div className="store-form__row">
          <div className="field">
            <span className="field__label">Como esta filial cobra</span>
            <div className="seg" role="group" aria-label="Taxa de serviço desta filial">
              {(
                [
                  { value: 'herda', label: 'Herdar' },
                  { value: 'cobra', label: 'Cobrar' },
                  { value: 'nao-cobra', label: 'Não cobrar' },
                ] as const
              ).map((opcao) => (
                <button
                  key={opcao.value}
                  type="button"
                  className="seg__opt"
                  aria-pressed={draft.serviceFee === opcao.value}
                  onClick={() => patch({ serviceFee: opcao.value })}
                  data-testid={`branch-service-fee-${opcao.value}`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
            <span className="field__hint">{ajudaDaTaxa(draft.serviceFee, padrao)}</span>
          </div>

          <Campo
            rotulo="Valor da taxa"
            classeExtra="store-form__narrow"
            proprio={gravado.service_fee_amount != null}
            padrao={formatCurrency(padrao.service_fee_amount)}
          >
            <input
              className="input tnum"
              inputMode="decimal"
              value={draft.serviceFeeAmount}
              disabled={draft.serviceFee === 'nao-cobra'}
              onChange={(event) => patch({ serviceFeeAmount: event.target.value })}
              data-testid="branch-service-fee-amount"
            />
          </Campo>
        </div>
      </section>

      <section className="store-form__section">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Taxa de contingência</h2>
          <span className="faint">
            Só entra quando o cálculo por km não pode ser feito. Zero desliga a contingência — não é
            frete grátis.
          </span>
        </div>

        {/*
          ELA NÃO É O FRETE: o frete sai das regras por km da seção Entrega.
          Esta só entra quando o cálculo por km não pode ser feito — e zero
          desliga a contingência, não significa frete grátis. É o oposto de
          `default_delivery_fee` em Geral, que a tela esconde de propósito:
          ali ele é o padrão da rede e ninguém o edita loja a loja.
        */}
        <div className="store-form__grid">
          <Campo
            rotulo="Valor da taxa"
            classeExtra="store-form__narrow"
            proprio={gravado.default_delivery_fee != null}
            padrao={formatCurrency(padrao.default_delivery_fee ?? 0)}
          >
            <input
              className="input tnum"
              inputMode="decimal"
              value={draft.defaultDeliveryFee}
              onChange={(event) => patch({ defaultDeliveryFee: event.target.value })}
              data-testid="branch-default-delivery-fee"
            />
          </Campo>
        </div>
      </section>

      <SaveBar
        isSaving={operation.isSaving(branchId, 'settings')}
        isDirty={isDirty}
        savedAt={savedAt}
        errorMessage={problem ?? operation.errorFor(branchId)}
        onSave={() => void handleSave()}
        onReset={() => {
          setDraft(baseline);
          setProblem(null);
        }}
      />
    </form>
  );
}

/** O que a filial segue enquanto herda — e o que ela escolheu, quando escolheu. */
function ajudaDaTaxa(
  escolha: OverridesDraft['serviceFee'],
  padrao: { service_fee_enabled: boolean | null; service_fee_amount: number },
): string {
  if (escolha !== 'herda')
    return 'Escolha desta filial. Volte para “Herdar” para seguir o restaurante de novo.';

  return padrao.service_fee_enabled === false
    ? 'Herdando o restaurante, que não cobra taxa de serviço.'
    : `Herdando o restaurante, que cobra ${formatCurrency(padrao.service_fee_amount)}.`;
}

/**
 * Um campo com a herança escrita ao lado.
 *
 * A ETIQUETA MARCA O QUE É PRÓPRIO, não o que é herdado. Herdar é o estado em
 * que toda filial nasce e em que a maioria dos campos fica; uma etiqueta
 * "herdando" em quatro de quatro campos seria a palavra que se repete sem
 * distinguir nada (§8 do design). O que distingue é a divergência.
 *
 * A ajuda diz o padrão do restaurante nos dois casos, e o texto muda de
 * trabalho: herdando, ele é o valor que está valendo; próprio, ele é o valor
 * que volta a valer se o campo for apagado.
 */
function Campo({
  rotulo,
  proprio,
  padrao,
  classeExtra = '',
  children,
}: {
  rotulo: string;
  proprio: boolean;
  padrao: string;
  classeExtra?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${classeExtra}`.trim()}>
      <span className="field__label">
        {rotulo}
        {proprio ? (
          <span className="tag store-form__tag" data-testid="tag-proprio">
            própria desta filial
          </span>
        ) : null}
      </span>
      {children}
      <span className="field__hint">
        {proprio
          ? `Padrão do restaurante: ${padrao}. Apague o campo para voltar a herdar.`
          : `Herdando o padrão do restaurante: ${padrao}.`}
      </span>
    </label>
  );
}
