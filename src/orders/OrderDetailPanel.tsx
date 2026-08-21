import { useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchOrderDetail } from '../api/orders';
import type { OrderDetail, OrderItem } from '../api/types';
import { XIcon } from '../ds/icons';
import { StatusChip } from '../ds/StatusChip';
import { customerHistoryLine, formatPhone } from '../customers/customer-model';
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
import { useCustomerHistory } from './useCustomerHistory';
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
 * Detalhe do pedido, fixo à direita da lista.
 *
 * Painel e não janela: com a janela aberta, a lista sumia atrás dela, e é a
 * lista que diz o que fazer em seguida. Aqui o lojista lê o pedido com as
 * colunas à vista e, clicando em outra linha, o conteúdo troca sem fechar nada.
 *
 * O CABEÇALHO DELE TEM A MESMA ALTURA DA FAIXA DA LISTA (`--topbar-h`), e é o
 * que faz as duas metades da tela lerem como uma tela só: o "#1042" nasce na
 * mesma horizontal em que nasce o "Pedidos" ao lado.
 */
export function OrderDetailPanel({
  orderId,
  branchId,
  onClose,
  onChangeStatus,
  podeCancelar,
  onCancelOrder,
  actionErrorMessage,
}: {
  orderId: string | null;
  /**
   * A filial do quadro — o mesmo recorte da lista ao lado, e pode ser vazia
   * ("todas as que eu enxergo"). Ela só serve ao histórico do cliente: os dois
   * números que o lojista vê na tela precisam responder ao mesmo recorte.
   */
  branchId: string;
  onClose: () => void;
  /** Devolve true quando o backend aceitou a transição. */
  onChangeStatus: (orderId: string, status: string) => Promise<boolean>;
  /** Devolve true quando o backend aceitou o cancelamento. */
  /**
   * "Cancelar" existe para este papel.
   *
   * Vem como propriedade, e não de `usePermissoes()` aqui dentro, pelo mesmo
   * motivo de `catalogPairing` em `ProductDialog`: este painel é montado em
   * teste sem provider nenhum (`OrderDetailPanel.xss.test.tsx`), e ler a sessão
   * daqui transformaria "quem é você" numa exceção na montagem.
   */
  podeCancelar: boolean;
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
   * Em desktop a coluna é permanente: abrir outro pedido troca só o conteúdo,
   * sem mover os tickets sob o ponteiro. Abaixo de 1280px, onde a divisão
   * esmagaria o quadro, ela só aparece com seleção e flutua; abaixo de 720px
   * vira uma folha de tela inteira.
   */
  const vazio = orderId === null;

  /*
   * OS BOTÕES QUE ESTE PAPEL PODE APERTAR.
   *
   * CANCELAR É DA GERÊNCIA E RECUSAR NÃO É, e a diferença não é de gosto: são
   * rotas diferentes. "Recusar" um pedido pendente vai por
   * `PATCH /admin/orders/{id}/status` (quem opera pode), e cancelar vai por
   * `PATCH /admin/orders/{id}/cancel`, que é rota própria e é da gerência.
   * Para quem está no balcão, isso significa poder dizer "não vou aceitar este
   * pedido" e não poder desfazer um que já entrou em produção.
   *
   * O BOTÃO SOME, não fica desabilitado. Os outros desta mesma fileira usam
   * `disabled` + `title` quando a TRANSIÇÃO não é permitida — e ali é o certo,
   * porque a razão é temporária ("o pagamento ainda não confirmou") e o botão
   * volta a funcionar sozinho. Aqui a razão é quem a pessoa é, e ela não muda
   * durante o turno: um botão permanentemente travado é um convite a insistir.
   */
  const alvos = detail
    ? nextStatusesFor(detail.status).filter((target) => target !== 'cancelled' || podeCancelar)
    : [];

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
              {/*
                O CHIP É O DO DESIGN SYSTEM, com a palavra do backend por
                cima. `rejected` e `cancelled` são o mesmo estágio visual e
                duas palavras diferentes, e aqui a diferença importa — o
                `label` do chip existe exatamente para isso, em vez de esta
                tela desenhar um segundo chip de status.
              */}
              <StatusChip
                stage={stageOf(detail.status)}
                label={STATUS_LABELS[detail.status] ?? detail.status}
                size="sm"
              />
              <span className="panel__modo">{labelFor(ORDER_TYPE_LABELS, detail.order_type)}</span>
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
        {/* Em desktop, explica a coluna permanente antes da primeira seleção. */}
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

        {detail ? <DetailBody detail={detail} branchId={branchId} /> : null}
      </div>

      {detail ? (
        <footer className="panel__footer">
          {alvos.map((target) => {
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
          {alvos.length === 0 ? (
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

function DetailBody({ detail, branchId }: { detail: OrderDetail; branchId: string }) {
  /*
   * O HISTÓRICO DO CLIENTE — "esta pessoa volta sempre?".
   *
   * Ele sai da MESMA rota da tela de Clientes, perguntada por telefone; não há
   * rota nova nem dado inventado. Ver `useCustomerHistory` para o casamento por
   * dígitos e para o motivo de o erro ser silencioso.
   */
  const historico = useCustomerHistory(detail.customer_phone_snapshot, branchId);

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
          {/*
            O TELEFONE SAI FORMATADO, como na tela de Clientes. Ele é lido em voz
            alta para discar, e um bloco de onze dígitos corridos obriga a pessoa
            a contar com o dedo na tela — o painel era o único lugar que ainda o
            mostrava cru.
          */}
          <span className="tnum">{formatPhone(detail.customer_phone_snapshot)}</span>
        </div>

        {/*
          QUEM VOLTA SEMPRE, DITO ANTES DE ACEITAR.

          A linha só aparece quando a resposta chegou e casou com este telefone.
          Enquanto carrega, e quando a leitura falha, não há linha nenhuma: é um
          dado de apoio, e um "carregando…" piscando a cada pedido aberto custa
          mais atenção do que a informação vale.
        */}
        {historico.customer ? (
          <p className="detail__cliente-historico" data-testid="customer-history">
            {customerHistoryLine(historico.customer)}
          </p>
        ) : null}
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
