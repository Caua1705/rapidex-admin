import type { CancelConfirmation } from '../api/types';
import { Modal } from '../ui/Modal';
import { CUSTO_DO_CANCELAMENTO, fraseDaProducao } from './cancel-confirmation';

/**
 * O SEGUNDO CLIQUE do cancelamento — quando a comida já foi feita.
 *
 * A partir de `preparing`, o backend responde 428 `confirmation_required` e
 * pede uma precondição que o painel satisfaz na hora. Este é o diálogo que a
 * satisfaz: confirmado, a mesma chamada sobe de novo com
 * `confirm_prepared_order: true`.
 *
 * ----------------------------------------------------------------------------
 * ELE SUBSTITUI O PRIMEIRO DIÁLOGO, NÃO SE EMPILHA SOBRE ELE
 * ----------------------------------------------------------------------------
 *
 * Dois `Modal` abertos ao mesmo tempo são dois fundos escuros, dois Esc e duas
 * armadilhas de foco disputando o mesmo teclado — e o de baixo continuaria
 * mostrando o campo de motivo que já foi preenchido, como se ainda houvesse o
 * que escrever. Quem guarda o motivo é o painel (`OrderDetailPanel`), que o
 * reenvia daqui; o lojista não redigita nada.
 *
 * ----------------------------------------------------------------------------
 * NÃO HÁ CAMPO NENHUM AQUI, E É O PONTO
 * ----------------------------------------------------------------------------
 *
 * A pergunta já foi feita e respondida na etapa anterior. Esta etapa não pede
 * um dado — pede uma DECISÃO, e a decisão precisa do que o lojista ainda não
 * sabia quando escreveu o motivo: que a comida já está pronta. Repetir o campo
 * transformaria a confirmação em pedágio, que é a mesma razão de o motivo da
 * recusa ser opcional em `RejectOrderDialog`.
 *
 * O BOTÃO DIZ O QUE VAI ACONTECER, e não "Confirmar". "Confirmar" ao lado de
 * "Manter o pedido" obriga a reler o título para saber qual é qual — e este é
 * o diálogo em que errar o alvo custa uma refeição.
 */
export function ConfirmPreparedCancelDialog({
  orderNumber,
  confirmation,
  isSending,
  errorMessage,
  onClose,
  onConfirm,
}: {
  orderNumber: number;
  /** O corpo do 428, com a `message` pronta e o `order_status` do pedido. */
  confirmation: CancelConfirmation;
  isSending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  /** Reenvia o MESMO motivo, agora com `confirm_prepared_order: true`. */
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={`Cancelar o pedido #${orderNumber} mesmo em produção?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSending}>
            Manter o pedido
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={isSending}
            onClick={onConfirm}
            data-testid="confirm-prepared-cancel"
          >
            {isSending ? 'Cancelando…' : 'Cancelar assim mesmo'}
          </button>
        </>
      }
    >
      <div className="saida">
        {/*
          O ESTÁGIO VEM PRIMEIRO, e ele é o dado novo desta etapa. "Já saiu para
          entrega" e "já está preparando" são conversas diferentes com o
          cliente, e é por isso que o backend manda `order_status` junto da
          mensagem — ver `fraseDaProducao`.
        */}
        <p className="saida__aviso" data-testid="prepared-cancel-stage">
          {fraseDaProducao(confirmation)}
        </p>

        <p className="saida__consequencia">{CUSTO_DO_CANCELAMENTO}</p>

        {errorMessage ? (
          <p className="alert alert--error" role="alert" data-testid="prepared-cancel-error">
            {errorMessage}
          </p>
        ) : null}

        {/*
          O MOTIVO JÁ ESCRITO, mostrado de volta — não é enfeite: ele é o que o
          lojista vai encontrar no histórico amanhã, e esta é a última tela em
          que ainda dá para desistir de gravá-lo.
        */}
        <p className="faint">O motivo que você escreveu vai junto para o histórico do pedido.</p>
      </div>
    </Modal>
  );
}
