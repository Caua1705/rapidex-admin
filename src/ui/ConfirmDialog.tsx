import type { ReactNode } from 'react';

import { Modal } from './Modal';

/**
 * A confirmação de uma ação que não tem desfazer e não pede nada em troca.
 *
 * ============================================================================
 * POR QUE ELE É GENÉRICO E OS DO PEDIDO NÃO SÃO
 * ============================================================================
 *
 * `CancelOrderDialog` e `RejectOrderDialog` não usam este componente, e isso é
 * de propósito: **eles não perguntam, eles COLHEM.** O que aqueles dois pedem é
 * o motivo — o dado que faltaria depois, e sem o qual ninguém consegue dizer no
 * dia seguinte se foi o cliente que desistiu ou a cozinha que não deu conta. Um
 * campo de texto com validação própria não cabe num "tem certeza?".
 *
 * Aqui não há dado a colher. As duas ações que este diálogo guarda são
 * pequenas, raras e definitivas, e o que falta nelas é só o segundo de pausa
 * entre o dedo e a consequência.
 *
 * ============================================================================
 * O CORPO É OBRIGATÓRIO, E É O PONTO
 * ============================================================================
 *
 * `children` não é opcional. Um diálogo que só diz "Tem certeza?" com Sim e Não
 * não protege ninguém: ele vira o gesto de dois cliques que a pessoa aprende a
 * fazer sem ler, e aí ele custa um clique e não previne nada. O que faz a
 * confirmação valer é a frase que diz **o que vai acontecer** e **o que fazer
 * em vez disso**, quando existe uma alternativa reversível.
 *
 * ============================================================================
 * O BOTÃO DIZ O VERBO, NÃO "CONFIRMAR"
 * ============================================================================
 *
 * Mesma regra do rodapé do pedido: "Confirmar" ao lado de "Cancelar" é a pior
 * dupla possível numa tela em português, porque "Cancelar" tanto pode ser
 * fechar o diálogo quanto cancelar a coisa. Quem chama passa o verbo
 * (`confirmLabel`), e a saída se chama pelo que ela preserva.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  sendingLabel,
  cancelLabel = 'Manter como está',
  isSending,
  errorMessage,
  onClose,
  onConfirm,
  'data-testid': testId,
}: {
  /** A pergunta, com o objeto dela nomeado: "Excluir a forma Pix?". */
  title: string;
  /** O que vai acontecer, e a alternativa reversível quando ela existe. */
  children: ReactNode;
  /** O verbo da ação. Nunca "Confirmar". */
  confirmLabel: string;
  sendingLabel: string;
  /** O que a saída preserva. Nunca só "Cancelar" — ver o bloco acima. */
  cancelLabel?: string;
  isSending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
  'data-testid'?: string;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={isSending}
            onClick={onConfirm}
            data-testid={testId ? `${testId}-confirmar` : undefined}
          >
            {isSending ? sendingLabel : confirmLabel}
          </button>
        </>
      }
    >
      <div className="saida" data-testid={testId}>
        <p className="saida__aviso">Esta ação não pode ser desfeita.</p>

        {/*
          O ERRO FICA DENTRO, e o diálogo NÃO fecha com ele: recusada a ação, a
          pessoa precisa ler o que aconteceu antes de sair. É a mesma regra do
          cancelamento do pedido.
        */}
        {errorMessage ? (
          <p className="alert alert--error" role="alert" data-testid={`${testId}-erro`}>
            {errorMessage}
          </p>
        ) : null}

        {children}
      </div>
    </Modal>
  );
}
