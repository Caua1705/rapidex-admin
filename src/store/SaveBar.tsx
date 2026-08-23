import { useEffect, useState } from 'react';

import './SaveBar.css';

/** Quanto tempo a confirmação "Alterações salvas" fica na tela. */
const SAVED_NOTICE_MS = 4000;

/**
 * A barra de salvar de Minha loja.
 *
 * POR QUE ELA GRUDA NO RODAPÉ: as abas desta tela são formulários longos —
 * Filial tem endereço, coordenada e contato; Horários tem sete linhas. O botão
 * ficava no fim do documento, então quem editava um campo do meio e trocava de
 * aba perdia a alteração sem nunca ter visto que havia algo para salvar. Grudada
 * embaixo da área de conteúdo, ela acompanha a rolagem e o aviso chega antes da
 * perda.
 *
 * POR QUE ELA SÓ APARECE ÀS VEZES: uma barra permanente com um botão sempre
 * inerte é uma faixa que o olho aprende a pular — e aí ela não avisa mais nada
 * no dia em que houver mesmo o que salvar. Ela existe quando há:
 *   - alteração não salva (com Salvar e Descartar);
 *   - erro da última tentativa — some junto seria engolir a falha;
 *   - a confirmação recém-salva, por alguns segundos.
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
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (savedAt === null) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  // Enquanto há o que salvar, a confirmação da vez anterior não interessa: o
  // estado atual é "não salvo", e as duas frases juntas se contradiriam.
  const confirmacaoVisivel = showSaved && !isDirty;
  if (!isDirty && !errorMessage && !confirmacaoVisivel) return null;

  return (
    <div className="store-form__actions" data-testid="store-save-bar">
      {errorMessage ? (
        <p className="alert alert--error store-form__error" role="alert" data-testid="store-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="store-form__buttons">
        {confirmacaoVisivel ? (
          <span className="faint store-form__saved" data-testid="store-saved">
            Alterações salvas.
          </span>
        ) : null}

        {/* Só aparece com algo para desfazer: um botão sempre visível e sempre
            inerte ensina o lojista a ignorar a linha inteira. */}
        {onReset && isDirty ? (
          <button type="button" className="btn" onClick={onReset} disabled={isSaving}>
            Descartar alterações
          </button>
        ) : null}

        {isDirty ? (
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSaving}
            onClick={onSave}
            data-testid="store-save"
          >
            {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
