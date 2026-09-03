import { useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { fetchOrderDetail } from '../api/orders';
import type { OrderDetail, OrderItem } from '../api/types';
import { XIcon } from '../ds/icons';
import { StatusChip } from '../ds/StatusChip';
import { customerHistoryLine, formatPhone, phoneHref } from '../customers/customer-model';
import { CancelOrderDialog } from './CancelOrderDialog';
import { EntregadorDoPedido } from '../couriers/EntregadorDoPedido';
import { ComandaDoPedido } from './ComandaDoPedido';
import { RejectOrderDialog } from './RejectOrderDialog';
import { advanceActionFor, exitActionFor, type ConfirmKind } from './order-actions';
import type { CancelConfirmation, CancelOutcome } from './cancel-confirmation';
import {
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatDateTime,
  labelFor,
} from './format';
import { readOptionGroups } from './order-options';
import { paymentOutcome, type PaymentOutcome } from './payment-outcome';
import { useCustomerHistory } from './useCustomerHistory';
import { stageOf } from './order-status';
import { STATUS_LABELS, checkTransition } from './order-status';
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
  /**
   * Devolve true quando o backend aceitou a transição.
   *
   * `note` é o motivo da RECUSA, e é opcional: `PATCH /admin/orders/{id}/status`
   * já o aceita, e é ele que grava no histórico por que o pedido não saiu. Ver
   * `RejectOrderDialog` para o porquê de aqui ele não ser obrigatório como no
   * cancelamento.
   */
  onChangeStatus: (orderId: string, status: string, note?: string) => Promise<boolean>;
  /** Devolve o desfecho do cancelamento — que tem TRÊS valores, não dois. */
  /**
   * "Cancelar" existe para este papel.
   *
   * Vem como propriedade, e não de `usePermissoes()` aqui dentro, pelo mesmo
   * motivo de `catalogPairing` em `ProductDialog`: este painel é montado em
   * teste sem provider nenhum (`OrderDetailPanel.xss.test.tsx`), e ler a sessão
   * daqui transformaria "quem é você" numa exceção na montagem.
   */
  podeCancelar: boolean;
  /**
   * O `confirm` é o SEGUNDO clique do 428, e ele nunca sai daqui sozinho: só
   * é `true` depois de o diálogo ter mostrado ao lojista a frase que o backend
   * mandou. Ver `cancel-confirmation.ts`.
   */
  onCancelOrder: (orderId: string, reason: string, confirm?: boolean) => Promise<CancelOutcome>;
  actionErrorMessage: string | null;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  /**
   * Qual confirmação está aberta. As duas saídas do pedido pedem uma, e é a
   * mesma pergunta com nomes diferentes — por isso um estado só, e não um
   * booleano por diálogo.
   */
  const [confirmando, setConfirmando] = useState<ConfirmKind | null>(null);
  const [isConfirmando, setIsConfirmando] = useState(false);
  /**
   * O 428 do cancelamento de pedido em produção, quando ele chega.
   *
   * Não nulo = o diálogo está no passo dois e o próximo envio vai com
   * `confirm_prepared_order: true`. Ele é o ÚNICO lugar onde esse `true`
   * nasce, e é o que garante que ninguém o mande sem o lojista ter lido a
   * frase.
   */
  const [confirmacaoDoPreparo, setConfirmacaoDoPreparo] = useState<CancelConfirmation | null>(null);
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
    setConfirmando(null);
    // Trocar de pedido zera a pergunta: a confirmação era sobre AQUELE pedido,
    // e mantê-la abriria o passo dois de um pedido que ninguém tentou cancelar.
    setConfirmacaoDoPreparo(null);

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

  /**
   * O cancelamento, que pode precisar de DOIS envios.
   *
   * O primeiro vai com `confirm = false`, sempre — o painel não adivinha se
   * este pedido exige confirmação, ele pergunta ao backend mandando. Se a
   * resposta for o 428, o diálogo vira o passo dois e o clique seguinte cai
   * aqui de novo, agora com a confirmação na mão.
   *
   * O DIÁLOGO NÃO FECHA no meio: fechá-lo e reabri-lo perderia o motivo já
   * escrito, e piscar duas janelas para a mesma pergunta é como se aperta o
   * botão errado no meio do movimento.
   */
  async function handleCancel(reason: string) {
    if (!orderId) return;
    setIsConfirmando(true);
    const desfecho = await onCancelOrder(orderId, reason, confirmacaoDoPreparo !== null);
    setIsConfirmando(false);

    if (desfecho.kind === 'precisa-confirmar') {
      setConfirmacaoDoPreparo(desfecho.confirmation);
      return;
    }

    if (desfecho.kind === 'cancelado') {
      setConfirmando(null);
      setConfirmacaoDoPreparo(null);
      setReloadToken((token) => token + 1);
    }
  }

  /**
   * A recusa vai pelo MESMO `PATCH /status` de sempre — o que mudou é que ela
   * passa por uma confirmação antes, e leva junto o motivo quando o lojista
   * escreve um. O diálogo só fecha se o backend aceitou: recusado por 409, o
   * lojista precisa ler o que aconteceu antes de sair.
   */
  async function handleReject(note: string) {
    if (!orderId) return;
    setIsConfirmando(true);
    setPendingStatus('rejected');
    const changed = await onChangeStatus(orderId, 'rejected', note === '' ? undefined : note);
    setIsConfirmando(false);
    setPendingStatus(null);
    if (changed) {
      setConfirmando(null);
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
   * DOIS BOTÕES, NO MÁXIMO: o avanço e a saída.
   *
   * Antes era um botão por destino da máquina de estados, todos com o mesmo
   * peso — num pedido pendente, "Aceito" em brasa entre "Recusado" e
   * "Cancelado" em vermelho. Qual dos três é o caminho normal do turno não
   * estava dito em lugar nenhum. As regras de qual é qual moram em
   * `order-actions.ts`, com o porquê de cada estágio.
   *
   * O BOTÃO DA SAÍDA SOME quando o papel não a tem (cancelar é da gerência),
   * em vez de ficar travado: a razão é quem a pessoa é, e ela não muda durante
   * o turno — um botão permanentemente cinza é um convite a insistir.
   */
  const avanco = detail ? advanceActionFor(detail) : null;
  const saida = detail ? exitActionFor(detail, podeCancelar) : null;

  /*
   * POR QUE O AVANÇO NÃO PODE SER APERTADO AGORA — e ele fica ESCRITO.
   *
   * Esta é a outra metade do defeito do botão travado: o motivo vivia só no
   * `title`, que não existe no toque. No celular, onde este painel é a tela
   * inteira, o lojista via um botão morto e nada explicando. Agora a frase fica
   * no rodapé, colada no botão que ela trava.
   */
  const trava = detail && avanco ? checkTransition(detail, avanco.target) : null;
  const motivoTravado = trava && !trava.allowed ? trava.reason : null;
  const enviando = pendingStatus !== null;

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
          {motivoTravado ? (
            <p className="panel__travado" data-testid="acao-travada">
              {motivoTravado}
            </p>
          ) : null}

          {avanco === null && saida === null ? (
            <span className="faint">Estado final: este pedido não muda mais.</span>
          ) : (
            /*
              A SAÍDA VEM PRIMEIRO E O AVANÇO POR ÚLTIMO — o rodapé alinha à
              direita, então o avanço termina na quina de baixo, que é onde o
              polegar chega no celular e onde o olho pousa no desktop. A ordem
              do documento é a mesma da leitura: o que se lê antes de decidir,
              e depois a decisão.
            */
            <div className="panel__acoes">
              {saida ? (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost-danger"
                  disabled={enviando || isConfirmando}
                  // Nenhuma das duas saídas sai daqui direto: as duas passam
                  // por confirmação, e é o diálogo que pede o motivo.
                  onClick={() => setConfirmando(saida.confirm)}
                  data-testid={`change-status-${saida.target}`}
                >
                  {saida.label}
                </button>
              ) : null}

              {avanco ? (
                <button
                  type="button"
                  className={`btn btn--sm btn--primary${motivoTravado ? ' btn--travado' : ''}`}
                  disabled={motivoTravado !== null || enviando}
                  onClick={() => void handleChangeStatus(avanco.target)}
                  data-testid={`change-status-${avanco.target}`}
                >
                  {pendingStatus === avanco.target ? avanco.sending : avanco.label}
                </button>
              ) : null}
            </div>
          )}
        </footer>
      ) : null}

      {confirmando === 'cancelar' && detail ? (
        <CancelOrderDialog
          orderNumber={detail.order_number}
          isSending={isConfirmando}
          errorMessage={actionErrorMessage}
          confirmation={confirmacaoDoPreparo}
          onClose={() => {
            setConfirmando(null);
            setConfirmacaoDoPreparo(null);
          }}
          onConfirm={(reason) => void handleCancel(reason)}
        />
      ) : null}

      {confirmando === 'recusar' && detail ? (
        <RejectOrderDialog
          orderNumber={detail.order_number}
          isSending={isConfirmando}
          errorMessage={actionErrorMessage}
          onClose={() => setConfirmando(null)}
          onConfirm={(note) => void handleReject(note)}
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

  /*
   * O DESFECHO DO PAGAMENTO, e não só o `payment_status`.
   *
   * `refunded` é o mesmo valor para o estorno e para a contestação do cliente;
   * quem separa os dois é o histórico do próprio pedido. Ver `paymentOutcome`.
   */
  const pagamento = paymentOutcome(detail);

  return (
    <div className="detail">
      <PagamentoAviso outcome={pagamento} />

      <section className="detail__block">
        <h3 className="detail__heading">Cliente</h3>
        <div className="detail__row">
          <span>{detail.customer_name_snapshot}</span>
          {/*
            O TELEFONE SAI FORMATADO, como na tela de Clientes. Ele é lido em voz
            alta para discar, e um bloco de onze dígitos corridos obriga a pessoa
            a contar com o dedo na tela — o painel era o único lugar que ainda o
            mostrava cru.

            E AGORA ELE DISCA. Este painel é a tela inteira no celular, e é aqui
            que o dono está quando precisa ligar para o cliente — endereço que
            não fecha, item que acabou. Ver `phoneHref`: o texto continua sendo
            o que se lê, o `href` é o que o aparelho entende. Sem número
            discável, volta a ser um `<span>` — link morto é pior que texto.
          */}
          <TelefoneDoCliente phone={detail.customer_phone_snapshot} />
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

      {/*
        QUEM ESTÁ LEVANDO, COLADO EM PARA ONDE. As duas metades da mesma
        pergunta do cliente que ligou — separá-las obrigaria a rolar entre a
        pergunta e a resposta no meio do telefonema.

        O bloco NÃO APARECE em retirada nem em pedido encerrado, e some inteiro:
        `not_delivery` e `order_closed` são duas das quatro recusas do
        contrato, e são as duas que a tela sabe prever olhando o próprio pedido.
      */}
      <EntregadorDoPedido
        orderId={detail.id}
        branchId={detail.branch_id}
        orderType={detail.order_type}
        status={detail.status}
      />

      <section className="detail__block">
        <h3 className="detail__heading">Itens</h3>
        <ul className="items">
          {detail.items.map((item) => (
            <ItemLine key={item.id} item={item} />
          ))}
        </ul>
      </section>

      {/*
        A COMANDA VEM LOGO DEPOIS DOS ITENS, e não no fim do painel: ela é a
        forma IMPRESSA do que está logo acima, e a adjacência é o que faz o
        lojista comparar as duas listas sem rolar entre elas. No fim, abaixo de
        Pagamento e Histórico, ela viraria uma gaveta que ninguém abre — numa
        tela cujo chamado mais frequente é justamente "a comanda não saiu".

        Ela nasce fechada e não cobra requisição nenhuma até o clique, então o
        custo de estar aqui em cima é uma linha de altura. Ver `ComandaDoPedido`.
      */}
      <ComandaDoPedido
        orderId={detail.id}
        branchId={detail.branch_id}
        paymentStatus={detail.payment_status}
      />

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
          <span>{pagamento.label}</span>
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
 * O AVISO DE PAGAMENTO NO TOPO DO PAINEL.
 *
 * São QUATRO conversas diferentes, e nenhuma delas é escrita aqui: o dinheiro
 * que voltou por decisão, o que voltou por contestação, o cartão que o
 * antifraude segurou e o pagamento que simplesmente não chegou. Todas saem de
 * `paymentOutcome`, porque a distinção entre as duas últimas é justamente a que
 * se perde quando cada componente escreve a sua (ver `payment-outcome.ts`).
 *
 * O que sobra para este componente é o que só ele sabe: em que classe do
 * primitivo cada tom se desenha.
 */
function PagamentoAviso({ outcome }: { outcome: PaymentOutcome }) {
  if (!outcome.notice) return null;

  return <p className={`alert alert--${outcome.notice.tone}`}>{outcome.notice.text}</p>;
}

/**
 * O telefone do cliente — link de discagem quando dá, texto quando não dá.
 *
 * Ele leva `.tnum`? NÃO, e é a mesma regra de `formatPhone`: telefone não é
 * número comparável descendo uma coluna. Aqui ele estava com `.tnum` por
 * engano de cópia, e a troca corrige isso de passagem.
 */
function TelefoneDoCliente({ phone }: { phone: string }) {
  const href = phoneHref(phone);
  const texto = formatPhone(phone);

  if (!href) return <span>{texto}</span>;

  return (
    <a className="detail__fone" href={href} data-testid="customer-phone-link">
      {texto}
    </a>
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
