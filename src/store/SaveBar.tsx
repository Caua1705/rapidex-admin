/**
 * O rodapé de salvar, igual em todas as abas de Minha loja.
 *
 * Existe como peça única para que as quatro abas tenham o mesmo alvo no mesmo
 * lugar: o lojista aprende uma vez onde fica o botão. A confirmação "Salvo" é
 * texto e não toast — some sozinho na próxima edição, e um toast por cima do
 * formulário taparia justamente o campo que acabou de mudar.
 */
export function SaveBar({
  isSaving,
  isDirty,
  savedAt,
  errorMessage,
  onSave,
  onReset,
}: {
  isSaving: boolean;
  isDirty: boolean;
  savedAt: number | null;
  errorMessage: string | null;
  onSave: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="store-form__actions">
      {errorMessage ? (
        <p className="alert alert--error store-form__error" role="alert" data-testid="store-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="store-form__buttons">
        {/* Só aparece com algo para desfazer: um botão sempre visível e sempre
            inerte ensina o lojista a ignorar a linha inteira. */}
        {onReset && isDirty ? (
          <button type="button" className="btn" onClick={onReset} disabled={isSaving}>
            Descartar alterações
          </button>
        ) : null}

        {savedAt && !isDirty ? (
          <span className="faint store-form__saved" data-testid="store-saved">
            Alterações salvas.
          </span>
        ) : null}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={isSaving || !isDirty}
          onClick={onSave}
          data-testid="store-save"
        >
          {isSaving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
