import { useState } from 'react';

import { Modal } from '../ui/Modal';
import { CANCEL_REASON_MAX, checkCancelReason } from './cancel-reason';
import { tituloDaConfirmacao, type CancelConfirmation } from './cancel-confirmation';

/**
 * Confirmação do cancelamento, com o motivo — e, quando a comida já foi feita,
 * um SEGUNDO passo.
 *
 * Cancelar é a única ação da tela que apaga trabalho já feito e não tem
 * desfazer — por isso ela passa por uma confirmação, e a confirmação não é um
 * "tem certeza?" vazio: o que ela pede é o dado que faltaria depois. Sem o
 * motivo gravado, ninguém consegue dizer, no dia seguinte, se foi o cliente
 * que desistiu ou a cozinha que não deu conta.
 *
 * ============================================================================
 * O SEGUNDO PASSO, E POR QUE ELE É ESTE DIÁLOGO E NÃO OUTRO
 * ============================================================================
 *
 * A partir de `preparing`, o backend responde 428 pedindo confirmação
 * explícita de que o lojista sabe que a comida já foi feita. Isso poderia ser
 * um segundo diálogo por cima deste. Não é, por três motivos:
 *
 *   1. O MOTIVO JÁ FOI ESCRITO. Um diálogo novo ou o descartaria (e o lojista
 *      digitaria de novo, no meio do movimento) ou o carregaria escondido —
 *      confirmar sem ver o que se está confirmando.
 *   2. NO CELULAR ESTE DIÁLOGO É A TELA. Um modal sobre o modal empilharia
 *      duas armadilhas de foco e deixaria dois "fechar" na mesma tela, com
 *      efeitos diferentes.
 *   3. É A MESMA PERGUNTA, MAIS CARA. O passo dois não muda de assunto: ele
 *      diz quanto custa a resposta que o lojista já deu.
 *
 * O texto do aviso é o que o BACKEND mandou (`confirmation.message`), e não uma
 * frase nossa: é ele que sabe o que o cancelamento custa, e essa regra muda lá
 * sem o painel ser reimplantado. O que o painel escreve é só o título, que é a
 * única coisa que o backend não tem como saber — ver `tituloDaConfirmacao`.
 */
export function CancelOrderDialog({
  orderNumber,
  isSending,
  errorMessage,
  confirmation,
  onClose,
  onConfirm,
}: {
  orderNumber: number;
  isSending: boolean;
  errorMessage: string | null;
  /**
   * O 428 que o backend devolveu, ou `null` enquanto ele não veio.
   *
   * Ele vem de FORA porque quem fala com a API é o painel: este diálogo não
   * conhece rota nenhuma, e é o que o mantém montável em teste sem servidor.
   */
  confirmation: CancelConfirmation | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);

  const check = checkCancelReason(draft);
  const showError = touched && !check.valid && check.message !== null;

  /*
   * O PASSO DOIS NÃO TEM ESTADO PRÓPRIO: ele É a existência da confirmação.
   *
   * Um `useState` espelhando `confirmation !== null` seria uma segunda verdade
   * sobre a mesma coisa, e é assim que um diálogo acaba mostrando o passo dois
   * de um pedido que já foi cancelado.
   */
  const confirmando = confirmation !== null;

  return (
    <Modal
      title={
        confirmando
          ? `${tituloDaConfirmacao(confirmation.orderStatus)} — cancelar mesmo assim?`
          : `Cancelar o pedido #${orderNumber}?`
      }
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
            data-testid={confirmando ? 'confirm-cancel-prepared' : 'confirm-cancel'}
          >
            {isSending ? 'Cancelando…' : confirmando ? 'Cancelar mesmo assim' : 'Cancelar pedido'}
          </button>
        </>
      }
    >
      <div className="saida">
        {confirmando ? (
          /*
           * `role="alert"` e não um parágrafo comum: no leitor de tela, o
           * diálogo já estava aberto quando este texto nasceu, e sem o anúncio
           * a única pista de que a pergunta MUDOU seria o título — que não é
           * relido. O botão embaixo diz "Cancelar mesmo assim"; ouvir só isso,
           * sem o porquê, é confirmar às cegas.
           */
          <p className="alert alert--warn" role="alert" data-testid="cancel-confirmation">
            {confirmation.message}
          </p>
        ) : (
          <p className="saida__aviso">Esta ação não pode ser desfeita.</p>
        )}

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
            /*
             * NO PASSO DOIS O MOTIVO CONTINUA EDITÁVEL, e de propósito: é
             * comum o lojista escrever "cliente desistiu" e, ao ler que a
             * comida já saiu, querer acrescentar "já estava na rua". Travar o
             * campo o obrigaria a cancelar o diálogo e recomeçar.
             */
          />
        </label>

        <div className="saida__meta">
          {showError ? (
            <span className="saida__erro">{check.message}</span>
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
