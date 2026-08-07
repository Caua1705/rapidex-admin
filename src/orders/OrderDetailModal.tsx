import { useEffect, useState } from 'react';

import { fetchOrderDetail } from '../api/orders';
import { messageFromUnknownError } from '../api/errors';
import type { OrderDetail } from '../api/types';
import { Modal } from '../ui/Modal';
import {
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  labelFor,
} from './format';
import {
  STATUS_LABELS,
  checkTransition,
  isAwaitingOnlinePayment,
  nextStatusesFor,
} from './order-status';
import './OrderDetailModal.css';

/** Endereço em uma linha só, pulando o que veio vazio. */
function formatAddress(detail: OrderDetail): string {
  const line = [
    [detail.address_street, detail.address_number].filter(Boolean).join(', '),
    detail.address_complement,
    detail.address_neighborhood,
    [detail.address_city, detail.address_state].filter(Boolean).join('/'),
    detail.address_zipcode,
  ]
    .filter((part) => part && String(part).trim() !== '')
    .join(' · ');
  return line || '—';
}

export function OrderDetailModal({
  orderId,
  onClose,
  onChangeStatus,
  actionErrorMessage,
}: {
  orderId: string;
  onClose: () => void;
  /** Devolve true quando o backend aceitou a transição. */
  onChangeStatus: (orderId: string, status: string) => Promise<boolean>;
  actionErrorMessage: string | null;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  // Muda de valor para forçar o recarregamento do detalhe após uma transição.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);

    void (async () => {
      try {
        const loaded = await fetchOrderDetail(orderId);
        if (!cancelled) setDetail(loaded);
      } catch (error) {
        if (!cancelled) setLoadError(messageFromUnknownError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken]);

  async function handleChangeStatus(status: string) {
    setPendingStatus(status);
    const changed = await onChangeStatus(orderId, status);
    setPendingStatus(null);
    if (changed) {
      // Recarrega o detalhe para trazer o histórico com a linha nova. A lista
      // do quadro já foi atualizada por quem tratou a chamada.
      setReloadToken((token) => token + 1);
    }
  }

  const title = detail ? (
    <span>
      <span className="mono">#{detail.order_number}</span>{' '}
      <span className="muted">
        · {STATUS_LABELS[detail.status] ?? detail.status} ·{' '}
        {labelFor(ORDER_TYPE_LABELS, detail.order_type)}
      </span>
    </span>
  ) : (
    'Pedido'
  );

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        detail ? (
          <>
            {nextStatusesFor(detail.status).map((target) => {
              const check = checkTransition(detail, target);
              return (
                <button
                  key={target}
                  type="button"
                  className={`btn btn--sm ${
                    target === 'cancelled' || target === 'rejected' ? 'btn--danger' : 'btn--primary'
                  }`}
                  disabled={!check.allowed || pendingStatus !== null}
                  // O título explica POR QUE o botão está travado. Sem isso o
                  // lojista clica, nada acontece e ele acha que a tela travou.
                  title={check.allowed ? undefined : check.reason}
                  onClick={() => void handleChangeStatus(target)}
                  data-testid={`change-status-${target}`}
                >
                  {pendingStatus === target ? 'Enviando…' : (STATUS_LABELS[target] ?? target)}
                </button>
              );
            })}
            {nextStatusesFor(detail.status).length === 0 ? (
              <span className="faint">Estado final: este pedido não muda mais.</span>
            ) : null}
          </>
        ) : null
      }
    >
      {loadError ? (
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {actionErrorMessage ? (
        <p className="alert alert--error" role="alert" data-testid="status-error">
          {actionErrorMessage}
        </p>
      ) : null}

      {!detail && !loadError ? <p className="muted">Carregando…</p> : null}

      {detail ? (
        <div className="detail">
          {isAwaitingOnlinePayment(detail.payment_status) ? (
            <p className="alert alert--warn">
              Pagamento online ainda não confirmado (
              {labelFor(PAYMENT_STATUS_LABELS, detail.payment_status)}). A cozinha não pode preparar
              este pedido.
            </p>
          ) : null}

          <section className="detail__block">
            <h3 className="detail__heading">Cliente</h3>
            <div className="detail__row">
              <span>{detail.customer_name_snapshot}</span>
              <span className="mono">{detail.customer_phone_snapshot}</span>
            </div>
          </section>

          <section className="detail__block">
            <h3 className="detail__heading">
              {detail.order_type === 'delivery' ? 'Endereço de entrega' : 'Retirada no balcão'}
            </h3>
            {detail.order_type === 'delivery' ? (
              <>
                <div>{formatAddress(detail)}</div>
                {detail.address_reference ? (
                  <div className="muted">Referência: {detail.address_reference}</div>
                ) : null}
                {detail.delivery_distance_km != null ? (
                  <div className="faint">
                    {detail.delivery_distance_km.toFixed(1)} km
                    {detail.delivery_eta_min != null && detail.delivery_eta_max != null
                      ? ` · previsão ${detail.delivery_eta_min}–${detail.delivery_eta_max} min`
                      : ''}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="muted">O cliente retira na loja.</div>
            )}
          </section>

          <section className="detail__block">
            <h3 className="detail__heading">Itens</h3>
            <table className="detail__items">
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td className="mono detail__qty">{item.quantity}×</td>
                    <td>
                      {item.product_name_snapshot}
                      {item.observation ? (
                        <div className="detail__observation">Obs.: {item.observation}</div>
                      ) : null}
                    </td>
                    <td className="mono detail__price">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/*
              Os adicionais escolhidos existem no banco (order_item_options),
              mas OrderItemResponse não os devolve — então não há como
              mostrá-los aqui. O valor deles já está somado no total do item.
            */}
            <p className="faint detail__note">
              Os adicionais não vêm no contrato atual de{' '}
              <code>GET /admin/orders/&#123;id&#125;</code>; o valor deles já está incluído no total
              de cada item.
            </p>
          </section>

          {detail.notes ? (
            <section className="detail__block">
              <h3 className="detail__heading">Observação do pedido</h3>
              <p className="detail__notes">{detail.notes}</p>
            </section>
          ) : null}

          <section className="detail__block">
            <h3 className="detail__heading">Pagamento</h3>
            <div className="detail__row">
              <span>Forma</span>
              <span>{labelFor(PAYMENT_METHOD_LABELS, detail.payment_method)}</span>
            </div>
            <div className="detail__row">
              <span>Situação</span>
              <span>{labelFor(PAYMENT_STATUS_LABELS, detail.payment_status)}</span>
            </div>
            {detail.paid_at ? (
              <div className="detail__row">
                <span>Pago em</span>
                <span>{formatDateTime(detail.paid_at)}</span>
              </div>
            ) : null}
            <div className="detail__row">
              <span>Subtotal</span>
              <span className="mono">{formatCurrency(detail.subtotal)}</span>
            </div>
            <div className="detail__row">
              <span>Taxa de entrega</span>
              <span className="mono">{formatCurrency(detail.delivery_fee)}</span>
            </div>
            <div className="detail__row">
              <span>Taxa de serviço</span>
              <span className="mono">{formatCurrency(detail.service_fee)}</span>
            </div>
            {detail.coupon_code ? (
              <div className="detail__row">
                <span>Cupom {detail.coupon_code}</span>
                <span className="mono">−{formatCurrency(detail.coupon_discount_amount)}</span>
              </div>
            ) : null}
            <div className="detail__row detail__row--total">
              <span>Total</span>
              <span className="mono">{formatCurrency(detail.total)}</span>
            </div>
          </section>

          <section className="detail__block">
            <h3 className="detail__heading">Histórico</h3>
            <ul className="detail__history">
              {detail.status_history.map((entry) => (
                <li key={entry.id}>
                  <span className="faint mono">{formatDateTime(entry.created_at)}</span>{' '}
                  <strong>{STATUS_LABELS[entry.status] ?? entry.status}</strong>
                  {entry.changed_by ? <span className="muted"> · {entry.changed_by}</span> : null}
                  {entry.note ? <span className="muted"> · {entry.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
