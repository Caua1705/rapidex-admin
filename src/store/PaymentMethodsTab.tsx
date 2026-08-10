import { useState } from 'react';

import type { PaymentFlow, PaymentMethod, PaymentMethodType } from '../api/types';
import { PAYMENT_METHOD_LABELS } from '../orders/format';
import { Switch } from '../ui/Switch';
import { PlusIcon } from '../ui/icons';
import { usePaymentMethods } from './usePaymentMethods';

const FLOW_LABELS: Record<PaymentFlow, string> = {
  online: 'Online (pelo app)',
  delivery: 'Na entrega',
};

const METHOD_TYPES: readonly PaymentMethodType[] = [
  'pix',
  'credit_card',
  'debit_card',
  'cash',
  'voucher',
  'meal_voucher',
  'other',
];

/**
 * As formas de pagamento aceitas pela filial.
 *
 * A LINHA QUE MANDA NESTA TELA: `payment_flow` e `method_type` NÃO MUDAM depois
 * de criados. Não é limitação de tela — é o contrato. Trocar o fluxo de uma
 * forma já cadastrada mudaria, no meio do expediente, como os próximos pedidos
 * daquela filial são cobrados: a mesma bandeira de cartão cobrada pelo gateway
 * ou na maquininha do entregador são dinheiros que entram por caminhos
 * diferentes. Por isso, na linha existente, os dois aparecem como TEXTO, e o
 * caminho para corrigir um cadastro errado é desabilitar e criar outro.
 *
 * A separação por fluxo também é o que o cliente vê no app: "paga agora" e
 * "paga na entrega" são momentos diferentes, não dois rótulos da mesma lista.
 */
