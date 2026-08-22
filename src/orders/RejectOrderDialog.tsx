import { useState } from 'react';

import { Modal } from '../ui/Modal';

/**
 * O limite do motivo da recusa.
 *
 * O contrato NÃO o publica: `note` do `PATCH /admin/orders/{id}/status` é só
 * `string`. O número é o mesmo do motivo do cancelamento, escrito à mão pela
 * mesma razão que lá — não há de onde gerá-lo. Aqui ele incomoda menos, porque
 * o campo é opcional: o pior caso é o backend recusar um texto longo demais e a
 * tela mostrar a mensagem dele.
 */
export const REJECT_NOTE_MAX = 300;

/**
 * Confirmação da recusa.
 *
 * RECUSAR É TÃO IRREVERSÍVEL QUANTO CANCELAR, e não pedia confirmação nenhuma:
 * um clique no rodapé e o pedido saía do quadro. Ele fica ao lado do botão que
 * o lojista aperta cinquenta vezes por turno ("Aceitar pedido"), no rodapé de
 * um painel que no celular ocupa a tela inteira — o dedo erra o alvo e não há
 * desfazer.
 *
 * O MOTIVO É OPCIONAL, e essa é a diferença para o cancelamento. Lá ele é
 * obrigatório porque há trabalho jogado fora e alguém vai perguntar por quê;
 * aqui o pedido nem começou, e exigir três linhas de justificativa no meio do
 * almoço para dizer "acabou a costela" transformaria a confirmação em pedágio.
 * O que ele escrever vai como `note` do `PATCH /status` e entra no histórico do
 * pedido — que é onde a diferença entre "eu recusei" e "o cliente desistiu"
 * mora.
 */
export function RejectOrderDialog({
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
  /** Recebe o motivo já aparado, ou vazio quando o lojista não escreveu nada. */
  onConfirm: (note: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const excedeu = draft.trim().length > REJECT_NOTE_MAX;

  return (
    <Modal
      title={`Recusar o pedido #${orderNumber}?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSending}>
            Manter o pedido
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={isSending || excedeu}
            onClick={() => onConfirm(draft.trim())}
            data-testid="confirm-reject"
          >
            {isSending ? 'Recusando…' : 'Recusar pedido'}
          </button>
        </>
      }
    >
      <div className="saida">
        <p className="saida__aviso">Esta ação não pode ser desfeita.</p>

        {/*
          O QUE ACONTECE DEPOIS, em uma linha. "Não pode ser desfeita" diz o
          tamanho do estrago; isto diz o estrago. Sem a segunda frase, o lojista
          confirma sabendo que é grave e sem saber o que é.
        */}
        <p className="saida__consequencia">
          O pedido sai do quadro e vai para o histórico como recusado. A cozinha não recebe nada.
        </p>

        {errorMessage ? (
          <p className="alert alert--error" role="alert" data-testid="reject-error">
            {errorMessage}
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">Motivo (opcional)</span>
          <textarea
            className="textarea"
            autoFocus
            maxLength={REJECT_NOTE_MAX}
            placeholder="Ex.: Acabou a costela."
            value={draft}
            aria-invalid={excedeu}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>

        <div className="saida__meta">
          <span className="faint">Fica gravado no histórico do pedido.</span>
          <span className="faint">
            {draft.trim().length}/{REJECT_NOTE_MAX}
          </span>
        </div>
      </div>
    </Modal>
  );
}
