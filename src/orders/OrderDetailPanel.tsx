import { useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchOrderDetail } from '../api/orders';
import type { OrderDetail, OrderItem } from '../api/types';
import { XIcon } from '../ds/icons';
import { CancelOrderDialog } from './CancelOrderDialog';
import {
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  labelFor,
} from './format';
import { readOptionGroups } from './order-options';
import { stageOf } from './order-status';
import {
  STATUS_LABELS,
  checkTransition,
  isAwaitingOnlinePayment,
  nextStatusesFor,
} from './order-status';
import './OrderDetailPanel.css';

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

/**
 * Detalhe do pedido, fixo à direita do quadro.
 *
 * Painel e não janela: com a janela aberta, o quadro sumia atrás dela, e é o
 * quadro que diz o que fazer em seguida. Aqui o lojista lê o pedido com as
 * colunas à vista e, clicando em outro card, o conteúdo troca sem fechar nada.
 */
export function OrderDetailPanel({
  orderId,
  onClose,
  onChangeStatus,
  onCancelOrder,
  actionErrorMessage,
}: {
  orderId: string | null;
  onClose: () => void;
  /** Devolve true quando o backend aceitou a transição. */
  onChangeStatus: (orderId: string, status: string) => Promise<boolean>;
  /** Devolve true quando o backend aceitou o cancelamento. */
  onCancelOrder: (orderId: string, reason: string) => Promise<boolean>;
  actionErrorMessage: string | null;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [askingCancel, setAskingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Muda de valor para forçar o recarregamento do detalhe após uma transição.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setDetail(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    setAskingCancel(false);

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
    if (!orderId) return;
    setPendingStatus(status);
    const changed = await onChangeStatus(orderId, status);
    setPendingStatus(null);
    if (changed) setReloadToken((token) => token + 1);
  }

  async function handleCancel(reason: string) {
    if (!orderId) return;
    setIsCancelling(true);
    const cancelled = await onCancelOrder(orderId, reason);
    setIsCancelling(false);
    if (cancelled) {
      setAskingCancel(false);
      setReloadToken((token) => token + 1);
    }
  }

  /*
   * O PAINEL É UMA COLUNA PERMANENTE, e não mais uma gaveta que aparece.
   *
   * Ele já foi montado só com pedido aberto, e o argumento era bom: 380px de
   * largura fixa para dizer "nenhum pedido aberto" é um quarto da tela gasto
   * com ausência de informação. O que derrubou esse argumento foi o quadro
   * parar de rolar de lado — sem a rolagem, a largura que o painel toma vira
   * uma coluna a menos na grade, e não pedido escondido.
   *
   * O que se ganha é maior: a coluna não muda de lugar ao abrir e ao fechar um
   * pedido. Com a gaveta, cada clique reflowava o quadro inteiro e o cartão que
   * a pessoa ia clicar em seguida trocava de posição embaixo do ponteiro.
   *
   * ABAIXO DE 1280px ELA NÃO É PERMANENTE: não há largura para dividir a tela
   * em duas. Lá o painel volta a existir só com pedido aberto, e flutua sobre o
   * quadro (ver `.panel--flutuante` no CSS) — deixá-lo simplesmente sumir
   * tiraria o único caminho para mudar o status num laptop de 1200px.
   */
  const vazio = orderId === null;

  return (
    <aside
      className={`panel${vazio ? ' panel--vazio' : ''}`}
      aria-label="Detalhe do pedido"
      data-testid="order-panel"
    >
      <header className="panel__header">
        <div className="panel__title">
          {detail ? (
            <>
              <span className="tnum panel__number">#{detail.order_number}</span>
              <span className={`panel__status is-${stageOf(detail.status)}`}>
                {STATUS_LABELS[detail.status] ?? detail.status}
              </span>
              <span className="faint">{labelFor(ORDER_TYPE_LABELS, detail.order_type)}</span>
            </>
          ) : (
            <span className="t-label">Pedido</span>
          )}
        </div>
        {/* Sem pedido aberto não há o que fechar: o botão sairia mentindo. */}
        {vazio ? null : (
          <button
            type="button"
            className="btn btn--sm icon-btn"
            onClick={onClose}
            aria-label="Fechar detalhe"
            title="Fechar detalhe"
          >
            <XIcon size={14} />
          </button>
        )}
      </header>

      <div className="panel__body">
        {/*
          O ESTADO VAZIO EXPLICA O QUE A COLUNA FAZ. Uma faixa de 380px em
          branco não é discrição — é uma pergunta sem resposta no meio da tela.
          Aqui ela cabe porque a coluna é permanente: a frase é lida uma vez, no
          começo do turno, e some no primeiro clique.
        */}
        {vazio ? (
          <p className="panel__vazio">
            Clique num pedido para ver os itens, o endereço e o pagamento — e para mudar o status.
          </p>
        ) : null}

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

        {!detail && !loadError && !vazio ? <p className="muted">Carregando…</p> : null}

        {detail ? <DetailBody detail={detail} /> : null}
      </div>

      {detail ? (
        <footer className="panel__footer">
          {nextStatusesFor(detail.status).map((target) => {
            const check = checkTransition(detail, target);
            const isCancel = target === 'cancelled';
            return (
              <button
                key={target}
                type="button"
                className={`btn btn--sm ${
                  isCancel || target === 'rejected' ? 'btn--danger' : 'btn--primary'
                }`}
                disabled={!check.allowed || pendingStatus !== null}
                // O título explica POR QUE o botão está travado. Sem isso o
                // lojista clica, nada acontece e ele acha que a tela travou.
                title={check.allowed ? undefined : check.reason}
                // Cancelar não sai daqui direto: o motivo é obrigatório, e
                // quem o pede é o diálogo.
                onClick={() => (isCancel ? setAskingCancel(true) : void handleChangeStatus(target))}
                data-testid={`change-status-${target}`}
              >
                {pendingStatus === target ? 'Enviando…' : (STATUS_LABELS[target] ?? target)}
              </button>
            );
          })}
          {nextStatusesFor(detail.status).length === 0 ? (
            <span className="faint">Estado final: este pedido não muda mais.</span>
          ) : null}
        </footer>
      ) : null}

      {askingCancel && detail ? (
        <CancelOrderDialog
          orderNumber={detail.order_number}
          isSending={isCancelling}
          errorMessage={actionErrorMessage}
          onClose={() => setAskingCancel(false)}
          onConfirm={(reason) => void handleCancel(reason)}
        />
      ) : null}
    </aside>
  );
}

function DetailBody({ detail }: { detail: OrderDetail }) {
  return (
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
          <span>{detail.customer_phone_snapshot}</span>
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
        <ul className="items">
          {detail.items.map((item) => (
            <ItemLine key={item.id} item={item} />
          ))}
        </ul>
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
          <span className="num">{formatCurrency(detail.subtotal)}</span>
        </div>
        <div className="detail__row">
          <span>Taxa de entrega</span>
          <span className="num">{formatCurrency(detail.delivery_fee)}</span>
        </div>
        <div className="detail__row">
          <span>Taxa de serviço</span>
          <span className="num">{formatCurrency(detail.service_fee)}</span>
        </div>
        {detail.coupon_code ? (
          <div className="detail__row">
            <span>Cupom {detail.coupon_code}</span>
            <span className="num">−{formatCurrency(detail.coupon_discount_amount)}</span>
          </div>
        ) : null}
        <div className="detail__row detail__row--total">
          <span>Total</span>
          <span className="num">{formatCurrency(detail.total)}</span>
        </div>
      </section>

      <section className="detail__block">
        <h3 className="detail__heading">Histórico</h3>
        <ul className="detail__history">
          {detail.status_history.map((entry) => (
            <li key={entry.id}>
              <span className="faint tnum">{formatDateTime(entry.created_at)}</span>{' '}
              <strong>{STATUS_LABELS[entry.status] ?? entry.status}</strong>
              {entry.changed_by ? <span className="muted"> · {entry.changed_by}</span> : null}
              {entry.note ? <span className="muted"> · {entry.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Um item com os adicionais escolhidos.
 *
 * Os adicionais ficam RECUADOS sob o nome e separados POR GRUPO: é o grupo que
 * diz se "espaguete" é a troca do acompanhamento ou uma porção a mais. Numa
 * lista achatada, os dois viram a mesma linha e a cozinha monta o prato errado.
 *
 * O preço ao lado da opção é só conferência — `unit_price_snapshot` já o
 * inclui, então ele não entra em soma nenhuma desta tela.
 */
function ItemLine({ item }: { item: OrderItem }) {
  const groups = readOptionGroups(item);

  return (
    <li className="items__row">
      <div className="items__main">
        <span className="items__qty">{item.quantity}×</span>
        <span className="items__name">{item.product_name_snapshot}</span>
        <span className="items__price num">{formatCurrency(item.total)}</span>
      </div>

      {groups.length > 0 ? (
        <ul className="options">
          {groups.map((group) => (
            <li key={group.key} className="options__group">
              {group.label ? <span className="options__label">{group.label}</span> : null}
              <ul className="options__list">
                {group.options.map((option) => (
                  <li key={option.key} className="options__option">
                    <span>{option.label}</span>
                    {option.additionalPrice ? (
                      <span className="options__price num faint">
                        {formatCurrency(option.additionalPrice)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {item.observation ? <p className="items__observation">Obs.: {item.observation}</p> : null}
    </li>
  );
}