export function PaymentMethodsTab({ branchId }: { branchId: string }) {
  const payment = usePaymentMethods(branchId);
  const [isAdding, setIsAdding] = useState(false);

  if (payment.isLoading) {
    return <p className="muted store__loading">Carregando as formas de pagamento…</p>;
  }

  const online = payment.methods.filter((method) => method.payment_flow === 'online');
  const onDelivery = payment.methods.filter((method) => method.payment_flow === 'delivery');

  return (
    <div className="store-form">
      {payment.errorMessage ? (
        <p className="alert alert--error" role="alert" data-testid="store-error">
          {payment.errorMessage}
        </p>
      ) : null}

      <section className="store-form__section">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Pagamento online</h2>
          <span className="faint">Cobrado pelo app, antes de a cozinha começar.</span>
        </div>
        <MethodList
          methods={online}
          pendingIds={payment.pendingIds}
          onToggle={(method, enabled) => void payment.update(method.id, { enabled })}
          onRemove={(method) => void payment.remove(method.id)}
        />
      </section>

      <section className="store-form__section">
        <div className="store-form__section-head">
          <h2 className="store-form__heading">Pagamento na entrega</h2>
          <span className="faint">O dinheiro entra na mão do entregador.</span>
        </div>
        <MethodList
          methods={onDelivery}
          pendingIds={payment.pendingIds}
          onToggle={(method, enabled) => void payment.update(method.id, { enabled })}
          onRemove={(method) => void payment.remove(method.id)}
        />
      </section>

      {isAdding ? (
        <NewMethodForm
          isSaving={payment.isCreating}
          onCancel={() => setIsAdding(false)}
          onCreate={async (draft) => {
            if (await payment.create(draft)) setIsAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn--primary store-form__add"
          onClick={() => setIsAdding(true)}
          data-testid="payment-add"
        >
          <PlusIcon />
          Nova forma de pagamento
        </button>
      )}
    </div>
  );
}

function MethodList({
  methods,
  pendingIds,
  onToggle,
  onRemove,
}: {
  methods: readonly PaymentMethod[];
  pendingIds: readonly string[];
  onToggle: (method: PaymentMethod, enabled: boolean) => void;
  onRemove: (method: PaymentMethod) => void;
}) {
  /**
   * O tipo, quando ele acrescenta alguma coisa ao rótulo.
   *
   * "Pix" com tipo Pix é a mesma palavra duas vezes na mesma linha. Já
   * "Maquininha da mesa" com tipo Crédito · Visa diz o que o nome escolhido
   * pelo lojista não diz.
   */
  function typeDetail(method: PaymentMethod): string {
    const type = PAYMENT_METHOD_LABELS[method.method_type] ?? method.method_type;
    const detail = method.brand ? `${type} · ${method.brand}` : type;
    return type.toLowerCase() === method.label.trim().toLowerCase() && !method.brand ? '' : detail;
  }

  if (methods.length === 0) {
    return <p className="faint store-form__hint">Nenhuma forma cadastrada neste fluxo.</p>;
  }

  return (
    <ul className="methods">
      {methods.map((method) => (
        <li
          className={`methods__row${method.enabled ? '' : ' methods__row--off'}`}
          key={method.id}
          data-testid={`payment-method-${method.id}`}
        >
          <span className="methods__label">{method.label}</span>

          {/*
            Tipo e fluxo são texto, não campo: o contrato não aceita mudá-los
            depois de criados, e um <select> travado só ensinaria o lojista a
            tentar. O caminho para corrigir é desabilitar e criar outra.

            E o tipo só aparece quando diz algo que o rótulo não diz: na maioria
            das lojas a forma se chama "Pix" e é do tipo Pix, e a linha ficava
            "Pix ... Pix". Ele existe para o caso de o lojista ter batizado a
            forma de "Maquininha da mesa" — aí saber que é crédito importa.
          */}
          <span className="methods__type faint">{typeDetail(method)}</span>

          <span className="methods__gateway faint">
            {method.requires_gateway ? 'Exige gateway' : ''}
          </span>

          <Switch
            checked={method.enabled}
            disabled={pendingIds.includes(method.id)}
            label={`${method.label}: ${method.enabled ? 'desativar' : 'ativar'}`}
            onChange={(next) => onToggle(method, next)}
          />

          <button
            type="button"
            className="btn btn--sm btn--danger"
            disabled={pendingIds.includes(method.id)}
            onClick={() => onRemove(method)}
            data-testid={`payment-remove-${method.id}`}
          >
            Excluir
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * O cadastro de uma forma nova.
 *
 * Fluxo e tipo só são escolhíveis AQUI, porque só aqui a escolha ainda não tem
 * consequência sobre pedido nenhum.
 */
function NewMethodForm({
  isSaving,
  onCancel,
  onCreate,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onCreate: (draft: {
    payment_flow: PaymentFlow;
    method_type: PaymentMethodType;
    label: string;
    brand: string | null;
    enabled: boolean;
    requires_gateway: boolean;
    sort_order: number;
  }) => void;
}) {
  const [flow, setFlow] = useState<PaymentFlow>('delivery');
  const [type, setType] = useState<PaymentMethodType>('pix');
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [requiresGateway, setRequiresGateway] = useState(false);

  const trimmedLabel = label.trim();

  return (
    <section className="store-form__section" data-testid="payment-new">
      <h2 className="store-form__heading">Nova forma de pagamento</h2>

      <p className="faint store-form__hint">
        O fluxo e o tipo não mudam depois de salvos: eles decidem como o dinheiro entra. Para
        corrigir um cadastro errado, desative a linha e crie outra.
      </p>

      <div className="store-form__grid">
        <label className="field">
          <span className="field__label">Fluxo</span>
          <select
            className="select"
            value={flow}
            onChange={(event) => setFlow(event.target.value as PaymentFlow)}
            data-testid="payment-new-flow"
          >
            {(Object.keys(FLOW_LABELS) as PaymentFlow[]).map((key) => (
              <option key={key} value={key}>
                {FLOW_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Tipo</span>
          <select
            className="select"
            value={type}
            onChange={(event) => setType(event.target.value as PaymentMethodType)}
            data-testid="payment-new-type"
          >
            {METHOD_TYPES.map((key) => (
              <option key={key} value={key}>
                {PAYMENT_METHOD_LABELS[key] ?? key}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Rótulo</span>
          <input
            className="input"
            value={label}
            placeholder="Como o cliente vê no app"
            onChange={(event) => setLabel(event.target.value)}
            data-testid="payment-new-label"
          />
        </label>

        <label className="field">
          <span className="field__label">Bandeira</span>
          <input
            className="input"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            data-testid="payment-new-brand"
          />
        </label>
      </div>

      <label className="store-form__check">
        <input
          type="checkbox"
          checked={requiresGateway}
          onChange={(event) => setRequiresGateway(event.target.checked)}
          data-testid="payment-new-gateway"
        />
        <span>Exige gateway de pagamento</span>
      </label>

      <div className="store-form__buttons">
        <button type="button" className="btn" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={trimmedLabel === '' || isSaving}
          onClick={() =>
            onCreate({
              payment_flow: flow,
              method_type: type,
              label: trimmedLabel,
              brand: brand.trim() === '' ? null : brand.trim(),
              enabled: true,
              requires_gateway: requiresGateway,
              sort_order: 0,
            })
          }
          data-testid="payment-new-save"
        >
          {isSaving ? 'Salvando…' : 'Adicionar'}
        </button>
      </div>
    </section>
  );
}
