import { useState } from 'react';

import { Modal } from '../ui/Modal';
import { CANCEL_REASON_MAX, checkCancelReason } from './cancel-reason';

/**
 * Confirmação do cancelamento, com o motivo.
 *
 * Cancelar é a única ação da tela que apaga trabalho já feito e não tem
 * desfazer — por isso ela passa por uma confirmação, e a confirmação não é um
 * "tem certeza?" vazio: o que ela pede é o dado que faltaria depois. Sem o
 * motivo gravado, ninguém consegue dizer, no dia seguinte, se foi o cliente
 * que desistiu ou a cozinha que não deu conta.
 *
 * O texto é direto e sem eufemismo, como o resto do painel.
 */
export function CancelOrderDialog({
  orderNumber,
  isSending,
  errorMessage,
  onClose,
  onConfirm,
}: {
  orderNumber: number;
  isSending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);

  const check = checkCancelReason(draft);
  const showError = touched && !check.valid && check.message !== null;

  return (
    <Modal
      title={`Cancelar o pedido #${orderNumber}?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSending}>
            Manter o pedido
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!check.valid || isSending}
            onClick={() => check.valid && onConfirm(check.reason)}
            data-testid="confirm-cancel"
          >
            {isSending ? 'Cancelando…' : 'Cancelar pedido'}
          </button>
        </>
      }
    >
      <div className="cancel">
        <p className="cancel__warning">Esta ação não pode ser desfeita.</p>

        {errorMessage ? (
          <p className="alert alert--error" role="alert" data-testid="cancel-error">
            {errorMessage}
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">Motivo do cancelamento</span>
          <textarea
            className="textarea"
            autoFocus
            maxLength={CANCEL_REASON_MAX}
            placeholder="Ex.: Cliente desistiu por telefone."
            value={draft}
            aria-invalid={showError}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => setTouched(true)}
          />
        </label>

        <div className="cancel__meta">
          {showError ? (
            <span className="cancel__error">{check.message}</span>
          ) : (
            <span className="faint">Fica gravado no histórico do pedido.</span>
          )}
          <span className="faint">
            {draft.trim().length}/{CANCEL_REASON_MAX}
          </span>
        </div>
      </div>
    </Modal>
  );
}
