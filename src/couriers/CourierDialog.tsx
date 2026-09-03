import { useId, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { NOME_MAX, type CourierDraft, type ErrosDoEntregador } from './courier-model';

const SEM_ERRO: ErrosDoEntregador = { campos: {}, geral: null };

/**
 * ============================================================================
 * CADASTRAR E EDITAR O ENTREGADOR — dois campos, e nada mais
 * ============================================================================
 *
 * "Nada mais" é a escolha do contrato e ela se defende sozinha: é o que o dono
 * sabe do motoboy, e cada campo a mais é um que ninguém preenche. Não há foto,
 * não há placa, não há documento — e não há campo de código de acesso, porque
 * o código é sorteado pelo servidor em outra rota.
 *
 * O ERRO DE TELEFONE REPETIDO APARECE NO CAMPO, e não no rodapé. É o único erro
 * de campo que esta rota devolve (409), a frase vem pronta do backend, e o que
 * a tela decide é onde pôr: um conflito no rodapé faz a pessoa reler os dois
 * campos procurando o que está errado num formulário que tem exatamente um
 * lugar possível.
 *
 * OS ERROS SÓ APARECEM DEPOIS DA PRIMEIRA TENTATIVA. Acender "escreva o nome"
 * no instante em que o diálogo abre é acusar o lojista de um campo que ele
 * ainda não teve chance de preencher.
 */
export function CourierDialog({
  initial,
  isEdicao,
  isSaving,
  onClose,
  onSave,
}: {
  initial: CourierDraft;
  /** Só muda o título e o verbo do botão: os campos são os mesmos. */
  isEdicao: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: CourierDraft) => Promise<ErrosDoEntregador | null>;
}) {
  const [draft, setDraft] = useState(initial);
  const [erros, setErros] = useState<ErrosDoEntregador>(SEM_ERRO);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();

  function editar(mudanca: Partial<CourierDraft>) {
    setDraft((atual) => ({ ...atual, ...mudanca }));
    // Digitar apaga o erro DAQUELE campo: manter o 409 aceso enquanto a pessoa
    // corrige o número é dizer que o novo também está repetido, sem saber.
    setErros(SEM_ERRO);
  }

  async function enviar() {
    const resultado = await onSave(draft);
    setErros(resultado ?? SEM_ERRO);
  }

  return (
    <Modal
      title={isEdicao ? 'Editar entregador' : 'Novo entregador'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Salvando…' : isEdicao ? 'Salvar' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        ref={formRef}
        className="store-form"
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <label className="field">
          <span className="field__label">Nome</span>
          <input
            className="input"
            value={draft.name}
            maxLength={NOME_MAX}
            autoFocus
            onChange={(event) => editar({ name: event.target.value })}
            data-testid="courier-name"
          />
          {erros.campos.name ? (
            <span className="field__error-text" role="alert" data-testid="courier-name-error">
              {erros.campos.name}
            </span>
          ) : null}
        </label>

        <label className="field">
          <span className="field__label">Telefone</span>
          <input
            className="input tnum"
            inputMode="tel"
            value={draft.phone}
            onChange={(event) => editar({ phone: event.target.value })}
            data-testid="courier-phone"
          />
          {erros.campos.phone ? (
            <span className="field__error-text" role="alert" data-testid="courier-phone-error">
              {erros.campos.phone}
            </span>
          ) : (
            <span className="field__hint">
              É por ele que o entregador é reconhecido nesta filial — não pode repetir.
            </span>
          )}
        </label>

        {erros.geral ? (
          <p className="alert alert--error" role="alert" data-testid="courier-dialog-error">
            {erros.geral}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
